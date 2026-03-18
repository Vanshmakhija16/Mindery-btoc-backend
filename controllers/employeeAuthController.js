import Employee from "../models/Employee.js";
import OrgMember from "../models/OrgMember.js";
import Company from "../models/Company.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendWhatsAppOtp } from "../services/whatsapp.service.js";

const otpStore = new Map();

/* ─────────────────────────────────────────────────────
   HELPER — detect company from email domain
───────────────────────────────────────────────────── */
const detectCompany = async (email) => {
  console.log("🔍 detectCompany() started");

  if (!email) {
    console.log("❌ No email provided");
    return null;
  }

  console.log("📧 Email received:", email);

  const domain = email.split("@").pop().toLowerCase().trim();
  console.log("🌐 Extracted domain:", domain);

  try {
    const company = await Company.findOne({
      domainPatterns: { $in: [domain] }
    });

    if (!company) {
      console.log("❌ No company matched for domain:", domain);
      return null;
    }

    console.log("✅ Company detected:", company.name);

    const isValid =
      !company.contractExpiry ||
      new Date(company.contractExpiry) > new Date();

    if (!isValid) {
      console.log("⚠️ Company found but contract expired:", company.name);
      return null;
    }

    console.log("🎯 Company valid. Returning company:", company.name);
    return company;

  } catch (err) {
    console.error("🚨 Error in detectCompany:", err);
    return null;
  }
};

/* ─────────────────────────────────────────────────────
   SEND OTP — unchanged, works for both user types
───────────────────────────────────────────────────── */
// export const sendOtp = async (req, res) => {
//   try {
//     const { phone, countryCode } = req.body;

//     if (!phone || !countryCode) {
//       return res.status(400).json({ message: "Phone number and country code are required" });
//     }

//     const fullPhone = `${countryCode}${phone}`;

//     // Check both collections
//     const existsEmployee  = await Employee.findOne({ phone: fullPhone });
//     const existsOrgMember = await OrgMember.findOne({ phone: fullPhone });

//     if (existsEmployee || existsOrgMember) {
//       return res.status(400).json({ message: "Phone already registered" });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     otpStore.set(fullPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

//     await sendWhatsAppOtp(fullPhone, otp);

//     return res.json({ message: "OTP sent on WhatsApp" });
//   } catch (err) {
//     console.error("Send OTP error:", err.message);
//     return res.status(500).json({ message: "Failed to send OTP" });
//   }
// };

