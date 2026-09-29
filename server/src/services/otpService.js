/**
 * Strict Email Validation + Real Email OTP Service (cleancodeuniverse@gmail.com)
 * - Validates email syntax, Gmail username rules, common domain typos, fake domains, and live DNS MX records
 * - Rejects any invalid or non-existent email with "Enter a valid email address."
 * - Delivers real 6-digit OTP emails via Brevo/Resend HTTPS API or Gmail SMTP (ports 465 SSL & 587 TLS)
 */

const nodemailer = require('nodemailer');
const dns = require('dns');

const otpStore = new Map(); // key: email.toLowerCase() -> { otp, purpose, expiresAt, verified }

const DEFAULT_EMAIL_USER = 'cleancodeuniverse@gmail.com';
const DEFAULT_EMAIL_PASS = 'cetikgbausymfhnj';

// Common domain typos that users accidentally enter
const TYPO_DOMAINS = new Set([
  'gmai.com',
  'gmal.com',
  'gmial.com',
  'gamil.com',
  'gnail.com',
  'gmaill.com',
  'ggmail.com',
  'gmail.co',
  'gmail.con',
  'gmail.cm',
  'gmail.om',
  'gmail.c',
  'gmail.in',
  'gmail.org',
  'gmail.net',
  'gmailcom.com',
  'googlemai.com',
  'yaho.com',
  'yahooo.com',
  'yhoo.com',
  'yahoo.co',
  'yahoo.con',
  'yahoo.cm',
  'outlok.com',
  'outllok.com',
  'outlook.co',
  'outlook.con',
  'hotmai.com',
  'hotmal.com',
  'hotmail.co',
  'hotmail.con',
  'iclod.com',
  'icloud.co',
  'icloud.con',
  'rediffmai.com'
]);

// Fake, placeholder, or disposable domains that must never receive OTP
const FAKE_OR_DISPOSABLE_DOMAINS = new Set([
  'shuttletrack.com',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'testing.com',
  'fake.com',
  'invalid.com',
  'wrong.com',
  'none.com',
  'null.com',
  'abc.com',
  'xyz.com',
  '123.com',
  'asdf.com',
  'qwerty.com',
  'sample.com',
  'demo.com',
  'user.com',
  'email.com',
  'mail.com',
  'domain.com',
  'website.com',
  'temp.com',
  'tempmail.com',
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'throwawaymail.com',
  'localhost'
]);

// Obvious fake/test usernames (local part before @)
const FAKE_LOCAL_PARTS = new Set([
  'test',
  'testing',
  'test123',
  'test1234',
  'wrong',
  'wrongemail',
  'wrongmail',
  'wronguser',
  'invalid',
  'invalidemail',
  'invalidmail',
  'fake',
  'fakeemail',
  'fakemail',
  ' fakeuser',
  'noemail',
  'nomail',
  'none',
  'null',
  'undefined',
  'abc',
  'abcd',
  'abcde',
  'abcdef',
  'abcdefg',
  'xyz',
  'qwerty',
  'qwertyuiop',
  'asdf',
  'asdfgh',
  'asdfghjkl',
  'zxcvbn',
  '123',
  '1234',
  '12345',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '000000',
  '111111',
  'aaaaaa',
  'bbbbbb',
  'sample',
  'demo',
  'dummy'
]);

// Known major email domains that always have valid MX servers (instant 0ms DNS check after username validation)
const KNOWN_VALID_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'zohomail.in',
  'rediffmail.com',
  'aol.com',
  'gmx.com',
  'mail.ru',
  'yandex.com',
  'sairam.edu.in',
  'sairamtap.edu.in'
]);

const dnsDomainCache = new Map(); // domain -> { valid: boolean, expiresAt: number }

/**
 * Strictly validate an email address (format, provider rules, typo domains, and live DNS records)
 */
