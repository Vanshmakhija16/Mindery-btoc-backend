// import OrgMember from "../models/orgMember.js";
import Company from "../models/Company.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendWhatsAppOtp } from "../services/whatsapp.service.js";

/* ─────────────────────────────────────────────
   IN-MEMORY OTP STORE
   fullPhone → { otp, expiresAt }
───────────────────────────────────────────── */
const otpStore = new Map();

/* ─────────────────────────────────────────────
   HELPER — detect company from email domain
───────────────────────────────────────────── */
const detectCompany = async (email) => {
  if (!email) return null;
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return null;

  const company = await Company.findOne({ domainPatterns: domain });
  if (!company) return null;

  // Check contract is still active
  const isValid =
    !company.contractExpiry ||
    new Date(company.contractExpiry) > new Date();

  return isValid ? company : null;
};

/* ─────────────────────────────────────────────
   SEND OTP (WhatsApp)
───────────────────────────────────────────── */
export const sendOtp = async (req, res) => {
  try {
    const { phone, countryCode } = req.body;

    if (!phone || !countryCode) {
      return res.status(400).json({ message: "Phone and country code are required" });
    }

    const fullPhone = `${countryCode}${phone}`;

    const exists = await OrgMember.findOne({ phone: fullPhone });
    if (exists) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(fullPhone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    await sendWhatsAppOtp(fullPhone, otp);

    return res.json({ message: "OTP sent on WhatsApp" });
  } catch (err) {
    console.error("OrgMember sendOtp error:", err.message);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ─────────────────────────────────────────────
   REGISTER (verify OTP + create OrgMember)
───────────────────────────────────────────── */
export const registerOrgMember = async (req, res) => {
  try {
    const { name, email, phone, countryCode, password, otp } = req.body;

    if (!name || !email || !phone || !countryCode || !password || !otp) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const fullPhone = `${countryCode}${phone}`;

    // ── Verify OTP ──────────────────────────────────────
    const record = otpStore.get(fullPhone);
    if (!record) {
      return res.status(400).json({ message: "OTP expired or not requested" });
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(fullPhone);
      return res.status(400).json({ message: "OTP expired" });
    }
    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    otpStore.delete(fullPhone);

    // ── Check duplicates ─────────────────────────────────
    const existing = await OrgMember.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: fullPhone }],
    });
    if (existing) {
      return res.status(400).json({ message: "Account already exists" });
    }

    // ── Auto-detect company from email domain ────────────
    const company = await detectCompany(email);
    const companyId = company ? company._id : null;

    if (company) {
      console.log(`✅ OrgMember ${email} linked to: ${company.name}`);
    } else {
      console.log(`ℹ️ OrgMember ${email} — no matching company found`);
    }

    // ── Create OrgMember ─────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    const member = await OrgMember.create({
      name,
      email: email.toLowerCase(),
      phone: fullPhone,
      password: hashedPassword,
      companyId,
    });

    // ── Issue JWT ────────────────────────────────────────
    const token = jwt.sign(
      {
        id: member._id,
        phone: member.phone,
        role: "org_member",
        companyId: companyId ? companyId.toString() : null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Signup successful",
      token,
      member: {
        id: member._id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        companyId: member.companyId || null,
        companyName: company ? company.name : null,
      },
    });
  } catch (err) {
    console.error("OrgMember register error:", err);
    return res.status(500).json({ message: "Signup failed" });
  }
};

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */
export const loginOrgMember = async (req, res) => {
  try {
    const { phone, countryCode, password } = req.body;

    if (!phone || !countryCode || !password) {
      return res.status(400).json({ message: "Phone, country code and password are required" });
    }

    const fullPhone = `${countryCode}${phone}`;

    const member = await OrgMember.findOne({ phone: fullPhone });
    if (!member) {
      return res.status(404).json({ message: "Account not found" });
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Re-detect company on every login (handles renewals/expiry)
    const company = await detectCompany(member.email);
    const companyId = company ? company._id : null;

    // If companyId changed (renewal or new contract), update the record silently
    if (String(member.companyId) !== String(companyId)) {
      member.companyId = companyId;
      await member.save();
    }

    const token = jwt.sign(
      {
        id: member._id,
        phone: member.phone,
        role: "org_member",
        companyId: companyId ? companyId.toString() : null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      member: {
        _id: member._id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        companyId: member.companyId || null,
        companyName: company ? company.name : null,
      },
    });
  } catch (err) {
    console.error("OrgMember login error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};

/* ─────────────────────────────────────────────
   FORGOT PASSWORD — SEND OTP
───────────────────────────────────────────── */
export const forgotPasswordSendOtp = async (req, res) => {
  try {
    const { phone, countryCode } = req.body;

    if (!phone || !countryCode) {
      return res.status(400).json({ message: "Phone and country code are required" });
    }

    const cleanPhone = phone.toString().replace(/\D/g, "");
    const cleanCode = countryCode.toString().replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith(cleanCode)
      ? cleanPhone
      : `${cleanCode}${cleanPhone}`;

    const member = await OrgMember.findOne({ phone: fullPhone });
    if (!member) {
      return res.status(404).json({ message: "Account not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    member.otp = otp;
    member.otpExpires = Date.now() + 10 * 60 * 1000;
    await member.save();

    await sendWhatsAppOtp(fullPhone, otp);

    return res.json({ success: true, message: "OTP sent to your WhatsApp" });
  } catch (err) {
    console.error("OrgMember forgotPassword error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ─────────────────────────────────────────────
   RESET PASSWORD
───────────────────────────────────────────── */
export const resetPassword = async (req, res) => {
  try {
    const { phone, countryCode, otp, newPassword } = req.body;

    const cleanPhone = phone.toString().replace(/\D/g, "");
    const cleanCode = countryCode.toString().replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith(cleanCode)
      ? cleanPhone
      : `${cleanCode}${cleanPhone}`;

    const member = await OrgMember.findOne({
      phone: fullPhone,
      otp,
      otpExpires: { $gt: Date.now() },
    });

    if (!member) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    member.password = await bcrypt.hash(newPassword, 10);
    member.otp = undefined;
    member.otpExpires = undefined;
    await member.save();

    const token = jwt.sign(
      {
        id: member._id,
        phone: member.phone,
        role: "org_member",
        companyId: member.companyId ? member.companyId.toString() : null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Password updated successfully",
      token,
      member: {
        _id: member._id,
        name: member.name,
        email: member.email,
        phone: member.phone,
      },
    });
  } catch (err) {
    console.error("OrgMember resetPassword error:", err);
    return res.status(500).json({ message: "Reset password failed" });
  }
};

/* ─────────────────────────────────────────────
   GET ME (for /me protected route)
───────────────────────────────────────────── */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      member: req.orgMember,
      
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};