export const sendOtp = async (req, res) => {
  try {
    const {  email, phone, countryCode, } = req.body;

    console.log("sendOtp body →", req.body); // 👈 debug log

    if (!phone || !countryCode || !email) {
      return res.status(400).json({
        message: "Phone number, country code and email are required",
        received: { phone, countryCode, email }, // 👈 see exactly what's missing
      });
    }

    const fullPhone = `${countryCode}${phone}`;

    // ── Step 1: Block work/org emails immediately ─────────
    const company = await detectCompany(email);
    if (company) {
      return res.status(403).json({
        message:
          "You cannot register with a work email. Please use your personal email to sign up here.",
        isOrgUser: true,
        companyName: company.name,
      });
    }

    // ── Step 2: Block if phone already in Employee DB ─────
    const existsEmployee = await Employee.findOne({ phone: fullPhone });
    if (existsEmployee) {
      return res.status(400).json({ message: "This number is already registered. Please login instead." });
    }

    // ── Step 3: Phone in OrgMember? → Allow OTP ───────────
    // Same number can exist in OrgMember — still allow with personal email

    // ── Step 4: Send OTP ──────────────────────────────────
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(fullPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    await sendWhatsAppOtp(fullPhone, otp);

    return res.json({ message: "OTP sent on WhatsApp" });

  } catch (err) {
    console.error("Send OTP error:", err.message);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ─────────────────────────────────────────────────────
   REGISTER —  Normal users only
───────────────────────────────────────────────────── */
// export const registerEmployee = async (req, res) => {
//   try {
//     console.log("started")
//     const { name, email, phone, countryCode, password, otp } = req.body;

//     if (!name || !email || !phone || !countryCode || !password || !otp) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     const fullPhone = `${countryCode}${phone}`;

//     // ── Step 1: Block work/org emails immediately ─────────
//     // No one can register in normal portal with a work email domain
//     const company = await detectCompany(email);
//     console.log(company)
//     if (company) {
//       return res.status(403).json({
//         message:
//           "You cannot register with a work email. Please use your personal email to sign up here.",
//         isOrgUser: true,
//         companyName: company.name,
//       });
//     }

//     // ── Step 2: Verify OTP ────────────────────────────────
//     const record = otpStore.get(fullPhone);
//     if (!record)                         return res.status(400).json({ message: "OTP expired or not requested" });
//     if (Date.now() > record.expiresAt) { otpStore.delete(fullPhone); return res.status(400).json({ message: "OTP expired" }); }
//     if (record.otp !== otp)              return res.status(400).json({ message: "Invalid OTP" });
//     otpStore.delete(fullPhone);

//     // ── Step 3: Block if already registered in Employee DB ─
//     // Check email OR phone — either match means duplicate
//     const existingEmployee = await Employee.findOne({ $or: [{ email }, { phone: fullPhone }] });
//     if (existingEmployee) {
//       return res.status(400).json({ message: "Account already exists with this email or phone" });
//     }

//     // ── Step 4: Phone in OrgMember? → Still allow ─────────
//     // User may already have a work account with same number
//     // As long as email is personal (passed Step 1), they can register here too
//     // No block needed — just proceed

//     // ── Step 5: Create Employee with personal email ───────
//     const hashedPassword = await bcrypt.hash(password, 10);

//     const employee = await Employee.create({
//       name,
//       email,
//       phone: fullPhone,
//       password: hashedPassword,
//     });

//     const token = jwt.sign(
//       {
//         id: employee._id,
//         phone: employee.phone,
//         role: "employee",
//         companyId: null,
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     console.log(`✅ New Employee created: ${email} (individual)`);

//     return res.status(201).json({
//       message: "Signup successful",
//       token,
//       employee: {
//         id: employee._id,
//         _id: employee._id,
//         name: employee.name,
//         email: employee.email,
//         phone: employee.phone,
//         userType: "employee",
//         companyId: null,
//         companyName: null,
//       },
//     });

//   } catch (err) {
//     console.error("Register error:", err);
//     return res.status(500).json({ message: "Signup failed" });
//   }
// };

export const registerEmployee = async (req, res) => {
  try {
    const { name, email, phone, countryCode, password, otp } = req.body;

    if (!name || !email || !phone || !countryCode || !password || !otp) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const fullPhone = `${countryCode}${phone}`;

    // ── Step 1: Block work/org emails ─────────────────────
    // By this point phone is already validated in sendOtp
    // Only check email domain here
    const company = await detectCompany(email);
    if (company) {
      return res.status(403).json({
        message:
          "You cannot register with a work email. Please use your personal email to sign up here.",
        isOrgUser: true,
        companyName: company.name,
      });
    }

    // ── Step 2: Verify OTP ────────────────────────────────
    const record = otpStore.get(fullPhone);
    if (!record)                         return res.status(400).json({ message: "OTP expired or not requested" });
    if (Date.now() > record.expiresAt) { otpStore.delete(fullPhone); return res.status(400).json({ message: "OTP expired" }); }
    if (record.otp !== otp)              return res.status(400).json({ message: "Invalid OTP" });
    otpStore.delete(fullPhone);

    // ── Step 3: Create Employee ───────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await Employee.create({
      name,
      email,
      phone: fullPhone,
      password: hashedPassword,
    });

    const token = jwt.sign(
      {
        id: employee._id,
        phone: employee.phone,
        role: "employee",
        companyId: null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`✅ New Employee created: ${email} (individual)`);

    return res.status(201).json({
      message: "Signup successful",
      token,
      employee: {
        id: employee._id,
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        userType: "employee",
        companyId: null,
        companyName: null,
      },
    });

  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Signup failed" });
  }
};

/* ─────────────────────────────────────────────────────
   LOGIN — tries OrgMember first, then Employee
   Same endpoint, same page, works for everyone
───────────────────────────────────────────────────── */
export const loginEmployee = async (req, res) => {
  try {
    console.log("login function starts");
    const { phone, countryCode, password } = req.body;

    if (!phone || !countryCode || !password) {
      return res.status(400).json({ message: "Phone, country code and password are required" });
    }

    const fullPhone = `${countryCode}${phone}`;

    // ── Step 1: Check if number belongs to OrgMember ──────
    const member = await OrgMember.findOne({ phone: fullPhone });
    console.log(member, "member");

    if (member) {
      return res.status(403).json({
        message:
          "This number is registered with an organization account. Please login via the Organization Portal or sign up again with your personal email.",
        isOrgUser: true,
      });
    }

    // ── Step 2: Check if number exists in Employee DB ─────
    const employee = await Employee.findOne({ phone: fullPhone });

    if (!employee) {
      return res.status(404).json({ message: "Account not found" });
    }

    // ── Step 3: Validate password ─────────────────────────
    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) return res.status(401).json({ message: "Invalid password" });

    // ── Step 4: Generate token & return response ──────────
    const token = jwt.sign(
      {
        id: employee._id,
        phone: employee.phone,
        role: "employee",
        companyId: null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      employee: {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        userType: "employee",
        companyId: null,
        companyName: null,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};
/* ─────────────────────────────────────────────────────
   FORGOT PASSWORD — tries both collections
───────────────────────────────────────────────────── */
export const forgotPasswordSendOtp = async (req, res) => {
  try {
    let { phone, countryCode } = req.body;

    if (!phone || !countryCode) {
      return res.status(400).json({ message: "Phone and country code are required" });
    }

    const cleanPhone = phone.toString().replace(/\D/g, "");
    const cleanCode  = countryCode.toString().replace(/\D/g, "");
    const fullPhone  = cleanPhone.startsWith(cleanCode) ? cleanPhone : `${cleanCode}${cleanPhone}`;

    // Try OrgMember first, then Employee
    let user = await OrgMember.findOne({ phone: fullPhone });
    if (!user) user = await Employee.findOne({ phone: fullPhone });

    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendWhatsAppOtp(fullPhone, otp);

    return res.json({ success: true, message: "OTP sent to your WhatsApp" });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
};

/* ─────────────────────────────────────────────────────
   RESET PASSWORD — tries both collections
───────────────────────────────────────────────────── */
export const resetPassword = async (req, res) => {
  try {
    const { phone, countryCode, otp, newPassword } = req.body;

    const cleanPhone = phone.toString().replace(/\D/g, "");
    const cleanCode  = countryCode.toString().replace(/\D/g, "");
    const fullPhone  = cleanPhone.startsWith(cleanCode) ? cleanPhone : `${cleanCode}${cleanPhone}`;

    // Try OrgMember first, then Employee
    let user     = await OrgMember.findOne({ phone: fullPhone, otp, otpExpires: { $gt: Date.now() } });
    let userType = "org_member";

    if (!user) {
      user     = await Employee.findOne({ phone: fullPhone, otp, otpExpires: { $gt: Date.now() } });
      userType = "employee";
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.password    = await bcrypt.hash(newPassword, 10);
    user.otp         = undefined;
    user.otpExpires  = undefined;
    await user.save();

    const token = jwt.sign(
      {
        id: user._id,
        phone: user.phone,
        role: userType,
        companyId: user.companyId ? user.companyId.toString() : null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Password updated successfully",
      token,
      employee: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        userType,
      },
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Reset password failed" });
  }
};

/* ─────────────────────────────────────────────────────
   GET ME — unchanged
───────────────────────────────────────────────────── */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({ success: true, employee: req.employee });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// // import Employee from "../models/Employee.js";
// // import bcrypt from "bcryptjs";
// // import jwt from "jsonwebtoken";
// // import nodemailer from "nodemailer";

// // const otpStore = new Map(); // email -> { otp, expiresAt }

// // // ====================== SEND OTP ======================


// // export const sendOtp = async (req, res) => {
// //   try {
// //     const { email } = req.body;
// //     if (!email)
// //       return res.status(400).json({ message: "Email required" });

// //     const existing = await Employee.findOne({ email });
// //     if (existing)
// //       return res.status(400).json({ message: "Email already registered" });

// //     const otp = Math.floor(100000 + Math.random() * 900000).toString();
// //     otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 minutes validity

// //     // ✅ Create transporter
// //     const transporter = nodemailer.createTransport({
// //       host: process.env.SMTP_HOST,
// //       port: process.env.SMTP_PORT,
// //       secure: process.env.SMTP_SECURE === "true",
// //       auth: {
// //         user: process.env.SMTP_USER,
// //         pass: process.env.SMTP_PASS,
// //       },
// //     });

// //     console.log("📨 Sending OTP to:", email);

// //     // ✅ Send email
// //     const info = await transporter.sendMail({
// //       from: process.env.SMTP_FROM,
// //       to: email,
// //       subject: "Verify your email address",
// //       text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
// //     });

// //     console.log("✅ OTP Email sent successfully:", info.response);

// //     // ✅ Only one response here
// //     return res.status(200).json({ message: "OTP sent to your email" });
// //   } catch (err) {
// //     console.error("❌ Error sending OTP:", err);
// //     if (!res.headersSent) {
// //       return res
// //         .status(500)
// //         .json({ message: "Failed to send OTP", error: err.message });
// //     }
// //   }
// // };


// // // ====================== REGISTER (VERIFY OTP) ======================
// // export const registerEmployee = async (req, res) => {
// //   try {
// //     const { name, email, password, otp } = req.body;

// //     if (!name || !email || !password || !otp)
// //       return res
// //         .status(400)
// //         .json({ message: "Name, email, password, and OTP are required" });

// //     // ✅ Verify OTP
// //     const record = otpStore.get(email);
// //     if (!record) return res.status(400).json({ message: "OTP not found or expired" });
// //     if (Date.now() > record.expiresAt)
// //       return res.status(400).json({ message: "OTP expired" });
// //     if (record.otp !== otp)
// //       return res.status(400).json({ message: "Invalid OTP" });

// //     otpStore.delete(email);

// //     const existing = await Employee.findOne({ email });
// //     if (existing)
// //       return res.status(400).json({ message: "Employee already exists" });

// //     const hashedPassword = await bcrypt.hash(password, 10);
// //     const employee = await Employee.create({
// //       name,
// //       email,
// //       password: hashedPassword,
// //     });

// //     const token = jwt.sign(
// //       { _id: employee._id, email: employee.email },
// //       process.env.JWT_SECRET,
// //       { expiresIn: "7d" }
// //     );

// //     res.status(201).json({
// //       message: "Signup successful",
// //       token,
// //       employee: {
// //         _id: employee._id,
// //         name: employee.name,
// //         email: employee.email,
// //       },
// //     });
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // };

// // // ====================== LOGIN ======================
// // export const loginEmployee = async (req, res) => {
// //   try {
// //     const { email, password } = req.body;
// //     const employee = await Employee.findOne({ email });
// //     if (!employee)
// //       return res.status(404).json({ message: "Employee not found" });

// //     const valid = await bcrypt.compare(password, employee.password);
// //     if (!valid)
// //       return res.status(401).json({ message: "Invalid password" });

// //     const token = jwt.sign(
// //       { id: employee._id, email: employee.email },
// //       process.env.JWT_SECRET,
// //       { expiresIn: "7d" }
// //     );

// //     res.json({ token, employee });
// //   } catch (err) {
// //     res.status(500).json({ error: err.message });
// //   }
// // };


// import Employee from "../models/Employee.js";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import { sendWhatsAppOtp } from "../services/whatsapp.service.js";

// /* ======================================================
//    TEMP OTP STORE (in-memory)
//    phone -> { otp, expiresAt }
// ====================================================== */
// const otpStore = new Map();

// /* ================= SEND OTP (WHATSAPP) ================= */
// // export const sendOtp = async (req, res) => {
// //   try {
// //     let { phone } = req.body;

// //     if (!phone) {
// //       return res.status(400).json({ message: "Phone number is required" });
// //     }

// //     // ✅ NORMALIZE PHONE NUMBER HERE
// //     // Convert 9571404870 → 919571404870
// //     if (!phone.startsWith("91")) {
// //       phone = `91${phone}`;
// //     }

// //     // ❌ check after normalization
// //     const exists = await Employee.findOne({ phone });
// //     if (exists) {
// //       return res.status(400).json({ message: "Phone already registered" });
// //     }

// //     const otp = Math.floor(100000 + Math.random() * 900000).toString();

// //     otpStore.set(phone, {
// //       otp,
// //       expiresAt: Date.now() + 5 * 60 * 1000,
// //     });

// //     await sendWhatsAppOtp(phone, otp);

// //     return res.json({ message: "OTP sent on WhatsApp" });

// //   } catch (err) {
// //     console.error("Send OTP error:", err.response?.data || err.message);
// //     return res.status(500).json({ message: "Failed to send OTP" });
// //   }
// // };


// export const sendOtp = async (req, res) => {
//   try {
//     const { phone, countryCode } = req.body;

//     if (!phone || !countryCode) {
//       return res.status(400).json({
//         message: "Phone number and country code are required",
//       });
//     }

//     // 🌍 GLOBAL phone (NO + sign)
//     const fullPhone = `${countryCode}${phone}`;

//     // ❌ Check if already registered
//     const exists = await Employee.findOne({ phone: fullPhone });
//     if (exists) {
//       return res.status(400).json({
//         message: "Phone already registered",
//       });
//     }

//     // 🔐 Generate OTP
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     // ⏳ Store OTP (5 minutes)
//     otpStore.set(fullPhone, {
//       otp,
//       expiresAt: Date.now() + 5 * 60 * 1000,
//     });

//     // 📲 Send OTP via WhatsApp (GetGabs)
//     await sendWhatsAppOtp(fullPhone, otp);

//     return res.json({
//       message: "OTP sent on WhatsApp",
//     });

//   } catch (err) {
//     console.error("Send OTP error:", err.response?.data || err.message);
//     return res.status(500).json({
//       message: "Failed to send OTP",
//     });
//   }
// };


// /* ================= REGISTER (VERIFY OTP & CREATE USER) ================= */
// // export const registerEmployee = async (req, res) => {
// //   try {
// //     const { name, email, phone, password, otp } = req.body;

// //     if (!name || !email || !phone || !password || !otp) {
// //       return res.status(400).json({ message: "All fields are required" });
// //     }

// //     // 🔍 Check OTP
// //     const record = otpStore.get(phone);

// //     if (!record) {
// //       return res.status(400).json({ message: "OTP expired or not requested" });
// //     }

// //     if (Date.now() > record.expiresAt) {
// //       otpStore.delete(phone);
// //       return res.status(400).json({ message: "OTP expired" });
// //     }

// //     if (record.otp !== otp) {
// //       return res.status(400).json({ message: "Invalid OTP" });
// //     }

// //     // ✅ OTP verified → remove from memory
// //     otpStore.delete(phone);

// //     // ❌ Double-check no user exists
// //     const existingUser = await Employee.findOne({
// //       $or: [{ email }, { phone }],
// //     });
// //     if (existingUser) {
// //       return res.status(400).json({ message: "User already exists" });
// //     }

// //     const hashedPassword = await bcrypt.hash(password, 10);

// //     // ✅ Create user ONLY after OTP verification
// //     const employee = await Employee.create({
// //       name,
// //       email,
// //       phone,
// //       password: hashedPassword,
// //     });

// //     const token = jwt.sign(
// //       { id: employee._id, phone: employee.phone },
// //       process.env.JWT_SECRET,
// //       { expiresIn: "7d" }
// //     );

// //     return res.status(201).json({
// //       message: "Signup successful",
// //       token,
// //       employee: {
// //         id: employee._id,
// //         name: employee.name,
// //         email: employee.email,
// //         phone: employee.phone,
// //       },
// //     });
// //   } catch (err) {
// //     console.error("Register error:", err);
// //     return res.status(500).json({ message: "Signup failed" });
// //   }
// // };


// export const registerEmployee = async (req, res) => {
//   try {
//     const { name, email, phone, countryCode, password, otp } = req.body;

//     if (!name || !email || !phone || !countryCode || !password || !otp) {
//       return res.status(400).json({
//         message: "All fields are required",
//       });
//     }

//     // 🌍 BUILD GLOBAL PHONE (same as sendOtp)
//     const fullPhone = `${countryCode}${phone}`;

//     // 🔍 Check OTP using fullPhone
//     const record = otpStore.get(fullPhone);

//     if (!record) {
//       return res.status(400).json({
//         message: "OTP expired or not requested",
//       });
//     }

//     if (Date.now() > record.expiresAt) {
//       otpStore.delete(fullPhone);
//       return res.status(400).json({
//         message: "OTP expired",
//       });
//     }

//     if (record.otp !== otp) {
//       return res.status(400).json({
//         message: "Invalid OTP",
//       });
//     }

//     // ✅ OTP verified → remove from store
//     otpStore.delete(fullPhone);

//     // ❌ Double-check no user exists
//     const existingUser = await Employee.findOne({
//       $or: [{ email }, { phone: fullPhone }],
//     });

//     if (existingUser) {
//       return res.status(400).json({
//         message: "User already exists",
//       });
//     }

//     // 🔐 Hash password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // ✅ Create user with GLOBAL phone
//     const employee = await Employee.create({
//       name,
//       email,
//       phone: fullPhone,
//       password: hashedPassword,
//     });

//     // 🔑 JWT
//     const token = jwt.sign(
//       { id: employee._id, phone: employee.phone },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     return res.status(201).json({
//       message: "Signup successful",
//       token,
//       employee: {
//         id: employee._id,
//         name: employee.name,
//         email: employee.email,
//         phone: employee.phone,
//       },
//     });

//   } catch (err) {
//     console.error("Register error:", err);
//     return res.status(500).json({
//       message: "Signup failed",
//     });
//   }
// };

// /* ================= LOGIN (PHONE + PASSWORD) ================= */
// export const loginEmployee = async (req, res) => {
//   try {
//     const { phone, countryCode, password } = req.body;

//     if (!phone || !countryCode || !password) {
//       return res.status(400).json({
//         message: "Phone, country code and password are required",
//       });
//     }

//     // 🌍 GLOBAL phone
//     const fullPhone = `${countryCode}${phone}`;

//     const employee = await Employee.findOne({ phone: fullPhone });
//     if (!employee) {
//       return res.status(404).json({
//         message: "User not found",
//       });
//     }

//     const valid = await bcrypt.compare(password, employee.password);
//     if (!valid) {
//       return res.status(401).json({
//         message: "Invalid password",
//       });
//     }

//     const token = jwt.sign(
//       { id: employee._id, phone: employee.phone },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     return res.json({ token, employee });

//   } catch (err) {
//     console.error("Login error:", err);
//     return res.status(500).json({
//       message: "Login failed",
//     });
//   }
// };


// // Function 1: Request OTP for Password Reset
// // Function 1: Request OTP for Password Reset
// export const forgotPasswordSendOtp = async (req, res) => {
//   try {
//     let { phone, countryCode } = req.body;

//     if (!phone || !countryCode) {
//       return res.status(400).json({ message: "Phone and country code are required" });
//     }

//     // 1. CLEANING: Remove spaces, dashes, or + signs from both
//     const cleanPhone = phone.toString().replace(/\D/g, "");
//     const cleanCode = countryCode.toString().replace(/\D/g, "");

//     // 2. LOGIC FIX: If the user entered the full number in the phone field,
//     // don't prepend the country code again.
//     const fullPhone = cleanPhone.startsWith(cleanCode) 
//       ? cleanPhone 
//       : `${cleanCode}${cleanPhone}`;

//     console.log("DEBUG: Database search string ->", fullPhone);

//     // 3. Search DB
//     const employee = await Employee.findOne({ phone: fullPhone });
    
//     if (!employee) {
//       return res.status(404).json({ 
//         message: `User not found. (Searched for: ${fullPhone})` 
//       });
//     }

//     // 4. Generate OTP (6 digits)
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     // 5. Save OTP to user record
//     employee.otp = otp;
//     employee.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
//     await employee.save();

//     // 6. Send OTP via WhatsApp
//     try {
//         await sendWhatsAppOtp(fullPhone, otp);
//         console.log(`✅ OTP for ${fullPhone} sent: ${otp}`);
//     } catch (whatsappErr) {
//         console.error("WhatsApp Service Error:", whatsappErr.message);
//         // We still return success if OTP is saved, or handle as error:
//         // return res.status(500).json({ message: "OTP saved but WhatsApp failed" });
//     }

//     return res.json({ 
//         success: true, 
//         message: "OTP sent to your WhatsApp"
//     });

//   } catch (err) {
//     console.error("Forgot Pass OTP Error:", err);
//     return res.status(500).json({ message: "Failed to send OTP" });
//   }
// };

// // STEP 2: RESET PASSWORD
// export const resetPassword = async (req, res) => {
//   try {
//     const { phone, countryCode, otp, newPassword } = req.body;
    
//     // 1. Clean the input to match your DB format (strip non-digits)
//     const cleanPhone = phone.toString().replace(/\D/g, "");
//     const cleanCode = countryCode.toString().replace(/\D/g, "");
    
//     // 2. Ensure country code isn't doubled
//     const fullPhone = cleanPhone.startsWith(cleanCode) 
//       ? cleanPhone 
//       : `${cleanCode}${cleanPhone}`;

//     // 3. Find user with valid OTP
//     const employee = await Employee.findOne({
//       phone: fullPhone,
//       otp: otp,
//       otpExpires: { $gt: Date.now() }
//     });

//     if (!employee) {
//       return res.status(400).json({ message: "Invalid or expired OTP" });
//     }

//     // 4. Hash new password
//     const salt = await bcrypt.genSalt(10);
//     employee.password = await bcrypt.hash(newPassword, salt);

//     // 5. Clear OTP fields
//     employee.otp = undefined;
//     employee.otpExpires = undefined;
//     await employee.save();

//     // 6. GENERATE TOKEN (Auto-Login)
//     const token = jwt.sign(
//       { id: employee._id, phone: employee.phone },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     // 7. Return success + Token + Employee data
//     return res.json({ 
//       success: true, 
//       message: "Password updated successfully",
//       token, 
//       employee: {
//         _id: employee._id,
//         name: employee.name,
//         email: employee.email,
//         phone: employee.phone
//       }
//     });
//   } catch (err) {
//     console.error("Reset Password Error:", err);
//     return res.status(500).json({ message: "Reset password failed" });
//   }
// };


// export const getMe = async (req, res) => {
//   try {
//     // authEmployee middleware already attached employee on req.employee
//     return res.status(200).json({
//       success: true,
//       employee: req.employee,
//     });
//   } catch (err) {
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };
