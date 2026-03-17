import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import OrgMember from "../models/OrgMember.js";
import Company from "../models/Company.js";

// ─── Nodemailer Transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── In-Memory OTP Store ──────────────────────────────────────────────────────
const otpStore = new Map();

// ─── Helper: Generate 6-digit OTP ────────────────────────────────────────────
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Helper: Send OTP Email ───────────────────────────────────────────────────
async function sendOtpEmail(to, otp, subject, bodyText) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#6366f1">Mindery</h2>
        <p>${bodyText}</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#6366f1;margin:24px 0">${otp}</div>
        <p style="color:#6b7280;font-size:13px">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </div>
    `,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. sendSignupOtp
// ─────────────────────────────────────────────────────────────────────────────
export const sendSignupOtp = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }

    const domain = email.split("@")[1];
    if (!domain) {
      return res.status(400).json({ message: "Invalid email address." });
    }

    const company = await Company.findOne({ domainPatterns: domain });
    if (!company) {
      return res.status(400).json({
        message: "Your email domain is not registered with any organization on Mindery.",
      });
    }

    const existing = await OrgMember.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(email, {
      otp,
      expiresAt,
      purpose: "signup",
      companyId: company._id.toString(),
      name,
      password,
      phone: phone || "",
    });

    await sendOtpEmail(
      email,
      otp,
      "Mindery — Verify your work email",
      `Hi <strong>${name}</strong>, your OTP to complete signup on Mindery is:`
    );

    return res.status(200).json({
      message: "OTP sent to your work email. Please verify to complete signup.",
      companyName: company.name,
    });
  } catch (err) {
    console.error("sendSignupOtp error:", err);
    return res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. verifyOtpAndRegister
// ─────────────────────────────────────────────────────────────────────────────
export const verifyOtpAndRegister = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const record = otpStore.get(email);

    if (!record) {
      return res.status(400).json({ message: "No OTP found for this email. Please request a new one." });
    }
    if (record.purpose !== "signup") {
      return res.status(400).json({ message: "Invalid OTP purpose." });
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }
    if (record.otp !== otp.toString()) {
      return res.status(400).json({ message: "Incorrect OTP." });
    }

    const hashedPassword = await bcrypt.hash(record.password, 10);

    const member = await OrgMember.create({
      name: record.name,
      email,
      password: hashedPassword,
      phone: record.phone,
      companyId: record.companyId,
    });

    otpStore.delete(email);

    const token = jwt.sign(
      { id: member._id, role: "org_member", companyId: member.companyId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: member._id,
        name: member.name,
        email: member.email,
        companyId: member.companyId,
      },
    });
  } catch (err) {
    console.error("verifyOtpAndRegister error:", err);
    return res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. loginOrgMember
// ─────────────────────────────────────────────────────────────────────────────
export const loginOrgMember = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const member = await OrgMember.findOne({ email });
    if (!member) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, member.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: member._id, role: "org_member", companyId: member.companyId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: member._id,
        name: member.name,
        email: member.email,
        companyId: member.companyId.toString(),
      },
    });
  } catch (err) {
    console.error("loginOrgMember error:", err);
    return res.status(500).json({ message: "Login failed. Please try again." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. forgotPasswordSendOtp
// ─────────────────────────────────────────────────────────────────────────────
export const forgotPasswordSendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const member = await OrgMember.findOne({ email });
    if (!member) {
      return res.status(200).json({ message: "If this email is registered, an OTP has been sent." });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore.set(email, { otp, expiresAt, purpose: "reset" });

    await sendOtpEmail(
      email,
      otp,
      "Mindery — Password Reset OTP",
      "You requested a password reset. Use the OTP below to set a new password:"
    );

    return res.status(200).json({ message: "If this email is registered, an OTP has been sent." });
  } catch (err) {
    console.error("forgotPasswordSendOtp error:", err);
    return res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. resetPassword
// ─────────────────────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and new password are required." });
    }

    const record = otpStore.get(email);

    if (!record) {
      return res.status(400).json({ message: "No OTP found for this email. Please request a new one." });
    }
    if (record.purpose !== "reset") {
      return res.status(400).json({ message: "Invalid OTP purpose." });
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }
    if (record.otp !== otp.toString()) {
      return res.status(400).json({ message: "Incorrect OTP." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await OrgMember.findOneAndUpdate({ email }, { password: hashedPassword });

    otpStore.delete(email);

    return res.status(200).json({ message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Password reset failed. Please try again." });
  }
};