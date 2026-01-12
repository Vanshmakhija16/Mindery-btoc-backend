// import Employee from "../models/Employee.js";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import nodemailer from "nodemailer";

// const otpStore = new Map(); // email -> { otp, expiresAt }

// // ====================== SEND OTP ======================


// export const sendOtp = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email)
//       return res.status(400).json({ message: "Email required" });

//     const existing = await Employee.findOne({ email });
//     if (existing)
//       return res.status(400).json({ message: "Email already registered" });

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 minutes validity

//     // ✅ Create transporter
//     const transporter = nodemailer.createTransport({
//       host: process.env.SMTP_HOST,
//       port: process.env.SMTP_PORT,
//       secure: process.env.SMTP_SECURE === "true",
//       auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS,
//       },
//     });

//     console.log("📨 Sending OTP to:", email);

//     // ✅ Send email
//     const info = await transporter.sendMail({
//       from: process.env.SMTP_FROM,
//       to: email,
//       subject: "Verify your email address",
//       text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
//     });

//     console.log("✅ OTP Email sent successfully:", info.response);

//     // ✅ Only one response here
//     return res.status(200).json({ message: "OTP sent to your email" });
//   } catch (err) {
//     console.error("❌ Error sending OTP:", err);
//     if (!res.headersSent) {
//       return res
//         .status(500)
//         .json({ message: "Failed to send OTP", error: err.message });
//     }
//   }
// };


// // ====================== REGISTER (VERIFY OTP) ======================
// export const registerEmployee = async (req, res) => {
//   try {
//     const { name, email, password, otp } = req.body;

//     if (!name || !email || !password || !otp)
//       return res
//         .status(400)
//         .json({ message: "Name, email, password, and OTP are required" });

//     // ✅ Verify OTP
//     const record = otpStore.get(email);
//     if (!record) return res.status(400).json({ message: "OTP not found or expired" });
//     if (Date.now() > record.expiresAt)
//       return res.status(400).json({ message: "OTP expired" });
//     if (record.otp !== otp)
//       return res.status(400).json({ message: "Invalid OTP" });

//     otpStore.delete(email);

