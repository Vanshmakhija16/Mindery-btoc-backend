import Employee from "../models/Employee.js";
import OrgMember from "../models/OrgMember.js";
import Company   from "../models/Company.js";
import bcrypt    from "bcryptjs";
import jwt       from "jsonwebtoken";
import { sendWhatsAppOtp } from "../services/whatsapp.service.js";

const otpStore = new Map();

const detectCompanyByDomain = async (email) => {
  if (!email) return null;
  const domain = email.split("@").pop().toLowerCase().trim();
  try {
    const company = await Company.findOne({ domainPatterns: { $in: [domain] } });
    if (!company) return null;
    return (!company.contractExpiry || new Date(company.contractExpiry) > new Date()) ? company : null;
  } catch { return null; }
};

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