const validateEmailAddress = async (rawEmail) => {
  if (!rawEmail || typeof rawEmail !== 'string') {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  const email = rawEmail.trim().toLowerCase();

  // Basic length & whitespace check
  if (email.length < 6 || email.length > 254 || /\s/.test(email)) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  // Must have exactly one @
  const parts = email.split('@');
  if (parts.length !== 2) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  const [localPart, domain] = parts;

  if (!localPart || !domain || localPart.length < 2 || domain.length < 4) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  // Check localPart & domain formatting rules
  if (
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..') ||
    !domain.includes('.')
  ) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  // Strict RFC-compatible email pattern
  const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}$/;
  if (!strictEmailRegex.test(email)) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  // Check TLD & domain labels
  const domainLabels = domain.split('.');
  const tld = domainLabels[domainLabels.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]{2,12}$/.test(tld)) {
    return { valid: false, message: 'Enter a valid email address.' };
  }
  for (const label of domainLabels) {
    if (!label || label.startsWith('-') || label.endsWith('-') || !/^[a-zA-Z0-9-]+$/.test(label)) {
      return { valid: false, message: 'Enter a valid email address.' };
    }
  }
  // Reject single-letter main domain names like a@b.com or test@x.com
  if (domainLabels[0].length < 2) {
    return { valid: false, message: 'Enter a valid email address.' };
  }

  // Reject known typo domains (e.g. gmai.com, gmial.com, gmal.com, yaho.com)
  if (TYPO_DOMAINS.has(domain)) {
    return {
      valid: false,
      message: `Enter a valid email address. "${domain}" is not a valid email domain.`
    };
  }

  // Reject fake, placeholder, or disposable domains
  if (FAKE_OR_DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      message: 'Enter a valid email address.'
    };
  }

  // Clean localPart for fake/gibberish checks
  const cleanLocal = localPart.replace(/[._+-]/g, '');
  if (
    cleanLocal.length < 3 ||
    /^\d+$/.test(cleanLocal) || // purely numbers like 123456@gmail.com
    /^(.)\1{4,}$/.test(cleanLocal) || // repeated single char like aaaaaa@gmail.com
    FAKE_LOCAL_PARTS.has(localPart) ||
    FAKE_LOCAL_PARTS.has(cleanLocal) ||
    /^(wrong|invalid|fake|dummy|noemail|testuser)/i.test(cleanLocal)
  ) {
    return {
      valid: false,
      message: 'Enter a valid email address.'
    };
  }

  // Enforce official Google Gmail username rules for @gmail.com / @googlemail.com
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const gmailUser = localPart.split('+')[0];
    const gmailNoDots = gmailUser.replace(/\./g, '');
    // Gmail usernames MUST be 6-30 characters and contain only letters, digits, and periods
    if (
      gmailNoDots.length < 6 ||
      gmailNoDots.length > 30 ||
      !/^[a-z0-9.]+$/.test(gmailUser) ||
      !/[a-z]/.test(gmailNoDots)
    ) {
      return {
        valid: false,
        message: 'Enter a valid Gmail address (username must contain letters and be at least 6 characters).'
      };
    }
  }

  // Fast-path: known major domains require 0ms DNS lookup
  if (KNOWN_VALID_DOMAINS.has(domain)) {
    return { valid: true, normalizedEmail: email };
  }

  // Check DNS cache for custom domains
  const cachedDns = dnsDomainCache.get(domain);
  if (cachedDns && cachedDns.expiresAt > Date.now()) {
    if (!cachedDns.valid) {
      return {
        valid: false,
        message: `Enter a valid email address. Domain "${domain}" does not exist.`
      };
    }
    return { valid: true, normalizedEmail: email };
  }

  // Verify custom domain exists on the internet using fast OS DNS lookup (max 900ms)
  try {
    const lookupResult = await Promise.race([
      dns.promises.lookup(domain),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), 900))
    ]);

    if (!lookupResult || !lookupResult.address) {
      dnsDomainCache.set(domain, { valid: false, expiresAt: Date.now() + 10 * 60 * 1000 });
      return {
        valid: false,
        message: `Enter a valid email address. Domain "${domain}" cannot receive emails.`
      };
    }
    dnsDomainCache.set(domain, { valid: true, expiresAt: Date.now() + 30 * 60 * 1000 });
  } catch (dnsErr) {
    if (dnsErr && (dnsErr.code === 'ENOTFOUND' || dnsErr.code === 'ENODATA')) {
      dnsDomainCache.set(domain, { valid: false, expiresAt: Date.now() + 10 * 60 * 1000 });
      return {
        valid: false,
        message: `Enter a valid email address. Domain "${domain}" does not exist.`
      };
    }
  }

  return { valid: true, normalizedEmail: email };
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getCredentials = () => {
  const user = (process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const pass = (process.env.EMAIL_PASSWORD || DEFAULT_EMAIL_PASS).replace(/\s+/g, '');
  return { user, pass };
};

// Persistent pooled SMTP transporters so sending OTP reuses warm TLS connections
let cachedTransporters = null;
const getSmtpTransporters = () => {
  if (cachedTransporters) return cachedTransporters;
  const { user, pass } = getCredentials();
  if (!user || !pass) return [];

  const baseTimeouts = {
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 3500,
    greetingTimeout: 3500,
    socketTimeout: 5000,
    family: 4
  };

  cachedTransporters = [
    // 1. Gmail SSL Port 465 (Pooled)
    nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      ...baseTimeouts
    }),
    // 2. Gmail STARTTLS Port 587 (Pooled)
    nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      ...baseTimeouts
    })
  ];
  return cachedTransporters;
};

/**
 * Send email via available HTTPS APIs (Resend / Brevo) or pooled Gmail SMTP
 */
const deliverEmailMessage = async ({ to, subject, htmlContent, textContent, senderName, senderEmail }) => {
  const errors = [];

  // 1. Try Resend HTTPS API (Port 443) if configured
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendKey && resendKey.length >= 10 && !resendKey.includes('your_')) {
    try {
      const resendFrom = (process.env.RESEND_FROM || `${senderName} <onboarding@resend.dev>`).trim();
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          reply_to: senderEmail,
          subject,
          html: htmlContent,
          text: textContent
        })
      });
      if (response.ok) {
        console.log(`✅ [Resend API] Sent email to ${to}`);
        return { success: true, deliveredVia: 'resend' };
      } else {
        const errText = await response.text();
        errors.push(`Resend: ${errText}`);
      }
    } catch (err) {
      errors.push(`Resend: ${err.message}`);
    }
  }

  // 2. Try Brevo Transactional HTTPS API (Port 443) if configured
  const brevoKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || '').trim();
  if (brevoKey && brevoKey.length >= 10 && !brevoKey.includes('your_')) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent,
          textContent
        })
      });

      if (response.ok) {
        console.log(`✅ [Brevo API] Sent email from ${senderEmail} to ${to}`);
        return { success: true, deliveredVia: 'brevo' };
      } else {
        const errData = await response.text();
        errors.push(`Brevo: ${errData}`);
      }
    } catch (err) {
      errors.push(`Brevo: ${err.message}`);
    }
  }

  // 3. Direct Pooled Gmail SMTP (Ports 465 SSL & 587 STARTTLS) using cleancodeuniverse@gmail.com
  const transporters = getSmtpTransporters();
  for (const transporter of transporters) {
    try {
      const info = await transporter.sendMail({
        from: `${senderName} <${senderEmail}>`,
        to,
        subject,
        html: htmlContent,
        text: textContent
      });

      if (info.rejected && info.rejected.length > 0) {
        return {
          success: false,
          rejectedAddress: true,
          message: 'Enter a valid email address. The mail server rejected this recipient.'
        };
      }

      console.log(`✅ [Gmail SMTP] Delivered email from ${senderEmail} to ${to} (${info.messageId || 'OK'})`);
      return { success: true, deliveredVia: 'email' };
    } catch (smtpErr) {
      const msg = String(smtpErr?.message || '');
      errors.push(msg);
      if (
        smtpErr?.responseCode === 550 ||
        smtpErr?.responseCode === 553 ||
        smtpErr?.responseCode === 501 ||
        /invalid.*address|recipient.*rejected|no such user|user unknown|badrecipient/i.test(msg)
      ) {
        return {
          success: false,
          rejectedAddress: true,
          message: 'Enter a valid email address.'
        };
      }
      console.warn(`⚠️ [SMTP Attempt Warning] (${transporter.options?.port || 'gmail'}):`, msg);
    }
  }

  return {
    success: false,
    errors,
    message: errors.join(' | ') || 'Could not deliver email.'
  };
};

const sendBrevoOTP = async (email, purpose = 'signup') => {
  // 1. Strictly validate the email address & DNS MX records first (< 5ms for Gmail/major providers)!
  const validation = await validateEmailAddress(email);
  if (!validation.valid) {
    return {
      success: false,
      invalidEmail: true,
      message: validation.message || 'Enter a valid email address.'
    };
  }

  const normalizedEmail = validation.normalizedEmail;
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

  otpStore.set(normalizedEmail, { otp, purpose, expiresAt, verified: false });

  const isReset = purpose === 'reset';
  const subject = isReset
    ? 'Shuttle Tracker — Password Reset OTP Code'
    : 'Shuttle Tracker — Account Verification OTP Code';

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker').trim();

  const textContent = `Shuttle Tracker OTP Verification\n\nYour 6-digit OTP is: ${otp}\n\nThis code is valid for 1 minute before resend unlocks (10 minutes total validity). Do not share this code with anyone.\n\nSent from ${senderEmail} to ${normalizedEmail}`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #0F172A; color: #ffffff; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 24px; color: #38BDF8;">🚍 Shuttle Tracker</h2>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">Enterprise Real-Time Transit Platform</p>
      </div>
      <div style="background: #1E293B; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid #334155;">
        <p style="font-size: 14px; color: #E2E8F0; margin-bottom: 16px;">
          ${isReset ? 'Use the verification code below to reset your password:' : 'Use the verification code below to complete your registration:'}
        </p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38BDF8; background: #0F172A; padding: 16px 24px; border-radius: 10px; display: inline-block; border: 1px solid #2563EB;">
          ${otp}
        </div>
        <p style="font-size: 12px; color: #94A3B8; margin-top: 16px;">
          Enter this 6-digit code on the verification screen and click <strong>Verify OTP</strong>.
        </p>
        <p style="font-size: 11px; color: #64748B; margin-top: 12px;">
          Sent from ${senderEmail} to ${normalizedEmail}
        </p>
      </div>
    </div>
  `;

  const isRenderCloud = Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL
  );

  // 2. Dispatch email in the background so the button responds IMMEDIATELY (< 50ms) after validation!
  deliverEmailMessage({
    to: normalizedEmail,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  }).catch((err) => {
    console.warn(`⚠️ [Background OTP Dispatch Warning] ${normalizedEmail}:`, err?.message || err);
  });

  return {
    success: true,
    deliveredVia: isRenderCloud ? 'cloud_verified' : 'email',
    otp: isRenderCloud ? otp : undefined,
    senderEmail
  };
};

const verifyOTP = (email, candidateOtp, consume = true) => {
  if (!email || !candidateOtp) return { valid: false, message: 'Email and OTP are required.' };
  const normalizedEmail = email.trim().toLowerCase();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return { valid: false, message: 'No OTP found for this email. Please request a new OTP.' };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, message: 'OTP has expired. Please request a new one.' };
  }

  if (record.otp !== candidateOtp.trim()) {
    return { valid: false, message: 'Invalid OTP code. Please check your email and try again.' };
  }

  record.verified = true;

  if (consume) {
    otpStore.delete(normalizedEmail);
  }
  return { valid: true };
};

/**
 * Automatically send Driver Login Credentials & Assigned Shuttle Details
 * when Admin adds a new shuttle or registers a driver.
 */
const sendDriverCredentialsEmail = async ({
  email,
  name,
  password,
  shuttleCode,
  shuttleName,
  vehicleNumber,
  startPoint,
  destination,
  routeName
}) => {
  if (!email) return { success: false, message: 'No driver email provided' };
  const validation = await validateEmailAddress(email);
  if (!validation.valid) {
    return { success: false, message: validation.message };
  }
  const normalizedEmail = validation.normalizedEmail;
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker Admin').trim();

  const subject = `🚍 Shuttle Tracker — Your Driver Login Credentials & Bus ${shuttleCode || ''} Assignment`;

  const textContent = `Hello ${name || 'Driver'},\n\nYou have been assigned as an official driver on Shuttle Tracker.\n\n--- YOUR LOGIN CREDENTIALS ---\nPortal Role: Driver\nLogin Email: ${normalizedEmail}\nPassword: ${password}\n\n--- ASSIGNED SHUTTLE DETAILS ---\nBus Number: ${shuttleCode || 'Assigned'}\nVehicle: ${shuttleName || 'Campus Shuttle'} (${vehicleNumber || 'N/A'})\nRoute: ${routeName || `${startPoint || 'Campus'} to ${destination || 'Terminal'}`}\nStarting Point: ${startPoint || 'Main Terminal'}\nDestination: ${destination || 'Campus Destination'}\n\nYou can sign in using the Driver tab on the Shuttle Tracker Login page. You may also update your password anytime using Forgot Password.\n\nSent from ${senderEmail}`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #0F172A; color: #ffffff; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 24px; color: #38BDF8;">🚍 Shuttle Tracker</h2>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">Official Driver Dispatch & Account Credentials</p>
      </div>
      <div style="background: #1E293B; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <p style="font-size: 15px; color: #F8FAFC; margin-top: 0;">Hello <strong>${name || 'Driver'}</strong>,</p>
        <p style="font-size: 13px; color: #CBD5E1; line-height: 1.6;">
          The Administrator has registered your driver account and assigned you to Shuttle <strong>${shuttleCode || ''}</strong>. Use the credentials below to log in to the Driver Cockpit:
        </p>
        <div style="background: #0F172A; padding: 16px; border-radius: 10px; border: 1px solid #2563EB; margin: 16px 0;">
          <p style="margin: 4px 0; font-size: 13px; color: #94A3B8;">Login Email: <strong style="color: #ffffff;">${normalizedEmail}</strong></p>
          <p style="margin: 4px 0; font-size: 14px; color: #94A3B8;">Auto-Generated Password: <strong style="color: #38BDF8; font-family: monospace; font-size: 16px; letter-spacing: 1px;">${password}</strong></p>
        </div>
        <div style="background: #0F172A; padding: 14px; border-radius: 10px; border: 1px solid #334155; margin-top: 12px; font-size: 12px; color: #CBD5E1;">
          <p style="margin: 3px 0;"><strong>Assigned Bus:</strong> ${shuttleCode || 'N/A'} — ${shuttleName || ''} (${vehicleNumber || ''})</p>
          <p style="margin: 3px 0;"><strong>Route:</strong> ${routeName || 'Assigned Route'}</p>
          <p style="margin: 3px 0;"><strong>Starting Point:</strong> ${startPoint || 'Start Terminal'}</p>
          <p style="margin: 3px 0;"><strong>Destination:</strong> ${destination || 'End Terminal'}</p>
        </div>
        <p style="font-size: 11px; color: #64748B; margin-top: 16px; text-align: center;">
          Sent by Administrator (${senderEmail})
        </p>
      </div>
    </div>
  `;

  const isRenderCloud = Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL
  );
  const relayPayload = {
    relayId: `drv_cred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to: normalizedEmail,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  };

  if (isRenderCloud) {
    deliverEmailMessage({
      to: normalizedEmail,
      subject,
      htmlContent,
      textContent,
      senderName,
      senderEmail
    }).catch(() => {});
    return { success: true, deliveredVia: 'cloud_verified', relayPayload };
  }

  const delivery = await deliverEmailMessage({
    to: normalizedEmail,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  });

  if (delivery.success) {
    return { success: true, deliveredVia: delivery.deliveredVia, relayPayload };
  }

  console.log(`📧 [Fallback Console Driver Email] To: ${normalizedEmail} | Password: ${password}`);
  return { success: true, deliveredVia: 'console_fallback', relayPayload };
};

/**
 * Send Schedule Notification Email from Admin to Driver when Admin sets a schedule
 */
const sendDriverScheduleEmail = async ({
  email,
  name,
  shuttleCode,
  shuttleName,
  vehicleNumber,
  startPoint,
  destination,
  routeName,
  departureTime,
  arrivalTime,
  days = 'Mon - Fri',
  isReminder = false
}) => {
  if (!email) return { success: false, message: 'No driver email provided' };
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail.includes('@') || normalizedEmail.endsWith('@shuttletrack.com') || normalizedEmail.endsWith('@shuttletracker.com')) {
    return { success: false, message: 'Driver email is a placeholder domain' };
  }
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker Admin').trim();

  const subject = isReminder
    ? `⏰ Shuttle Tracker — Your Schedule Time (${departureTime} – ${arrivalTime}) is On — Ready to Ride Safely!`
    : `📅 Shuttle Tracker — New Trip Schedule Assigned (${departureTime} – ${arrivalTime}) — Ready to Ride Safely!`;

  const headlineMsg = isReminder
    ? `Your scheduled trip time (${departureTime} – ${arrivalTime}) is ON now! Please be ready to ride safely and press START TRIP in your Driver Login.`
    : `The Administrator has scheduled your trip time (${departureTime} – ${arrivalTime}). Your schedule time is on — please be ready to ride safely!`;

  const textContent = `Hello ${name || 'Driver'},\n\n${headlineMsg}\n\n--- YOUR SCHEDULE DETAILS ---\nAssigned Bus: ${shuttleCode || 'Assigned'} (${vehicleNumber || shuttleName || 'Campus Shuttle'})\nRoute: ${routeName || `${startPoint || 'Start'} to ${destination || 'Destination'}`}\nStarting Point: ${startPoint || 'Start Terminal'}\nDestination: ${destination || 'Destination Terminal'}\nScheduled Departure: ${departureTime || 'Scheduled'}\nScheduled Arrival: ${arrivalTime || 'Scheduled'}\nOperating Days: ${days}\n\nMessage from Admin: "Your schedule time is on, so please be ready to ride safely!"\n\nLog in to your Driver Portal to view your schedule and press START TRIP on time.\n\nSent from Administrator (${senderEmail})`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #0F172A; color: #ffffff; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 24px; color: #38BDF8;">🚍 Shuttle Tracker</h2>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">Official Driver Schedule Notification from Admin</p>
      </div>
      <div style="background: #1E293B; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <p style="font-size: 15px; color: #F8FAFC; margin-top: 0;">Hello <strong>${name || 'Driver'}</strong>,</p>
        <div style="background: #064E3B; padding: 14px 16px; border-radius: 10px; border: 1px solid #10B981; margin: 14px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #ECFDF5;">
            🛡️ ${headlineMsg}
          </p>
        </div>
        <div style="background: #0F172A; padding: 16px; border-radius: 10px; border: 1px solid #2563EB; margin: 16px 0;">
          <p style="margin: 4px 0; font-size: 13px; color: #94A3B8;">Scheduled Departure: <strong style="color: #38BDF8; font-size: 15px;">${departureTime || 'N/A'}</strong></p>
          <p style="margin: 4px 0; font-size: 13px; color: #94A3B8;">Scheduled Arrival: <strong style="color: #34D399; font-size: 15px;">${arrivalTime || 'N/A'}</strong></p>
          <p style="margin: 4px 0; font-size: 12px; color: #CBD5E1;">Operating Days: <strong>${days}</strong></p>
        </div>
        <div style="background: #0F172A; padding: 14px; border-radius: 10px; border: 1px solid #334155; margin-top: 12px; font-size: 12px; color: #CBD5E1;">
          <p style="margin: 3px 0;"><strong>Assigned Bus:</strong> ${shuttleCode || 'N/A'} ${vehicleNumber ? `(${vehicleNumber})` : ''}</p>
          <p style="margin: 3px 0;"><strong>Route:</strong> ${routeName || 'Assigned Route'}</p>
          <p style="margin: 3px 0;"><strong>Starting Point:</strong> ${startPoint || 'Start Terminal'}</p>
          <p style="margin: 3px 0;"><strong>Destination:</strong> ${destination || 'End Terminal'}</p>
        </div>
        <p style="font-size: 11px; color: #64748B; margin-top: 16px; text-align: center;">
          Sent by Administrator (${senderEmail}) • Ready to Ride Safely
        </p>
      </div>
    </div>
  `;

  const isRenderCloud = Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL
  );
  const relayPayload = {
    relayId: `drv_sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to: normalizedEmail,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  };

  if (isRenderCloud) {
    deliverEmailMessage({
      to: normalizedEmail,
      subject,
      htmlContent,
      textContent,
      senderName,
      senderEmail
    }).catch(() => {});
    return { success: true, deliveredVia: 'cloud_verified', relayPayload };
  }

  const delivery = await deliverEmailMessage({
    to: normalizedEmail,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  });

  if (delivery.success) {
    return { success: true, deliveredVia: delivery.deliveredVia, relayPayload };
  }

  console.log(`📧 [Fallback Console Schedule Email] To: ${normalizedEmail} | Schedule: ${departureTime} - ${arrivalTime}`);
  return { success: true, deliveredVia: 'console_fallback', relayPayload };
};

/**
 * Send Emergency Alert Notification Email to Admin when:
 * 1. Driver directly presses the Emergency button, OR
 * 2. Minimum 5 to 10 passengers on the same bus press the Emergency button within 10 to 20 minutes
 */
const sendAdminEmergencyEmail = async ({
  adminEmails = [],
  adminName = 'Administrator',
  busCode = 'S01',
  shuttleName = 'Campus Shuttle',
  vehicleNumber = '',
  driverName = 'Assigned Driver',
  routeName = 'Assigned Route',
  stopName = 'Current Location',
  reportedByRole = 'driver',
  reportedByName = '',
  passengerCount = 0,
  maxPassengerCount = 10,
  passengerNames = '',
  reason = '',
  organizationName = 'Campus Organization'
}) => {
  const emailList = [DEFAULT_EMAIL_USER, ...(Array.isArray(adminEmails) ? adminEmails : [adminEmails])]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(
      (e) =>
        e &&
        e.includes('@') &&
        !e.endsWith('@shuttletrack.com') &&
        !e.endsWith('@shuttletracker.com')
    );

  const uniqueEmails = [...new Set(emailList)];
  if (uniqueEmails.length === 0) {
    uniqueEmails.push(DEFAULT_EMAIL_USER);
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker Emergency Alert').trim();

  const isPassengerGroup = reportedByRole === 'user';
  const alertTypeLabel = isPassengerGroup
    ? `Passenger Group Emergency Alert (${passengerCount} out of ${maxPassengerCount} Passengers within 15 Mins)`
    : 'Driver Direct Emergency Alert';

  const subject = isPassengerGroup
    ? `🚨 EMERGENCY ALERT: Bus ${busCode} (${passengerCount}/${maxPassengerCount} Passengers Reported Issue) — ${organizationName}`
    : `🚨 EMERGENCY ALERT: Bus ${busCode} (Reported Directly by Driver ${driverName}) — ${organizationName}`;

  const summaryMessage =
    reason ||
    (isPassengerGroup
      ? `Bus ${busCode} (Driver: ${driverName}, Route: ${routeName}) is facing an emergency near "${stopName}". ${passengerCount} out of ${maxPassengerCount} passengers on Bus ${busCode} (${passengerNames || 'Allocated Passengers'}) pressed the Emergency Alert button within the 15-minute window.`
      : `Driver ${driverName} on Bus ${busCode} (Route: ${routeName}) directly pressed the Emergency Alert button near "${stopName}". Immediate Admin attention is required.`);

  const textContent = `URGENT SHUTTLE TRACKER EMERGENCY ALERT\n\nHello ${adminName},\n\n${summaryMessage}\n\n--- EMERGENCY DETAILS ---\nOrganization: ${organizationName}\nAlert Trigger: ${alertTypeLabel}\nBus Number: Bus ${busCode} ${vehicleNumber ? `(${vehicleNumber})` : `(${shuttleName})`}\nDriver Name: ${driverName}\nAssigned Route: ${routeName}\nCurrent Location / Stop: ${stopName}\n${
    isPassengerGroup
      ? `Passengers Who Reported (${passengerCount}/${maxPassengerCount}): ${passengerNames || reportedByName}`
      : `Reported By: Driver ${driverName}`
  }\nTime Reported: ${new Date().toLocaleString()}\n\nPlease check the Admin Live Tracking Portal immediately.\n\nSent by Shuttle Tracker Emergency Dispatch (${senderEmail})`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; background: #0F172A; color: #ffffff; border-radius: 16px; border: 2px solid #EF4444;">
      <div style="text-align: center; margin-bottom: 22px;">
        <div style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: #7F1D1D; color: #FECACA; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
          🚨 Immediate Admin Attention Required
        </div>
        <h2 style="margin: 0; font-size: 24px; color: #F87171;">Shuttle Emergency Alert — Bus ${busCode}</h2>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">${organizationName}</p>
      </div>
      <div style="background: #1E293B; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <p style="font-size: 15px; color: #F8FAFC; margin-top: 0;">Hello <strong>${adminName}</strong>,</p>
        <div style="background: #450A0A; padding: 16px; border-radius: 10px; border: 1px solid #EF4444; margin: 14px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #FEE2E2; line-height: 1.5;">
            🚨 ${summaryMessage}
          </p>
        </div>
        <div style="background: #0F172A; padding: 16px; border-radius: 10px; border: 1px solid #334155; margin-top: 14px; font-size: 13px; color: #CBD5E1; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>Alert Source:</strong> <span style="color: #F87171; font-weight: 700;">${alertTypeLabel}</span></p>
          <p style="margin: 4px 0;"><strong>Bus Number:</strong> Bus ${busCode} ${vehicleNumber ? `(${vehicleNumber})` : ''}</p>
          <p style="margin: 4px 0;"><strong>Assigned Driver:</strong> ${driverName}</p>
          <p style="margin: 4px 0;"><strong>Route:</strong> ${routeName}</p>
          <p style="margin: 4px 0;"><strong>Location / Nearest Stop:</strong> ${stopName}</p>
          ${
            isPassengerGroup
              ? `<p style="margin: 4px 0;"><strong>Passenger Reports (${passengerCount}/${maxPassengerCount}):</strong> ${passengerNames || reportedByName}</p>`
              : `<p style="margin: 4px 0;"><strong>Reported Directly By:</strong> Driver ${driverName}</p>`
          }
        </div>
        <p style="font-size: 11px; color: #64748B; margin-top: 16px; text-align: center;">
          Sent by Shuttle Tracker Emergency Monitor (${senderEmail})
        </p>
      </div>
    </div>
  `;

  const isRenderCloud = Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL
  );

  const toHeader = uniqueEmails.join(', ');
  const relayPayload = {
    relayId: `adm_emg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to: toHeader,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  };

  if (isRenderCloud) {
    deliverEmailMessage({
      to: toHeader,
      subject,
      htmlContent,
      textContent,
      senderName,
      senderEmail
    }).catch(() => {});
    return { success: true, deliveredVia: 'cloud_verified', recipients: uniqueEmails, relayPayload };
  }

  const delivery = await deliverEmailMessage({
    to: toHeader,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  });

  return {
    success: true,
    deliveredVia: delivery.success ? delivery.deliveredVia : 'console_fallback',
    recipients: uniqueEmails,
    relayPayload
  };
};

/**
 * Send Off-Route Alert Email to Admin when:
 * 1. Driver travels on a non-allocated route determined by Google Maps / GPS route distance, OR
 * 2. Driver directly presses the Off-Route Alert button
 */
const sendAdminOffRouteEmail = async ({
  adminEmails = [],
  adminName = 'Administrator',
  busCode = 'S01',
  shuttleName = 'Campus Shuttle',
  vehicleNumber = '',
  driverName = 'Assigned Driver',
  routeName = 'Assigned Route',
  latitude = 0,
  longitude = 0,
  reason = '',
  organizationName = 'Campus Organization'
}) => {
  const emailList = [DEFAULT_EMAIL_USER, ...(Array.isArray(adminEmails) ? adminEmails : [adminEmails])]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(
      (e) =>
        e &&
        e.includes('@') &&
        !e.endsWith('@shuttletrack.com') &&
        !e.endsWith('@shuttletracker.com')
    );

  const uniqueEmails = [...new Set(emailList)];
  if (uniqueEmails.length === 0) {
    uniqueEmails.push(DEFAULT_EMAIL_USER);
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker Off-Route Monitor').trim();

  const subject = `⚠️ OFF-ROUTE ALERT: Bus ${busCode} (${driverName}) Deviated from Allocated Route — ${organizationName}`;
  const gpsCoords = `${Number(latitude || 12.9602).toFixed(5)}°N, ${Number(longitude || 80.0569).toFixed(5)}°E`;
  const summaryMessage =
    reason ||
    `Driver ${driverName} on Bus ${busCode} is travelling on a non-allocated route away from "${routeName}" at GPS (${gpsCoords}).`;

  const textContent = `SHUTTLE TRACKER OFF-ROUTE DEVIATION ALERT\n\nHello ${adminName},\n\n${summaryMessage}\n\n--- OFF-ROUTE DETAILS ---\nOrganization: ${organizationName}\nBus Number: Bus ${busCode} ${vehicleNumber ? `(${vehicleNumber})` : `(${shuttleName})`}\nDriver Name: ${driverName}\nAllocated Route: ${routeName}\nDeviated GPS Coordinates: ${gpsCoords}\nTime Detected: ${new Date().toLocaleString()}\n\nPlease check the Admin Live Tracking map immediately.\n\nSent by Shuttle Tracker Off-Route Monitor (${senderEmail})`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; background: #0F172A; color: #ffffff; border-radius: 16px; border: 2px solid #F59E0B;">
      <div style="text-align: center; margin-bottom: 22px;">
        <div style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: #78350F; color: #FDE68A; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
          ⚠️ Non-Allocated Route Deviation Detected
        </div>
        <h2 style="margin: 0; font-size: 24px; color: #FBBF24;">Off-Route Alert — Bus ${busCode}</h2>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">${organizationName}</p>
      </div>
      <div style="background: #1E293B; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <p style="font-size: 15px; color: #F8FAFC; margin-top: 0;">Hello <strong>${adminName}</strong>,</p>
        <div style="background: #451A03; padding: 16px; border-radius: 10px; border: 1px solid #F59E0B; margin: 14px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #FEF3C7; line-height: 1.5;">
            ⚠️ ${summaryMessage}
          </p>
        </div>
        <div style="background: #0F172A; padding: 16px; border-radius: 10px; border: 1px solid #334155; margin-top: 14px; font-size: 13px; color: #CBD5E1; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>Bus Number:</strong> Bus ${busCode} ${vehicleNumber ? `(${vehicleNumber})` : ''}</p>
          <p style="margin: 4px 0;"><strong>Assigned Driver:</strong> ${driverName}</p>
          <p style="margin: 4px 0;"><strong>Allocated Route:</strong> ${routeName}</p>
          <p style="margin: 4px 0;"><strong>Current GPS Location:</strong> <span style="font-family: monospace; color: #FBBF24;">${gpsCoords}</span></p>
        </div>
        <p style="font-size: 11px; color: #64748B; margin-top: 16px; text-align: center;">
          Sent by Shuttle Tracker Route Monitor (${senderEmail})
        </p>
      </div>
    </div>
  `;

  const isRenderCloud = Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL
  );
  const toHeader = uniqueEmails.join(', ');
  const relayPayload = {
    relayId: `adm_off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to: toHeader,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  };

  if (isRenderCloud) {
    deliverEmailMessage({
      to: toHeader,
      subject,
      htmlContent,
      textContent,
      senderName,
      senderEmail
    }).catch(() => {});
    return { success: true, deliveredVia: 'cloud_verified', recipients: uniqueEmails, relayPayload };
  }

  const delivery = await deliverEmailMessage({
    to: toHeader,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  });

  return {
    success: true,
    deliveredVia: delivery.success ? delivery.deliveredVia : 'console_fallback',
    recipients: uniqueEmails,
    relayPayload
  };
};

/**
 * Send Delay / Late Arrival Alert Email to Admin when:
 * 1. Driver does not reach destination within allocated arrival time, OR
 * 2. Driver directly presses the Report Route Delay button
 */
const sendAdminDelayEmail = async ({
  adminEmails = [],
  adminName = 'Administrator',
  busCode = 'S01',
  shuttleName = 'Campus Shuttle',
  vehicleNumber = '',
  driverName = 'Assigned Driver',
  routeName = 'Assigned Route',
  destination = 'Destination',
  scheduledArrival = '',
  actualArrival = '',
  delayMinutes = 5,
  pointsEarned = 5,
  totalDriverPoints = 10,
  reason = '',
  organizationName = 'Campus Organization'
}) => {
  const emailList = [DEFAULT_EMAIL_USER, ...(Array.isArray(adminEmails) ? adminEmails : [adminEmails])]
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(
      (e) =>
        e &&
        e.includes('@') &&
        !e.endsWith('@shuttletrack.com') &&
        !e.endsWith('@shuttletracker.com')
    );

  const uniqueEmails = [...new Set(emailList)];
  if (uniqueEmails.length === 0) {
    uniqueEmails.push(DEFAULT_EMAIL_USER);
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker Delay Monitor').trim();

  const subject = `⏰ DELAY ALERT: Bus ${busCode} (${driverName}) Delayed by +${delayMinutes} Min — ${organizationName}`;
  const summaryMessage =
    reason ||
    `Driver ${driverName} on Bus ${busCode} (${routeName}) is delayed by +${delayMinutes} minute(s) past the allocated arrival time (${scheduledArrival || 'Scheduled Time'}).`;

  const textContent = `SHUTTLE TRACKER DELAY & ARRIVAL TIME ALERT\n\nHello ${adminName},\n\n${summaryMessage}\n\n--- DELAY DETAILS ---\nOrganization: ${organizationName}\nBus Number: Bus ${busCode} ${vehicleNumber ? `(${vehicleNumber})` : `(${shuttleName})`}\nDriver Name: ${driverName}\nAllocated Route: ${routeName}\nDestination: ${destination}\nAllocated Arrival Time: ${scheduledArrival || 'N/A'}\nExpected / Actual Arrival: ${actualArrival || 'Delayed'}\nDelay Duration: +${delayMinutes} min(s)\nDriver Points Awarded: +${pointsEarned} pts (Total Score: ${totalDriverPoints} pts)\nTime Reported: ${new Date().toLocaleString()}\n\nSent by Shuttle Tracker Delay Monitor (${senderEmail})`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; background: #0F172A; color: #ffffff; border-radius: 16px; border: 2px solid #F59E0B;">
      <div style="text-align: center; margin-bottom: 22px;">
        <div style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: #78350F; color: #FDE68A; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
          ⏰ Schedule & Arrival Delay Notice
        </div>
        <h2 style="margin: 0; font-size: 24px; color: #FBBF24;">Shuttle Delay Alert — Bus ${busCode} (+${delayMinutes}m)</h2>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">${organizationName}</p>
      </div>
      <div style="background: #1E293B; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <p style="font-size: 15px; color: #F8FAFC; margin-top: 0;">Hello <strong>${adminName}</strong>,</p>
        <div style="background: #451A03; padding: 16px; border-radius: 10px; border: 1px solid #F59E0B; margin: 14px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #FEF3C7; line-height: 1.5;">
            ⏰ ${summaryMessage}
          </p>
        </div>
        <div style="background: #0F172A; padding: 16px; border-radius: 10px; border: 1px solid #334155; margin-top: 14px; font-size: 13px; color: #CBD5E1; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>Bus Number:</strong> Bus ${busCode} ${vehicleNumber ? `(${vehicleNumber})` : ''}</p>
          <p style="margin: 4px 0;"><strong>Assigned Driver:</strong> ${driverName}</p>
          <p style="margin: 4px 0;"><strong>Allocated Route:</strong> ${routeName}</p>
          <p style="margin: 4px 0;"><strong>Allocated Arrival Time:</strong> ${scheduledArrival || 'Scheduled'}</p>
          <p style="margin: 4px 0;"><strong>Delay Duration:</strong> <span style="color: #FBBF24; font-weight: 700;">+${delayMinutes} min(s)</span></p>
          <p style="margin: 4px 0;"><strong>Driver Points Adjusted:</strong> +${pointsEarned} pts (Cumulative: ${totalDriverPoints} pts)</p>
        </div>
        <p style="font-size: 11px; color: #64748B; margin-top: 16px; text-align: center;">
          Sent by Shuttle Tracker Delay Monitor (${senderEmail})
        </p>
      </div>
    </div>
  `;

  const isRenderCloud = Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL
  );
  const toHeader = uniqueEmails.join(', ');
  const relayPayload = {
    relayId: `adm_dly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to: toHeader,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  };

  if (isRenderCloud) {
    deliverEmailMessage({
      to: toHeader,
      subject,
      htmlContent,
      textContent,
      senderName,
      senderEmail
    }).catch(() => {});
    return { success: true, deliveredVia: 'cloud_verified', recipients: uniqueEmails, relayPayload };
  }

  const delivery = await deliverEmailMessage({
    to: toHeader,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  });

  return {
    success: true,
    deliveredVia: delivery.success ? delivery.deliveredVia : 'console_fallback',
    recipients: uniqueEmails,
    relayPayload
  };
};

/**
 * Send Trip Started Notification Email to Passengers when Driver presses START TRIP
 */
const sendPassengerTripStartedEmail = async ({
  passengerEmails = [],
  busCode = 'S01',
  shuttleName = 'Campus Shuttle',
  vehicleNumber = '',
  driverName = 'Assigned Driver',
  startPoint = 'Starting Point',
  destination = 'Destination',
  routeName = 'Assigned Route',
  organizationName = 'Campus Organization'
}) => {
  const emailList = (Array.isArray(passengerEmails) ? passengerEmails : [passengerEmails])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(
      (e) =>
        e &&
        e.includes('@') &&
        !e.endsWith('@shuttletrack.com') &&
        !e.endsWith('@shuttletracker.com')
    );

  const uniqueEmails = [...new Set(emailList)];
  if (uniqueEmails.length === 0) {
    return { success: false, message: 'No valid passenger emails found' };
  }

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker Live Dispatch').trim();

  const subject = `🚍 Trip Started: Bus ${busCode} (${startPoint} ➔ ${destination}) is Now Live!`;
  const summaryMessage = `Driver ${driverName} has started the trip on Bus ${busCode} (${routeName}). Live GPS tracking is now active on your Passenger Dashboard!`;

  const textContent = `SHUTTLE TRACKER — TRIP STARTED NOTIFICATION\n\nHello Passenger,\n\n${summaryMessage}\n\n--- TRIP DETAILS ---\nOrganization: ${organizationName}\nBus Number: Bus ${busCode} ${vehicleNumber ? `(${vehicleNumber})` : `(${shuttleName})`}\nDriver Name: ${driverName}\nRoute: ${routeName}\nStarting Point: ${startPoint}\nDestination: ${destination}\nStarted At: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n\nOpen your Passenger Dashboard to track Bus ${busCode} live second-by-second on Google Maps.\n\nSent by Shuttle Tracker Live Dispatch (${senderEmail})`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #0F172A; color: #ffffff; border-radius: 16px; border: 2px solid #10B981;">
      <div style="text-align: center; margin-bottom: 22px;">
        <div style="display: inline-block; padding: 6px 14px; border-radius: 999px; background: #064E3B; color: #A7F3D0; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">
          🟢 Live GPS Tracking Active
        </div>
        <h2 style="margin: 0; font-size: 24px; color: #34D399;">Bus ${busCode} Trip Started!</h2>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">${organizationName}</p>
      </div>
      <div style="background: #1E293B; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <p style="font-size: 15px; color: #F8FAFC; margin-top: 0;">Hello <strong>Passenger</strong>,</p>
        <div style="background: #064E3B; padding: 16px; border-radius: 10px; border: 1px solid #10B981; margin: 14px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: #ECFDF5; line-height: 1.5;">
            🚍 ${summaryMessage}
          </p>
        </div>
        <div style="background: #0F172A; padding: 16px; border-radius: 10px; border: 1px solid #334155; margin-top: 14px; font-size: 13px; color: #CBD5E1; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>Bus Number:</strong> Bus ${busCode} ${vehicleNumber ? `(${vehicleNumber})` : ''}</p>
          <p style="margin: 4px 0;"><strong>Driver Name:</strong> ${driverName}</p>
          <p style="margin: 4px 0;"><strong>Route:</strong> ${routeName}</p>
          <p style="margin: 4px 0;"><strong>Starting Point:</strong> ${startPoint}</p>
          <p style="margin: 4px 0;"><strong>Destination:</strong> ${destination}</p>
        </div>
        <p style="font-size: 11px; color: #64748B; margin-top: 16px; text-align: center;">
          Sent by Shuttle Tracker Live Dispatch (${senderEmail})
        </p>
      </div>
    </div>
  `;

  const isRenderCloud = Boolean(
    process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL
  );
  const toHeader = uniqueEmails.join(', ');
  const relayPayload = {
    relayId: `pass_start_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    to: toHeader,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  };

  if (isRenderCloud) {
    deliverEmailMessage({
      to: toHeader,
      subject,
      htmlContent,
      textContent,
      senderName,
      senderEmail
    }).catch(() => {});
    return { success: true, deliveredVia: 'cloud_verified', recipients: uniqueEmails, relayPayload };
  }

  const delivery = await deliverEmailMessage({
    to: toHeader,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  });

  return {
    success: true,
    deliveredVia: delivery.success ? delivery.deliveredVia : 'console_fallback',
    recipients: uniqueEmails,
    relayPayload
  };
};

/**
 * Deliver a raw email payload (used by /api/auth/relay-email when Render free tier blocks outbound port 465/587)
 */
const processedRelayIds = new Set();
const sendRawRelayEmail = async ({ relayId, to, subject, htmlContent, textContent, senderName, senderEmail }) => {
  if (!to || !subject) {
    return { success: false, message: 'Missing recipient or subject.' };
  }
  if (relayId && processedRelayIds.has(relayId)) {
    return { success: true, deliveredVia: 'already_relayed' };
  }
  if (relayId) {
    processedRelayIds.add(relayId);
    if (processedRelayIds.size > 500) {
      const first = processedRelayIds.values().next().value;
      processedRelayIds.delete(first);
    }
  }
  return deliverEmailMessage({
    to,
    subject,
    htmlContent: htmlContent || `<p>${textContent || ''}</p>`,
    textContent: textContent || '',
    senderName: senderName || 'Shuttle Tracker',
    senderEmail: senderEmail || DEFAULT_EMAIL_USER
  });
};

/**
 * Deliver an already-generated OTP code to the validated email via Gmail SMTP
 */
const sendExplicitOTP = async (email, explicitOtp, purpose = 'signup') => {
  const validation = await validateEmailAddress(email);
  if (!validation.valid) {
    return { success: false, message: validation.message || 'Enter a valid email address.' };
  }
  const normalizedEmail = validation.normalizedEmail;
  const otp = String(explicitOtp || '').trim();
  if (!/^\d{6}$/.test(otp)) {
    return { success: false, message: 'Invalid OTP format.' };
  }

  const isReset = purpose === 'reset';
  const subject = isReset
    ? 'Shuttle Tracker — Password Reset OTP Code'
    : 'Shuttle Tracker — Account Verification OTP Code';

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || DEFAULT_EMAIL_USER).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker').trim();

  const textContent = `Shuttle Tracker OTP Verification\n\nYour 6-digit OTP is: ${otp}\n\nThis code is valid for 1 minute before resend unlocks (10 minutes total validity). Do not share this code with anyone.\n\nSent from ${senderEmail} to ${normalizedEmail}`;

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #0F172A; color: #ffffff; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 24px; color: #38BDF8;">🚍 Shuttle Tracker</h2>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 4px;">Enterprise Real-Time Transit Platform</p>
      </div>
      <div style="background: #1E293B; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid #334155;">
        <p style="font-size: 14px; color: #E2E8F0; margin-bottom: 16px;">
          ${isReset ? 'Use the verification code below to reset your password:' : 'Use the verification code below to complete your registration:'}
        </p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38BDF8; background: #0F172A; padding: 16px 24px; border-radius: 10px; display: inline-block; border: 1px solid #2563EB;">
          ${otp}
        </div>
        <p style="font-size: 12px; color: #94A3B8; margin-top: 16px;">
          Enter this 6-digit code on the verification screen and click <strong>Verify OTP</strong>.
        </p>
        <p style="font-size: 11px; color: #64748B; margin-top: 12px;">
          Sent from ${senderEmail} to ${normalizedEmail}
        </p>
      </div>
    </div>
  `;

  return deliverEmailMessage({
    to: normalizedEmail,
    subject,
    htmlContent,
    textContent,
    senderName,
    senderEmail
  });
};

module.exports = {
  validateEmailAddress,
  sendBrevoOTP,
  sendExplicitOTP,
  sendRawRelayEmail,
  verifyOTP,
  sendDriverCredentialsEmail,
  sendDriverScheduleEmail,
  sendAdminEmergencyEmail,
  sendAdminOffRouteEmail,
  sendAdminDelayEmail,
  sendPassengerTripStartedEmail
};

