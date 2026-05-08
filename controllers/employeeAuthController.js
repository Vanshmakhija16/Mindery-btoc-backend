import Employee from "../models/Employee.js";
import OrgMember from "../models/OrgMember.js";
import Company   from "../models/Company.js";
import bcrypt    from "bcryptjs";
import jwt       from "jsonwebtoken";
import { sendWhatsAppOtp } from "../services/whatsapp.service.js";
import { sendEmail }       from "../utils/emails.js";

const otpStore      = new Map();   // signup OTPs (keyed by fullPhone) — existing
const loginOtpStore = new Map();   // login OTPs (keyed by identifier) — new

// ── Email OTP helper (signup + login) ────────────────────────────────────────
const sendOtpByEmail = async (to, otp, purpose = "verification") => {
  const subject = purpose === "login"
    ? "Your Mindery login code"
    : "Your Mindery verification code";
  const text = `Your OTP is ${otp}. It expires in 5 minutes.`;
  const html = `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a;">
      <h2 style="color:#DE6875;margin:0 0 12px;">Your Mindery code</h2>
      <p style="font-size:14px;color:#555;margin:0 0 16px;">
        Use the OTP below to ${purpose === "login" ? "sign in to" : "verify"} your Mindery account.
      </p>
      <div style="font-size:30px;letter-spacing:8px;font-weight:700;color:#DE6875;
                  background:#fff5f6;border:1px solid #fde8ea;border-radius:12px;
                  padding:14px 20px;text-align:center;margin:0 0 16px;">${otp}</div>
      <p style="font-size:12px;color:#888;margin:0;">This code expires in 5 minutes. If you didn't request it, ignore this email.</p>
    </div>`;
  await sendEmail({ to, subject, text, html });
};

const detectCompanyByDomain = async (email) => {
  if (!email) return null;
  const domain = email.split("@").pop().toLowerCase().trim();
  try {
    const company = await Company.findOne({ domainPatterns: { $in: [domain] } });
    if (!company) return null;
    return (!company.contractExpiry || new Date(company.contractExpiry) > new Date()) ? company : null;
  } catch { return null; }
};


// const detectCompanyByDomain = async (email) => { 

  
  

  // 

// }

const findCompanyByReferralCode = async (code) => {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  const company = await Company.findOne({ referralCodes: { $elemMatch: { $regex: new RegExp(`^${trimmed}$`, "i") } } });
  if (!company) return null;
  return (!company.contractExpiry || new Date(company.contractExpiry) > new Date()) ? company : null;
};

/* ─── SEND OTP ─────────────────────────────────────────────────────────────── */
export const sendOtp = async (req, res) => {
  try {
    const { email, phone, countryCode } = req.body;
    if (!phone || !countryCode || !email) return res.status(400).json({ message: "Phone, country code and email are required" });
    const fullPhone = `${countryCode}${phone}`;
    const company = await detectCompanyByDomain(email);
    if (company) return res.status(403).json({ message: "You cannot register with a work email. Please use your personal email.", isOrgUser: true, companyName: company.name });
    const existsEmployee = await Employee.findOne({ phone: fullPhone });
    if (existsEmployee) return res.status(400).json({ message: "This number is already registered. Please login instead." });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(fullPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
    await sendWhatsAppOtp(fullPhone, otp);
    return res.json({ message: "OTP sent on WhatsApp" });
  } catch (err) {
    console.error("Send OTP error:", err.message);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ─── VALIDATE COMPANY REFERRAL CODE (existing — unchanged) ────────────────── */
export const validateReferralCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: "Code is required" });
    const company = await findCompanyByReferralCode(code);
    if (!company) return res.status(404).json({ valid: false, message: "Invalid or expired referral code" });
    return res.json({ valid: true, companyId: company._id, companyName: company.name, companySlug: company.slug, companyLogo: company.logo });
  } catch (err) {
    return res.status(500).json({ valid: false, message: "Server error" });
  }
};

