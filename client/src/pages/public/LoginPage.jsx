import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import {
  Bus,
  Shield,
  User,
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sun,
  Moon,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  Timer,
  Send,
  UserPlus,
  ShieldCheck,
  Eye,
  EyeOff,
  Building2,
  Upload,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import Input from '../../components/common/Input';

// Generate a 5-character alphanumeric Captcha code
const createCaptchaString = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const LoginPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get('role') || 'admin';
  const [selectedRole, setSelectedRole] = useState(initialRole);

  // Modes: 'login' | 'signup' (Passenger ONLY) | 'forgot' (Admin, Passenger, Driver)
  const [authMode, setAuthMode] = useState('login');

  // Available shuttles & Admin-configured Organization Name + Sample ID Card Format
  const [availableShuttles, setAvailableShuttles] = useState([]);
  const [registeredOrgs, setRegisteredOrgs] = useState([]);
  const [adminOrgName, setAdminOrgName] = useState('');
  const [adminSampleIdUrl, setAdminSampleIdUrl] = useState('');

  // Form fields
  const [username, setUsername] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [busNumber, setBusNumber] = useState('S01');
  const [destination, setDestination] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [captchaCode, setCaptchaCode] = useState(() => createCaptchaString());
  const [captchaInput, setCaptchaInput] = useState('');

  // Passenger AI ID Card Verification States
  const [idCardBase64, setIdCardBase64] = useState('');
  const [idCardVerifying, setIdCardVerifying] = useState(false);
  const [idCardVerified, setIdCardVerified] = useState(false);
  const [idCardMessage, setIdCardMessage] = useState('');

  // OTP Verification & 1-Minute Timer States
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { login, register, getDashboardPath } = useAuth();
  const { relayCloudEmail } = useSocket();
  const { addToast } = useToast();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  // All roles (Admin, Passenger, Driver) start with empty login fields on the website
  const demoAccounts = {
    admin: { email: '', password: '' },
    user: { email: '', password: '' },
    driver: { email: '', password: '' }
  };

  // Find matching registered organization object if any
  const findMatchingOrg = (enteredOrg) => {
    const cleanEntered = String(enteredOrg || '').trim().toLowerCase();
    if (!cleanEntered) return null;
    const found = registeredOrgs.find(
      (o) => String(o.organization_name || '').trim().toLowerCase() === cleanEntered
    );
    if (found) return found;
    if (adminOrgName && cleanEntered === String(adminOrgName).trim().toLowerCase()) {
      return { organization_name: adminOrgName, sample_id_card_url: adminSampleIdUrl };
    }
    return null;
  };

  // Load shuttles, organizations list, and Admin Sample ID Card structure reference from settings
  const loadOrgContext = async (targetOrg) => {
    try {
      const orgQuery = targetOrg ? `?organization_name=${encodeURIComponent(targetOrg)}` : '';
      const [shuttlesRes, settingsRes, orgsRes] = await Promise.all([
        api.get(`/shuttles${orgQuery}`),
        api.get(`/stats/settings${orgQuery}`),
        api.get('/stats/organizations').catch(() => ({ data: { success: false, data: [] } }))
      ]);
      if (orgsRes.data?.success && Array.isArray(orgsRes.data.data)) {
        setRegisteredOrgs(orgsRes.data.data);
      }
      if (shuttlesRes.data.success && shuttlesRes.data.data?.length > 0) {
        setAvailableShuttles(shuttlesRes.data.data);
        setBusNumber(shuttlesRes.data.data[0].code);
        setDestination(shuttlesRes.data.data[0].destination || 'Destination');
      }
      if (settingsRes.data?.success && settingsRes.data.data) {
        if (settingsRes.data.data.organization_name) {
          setAdminOrgName(settingsRes.data.data.organization_name);
        }
        setAdminSampleIdUrl(settingsRes.data.data.sample_id_card_url || '');
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadOrgContext(organizationName.trim());
  }, [authMode]);

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam && ['admin', 'user', 'driver'].includes(roleParam)) {
      setSelectedRole(roleParam);
    }
  }, [searchParams]);

  // Reset states when switching role or mode (Driver & Admin cannot use Sign Up)
  useEffect(() => {
    if ((selectedRole === 'admin' || selectedRole === 'driver') && authMode === 'signup') {
      setAuthMode('login');
    }
    setErrorMessage('');
    setSuccessMessage('');
    setOtpSent(false);
    setOtpVerified(false);
    setOtp('');
    setOtpTimer(0);
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIdCardBase64('');
    setIdCardVerified(false);
    setIdCardMessage('');

    if (authMode === 'login') {
      setEmail('');
      setPassword('');
      setOrganizationName('');
    } else if (authMode === 'signup') {
      setEmail('');
      setPassword('');
      setUsername('');
      setOrganizationName('');
      setCaptchaInput('');
      setCaptchaCode(createCaptchaString());
    } else if (authMode === 'forgot') {
      setEmail('');
      setPassword('');
      setCaptchaInput('');
      setCaptchaCode(createCaptchaString());
    }
  }, [selectedRole, authMode]);

  // 1-Minute (60s) OTP Countdown Timer
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const refreshCaptcha = () => {
    setCaptchaCode(createCaptchaString());
    setCaptchaInput('');
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setSearchParams({ role });
    if ((role === 'admin' || role === 'driver') && authMode === 'signup') {
      setAuthMode('login');
    }
  };

  // If user edits Name or Organization after verifying ID card, require re-verification
  const handleNameChange = (e) => {
    setUsername(e.target.value);
    if (idCardVerified) {
      setIdCardVerified(false);
      setIdCardMessage('');
    }
  };

  const handleOrgChange = (e) => {
    const val = e.target.value;
    setOrganizationName(val);
    if (idCardVerified) {
      setIdCardVerified(false);
      setIdCardMessage('');
    }
    const matched = findMatchingOrg(val);
    if (matched) {
      setAdminOrgName(matched.organization_name);
      if (matched.sample_id_card_url !== undefined) {
        setAdminSampleIdUrl(matched.sample_id_card_url || '');
      }
      loadOrgContext(matched.organization_name);
    }
  };

  const handleBusSelectChange = (e) => {
    const code = e.target.value;
    setBusNumber(code);
    const found = availableShuttles.find((s) => s.code === code);
    if (found) {
      setDestination(found.destination || 'Campus Terminal');
    }
  };

  // Compress image on canvas so OCR API never exceeds file size limits
  const compressImageForVerification = (rawDataUrl) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1100;
          let w = img.width || 800;
          let h = img.height || 500;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        } catch (_) {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });

  // Compare Passenger Uploaded ID Card Structure against Admin Uploaded ID Card Structure
  // (Compares card aspect ratio, header/footer banner, background layout & text-edge density while IGNORING the face/portrait region)
  const compareIdCardStructureWithAdminSample = (uploadedDataUrl, sampleDataUrl) =>
    new Promise((resolve) => {
      if (!sampleDataUrl || !uploadedDataUrl) {
        resolve({ structureMatched: true, structureScore: 0.85 });
        return;
      }
      const imgUp = new Image();
      const imgSa = new Image();
      let loaded = 0;
      const onBothLoaded = () => {
        loaded += 1;
        if (loaded < 2) return;
        try {
          const ratioUp = (imgUp.width || 1) / (imgUp.height || 1);
          const ratioSa = (imgSa.width || 1) / (imgSa.height || 1);
          const aspectDiff = Math.abs(ratioUp - ratioSa);
          const aspectRatioMatch = aspectDiff <= 0.55;

          const SIZE = 120;
          const GRID = 8;
          const CELL = SIZE / GRID;

          const extractGridAndEdges = (img) => {
            const c = document.createElement('canvas');
            c.width = SIZE;
            c.height = SIZE;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, 0, 0, SIZE, SIZE);
            const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

            // Compute horizontal/vertical edge density (text lines & card borders)
            let edgeCount = 0;
            for (let y = 1; y < SIZE - 1; y++) {
              for (let x = 1; x < SIZE - 1; x++) {
                const idx = (y * SIZE + x) * 4;
                const prevX = (y * SIZE + (x - 1)) * 4;
                const prevY = ((y - 1) * SIZE + x) * 4;
                const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                const lumX = 0.299 * data[prevX] + 0.587 * data[prevX + 1] + 0.114 * data[prevX + 2];
                const lumY = 0.299 * data[prevY] + 0.587 * data[prevY + 1] + 0.114 * data[prevY + 2];
                if (Math.abs(lum - lumX) > 28 || Math.abs(lum - lumY) > 28) {
                  edgeCount++;
                }
              }
            }
            const edgeRatio = edgeCount / (SIZE * SIZE);

            // Extract 8x8 cell RGB + Luminance averages
            const cells = [];
            for (let gy = 0; gy < GRID; gy++) {
              for (let gx = 0; gx < GRID; gx++) {
                let r = 0,
                  g = 0,
                  b = 0,
                  count = 0;
                for (let py = Math.floor(gy * CELL); py < Math.floor((gy + 1) * CELL); py++) {
                  for (let px = Math.floor(gx * CELL); px < Math.floor((gx + 1) * CELL); px++) {
                    const pIdx = (py * SIZE + px) * 4;
                    r += data[pIdx];
                    g += data[pIdx + 1];
                    b += data[pIdx + 2];
                    count++;
                  }
                }
                r /= count || 1;
                g /= count || 1;
                b /= count || 1;
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                cells.push({ gx, gy, r, g, b, lum });
              }
            }
            return { edgeRatio, cells };
          };

          const upFeat = extractGridAndEdges(imgUp);
          const saFeat = extractGridAndEdges(imgSa);

          // Separate structural template cells (Header rows 0-1, Footer row 7, Border cols) from Middle Portrait/Face zone (rows 2-6)
          const structuralDiffs = [];
          const middleDiffs = [];

          for (let i = 0; i < upFeat.cells.length; i++) {
            const cUp = upFeat.cells[i];
            const cSa = saFeat.cells[i];
            const colorDist =
              (Math.abs(cUp.r - cSa.r) + Math.abs(cUp.g - cSa.g) + Math.abs(cUp.b - cSa.b)) / (3 * 255);
            const lumDist = Math.abs(cUp.lum - cSa.lum) / 255;
            const cellDiff = 0.6 * colorDist + 0.4 * lumDist;

            const isHeaderOrFooter = cUp.gy <= 1 || cUp.gy === GRID - 1;
            if (isHeaderOrFooter) {
              structuralDiffs.push(cellDiff);
            } else {
              middleDiffs.push(cellDiff);
            }
          }

          // Ignore the top 45% most-different middle cells (where different people's face portrait photo & name sit!)
          middleDiffs.sort((a, b) => a - b);
          const keptMiddle = middleDiffs.slice(0, Math.ceil(middleDiffs.length * 0.55));
          const allTemplateDiffs = [...structuralDiffs, ...keptMiddle];
          const avgDiff =
            allTemplateDiffs.reduce((acc, v) => acc + v, 0) / (allTemplateDiffs.length || 1);
          const structureScore = Number(Math.max(0, 1 - avgDiff).toFixed(2));

          const hasCardTextEdges = upFeat.edgeRatio >= 0.025;
          const structureMatched = aspectRatioMatch && hasCardTextEdges && structureScore >= 0.56;

          let reason = '';
          if (!aspectRatioMatch) {
            reason =
              'ID Card Structure Mismatch: Uploaded image orientation/dimensions do not match the Admin uploaded ID card structure.';
          } else if (!hasCardTextEdges) {
            reason =
              'ID Card Structure Mismatch: Uploaded image does not have valid ID card layout and text structure.';
          } else if (structureScore < 0.56) {
            reason =
              'ID Card Structure Mismatch: Uploaded image header/background layout does not match the Admin uploaded ID card structure.';
          }

          resolve({
            structureMatched,
            structureScore,
            aspectRatioMatch,
            edgeRatio: Number(upFeat.edgeRatio.toFixed(3)),
            reason
          });
        } catch (_) {
          resolve({ structureMatched: true, structureScore: 0.8 });
        }
      };
      imgUp.onload = onBothLoaded;
      imgSa.onload = onBothLoaded;
      imgUp.onerror = () => resolve({ structureMatched: false, structureScore: 0, reason: 'Invalid uploaded image.' });
      imgSa.onerror = () => resolve({ structureMatched: true, structureScore: 0.8 });
      imgUp.src = uploadedDataUrl;
      imgSa.src = sampleDataUrl;
    });

  // Upload ID Card & Run AI Verification (Checks ID Card Structure [ignoring face], Name & Organization Name)
  const verifyIdCardImageWithAI = async (base64Img) => {
    if (!adminSampleIdUrl) {
      const noSampleMsg =
        'Admin has not uploaded the official Sample ID Card in Admin Profile yet. Passengers can only create an account after Admin uploads the sample ID card.';
      setErrorMessage(noSampleMsg);
      setIdCardVerified(false);
      setIdCardMessage(noSampleMsg);
      return;
    }

    if (!username.trim() || !organizationName.trim()) {
      setErrorMessage('Please enter your Full Name and Organization Name before uploading your ID card.');
      return;
    }

    setErrorMessage('');
    setIdCardVerifying(true);
    setIdCardVerified(false);
    setIdCardMessage('AI is verifying your Name, Organization Name, and ID card structure...');

    try {
      const structureComparison = await compareIdCardStructureWithAdminSample(base64Img, adminSampleIdUrl);

      const res = await api.post('/auth/verify-id-card', {
        name: username.trim(),
        organization_name: organizationName.trim(),
        id_card_base64: base64Img,
        structure_comparison: structureComparison
      });

      setIdCardVerifying(false);
      if (res.data.success && res.data.verified) {
        setIdCardVerified(true);
        setIdCardMessage(res.data.message);
        addToast({
          title: 'ID Card Verified by AI',
          message: `Verified ID card structure, Name ("${username.trim()}"), and Organization ("${organizationName.trim()}")!`,
          type: 'success'
        });
      } else {
        setIdCardVerified(false);
        setIdCardMessage(res.data.message || 'ID card structure, Name, or Organization did not match.');
      }
    } catch (err) {
      setIdCardVerifying(false);
      setIdCardVerified(false);
      const msg =
        err.response?.data?.message ||
        'Verification Failed: Uploaded image does not match Admin ID card structure, Name, or Organization.';
      setIdCardMessage(msg);
      setErrorMessage(msg);
    }
  };

  const handleIdCardFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressedBase64 = await compressImageForVerification(reader.result);
      setIdCardBase64(compressedBase64);
      verifyIdCardImageWithAI(compressedBase64);
    };
    reader.readAsDataURL(file);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (otpSent || otpVerified) {
      setOtpSent(false);
      setOtpVerified(false);
      setOtp('');
    }
  };

  // Clean standard email validation that accepts all valid student, faculty, corporate & personal emails
  const validateEnteredEmail = (rawEmail) => {
    const clean = String(rawEmail || '').trim().toLowerCase();
    if (!clean) {
      return { valid: false, message: 'Please enter your email address.' };
    }
    if (/\s/.test(clean)) {
      return { valid: false, message: 'Email address cannot contain spaces.' };
    }
    const parts = clean.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { valid: false, message: 'Please enter a valid email address format (e.g. name@example.com).' };
    }
    const [localPart, domain] = parts;
    if (localPart.length < 1 || domain.length < 3 || !domain.includes('.')) {
      return { valid: false, message: 'Please enter a valid email address format (e.g. name@example.com).' };
    }

    const domainLabels = domain.split('.');
    const tld = domainLabels[domainLabels.length - 1];
    if (!tld || tld.length < 2 || !/^[a-zA-Z]{2,12}$/.test(tld)) {
      return { valid: false, message: 'Please enter an email address with a valid domain extension (e.g. .com, .edu, .in).' };
    }

    const standardEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!standardEmailRegex.test(clean)) {
      return { valid: false, message: 'Please enter a valid email address format (e.g. name@example.com).' };
    }

    const typoDomains = new Set([
      'gmai.com', 'gmal.com', 'gmial.com', 'gamil.com', 'gnail.com', 'gmaill.com',
      'gmail.co', 'gmail.con', 'gmail.cm', 'yaho.com', 'yahooo.com', 'yhoo.com',
      'outlok.com', 'outllok.com', 'hotmai.com', 'hotmal.com'
    ]);
    if (typoDomains.has(domain)) {
      return {
        valid: false,
        message: `"${domain}" looks like a typo. Please check the spelling of your email domain.`
      };
    }

    return { valid: true, normalizedEmail: clean };
  };

  // Step 1: Send OTP to Email
  const handleSendOTP = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    const emailCheck = validateEnteredEmail(email);
    if (!emailCheck.valid) {
      setOtpSent(false);
      setOtpVerified(false);
      setErrorMessage(emailCheck.message);
      addToast({
        title: 'Invalid Email',
        message: emailCheck.message,
        type: 'error'
      });
      return;
    }

    if (authMode === 'signup') {
      if (!username.trim() || !organizationName.trim()) {
        setErrorMessage('Please enter your Full Name and Organization Name first.');
        return;
      }
    }

    setOtpSending(true);
    setOtpVerified(false);
    try {
      const endpoint =
        authMode === 'forgot' ? '/auth/forgot-password/send-otp' : '/auth/send-otp';
      const res = await api.post(endpoint, {
        email: email.trim(),
        role: selectedRole,
        organization_name: organizationName.trim()
      });

      setOtpSending(false);
      if (res.data.success) {
        if (res.data.emailRelayPayload) {
          relayCloudEmail(res.data.emailRelayPayload);
        }
        setOtpSent(true);
        setOtpTimer(60);

        if (res.data.devOtp) {
          setEnteredOtp(res.data.devOtp);
        }

        const isCloudOtp = res.data.devOtp && (res.data.deliveredVia === 'cloud_secure_otp' || res.data.deliveredVia === 'cloud_verified');
        const noticeMsg = isCloudOtp
          ? `6-digit OTP code: ${res.data.devOtp} (Sent to ${email.trim()})`
          : `6-digit OTP has been sent to ${email.trim()}. Please check your email inbox.`;

        setSuccessMessage(noticeMsg);
        addToast({
          title: 'OTP Ready',
          message: noticeMsg,
          type: 'success'
        });
      } else {
        setOtpSent(false);
        const msg = res.data.message || (authMode === 'forgot' ? 'No registered account found with this email.' : 'Could not send verification OTP.');
        setErrorMessage(msg);
        addToast({
          title: authMode === 'forgot' ? 'Account Notice' : 'Verification Error',
          message: msg,
          type: 'error'
        });
      }
    } catch (err) {
      setOtpSending(false);
      setOtpSent(false);
      const is404 = err.response?.status === 404;
      const errMsg =
        err.response?.data?.message || (authMode === 'forgot' ? 'No registered account found with this email. Please check your email or sign up.' : 'Failed to send OTP. Please check your email.');
      setErrorMessage(errMsg);
      addToast({
        title: is404 ? 'Account Not Found' : 'Email Notice',
        message: errMsg,
        type: 'error'
      });
    }
  };

  // Step 2: Verify OTP Code
  const handleVerifyOTP = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!otp || otp.trim().length < 6) {
      setErrorMessage('Please enter the 6-digit OTP code.');
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        email: email.trim(),
        otp: otp.trim()
      });
      setOtpVerifying(false);

      if (res.data.success) {
        setOtpVerified(true);
        setSuccessMessage('OTP verified! Please enter your password below.');
        addToast({
          title: 'OTP Verified',
          message: 'Email verified successfully. You can now set your password.',
          type: 'success'
        });
      }
    } catch (err) {
      setOtpVerifying(false);
      setOtpVerified(false);
      setErrorMessage(
        err.response?.data?.message || 'Incorrect OTP code. Please check and try again.'
      );
    }
  };

  // Step 3: Final Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // 1. LOGIN FLOW
    if (authMode === 'login') {
      if (selectedRole === 'admin' && !organizationName.trim()) {
        setErrorMessage('Please enter your Organization Name.');
        return;
      }
      setLoading(true);
      const result = await login(
        email.trim(),
        password,
        selectedRole,
        selectedRole === 'admin' ? organizationName.trim() : undefined
      );
      setLoading(false);
      if (result.success) {
        addToast({
          title: 'Login Successful',
          message: `Welcome, ${result.user.name}!`,
          type: 'success'
        });
        navigate(getDashboardPath(result.user.role));
      } else {
        setErrorMessage(result.message);
      }
      return;
    }

    if (!otpVerified) {
      setErrorMessage('Please verify your OTP code first before setting a password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter the exact same password.');
      return;
    }

    if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      setErrorMessage('Captcha code does not match. Please try again.');
      refreshCaptcha();
      return;
    }

    // 2. PASSENGER SIGN UP FLOW
    if (authMode === 'signup') {
      if (!idCardVerified) {
        setErrorMessage('Please verify your ID card with AI before creating your account.');
        return;
      }

      setLoading(true);
      const result = await register({
        name: username.trim(),
        email: email.trim(),
        password,
        role: 'user',
        otp: otp.trim(),
        organization_name: organizationName.trim(),
        bus_number: busNumber,
        destination,
        id_card_url: idCardBase64,
        id_card_verified: true
      });
      setLoading(false);

      if (result.success) {
        addToast({
          title: 'Passenger Account Created!',
          message: `Welcome to Shuttle Tracker, ${result.user.name}! Assigned to Bus ${busNumber}.`,
          type: 'success'
        });
        navigate(getDashboardPath(result.user.role));
      } else {
        setErrorMessage(result.message);
      }
      return;
    }

    // 3. FORGOT PASSWORD FLOW (Admin, Passenger, Driver)
    if (authMode === 'forgot') {
      setLoading(true);
      try {
        const res = await api.post('/auth/forgot-password/reset', {
          email: email.trim(),
          otp: otp.trim(),
          newPassword: password
        });
        setLoading(false);

        if (res.data.success) {
          addToast({
            title: 'Password Reset Complete',
            message: 'Your password has been updated. Please login.',
            type: 'success'
          });
          setSuccessMessage('Password updated successfully! Switching to Login...');
          setTimeout(() => {
            setAuthMode('login');
          }, 1200);
        }
      } catch (err) {
        setLoading(false);
        setErrorMessage(
          err.response?.data?.message || 'Failed to reset password.'
        );
      }
    }
  };

  const roleConfig = {
    admin: {
      id: 'admin',
      label: 'Admin',
      title: authMode === 'forgot' ? 'Admin Forgot Password' : 'Admin Login',
      subtitle: 'Fleet Operations & Route Control',
      icon: Shield,
      accentGradient: 'from-blue-600 to-indigo-600',
      activeTab: 'bg-blue-600 text-white shadow-md shadow-blue-500/30 border-blue-600',
      btnBg: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25',
      orbColor: 'bg-blue-500/20 dark:bg-blue-500/25',
      btnText: authMode === 'forgot' ? 'Update Admin Password' : 'Login as Admin'
    },
    user: {
      id: 'user',
      label: 'Passenger',
      title:
        authMode === 'signup'
          ? 'Passenger Sign Up (AI ID Verified)'
          : authMode === 'forgot'
          ? 'Passenger Forgot Password'
          : 'Passenger Login',
      subtitle: 'Live Shuttle Tracking & Stop ETAs',
      icon: User,
      accentGradient: 'from-emerald-600 to-teal-600',
      activeTab: 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 border-emerald-600',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25',
      orbColor: 'bg-emerald-500/20 dark:bg-emerald-500/25',
      btnText:
        authMode === 'signup'
          ? 'Create Verified Passenger Account'
          : authMode === 'forgot'
          ? 'Update Passenger Password'
          : 'Login as Passenger'
    },
    driver: {
      id: 'driver',
      label: 'Driver',
      title: authMode === 'forgot' ? 'Driver Forgot Password' : 'Driver Login',
      subtitle: 'In-Cabin Cockpit & GPS Broadcast (Provisioned by Admin)',
      icon: Bus,
      accentGradient: 'from-purple-600 to-violet-600',
      activeTab: 'bg-purple-600 text-white shadow-md shadow-purple-500/30 border-purple-600',
      btnBg: 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/25',
      orbColor: 'bg-purple-500/20 dark:bg-purple-500/25',
      btnText: authMode === 'forgot' ? 'Update Driver Password' : 'Login as Driver'
    }
  };

  const current = roleConfig[selectedRole] || roleConfig.admin;

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-gradient-to-br from-slate-50 via-sky-50/50 to-blue-100/60 dark:from-navy-950 dark:via-slate-950 dark:to-blue-950/40 text-slate-900 dark:text-white flex items-center justify-center p-4 sm:p-6 relative transition-colors duration-500 select-none">
      {/* Background Radar Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1.2px,transparent_1.2px)] dark:bg-[radial-gradient(#38bdf8_1.2px,transparent_1.2px)] [background-size:32px_32px] opacity-20 dark:opacity-20 pointer-events-none" />

      {/* Dynamic Ambient Glow Orbs */}
      <div className={`absolute -top-20 -left-20 w-96 h-96 rounded-full blur-[120px] transition-colors duration-700 pointer-events-none ${current.orbColor}`} />
      <div className={`absolute -bottom-20 -right-20 w-96 h-96 rounded-full blur-[120px] transition-colors duration-700 pointer-events-none ${current.orbColor}`} />

      {/* Single Centered Card */}
      <div className="w-full max-w-[480px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 sm:p-8 relative z-10 my-4">
        {/* Top Bar: Back to Home + Theme Switcher */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-500 transition-colors"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Centered Shuttle Tracker Logo & Role Title */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="relative mb-2.5">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${current.accentGradient} text-white flex items-center justify-center shadow-lg transition-all duration-300`}>
              <Bus className="w-7 h-7 stroke-[2.2]" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            {current.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {current.subtitle}
          </p>
        </div>

        {/* 3 Role Switcher Buttons */}
        <div className="mb-5">
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60">
            {Object.values(roleConfig).map((role) => {
              const Icon = role.icon;
              const isActive = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleSelect(role.id)}
                  className={`flex flex-col items-center justify-center py-2 px-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? role.activeTab
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1 stroke-[2.2]" />
                  <span>{role.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Tabs: Login vs Sign Up (ONLY for Passenger! Removed for Driver & Admin) */}
        {selectedRole === 'user' && authMode !== 'forgot' && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 mb-5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authMode === 'signup'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>
        )}

        {/* Error / Success Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-medium text-center">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs font-bold text-center">
            {successMessage}
          </div>
        )}

        {/* Email OTP Sent Notification */}
        {otpSent && (authMode === 'signup' || authMode === 'forgot') && !otpVerified && (
          <div className="mb-4 p-3 rounded-xl bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-800/80 flex items-center gap-2 text-xs text-brand-700 dark:text-brand-300">
            <Mail className="w-4 h-4 text-brand-500 shrink-0" />
            <span>
              A 6-digit OTP has been sent to <strong>{email}</strong>. Check your inbox and verify below.
            </span>
          </div>
        )}

        {/* =================================================================
            AUTH FORM (LOGIN / PASSENGER SIGN UP / FORGOT PASSWORD)
           ================================================================= */}
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* PASSENGER SIGN UP SPECIFIC FIELDS (Name, Organization, Bus Number, & AI ID Card Upload) */}
          {authMode === 'signup' && selectedRole === 'user' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Full Name (as on ID Card)"
                  id="username"
                  type="text"
                  icon={User}
                  placeholder="Enter your full name"
                  value={username}
                  onChange={handleNameChange}
                  disabled={otpVerified}
                  required
                />

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Organization Name (as on ID Card)
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="orgName"
                      type="text"
                      placeholder="Enter your organization name"
                      value={organizationName}
                      onChange={handleOrgChange}
                      disabled={otpVerified}
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Select Bus Number & Route for Destination */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Bus Number & Route for Destination
                </label>
                <div className="relative">
                  <Bus className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={busNumber}
                    onChange={handleBusSelectChange}
                    disabled={otpVerified}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    {availableShuttles.length > 0 ? (
                      availableShuttles.map((s) => (
                        <option key={s.id} value={s.code}>
                          Bus {s.code} — {s.start_point || 'Hostel'} ➔ {s.destination || 'Campus'} ({s.name})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="S01">Bus S01 — Hostel Complex ➔ Sports Ground</option>
                        <option value="S02">Bus S02 — Gate 2 Terminal ➔ Academic Block</option>
                        <option value="S03">Bus S03 — Sports Arena ➔ Metro Station Link</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Upload ID Card Photo & AI Verification Box (Checks Name, Organization & ID Card Structure — Face is ignored) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-navy-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Upload ID Card for AI Verification</span>
                    </span>
                    <p className="text-[10px] text-slate-400">
                      AI checks your Name, Organization Name, and ID card structure against Admin uploaded ID card (face photo is not compared)
                    </p>
                  </div>

                  <label
                    className={`px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 shrink-0 ${
                      otpVerified || idCardVerifying
                        ? 'bg-slate-400 cursor-not-allowed'
                        : 'cursor-pointer bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {idCardVerifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{idCardBase64 ? 'Re-upload ID' : 'Upload ID Card'}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleIdCardFileChange}
                      className="hidden"
                      disabled={otpVerified || idCardVerifying}
                    />
                  </label>
                </div>

                {idCardBase64 && (
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={idCardBase64}
                      alt="Uploaded ID Card"
                      className="w-16 h-11 rounded-lg object-cover border border-slate-300 dark:border-slate-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-[11px]">
                      {idCardVerifying ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          <span>{idCardMessage}</span>
                        </span>
                      ) : idCardVerified ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{idCardMessage}</span>
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{idCardMessage}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => verifyIdCardImageWithAI(idCardBase64)}
                            className="text-[10px] font-bold text-brand-500 hover:underline"
                          >
                            Retry AI Verification
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ADMIN LOGIN: ORGANIZATION NAME FIELD (No default value, no extra description) */}
          {authMode === 'login' && selectedRole === 'admin' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Organization Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="adminOrgName"
                  type="text"
                  placeholder="Enter Organization Name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                />
              </div>
            </div>
          )}

          {/* EMAIL ADDRESS FIELD + SEND / RESEND OTP BUTTON */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Enter your email"
                  disabled={otpVerified}
                  required
                  className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    otpVerified ? 'opacity-75 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {(authMode === 'signup' || authMode === 'forgot') && !otpVerified && (
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={otpSending || otpTimer > 0}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                    otpTimer > 0
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm'
                  }`}
                >
                  {otpSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : otpTimer > 0 ? (
                    <>
                      <Timer className="w-3.5 h-3.5 text-amber-500" />
                      <span>{otpTimer}s</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{otpSent ? 'Resend OTP' : 'Send OTP'}</span>
                    </>
                  )}
                </button>
              )}

              {otpVerified && (authMode === 'signup' || authMode === 'forgot') && (
                <div className="px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verified</span>
                </div>
              )}
            </div>
          </div>

          {/* OTP INPUT + VERIFY OTP BUTTON */}
          {(authMode === 'signup' || authMode === 'forgot') && otpSent && !otpVerified && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Enter Verification OTP
                </label>
                {otpTimer > 0 ? (
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    Resend available in {otpTimer}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOTP}
                    className="text-[11px] font-bold text-brand-500 hover:underline"
                  >
                    Resend OTP Now
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit OTP"
                    className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm font-mono tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOTP}
                  disabled={otpVerifying || otp.length < 6}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                >
                  {otpVerifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify OTP</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* PASSWORD, CONFIRM PASSWORD & CAPTCHA */}
          {(authMode === 'login' || otpVerified) && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {authMode === 'forgot' ? 'New Password' : 'Password'}
                  </label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setAuthMode('forgot')}
                      className="text-[11px] font-bold text-brand-500 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      authMode === 'forgot'
                        ? 'Enter new password (min 6 chars)'
                        : authMode === 'signup'
                        ? 'Create password (min 6 chars)'
                        : '••••••••'
                    }
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {(authMode === 'signup' || authMode === 'forgot') && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {authMode === 'forgot' ? 'Re-enter New Password' : 'Confirm Password'}
                    </label>
                    {password.length >= 6 && confirmPassword === password && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Password Matched
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password again"
                      required
                      className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm rounded-xl border bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                        confirmPassword.length > 0 && confirmPassword !== password
                          ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500'
                          : password.length >= 6 && confirmPassword === password
                          ? 'border-emerald-400 dark:border-emerald-600 focus:ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {(authMode === 'signup' || authMode === 'forgot') &&
                password.length >= 6 &&
                confirmPassword === password && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Captcha Verification
                    </label>
                    <div className="flex items-center gap-2.5">
                      <div className="relative px-4 py-2 rounded-xl bg-slate-900 text-white font-mono text-base font-black tracking-[0.3em] select-none overflow-hidden border border-slate-700 shadow-inner shrink-0">
                        <span className="relative z-10 italic bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-white to-emerald-300">
                          {captchaCode}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={refreshCaptcha}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-brand-500 transition-colors shrink-0"
                        title="Refresh Captcha"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

                      <div className="relative flex-1">
                        <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          maxLength={5}
                          value={captchaInput}
                          onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                          placeholder="Enter code"
                          required
                          className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

              {(authMode === 'login' ||
                (password.length >= 6 && confirmPassword === password)) && (
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] mt-2 ${current.btnBg}`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>{current.btnText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {authMode === 'forgot' && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-xs font-bold text-slate-500 hover:text-brand-500 transition-colors"
              >
                ← Back to {current.label} Login
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