//     const existing = await Employee.findOne({ email });
//     if (existing)
//       return res.status(400).json({ message: "Employee already exists" });

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const employee = await Employee.create({
//       name,
//       email,
//       password: hashedPassword,
//     });

//     const token = jwt.sign(
//       { _id: employee._id, email: employee.email },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.status(201).json({
//       message: "Signup successful",
//       token,
//       employee: {
//         _id: employee._id,
//         name: employee.name,
//         email: employee.email,
//       },
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ====================== LOGIN ======================
// export const loginEmployee = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const employee = await Employee.findOne({ email });
//     if (!employee)
//       return res.status(404).json({ message: "Employee not found" });

//     const valid = await bcrypt.compare(password, employee.password);
//     if (!valid)
//       return res.status(401).json({ message: "Invalid password" });

//     const token = jwt.sign(
//       { id: employee._id, email: employee.email },
//       process.env.JWT_SECRET,
//       { expiresIn: "7d" }
//     );

//     res.json({ token, employee });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };


import Employee from "../models/Employee.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendWhatsAppOtp } from "../services/whatsapp.service.js";

/* ======================================================
   TEMP OTP STORE (in-memory)
   phone -> { otp, expiresAt }
====================================================== */
const otpStore = new Map();

/* ================= SEND OTP (WHATSAPP) ================= */
// export const sendOtp = async (req, res) => {
//   try {
//     let { phone } = req.body;

//     if (!phone) {
//       return res.status(400).json({ message: "Phone number is required" });
//     }

//     // ✅ NORMALIZE PHONE NUMBER HERE
//     // Convert 9571404870 → 919571404870
//     if (!phone.startsWith("91")) {
//       phone = `91${phone}`;
//     }

//     // ❌ check after normalization
//     const exists = await Employee.findOne({ phone });
//     if (exists) {
//       return res.status(400).json({ message: "Phone already registered" });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     otpStore.set(phone, {
//       otp,
//       expiresAt: Date.now() + 5 * 60 * 1000,
//     });

//     await sendWhatsAppOtp(phone, otp);

//     return res.json({ message: "OTP sent on WhatsApp" });

//   } catch (err) {
//     console.error("Send OTP error:", err.response?.data || err.message);
//     return res.status(500).json({ message: "Failed to send OTP" });
//   }
// };


export const sendOtp = async (req, res) => {
  try {
    const { phone, countryCode } = req.body;

    if (!phone || !countryCode) {
      return res.status(400).json({
        message: "Phone number and country code are required",
      });
    }

    // 🌍 GLOBAL phone (NO + sign)
    const fullPhone = `${countryCode}${phone}`;

    // ❌ Check if already registered
    const exists = await Employee.findOne({ phone: fullPhone });
    if (exists) {
      return res.status(400).json({
        message: "Phone already registered",
      });
    }

    // 🔐 Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // ⏳ Store OTP (5 minutes)
    otpStore.set(fullPhone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // 📲 Send OTP via WhatsApp (GetGabs)
    await sendWhatsAppOtp(fullPhone, otp);

    return res.json({
      message: "OTP sent on WhatsApp",
    });

  } catch (err) {
    console.error("Send OTP error:", err.response?.data || err.message);
    return res.status(500).json({
      message: "Failed to send OTP",
    });
  }
};


/* ================= REGISTER (VERIFY OTP & CREATE USER) ================= */
// export const registerEmployee = async (req, res) => {
//   try {
//     const { name, email, phone, password, otp } = req.body;

//     if (!name || !email || !phone || !password || !otp) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     // 🔍 Check OTP
//     const record = otpStore.get(phone);

//     if (!record) {
//       return res.status(400).json({ message: "OTP expired or not requested" });
//     }

//     if (Date.now() > record.expiresAt) {
//       otpStore.delete(phone);
//       return res.status(400).json({ message: "OTP expired" });
//     }

//     if (record.otp !== otp) {
//       return res.status(400).json({ message: "Invalid OTP" });
//     }

//     // ✅ OTP verified → remove from memory
//     otpStore.delete(phone);

//     // ❌ Double-check no user exists
//     const existingUser = await Employee.findOne({
//       $or: [{ email }, { phone }],
//     });
//     if (existingUser) {
//       return res.status(400).json({ message: "User already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     // ✅ Create user ONLY after OTP verification
//     const employee = await Employee.create({
//       name,
//       email,
//       phone,
//       password: hashedPassword,
//     });

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
//     return res.status(500).json({ message: "Signup failed" });
//   }
// };


export const registerEmployee = async (req, res) => {
  try {
    const { name, email, phone, countryCode, password, otp } = req.body;

    if (!name || !email || !phone || !countryCode || !password || !otp) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // 🌍 BUILD GLOBAL PHONE (same as sendOtp)
    const fullPhone = `${countryCode}${phone}`;

    // 🔍 Check OTP using fullPhone
    const record = otpStore.get(fullPhone);

    if (!record) {
      return res.status(400).json({
        message: "OTP expired or not requested",
      });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(fullPhone);
      return res.status(400).json({
        message: "OTP expired",
      });
    }

    if (record.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    // ✅ OTP verified → remove from store
    otpStore.delete(fullPhone);

    // ❌ Double-check no user exists
    const existingUser = await Employee.findOne({
      $or: [{ email }, { phone: fullPhone }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create user with GLOBAL phone
    const employee = await Employee.create({
      name,
      email,
      phone: fullPhone,
      password: hashedPassword,
    });

    // 🔑 JWT
    const token = jwt.sign(
      { id: employee._id, phone: employee.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Signup successful",
      token,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
      },
    });

  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({
      message: "Signup failed",
    });
  }
};

/* ================= LOGIN (PHONE + PASSWORD) ================= */
export const loginEmployee = async (req, res) => {
  try {
    const { phone, countryCode, password } = req.body;

    if (!phone || !countryCode || !password) {
      return res.status(400).json({
        message: "Phone, country code and password are required",
      });
    }

    // 🌍 GLOBAL phone
    const fullPhone = `${countryCode}${phone}`;

    const employee = await Employee.findOne({ phone: fullPhone });
    if (!employee) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) {
      return res.status(401).json({
        message: "Invalid password",
      });
    }

    const token = jwt.sign(
      { id: employee._id, phone: employee.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token, employee });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      message: "Login failed",
    });
  }
};