/* ─── VALIDATE PERSONAL CA REFERRAL CODE (new) ─────────────────────────────── */
// Used on CA signup — checks if code belongs to an existing user
// Returns referrerName so frontend can show "You're using [Name]'s referral code"
export const validateCaReferralCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ valid: false, message: "Code is required" });
    const referrer = await Employee.findOne({ referralCode: code.trim().toUpperCase() }).select("name referralCode");
    if (!referrer) return res.status(404).json({ valid: false, message: "Invalid referral code" });
    return res.json({ valid: true, referrerName: referrer.name, referralCode: referrer.referralCode });
  } catch (err) {
    return res.status(500).json({ valid: false, message: "Server error" });
  }
};

/* ─── REGISTER ─────────────────────────────────────────────────────────────── */
export const registerEmployee = async (req, res) => {
  try {
    const { name, email, phone, countryCode, password, otp, referralCode, caReferralCode } = req.body;
    if (!name || !email || !phone || !countryCode || !password || !otp) return res.status(400).json({ message: "All fields are required" });
    const fullPhone = `${countryCode}${phone}`;

    const domainCompany = await detectCompanyByDomain(email);
    if (domainCompany) return res.status(403).json({ message: "You cannot register with a work email. Please use your personal email.", isOrgUser: true, companyName: domainCompany.name });

    const record = otpStore.get(fullPhone);
    if (!record) return res.status(400).json({ message: "OTP expired or not requested" });
    if (Date.now() > record.expiresAt) { otpStore.delete(fullPhone); return res.status(400).json({ message: "OTP expired" }); }
    if (record.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    otpStore.delete(fullPhone);

    // ── Company referral (existing — unchanged) ──
    let mappedCompanyId = null, mappedCompanySlug = null, mappedCompanyName = null, mappedCompanyLogo = null;
    if (referralCode?.trim()) {
      const refCompany = await findCompanyByReferralCode(referralCode.trim());
      if (!refCompany) return res.status(400).json({ message: "Invalid or expired referral code." });
      mappedCompanyId = refCompany._id; mappedCompanySlug = refCompany.slug;
      mappedCompanyName = refCompany.name; mappedCompanyLogo = refCompany.logo;
    }

    // ── Personal CA referral (new) ──
    // We record who referred this user. Admin manually credits 5 CAD to referrer.
    let referredByEmployeeId = null;
    if (caReferralCode?.trim()) {
      const referrer = await Employee.findOne({ referralCode: caReferralCode.trim().toUpperCase() });
      if (referrer) {
        referredByEmployeeId = referrer._id;
        console.log(`CA Referral: new user referred by ${referrer.name} | code: ${caReferralCode}`);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Employee pre-save auto-generates referralCode (MIN-XXXXXX)
    const employee = await Employee.create({
      name, email, phone: fullPhone, password: hashedPassword,
      companyId: mappedCompanyId,
      referredBy: referredByEmployeeId,
    });

    const token = jwt.sign(
      { id: employee._id, phone: employee.phone, role: "employee", companyId: mappedCompanyId },
      process.env.JWT_SECRET, { expiresIn: "7d" }
    );

    console.log(`New Employee: ${email} | referralCode: ${employee.referralCode} | referredBy: ${referredByEmployeeId || "none"}`);

    return res.status(201).json({
      message: "Signup successful", token,
      employee: {
        id: employee._id, _id: employee._id,
        name: employee.name, email: employee.email, phone: employee.phone,
        userType: "employee", referralCode: employee.referralCode,
        companyId: mappedCompanyId, companyName: mappedCompanyName,
        companySlug: mappedCompanySlug, companyLogo: mappedCompanyLogo,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Signup failed" });
  }
};

/* ─── LOGIN ────────────────────────────────────────────────────────────────── */
export const loginEmployee = async (req, res) => {
  try {
    const { phone, countryCode, password } = req.body;
    if (!phone || !countryCode || !password) return res.status(400).json({ message: "Phone, country code and password are required" });
    const fullPhone = `${countryCode}${phone}`;
    const employee = await Employee.findOne({ phone: fullPhone }).populate("companyId", "name slug logo primaryColor accentColor");
    // Only redirect to org portal if the number is in OrgMember but NOT in Employee
    if (!employee) {
      const member = await OrgMember.findOne({ phone: fullPhone });
      if (member) return res.status(403).json({ message: "This number is registered with an organization account. Please login via the Organization Portal.", isOrgUser: true });
      return res.status(404).json({ message: "Account not found" });
    }
    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) return res.status(401).json({ message: "Invalid password" });
    const company = employee.companyId;
    const token = jwt.sign({ id: employee._id, phone: employee.phone, role: "employee", companyId: company?._id || null }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      token,
      employee: {
        _id: employee._id, name: employee.name, email: employee.email, phone: employee.phone,
        userType: "employee",
        referralCode: employee.referralCode,       // returned on every login
        caWalletBalance: employee.caWalletBalance || 0,
        companyId: company?._id || null, companyName: company?.name || null,
        companySlug: company?.slug || null, companyLogo: company?.logo || null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};

/* ─── FORGOT PASSWORD OTP ──────────────────────────────────────────────────── */
export const forgotPasswordSendOtp = async (req, res) => {
  try {
    let { phone, countryCode } = req.body;
    if (!phone || !countryCode) return res.status(400).json({ message: "Phone and country code are required" });
    const cleanPhone = phone.toString().replace(/\D/g, "");
    const cleanCode  = countryCode.toString().replace(/\D/g, "");
    const fullPhone  = cleanPhone.startsWith(cleanCode) ? cleanPhone : `${cleanCode}${cleanPhone}`;
    let user = await OrgMember.findOne({ phone: fullPhone });
    if (!user) user = await Employee.findOne({ phone: fullPhone });
    if (!user) return res.status(404).json({ message: "Account not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp; user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    await sendWhatsAppOtp(fullPhone, otp);
    return res.json({ success: true, message: "OTP sent to your WhatsApp" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ─── RESET PASSWORD ───────────────────────────────────────────────────────── */
export const resetPassword = async (req, res) => {
  try {
    const { phone, countryCode, otp, newPassword } = req.body;
    const cleanPhone = phone.toString().replace(/\D/g, "");
    const cleanCode  = countryCode.toString().replace(/\D/g, "");
    const fullPhone  = cleanPhone.startsWith(cleanCode) ? cleanPhone : `${cleanCode}${cleanPhone}`;
    let user = await OrgMember.findOne({ phone: fullPhone, otp, otpExpires: { $gt: Date.now() } });
    let userType = "org_member";
    if (!user) { user = await Employee.findOne({ phone: fullPhone, otp, otpExpires: { $gt: Date.now() } }); userType = "employee"; }
    if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined; user.otpExpires = undefined;
    await user.save();
    const token = jwt.sign({ id: user._id, phone: user.phone, role: userType, companyId: user.companyId || null }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ success: true, message: "Password updated successfully", token, employee: { _id: user._id, name: user.name, email: user.email, phone: user.phone, userType } });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Reset password failed" });
  }
};

/* ─── GET ME ───────────────────────────────────────────────────────────────── */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({ success: true, employee: req.employee });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─── SIGNUP: SEND OTP TO EMAIL (FALLBACK) ─────────────────────────────────── */
// Frontend calls this when WhatsApp didn't deliver. We reuse the SAME phone-keyed
// otpStore so the existing /signup endpoint can verify regardless of channel.
export const sendSignupOtpEmail = async (req, res) => {
  try {
    const { email, phone, countryCode } = req.body;
    if (!email || !phone || !countryCode) {
      return res.status(400).json({ message: "Email, phone and country code are required" });
    }
    const fullPhone = `${countryCode}${phone}`;
    const company = await detectCompanyByDomain(email);
    if (company) {
      return res.status(403).json({
        message: "You cannot register with a work email. Please use your personal email.",
        isOrgUser: true, companyName: company.name,
      });
    }
    const existing = await Employee.findOne({ phone: fullPhone });
    if (existing) {
      return res.status(400).json({ message: "This number is already registered. Please login instead." });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(fullPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000, channel: "email" });
    await sendOtpByEmail(email, otp, "verification");
    return res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Send signup email OTP error:", err.message);
    return res.status(500).json({ message: "Failed to send OTP to email" });
  }
};

/* ─── LOGIN: SEND OTP (PHONE OR EMAIL) ─────────────────────────────────────── */
// body: { channel: "phone" | "email", phone?, countryCode?, email? }
export const sendLoginOtp = async (req, res) => {
  try {
    const { channel, phone, countryCode, email } = req.body;
    if (channel !== "phone" && channel !== "email") {
      return res.status(400).json({ message: "channel must be 'phone' or 'email'" });
    }

    let user, identifier, sendVia;
    if (channel === "phone") {
      if (!phone || !countryCode) return res.status(400).json({ message: "Phone and country code required" });
      const fullPhone = `${countryCode}${phone}`;
      user = await Employee.findOne({ phone: fullPhone });
      if (!user) {
        const member = await OrgMember.findOne({ phone: fullPhone });
        if (member) return res.status(403).json({ message: "This number is registered with an organization account. Please login via the Organization Portal.", isOrgUser: true });
        return res.status(404).json({ message: "No account found with this number" });
      }
      identifier = fullPhone;
      sendVia    = "phone";
    } else {
      if (!email) return res.status(400).json({ message: "Email required" });
      user = await Employee.findOne({ email: email.toLowerCase().trim() });
      if (!user) return res.status(404).json({ message: "No account found with this email" });
      identifier = user.email;
      sendVia    = "email";
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    loginOtpStore.set(identifier, { otp, expiresAt: Date.now() + 5 * 60 * 1000, userId: user._id });

    if (sendVia === "phone") {
      await sendWhatsAppOtp(identifier, otp);
      return res.json({ message: "OTP sent on WhatsApp", channel: "phone" });
    } else {
      await sendOtpByEmail(identifier, otp, "login");
      return res.json({ message: "OTP sent to your email", channel: "email" });
    }
  } catch (err) {
    console.error("Send login OTP error:", err.message);
    return res.status(500).json({ message: "Failed to send login OTP" });
  }
};

/* ─── LOGIN: VERIFY OTP ────────────────────────────────────────────────────── */
// body: { channel: "phone" | "email", phone?, countryCode?, email?, otp }
export const verifyLoginOtp = async (req, res) => {
  try {
    const { channel, phone, countryCode, email, otp } = req.body;
    if (!otp) return res.status(400).json({ message: "OTP is required" });

    let identifier;
    if (channel === "phone") {
      if (!phone || !countryCode) return res.status(400).json({ message: "Phone and country code required" });
      identifier = `${countryCode}${phone}`;
    } else if (channel === "email") {
      if (!email) return res.status(400).json({ message: "Email required" });
      identifier = email.toLowerCase().trim();
    } else {
      return res.status(400).json({ message: "channel must be 'phone' or 'email'" });
    }

    const record = loginOtpStore.get(identifier);
    if (!record) return res.status(400).json({ message: "OTP expired or not requested" });
    if (Date.now() > record.expiresAt) { loginOtpStore.delete(identifier); return res.status(400).json({ message: "OTP expired" }); }
    if (record.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    loginOtpStore.delete(identifier);

    const employee = await Employee.findById(record.userId).populate("companyId", "name slug logo primaryColor accentColor");
    if (!employee) return res.status(404).json({ message: "Account not found" });

    const company = employee.companyId;
    const token = jwt.sign(
      { id: employee._id, phone: employee.phone, role: "employee", companyId: company?._id || null },
      process.env.JWT_SECRET, { expiresIn: "7d" }
    );
    return res.json({
      token,
      employee: {
        _id: employee._id, name: employee.name, email: employee.email, phone: employee.phone,
        userType: "employee",
        referralCode: employee.referralCode,
        caWalletBalance: employee.caWalletBalance || 0,
        companyId: company?._id || null, companyName: company?.name || null,
        companySlug: company?.slug || null, companyLogo: company?.logo || null,
      },
    });
  } catch (err) {
    console.error("Verify login OTP error:", err);
    return res.status(500).json({ message: "Login verification failed" });
  }
};
