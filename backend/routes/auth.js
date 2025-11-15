// backend/routes/auth.js
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const User = require('../models/User');
const OtpRecord = require('../models/OtpRecord');

const router = express.Router();

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 3);

// Create nodemailer SMTP transporter using env vars (Gmail)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: (process.env.SMTP_SECURE === 'true'), // false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// verify transporter on startup (optional)
transporter.verify((err, success) => {
  if (err) {
    console.error('Nodemailer SMTP verify failed:', err.message || err);
  } else {
    console.log('Nodemailer SMTP ready to send messages');
  }
});

function generateOtp(len = OTP_LENGTH) {
  let otp = '';
  for (let i = 0; i < len; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

function hashOtp(otp, salt) {
  const secret = process.env.OTP_HASH_SECRET || 'otp-secret';
  return crypto.createHmac('sha256', secret).update(otp + salt).digest('hex');
}

// POST /auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    // throttle per email: last OTP created recently?
    const last = await OtpRecord.findOne({ email }).sort({ createdAt: -1 });
    if (last && !last.used && last.expiresAt > new Date()) {
      const secondsSince = (Date.now() - last.createdAt.getTime()) / 1000;
      if (secondsSince < 30) {
        return res.status(429).json({ message: 'Please wait before requesting another OTP' });
      }
    }

    const otp = generateOtp();
    const salt = crypto.randomBytes(8).toString('hex');
    const hashed = hashOtp(otp, salt);
    const otpHash = `${salt}:${hashed}`;

    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const record = new OtpRecord({
      email,
      otpHash,
      createdAt: new Date(),
      expiresAt,
      used: false
    });
    await record.save();

    // send email
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Your login OTP',
      text: `Your OTP is ${otp}. It expires in ${OTP_TTL_MINUTES} minute(s).`,
      html: `<p>Your OTP is <strong>${otp}</strong>. It expires in ${OTP_TTL_MINUTES} minute(s).</p>`
    };

    const info = await transporter.sendMail(mailOptions);

    // For Gmail SMTP, info will be an object; we don't log sensitive info, just a success note
    console.log(`OTP sent to ${email} (messageId: ${info.messageId || 'unknown'})`);

    return res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    console.error('send-otp error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

    const record = await OtpRecord.findOne({ email, used: false }).sort({ createdAt: -1 });
    if (!record) return res.status(400).json({ message: 'No OTP record found or already used' });

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const [salt, storedHash] = record.otpHash.split(':');
    const candidateHash = hashOtp(otp, salt);

    if (candidateHash !== storedHash) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    record.used = true;
    await record.save();

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email });
      await user.save();
    }

    const payload = { userId: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'jwt-secret', { expiresIn: '7d' });

    // you can choose to set cookie here; we'll return token in JSON for frontend to store
    return res.json({ success: true, token, user: { email: user.email } });
  } catch (err) {
    console.error('verify-otp error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
