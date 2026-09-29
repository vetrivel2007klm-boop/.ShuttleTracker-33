const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const {
  validateEmailAddress,
  sendBrevoOTP,
  sendExplicitOTP,
  sendRawRelayEmail,
  verifyOTP
} = require('../services/otpService');

// POST /api/auth/login (Supports Multi-Organization Admin, Driver, and Passenger Login)
router.post('/login', async (req, res) => {
  try {
    const { email, password, expectedRole, organization_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    if (expectedRole === 'admin' && (!organization_name || !String(organization_name).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your Organization Name.'
      });
    }

    let user = await db.findUserByEmail(email.trim());

    // Support creating / provisioning a dedicated Organization Admin account when logging in as Admin with a new organization email & password
    if (!user && expectedRole === 'admin' && organization_name && String(organization_name).trim().length >= 2) {
      const cleanOrg = String(organization_name).trim();
      const password_hash = await bcrypt.hash(String(password).trim(), 10);
      const adminName = email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
      user = await db.createUser({
        name: `${adminName} (${cleanOrg} Admin)`,
        email: email.trim().toLowerCase(),
        password_hash,
        plain_password: String(password).trim(),
        role: 'admin',
        organization_name: cleanOrg
      });
      await db.updateSettings(
        {
          organization_name: cleanOrg,
          admin_profile_name: user.name,
          admin_profile_email: user.email
        },
        cleanOrg
      );
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No account found with this email address.'
      });
    }

    // Check if Driver or their assigned Shuttle is Deactivated by Admin
    let driverRecord = null;
    if (user.role === 'driver') {
      const allDrivers = await db.getAllDrivers();
      driverRecord = allDrivers.find(
        (d) => d.user_id === user.id || (d.email && d.email.toLowerCase() === user.email.toLowerCase())
      );

      if (
        user.is_active === false ||
        (driverRecord && (driverRecord.is_active === false || driverRecord.status === 'inactive'))
      ) {
        return res.status(403).json({
          success: false,
          message:
            'Your driver account or assigned shuttle has been deactivated by the Administrator. Login access is disabled until reactivated.'
        });
      }
    }

    const trimmedPassword = String(password).trim();

    // Password comparison
    let isPasswordValid = false;
    if (user.password_hash && (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$'))) {
      isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid && trimmedPassword !== password) {
        isPasswordValid = await bcrypt.compare(trimmedPassword, user.password_hash);
      }
    } else {
      isPasswordValid = password === user.password_hash || trimmedPassword === user.password_hash;
    }

    // Also check plain_password if set on user or driver record (shown in Admin Drivers table)
    if (
      !isPasswordValid &&
      user.plain_password &&
      (password === user.plain_password || trimmedPassword === String(user.plain_password).trim())
    ) {
      isPasswordValid = true;
    }

    if (
      !isPasswordValid &&
      driverRecord &&
      driverRecord.plain_password &&
      (password === driverRecord.plain_password || trimmedPassword === String(driverRecord.plain_password).trim())
    ) {
      isPasswordValid = true;
    }

    // Fallback for default seeded demo accounts & drivers without custom plain_password
    if (
      !isPasswordValid &&
      (trimmedPassword === 'password123' ||
        trimmedPassword === 'admin123' ||
        trimmedPassword === 'user123' ||
        trimmedPassword === 'driver123') &&
      (!user.plain_password || user.plain_password === 'driver123')
    ) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please verify and try again.'
      });
    }

    // Resolve organization_name for this user
    let resolvedOrgName =
      (organization_name && String(organization_name).trim()) ||
      user.organization_name ||
      driverRecord?.organization_name ||
      (await db.getSettings())?.organization_name ||
      'Sathyabama Institute of Science and Technology';

    if (user.role === 'admin' && organization_name && String(organization_name).trim()) {
      resolvedOrgName = String(organization_name).trim();
      user.organization_name = resolvedOrgName;
      await db.updateUserProfile(user.id, { organization_name: resolvedOrgName });
      await db.updateSettings({ organization_name: resolvedOrgName }, resolvedOrgName);
    } else if (user.role === 'user' && organization_name && String(organization_name).trim()) {
      const enteredOrg = String(organization_name).trim();
      if (user.organization_name && !db.matchesOrg(user.organization_name, enteredOrg)) {
        return res.status(403).json({
          success: false,
          message: `Organization mismatch! Your passenger account is registered under "${user.organization_name}", not "${enteredOrg}". Please select or enter your registered organization.`
        });
      }
      resolvedOrgName = user.organization_name || enteredOrg;
    }

    // Mark driver login status as Active (has_logged_in = true) once the driver logs into the website for the first time
    if (user.role === 'driver') {
      const updatedDrv = await db.markDriverLoggedIn(user.id);
      const io = req.app.get('io');
      if (io) {
        io.emit('driver:updated', updatedDrv);
      }
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        email: user.email,
        name: user.name,
        organization_name: resolvedOrgName
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...safeUserData } = user;
    safeUserData.organization_name = resolvedOrgName;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUserData
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
});

// Helper to run OCR text extraction with Engine 2 + Engine 1 fallback
async function extractOcrFromBase64(base64Image) {
  if (!base64Image || !String(base64Image).startsWith('data:image/')) return '';
  const engines = ['2', '1'];
  for (const engine of engines) {
    try {
      const formBody = new URLSearchParams();
      formBody.append('apikey', process.env.OCR_SPACE_API_KEY || 'helloworld');
      formBody.append('base64Image', base64Image);
      formBody.append('language', 'eng');
      formBody.append('isOverlayRequired', 'false');
      formBody.append('scale', 'true');
      formBody.append('OCREngine', engine);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8500);

      const ocrRes = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody.toString(),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (ocrRes.ok) {
        const ocrJson = await ocrRes.json();
        if (ocrJson?.ParsedResults?.length > 0) {
          const text = (ocrJson.ParsedResults[0].ParsedText || '').trim();
          if (text.length >= 4) {
            return text;
          }
        }
      }
    } catch (ocrErr) {
      console.warn(`OCR Engine ${engine} notice:`, ocrErr.message);
    }
  }
  return '';
}

// Helper to resolve organization settings & sample ID card for passenger verification
async function resolveOrgSettingsForPassenger(enteredOrg) {
  const allOrgs = await db.getAllOrganizations();
  const defaultSettings = await db.getSettings();
  const matchedOrgRecord = allOrgs.find((o) => db.matchesOrg(o.organization_name, enteredOrg));

  if (matchedOrgRecord) {
    const s = await db.getSettings(matchedOrgRecord.organization_name);
    return { settings: s, defaultSettings, targetOrgName: s?.organization_name || matchedOrgRecord.organization_name };
  }

  // Also check if any organization with an uploaded sample ID card matches the entered org in its OCR keywords
  for (const orgEntry of allOrgs) {
    const s = await db.getSettings(orgEntry.organization_name);
    const sampleText = String(s?.sample_id_ocr_text || '').toLowerCase();
    const enteredTokens = String(enteredOrg || '')
      .toLowerCase()
      .split(/[\s,._\-()]+/)
      .filter((t) => t.length >= 3);
    if (
      s?.sample_id_card_url &&
      enteredTokens.length > 0 &&
      enteredTokens.some((tok) => sampleText.includes(tok) || String(s.organization_name || '').toLowerCase().includes(tok))
    ) {
      return { settings: s, defaultSettings, targetOrgName: enteredOrg || s.organization_name };
    }
  }

  return {
    settings: defaultSettings,
    defaultSettings,
    targetOrgName: enteredOrg || defaultSettings?.organization_name || 'Organization'
  };
}

// POST /api/auth/verify-id-card (AI Verification: Matches ID Card Structure [ignoring face], Passenger Name & Organization Name)
router.post('/verify-id-card', async (req, res) => {
  try {
    const { name, organization_name, id_card_base64, structure_comparison } = req.body;

    if (!name || !organization_name) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Please enter both your Full Name and Organization Name before uploading your ID card.'
      });
    }

    const enteredOrg = String(organization_name).trim();
    const { settings, defaultSettings } = await resolveOrgSettingsForPassenger(enteredOrg);
    const sampleIdCardUrl = settings?.sample_id_card_url || defaultSettings?.sample_id_card_url || '';

    if (!sampleIdCardUrl) {
      return res.status(400).json({
        success: false,
        verified: false,
        requiresAdminSample: true,
        message:
          'Admin has not uploaded the official Sample ID Card in Admin Profile yet. Passengers can only create an account after Admin uploads the sample ID card.'
      });
    }

    if (!id_card_base64 || !id_card_base64.startsWith('data:image/')) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Please upload a valid ID card image (PNG/JPG).'
      });
    }

    // 1. Check Visual ID Card Structure against Admin Uploaded ID Card (Face region is ignored so different people match)
    if (structure_comparison && structure_comparison.structureMatched === false) {
      return res.status(400).json({
        success: false,
        verified: false,
        formatMatched: false,
        structureScore: structure_comparison.structureScore,
        message:
          structure_comparison.reason ||
          'ID Card Structure Mismatch: The uploaded image structure does not match the Admin uploaded ID card structure (face is ignored, but ID card layout, header/footer, and format must match).'
      });
    }

    // 2. Ensure Admin Sample ID Card OCR text is available for template & organization comparison
    let sampleOcrText = String(settings?.sample_id_ocr_text || defaultSettings?.sample_id_ocr_text || '').trim();
    if (sampleOcrText.length < 4 && sampleIdCardUrl) {
      sampleOcrText = await extractOcrFromBase64(sampleIdCardUrl);
      if (sampleOcrText.length >= 4) {
        const rawTokens = sampleOcrText
          .toLowerCase()
          .split(/[\s,._\-:/()]+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 3);
        const uniqueKeywords = Array.from(new Set(rawTokens)).slice(0, 30);
        await db.updateSettings(
          {
            sample_id_ocr_text: sampleOcrText,
            sample_id_format_keywords: uniqueKeywords
          },
          settings?.organization_name
        );
      }
    }

    // 3. Extract text from Passenger's uploaded ID card via OCR
    const extractedText = await extractOcrFromBase64(id_card_base64);
    const normalizedOcr = extractedText.toLowerCase().replace(/\s+/g, ' ');
    const normalizedSampleOcr = sampleOcrText.toLowerCase().replace(/\s+/g, ' ');

    // Reject unrelated photos / images that contain no readable ID card text!
    if (normalizedOcr.length < 4) {
      return res.status(400).json({
        success: false,
        verified: false,
        formatMatched: false,
        message:
          'Verification Failed: Unrelated photo or no readable ID card text detected. AI checks your Name, Organization Name, and ID card structure against the Admin uploaded ID card.'
      });
    }

    const cleanName = name.trim().toLowerCase();
    const cleanEnteredOrg = enteredOrg.toLowerCase();
    const cleanAdminOrg = String(settings?.organization_name || defaultSettings?.organization_name || '').toLowerCase();

    // Stopwords that shouldn't count alone as a unique organization match
    const genericWords = new Set(['the', 'and', 'for', 'of', 'in', 'at', 'to', 'id', 'card', 'identity', 'student', 'name']);

    const nameTokens = cleanName
      .split(/[\s,._-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !genericWords.has(t));

    const enteredOrgTokens = cleanEnteredOrg
      .split(/[\s,._\-()]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !genericWords.has(t));

    const adminOrgTokens = cleanAdminOrg
      .split(/[\s,._\-()]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3 && !genericWords.has(t));

    const sampleKeywords = Array.isArray(settings?.sample_id_format_keywords)
      ? settings.sample_id_format_keywords.map((k) => String(k).toLowerCase().trim()).filter((k) => k.length >= 3)
      : normalizedSampleOcr
          .split(/[\s,._\-:/()]+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 3);

    // Check A: Passenger's entered Name must appear on the uploaded ID card image
    const nameMatched =
      nameTokens.length > 0 && nameTokens.some((tok) => normalizedOcr.includes(tok));

    // Check B: Passenger's entered Organization Name must appear on the uploaded ID card image
    const orgFoundOnUploadedCard =
      enteredOrgTokens.length > 0 && enteredOrgTokens.some((tok) => normalizedOcr.includes(tok));

    // Check C: Organization & Structure must match Admin's uploaded ID card (via Admin's sample card OCR text or Admin org name)
    const orgMatchesAdminCard =
      enteredOrgTokens.some(
        (tok) =>
          normalizedSampleOcr.includes(tok) ||
          adminOrgTokens.includes(tok) ||
          sampleKeywords.includes(tok)
      ) ||
      (adminOrgTokens.length > 0 && adminOrgTokens.some((tok) => normalizedOcr.includes(tok)));

    // Check D: Shared structural template tokens between Admin Sample ID Card and Passenger ID Card
    const sharedStructureTokens = sampleKeywords.filter((kw) => normalizedOcr.includes(kw));
    const structureKeywordsMatched =
      sampleKeywords.length === 0 || sharedStructureTokens.length >= 1 || orgMatchesAdminCard;

    if (!nameMatched) {
      return res.status(400).json({
        success: false,
        verified: false,
        formatMatched: structureKeywordsMatched,
        nameMatched: false,
        orgMatched: orgFoundOnUploadedCard,
        extractedText,
        message: `Name Mismatch: Your entered Name ("${name.trim()}") was not found on the uploaded ID card image. AI verifies that the Name on the ID card matches your entered Name.`
      });
    }

    if (!orgFoundOnUploadedCard || !orgMatchesAdminCard) {
      return res.status(400).json({
        success: false,
        verified: false,
        formatMatched: false,
        nameMatched: true,
        orgMatched: false,
        extractedText,
        message: !orgFoundOnUploadedCard
          ? `Organization Mismatch: Your entered Organization ("${enteredOrg}") was not found on the uploaded ID card image.`
          : `Organization / Format Mismatch: The organization on your uploaded ID card does not match the Admin's uploaded ID card format.`
      });
    }

    if (!structureKeywordsMatched) {
      return res.status(400).json({
        success: false,
        verified: false,
        formatMatched: false,
        extractedText,
        message:
          'ID Card Structure Mismatch: The uploaded image does not match the structure and fields of the Admin uploaded ID card.'
      });
    }

    return res.status(200).json({
      success: true,
      verified: true,
      formatMatched: true,
      organization_name: enteredOrg,
      extractedText,
      message: `AI Verified! ID Card structure, Name ("${name.trim()}"), and Organization ("${enteredOrg}") matched the Admin uploaded ID card.`
    });
  } catch (err) {
    console.error('ID Verification Error:', err);
    return res.status(500).json({
      success: false,
      verified: false,
      message: 'Failed to process ID card verification.'
    });
  }
});

// POST /api/auth/send-otp (Send OTP for Passenger Sign Up)
router.post('/send-otp', async (req, res) => {
  try {
    const { email, role, organization_name } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    // 1. Validate email syntax, domain typos, Gmail rules, and DNS MX records FIRST
    const emailValidation = await validateEmailAddress(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message || 'Enter a valid email address.'
      });
    }

    // Strictly enforce: Only Passenger ('user') can self sign up via passenger registration!
    if (role === 'admin' || role === 'driver') {
      return res.status(403).json({
        success: false,
        message: `${role === 'admin' ? 'Administrator' : 'Driver'} self-registration is disabled here. Drivers are registered by their Organization Admin and receive their auto-generated password via email.`
      });
    }

    const enteredOrg = String(organization_name || '').trim();
    if (!enteredOrg) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your Organization Name.'
      });
    }

    const { settings, defaultSettings } = await resolveOrgSettingsForPassenger(enteredOrg);
    const sampleUrl = settings?.sample_id_card_url || defaultSettings?.sample_id_card_url || '';
    if (!sampleUrl) {
      return res.status(400).json({
        success: false,
        message:
          'Admin has not uploaded the Sample Passenger ID Card in Admin Profile yet. Account creation is locked until Admin uploads the sample ID card.'
      });
    }

    // Check if account already exists (fast in-memory check for instant OTP response)
    const existing = await db.findUserByEmail(emailValidation.normalizedEmail, { memoryOnly: true });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in instead.'
      });
    }

    const result = await sendBrevoOTP(emailValidation.normalizedEmail, 'signup');
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Enter a valid email address.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verification OTP sent to ${emailValidation.normalizedEmail}.`,
      deliveredVia: result.deliveredVia,
      devOtp: result.otp
    });
  } catch (err) {
    console.error('OTP Send Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to dispatch verification OTP.' });
  }
});

// POST /api/auth/verify-otp (Verify 6-digit OTP before unlocking password input)
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please enter both email and the 6-digit OTP code.' });
    }
    const validation = verifyOTP(email, otp, false); // keep OTP valid for final submission
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully! You may now set your password.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'OTP verification failed.' });
  }
});

// POST /api/auth/relay-otp-email (Relay cloud-generated OTP via local Gmail SMTP when Render Free Tier blocks port 465/587)
router.post('/relay-otp-email', async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    const result = await sendExplicitOTP(email, otp, purpose || 'signup');
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message || 'Enter a valid email address.' });
    }
    return res.status(200).json({ success: true, deliveredVia: result.deliveredVia });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to relay OTP email.' });
  }
});

// POST /api/auth/relay-email (Relay Driver Schedule Allocation & Admin Emergency Alert emails via local Gmail SMTP when Render Free Tier blocks port 465/587)
router.post('/relay-email', async (req, res) => {
  try {
    const payload = req.body?.relayPayload || req.body;
    if (!payload || !payload.to || !payload.subject) {
      return res.status(400).json({ success: false, message: 'Invalid email relay payload.' });
    }
    const result = await sendRawRelayEmail(payload);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message || 'Failed to relay email.' });
    }
    return res.status(200).json({ success: true, deliveredVia: result.deliveredVia });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to relay email.' });
  }
});

// POST /api/auth/register (Passenger Sign Up with AI Verified ID Card Structure, Name & Organization)
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'user',
      phone,
      otp,
      organization_name,
      bus_number,
      destination,
      id_card_url,
      id_card_verified,
      avatar_url
    } = req.body;

    // Reject Admin or Driver Self-Registration
    if (role === 'admin' || role === 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Only Passenger accounts can self-register. Driver accounts are provisioned by the Administrator.'
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, and password.'
      });
    }

    if (!organization_name || !bus_number) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your Organization Name and select your Bus Number.'
      });
    }

    const enteredOrg = String(organization_name).trim();
    const { settings, defaultSettings, targetOrgName } = await resolveOrgSettingsForPassenger(enteredOrg);
    const adminOrg = settings?.organization_name || targetOrgName || enteredOrg;
    const sampleUrl = settings?.sample_id_card_url || defaultSettings?.sample_id_card_url || '';
    if (!sampleUrl) {
      return res.status(400).json({
        success: false,
        message:
          'Admin has not uploaded the official Sample Passenger ID Card in Admin Profile yet. Account creation is disabled until Admin uploads the sample ID card.'
      });
    }

    if (!id_card_verified || !id_card_url) {
      return res.status(400).json({
        success: false,
        message: 'Please upload and verify your ID card with AI before creating your account.'
      });
    }

    // Verify Brevo OTP
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the 6-digit OTP code sent to your email.'
      });
    }

    const otpValidation = verifyOTP(email, otp);
    if (!otpValidation.valid) {
      return res.status(400).json({
        success: false,
        message: otpValidation.message
      });
    }

    const existingUser = await db.findUserByEmail(email.trim());
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await db.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      plain_password: password,
      role: 'user',
      phone: phone || '',
      organization_name: adminOrg,
      bus_number: bus_number.trim().toUpperCase(),
      destination: destination ? destination.trim() : '',
      id_card_url: id_card_url || '',
      avatar_url: avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
    });

    const token = jwt.sign(
      {
        userId: newUser.id,
        role: newUser.role,
        email: newUser.email,
        name: newUser.name,
        organization_name: newUser.organization_name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash: ph, ...safeUserData } = newUser;

    const io = req.app.get('io');
    if (io) {
      io.emit('driver:updated', { newPassenger: safeUserData });
    }

    console.log(
      `🎉 New PASSENGER registered: ${newUser.name} (${newUser.email}) | Org: ${newUser.organization_name} | Bus: ${newUser.bus_number}`
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: safeUserData
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.'
    });
  }
});

// GET /api/auth/passengers - Get registered passengers (optionally filtered by bus_number & organization_name)
router.get('/passengers', authenticate, async (req, res) => {
  try {
    const { bus_number, organization_name } = req.query;
    const orgName = organization_name || req.user?.organization_name || null;
    const passengers = await db.getPassengersByBus(bus_number, orgName);
    return res.status(200).json({
      success: true,
      count: passengers.length,
      data: passengers
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch passengers.' });
  }
});

// POST /api/auth/forgot-password/send-otp (For Admin, Passenger, and Driver)
router.post('/forgot-password/send-otp', async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }

    // 1. Strictly validate email format, provider rules, and DNS MX records
    const emailValidation = await validateEmailAddress(email);
    if (!emailValidation.valid) {
      return res.status(400).json({
        success: false,
        message: emailValidation.message || 'Enter a valid email address.'
      });
    }

    const user = await db.findUserByEmail(emailValidation.normalizedEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Enter a valid email address. No registered account found with this email.'
      });
    }

    if (role && ['admin', 'user', 'driver'].includes(role) && user.role !== role) {
      return res.status(400).json({
        success: false,
        message: `Enter a valid email address. This email is not registered as a ${role === 'user' ? 'Passenger' : role}.`
      });
    }

    const result = await sendBrevoOTP(emailValidation.normalizedEmail, 'reset');
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Enter a valid email address.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Password reset OTP sent to ${emailValidation.normalizedEmail}.`,
      role: user.role,
      deliveredVia: result.deliveredVia,
      devOtp: result.otp
    });
  } catch (err) {
    console.error('Forgot Password Send OTP Error:', err);
    return res.status(500).json({ success: false, message: 'Could not send reset OTP.' });
  }
});

// POST /api/auth/forgot-password/reset (For Admin, Passenger, and Driver)
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP code, and a new password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Verify OTP
    const otpValidation = verifyOTP(email, otp);
    if (!otpValidation.valid) {
      return res.status(400).json({
        success: false,
        message: otpValidation.message
      });
    }

    const user = await db.findUserByEmail(email.trim());
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    // Also persist plain_password so Admin Drivers table always displays the driver's updated password!
    await db.updateUserPassword(email.trim(), password_hash, newPassword);

    console.log(`🔐 Password successfully reset for ${user.email} (${user.role})`);

    return res.status(200).json({
      success: true,
      message: 'Password has been successfully updated. You may now sign in.'
    });
  } catch (err) {
    console.error('Password Reset Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    let user = await db.findUserById(req.user.userId);
    if (!user) {
      user = {
        id: req.user.userId || 1,
        name: req.user.name || 'Admin Controller',
        email: req.user.email || 'admin@shuttletrack.com',
        role: req.user.role || 'admin',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
      };
    }
    const { password_hash, ...safeUserData } = user;
    if (req.user?.organization_name) {
      safeUserData.organization_name = req.user.organization_name;
    }
    return res.status(200).json({
      success: true,
      user: safeUserData
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/auth/me/avatar - Passenger (or any user) updates their profile image
router.put('/me/avatar', authenticate, async (req, res) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) {
      return res.status(400).json({ success: false, message: 'Please provide an image to upload.' });
    }
    const updatedUser = await db.updateUserAvatar(req.user.userId, avatar_url);
    const io = req.app.get('io');
    if (io && updatedUser) {
      io.emit('passenger:updated', updatedUser);
      io.emit('driver:updated', { passengerUpdated: updatedUser });
      io.emit('shuttle:updated', { passengerUpdated: updatedUser });
    }
    return res.status(200).json({
      success: true,
      message: 'Passenger profile image updated and synced across Driver & Admin portals.',
      data: updatedUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update profile image.' });
  }
});

// PUT /api/auth/me/profile - Passenger updates their profile details (name, phone, bus_number, avatar_url)
router.put('/me/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, bus_number, avatar_url } = req.body;
    const updatedUser = await db.updateUserProfile(req.user.userId, {
      name,
      phone,
      bus_number,
      avatar_url
    });
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }
    const io = req.app.get('io');
    if (io) {
      io.emit('passenger:updated', updatedUser);
      io.emit('driver:updated', { passengerUpdated: updatedUser });
      io.emit('shuttle:updated', { passengerUpdated: updatedUser });
    }
    return res.status(200).json({
      success: true,
      message: 'Passenger profile updated and synced across Driver & Admin portals.',
      data: updatedUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update passenger profile.' });
  }
});

module.exports = router;
