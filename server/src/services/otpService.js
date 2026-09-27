/**
 * Brevo (Sendinblue) HTTPS API + cleancodeuniverse@gmail.com Real Email OTP Service
 * - Primary: Brevo Transactional Email REST API (HTTPS port 443 - Cloud/Render & Localhost)
 *   Sender: cleancodeuniverse@gmail.com
 * - Secondary (Localhost Direct): Gmail SMTP via cleancodeuniverse@gmail.com
 *   Ensures real emails arrive in the user's inbox from cleancodeuniverse@gmail.com on localhost immediately.
 */

const nodemailer = require('nodemailer');

const otpStore = new Map(); // key: email.toLowerCase() -> { otp, purpose, expiresAt, verified }

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

let smtpTransporter = null;

const getSmtpTransporter = () => {
  if (smtpTransporter) return smtpTransporter;
  const user = (process.env.EMAIL_USER || 'cleancodeuniverse@gmail.com').trim();
  const pass = (process.env.EMAIL_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) return null;

  smtpTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 4500,
    greetingTimeout: 4500,
    socketTimeout: 7000
  });
  return smtpTransporter;
};

const sendBrevoOTP = async (email, purpose = 'signup') => {
  const normalizedEmail = email.trim().toLowerCase();
  const otp = generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

  otpStore.set(normalizedEmail, { otp, purpose, expiresAt, verified: false });

  const isReset = purpose === 'reset';
  const subject = isReset
    ? 'Shuttle Tracker — Password Reset OTP Code'
    : 'Shuttle Tracker — Account Verification OTP Code';

  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'cleancodeuniverse@gmail.com').trim();
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

  // 1. PRIMARY: Brevo Transactional Email REST API (HTTPS port 443)
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (apiKey && apiKey.length >= 10) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: normalizedEmail }],
          subject,
          htmlContent,
          textContent
        })
      });

      if (response.ok) {
        console.log(`✅ [Brevo API] Sent ${purpose} OTP from ${senderEmail} to ${normalizedEmail}`);
        return {
          success: true,
          deliveredVia: 'brevo',
          senderEmail
        };
      } else {
        const errData = await response.text();
        console.warn(`⚠️ [Brevo API Warning] Status ${response.status}:`, errData);
      }
    } catch (err) {
      console.warn(`⚠️ [Brevo Network Error]:`, err.message);
    }
  }

  // 2. SECONDARY: Direct Gmail Delivery from cleancodeuniverse@gmail.com (Localhost / VPS)
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `${senderName} <${senderEmail}>`,
        to: normalizedEmail,
        subject,
        html: htmlContent,
        text: textContent
      });
      console.log(`✅ [Email Delivered] Sent ${purpose} OTP from ${senderEmail} to ${normalizedEmail}`);
      return {
        success: true,
        deliveredVia: 'email',
        senderEmail
      };
    } catch (smtpErr) {
      console.warn(`⚠️ [SMTP Warning] Could not send via ${senderEmail}:`, smtpErr.message);
    }
  }

  // 3. Fallback only if both Brevo and SMTP fail (e.g. Render Free Tier blocking port 587 without Brevo key)
  console.log(`🔑 [Fallback Console OTP] From: ${senderEmail} -> To: ${normalizedEmail} | OTP: ${otp}`);
  return {
    success: true,
    deliveredVia: 'console_fallback',
    otp,
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
  const normalizedEmail = email.trim().toLowerCase();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'cleancodeuniverse@gmail.com').trim();
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

  // 1. Try Brevo REST API
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (apiKey && apiKey.length >= 10) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: normalizedEmail }],
          subject,
          htmlContent,
          textContent
        })
      });
      if (response.ok) {
        console.log(`✅ [Brevo API] Sent Driver Credentials to ${normalizedEmail}`);
        return { success: true, deliveredVia: 'brevo' };
      }
    } catch (err) {
      console.warn('⚠️ [Brevo Driver Email Warning]:', err.message);
    }
  }

  // 2. Secondary: Direct Gmail SMTP from cleancodeuniverse@gmail.com
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `${senderName} <${senderEmail}>`,
        to: normalizedEmail,
        subject,
        html: htmlContent,
        text: textContent
      });
      console.log(`✅ [Gmail SMTP] Sent Driver Credentials from ${senderEmail} to ${normalizedEmail}`);
      return { success: true, deliveredVia: 'email' };
    } catch (smtpErr) {
      console.warn('⚠️ [SMTP Driver Email Warning]:', smtpErr.message);
    }
  }

  console.log(`📧 [Fallback Console Driver Email] To: ${normalizedEmail} | Password: ${password}`);
  return { success: true, deliveredVia: 'console_fallback' };
};

/**
 * Send Schedule Notification Email from Admin to Driver when Admin sets a schedule
 * or when the driver's schedule time is approaching / active:
 * "Your schedule time is on — please be ready to ride safely!"
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
  const normalizedEmail = email.trim().toLowerCase();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'cleancodeuniverse@gmail.com').trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Shuttle Tracker Admin').trim();

  const subject = isReminder
    ? `⏰ Shuttle Tracker — Your Schedule Time (${departureTime} – ${arrivalTime}) is On — Ready to Ride Safely!`
    : `📅 Shuttle Tracker — New Schedule Assigned (${departureTime} – ${arrivalTime}) — Ready to Ride Safely!`;

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

  // 1. Try Brevo REST API
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (apiKey && apiKey.length >= 10) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: normalizedEmail }],
          subject,
          htmlContent,
          textContent
        })
      });
      if (response.ok) {
        console.log(`✅ [Brevo API] Sent Driver Schedule Email to ${normalizedEmail}`);
        return { success: true, deliveredVia: 'brevo' };
      }
    } catch (err) {
      console.warn('⚠️ [Brevo Schedule Email Warning]:', err.message);
    }
  }

  // 2. Secondary: Direct Gmail SMTP
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `${senderName} <${senderEmail}>`,
        to: normalizedEmail,
        subject,
        html: htmlContent,
        text: textContent
      });
      console.log(`✅ [Gmail SMTP] Sent Driver Schedule Email from ${senderEmail} to ${normalizedEmail}`);
      return { success: true, deliveredVia: 'email' };
    } catch (smtpErr) {
      console.warn('⚠️ [SMTP Schedule Email Warning]:', smtpErr.message);
    }
  }

  console.log(`📧 [Fallback Console Schedule Email] To: ${normalizedEmail} | Schedule: ${departureTime} - ${arrivalTime} (Ready to ride safely!)`);
  return { success: true, deliveredVia: 'console_fallback' };
};

module.exports = {
  sendBrevoOTP,
  verifyOTP,
  sendDriverCredentialsEmail,
  sendDriverScheduleEmail
};


