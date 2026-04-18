import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Participant from "../models/Participant.js";
import Enrollment from "../models/Enrollment.js";
import Course from "../models/Course.js";
import Employee from "../models/Employee.js";
import { sendWhatsAppOtp } from "../services/whatsapp.service.js";

const router = express.Router();

// ==============================
// 🔥 OTP & Rate Limiting Storage
// ==============================
const courseOtpStore = new Map(); // { phone: { otp, expiresAt } }
const otpRateLimit = new Map(); // { phone: { attempts, resetAt } }
const MAX_OTP_ATTEMPTS = 3;
const OTP_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes

// ==============================
// 🔥 Razorpay Instance
// ==============================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

// ==============================
// 🛠️ UTILITY FUNCTIONS
// ==============================

/**
 * Normalize phone number to consistent format (countryCode + localNumber)
 */
const normalizePhone = (phone, countryCode = "91") => {
  if (!phone) return null;
  const cleanPhone = phone.toString().replace(/[^\d+]/g, "");
  const cleanCode = countryCode.toString().replace(/[^\d]/g, "");
  
  if (cleanPhone.startsWith("+")) {
    return cleanPhone.substring(1); // Remove + for storage
  }
  if (cleanPhone.startsWith(cleanCode)) {
    return cleanPhone;
  }
  return `${cleanCode}${cleanPhone}`;
};

/**
 * Check and enforce OTP rate limiting
 */
const checkRateLimit = (phone) => {
  const now = Date.now();
  const record = otpRateLimit.get(phone);
  
  if (!record) {
    otpRateLimit.set(phone, { attempts: 1, resetAt: now + OTP_RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (now > record.resetAt) {
    otpRateLimit.set(phone, { attempts: 1, resetAt: now + OTP_RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    return false; // Rate limited
  }
  
  record.attempts += 1;
  return true;
};

/**
 * Get remaining attempts for rate limiting
 */
const getRemainingAttempts = (phone) => {
  const record = otpRateLimit.get(phone);
  if (!record) return MAX_OTP_ATTEMPTS;
  
  if (Date.now() > record.resetAt) {
    otpRateLimit.delete(phone);
    return MAX_OTP_ATTEMPTS;
  }
  
  return MAX_OTP_ATTEMPTS - record.attempts;
};

// ==============================
// ✅ SEND OTP FOR COURSE ENROLLMENT
// ==============================
router.post("/send-enrollment-otp", async (req, res) => {
  try {
    const { phone, countryCode = "91" } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const normalizedPhone = normalizePhone(phone, countryCode);

    // Check rate limiting
    if (!checkRateLimit(normalizedPhone)) {
      return res.status(429).json({
        message: "Too many OTP attempts. Please try again later.",
        remainingAttempts: 0,
      });
    }

    // Generate and store OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    courseOtpStore.set(normalizedPhone, {
      otp,
      expiresAt: Date.now() + OTP_EXPIRY,
    });

    // Send OTP via WhatsApp
    await sendWhatsAppOtp(`+${normalizedPhone}`, otp);

    return res.json({
      message: "OTP sent successfully",
      remainingAttempts: getRemainingAttempts(normalizedPhone),
    });
  } catch (err) {
    console.error("Send OTP Error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ==============================
// ✅ VERIFY OTP FOR COURSE ENROLLMENT
// ==============================
router.post("/verify-enrollment-otp", async (req, res) => {
  try {
    const { phone, otp, countryCode = "91" } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required" });
    }

    const normalizedPhone = normalizePhone(phone, countryCode);
    const otpRecord = courseOtpStore.get(normalizedPhone);

    // Check if OTP exists
    if (!otpRecord) {
      return res.status(400).json({
        message: "OTP not requested. Please request a new OTP.",
        code: "OTP_NOT_FOUND",
      });
    }

    // Check if OTP is expired
    if (Date.now() > otpRecord.expiresAt) {
      courseOtpStore.delete(normalizedPhone);
      return res.status(400).json({
        message: "OTP expired. Please request a new one.",
        code: "OTP_EXPIRED",
      });
    }

    // Verify OTP
    if (otpRecord.otp !== otp.toString()) {
      return res.status(400).json({
        message: "Invalid OTP. Please try again.",
        code: "INVALID_OTP",
      });
    }

    // ✅ OTP verified - mark as verified (don't delete yet, keep for enrollment)
    courseOtpStore.set(normalizedPhone, {
      ...otpRecord,
      verified: true,
      verifiedAt: Date.now(),
    });

    return res.json({
      message: "OTP verified successfully",
      verified: true,
    });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    return res.status(500).json({ message: "OTP verification failed" });
  }
});

// ==============================
// ✅ CREATE ORDER
// ==============================
router.post("/create-order", async (req, res) => {
  try {
    const { courseId } = req.body;

    // 🔒 Validate course
    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // 🔥 Create order using DB price
    const totalAmount = course.price;

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // ₹ → paisa
      currency: "INR",
      receipt: `c_${courseId}_${Date.now().toString().slice(-6)}`, // Shorter receipt
    });

    res.json({
      ...order,
      coursePrice: course.price,
      totalAmount,
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ message: "Failed to create order" });
  }
});

// ==============================
// ✅ CHECK ENROLLMENT STATUS
// ==============================
router.post("/check-enrollment", async (req, res) => {
  try {
    const { courseId, email, phone } = req.body;

    if (!courseId || (!email && !phone)) {
      return res.status(400).json({ message: "Course ID and email or phone are required" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const cleanEmail = email?.toLowerCase().trim();
    const cleanPhone = phone?.trim();

    const participant = await Participant.findOne({
      $or: [
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(cleanPhone ? [{ phone: cleanPhone }] : []),
      ],
    });

    if (!participant) {
      return res.json({ enrolled: false });
    }

    const alreadyEnrolled = await Enrollment.findOne({
      participantId: participant._id,
      courseId,
    });

    if (!alreadyEnrolled) {
      return res.json({ enrolled: false });
    }

    return res.json({ enrolled: true, message: "You are already enrolled in this course." });
  } catch (error) {
    console.error("Enrollment Check Error:", error);
    res.status(500).json({ message: "Failed to check enrollment status" });
  }
});

// ==============================
// ✅ CHECK USER REGISTRATION STATUS
// ==============================
router.post("/check-registration", async (req, res) => {
  try {
    const { email, phone } = req.body;

    const cleanEmail = email?.toLowerCase().trim();
    const cleanPhone = phone?.trim();

    // 🔍 Check email separately
    const emailExists = cleanEmail
      ? await Employee.findOne({ email: cleanEmail })
      : null;

    // 🔍 Check phone separately
    const phoneExists = cleanPhone
      ? await Employee.findOne({ phone: cleanPhone })
      : null;

    // 🚫 If any exists → block
    if (emailExists || phoneExists) {
      return res.json({
        registered: true,
        emailExists: !!emailExists,
        phoneExists: !!phoneExists,
        message: "User already exists with this email or phone",
      });
    }

    // ✅ Both unused
    return res.json({ registered: false });

  } catch (error) {
    console.error("Registration Check Error:", error);
    res.status(500).json({ message: "Failed to check registration status" });
  }
});

// ==============================
// ✅ VERIFY PAYMENT + SAVE DATA
// ==============================
router.post("/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
      formData,
      countryCode = "91",
    } = req.body;

    // ============================
    // 🔒 BASIC VALIDATION
    // ============================
    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !courseId ||
      !formData
    ) {
      return res.status(400).json({ message: "Missing required data" });
    }

    const { name, email, phone, degree, college, year } = formData;

    if (!name || !email || !phone) {
      return res.status(400).json({
        message: "Name, Email and Phone are required",
      });
    }

    // ============================
    // 🔐 VERIFY SIGNATURE
    // ============================
    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // ============================
    // 🔒 VERIFY COURSE & AMOUNT
    // ============================
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // ============================
    // 🔥 NORMALIZE DATA
    // ============================
    const cleanEmail = email.toLowerCase().trim();
    const normalizedPhone = normalizePhone(phone, countryCode);

    // ============================
    // ✅ VERIFY OTP (CRITICAL Security Check)
    // ============================
    const otpRecord = courseOtpStore.get(normalizedPhone);

    if (!otpRecord) {
      return res.status(400).json({
        message: "Phone number not verified. Please request OTP first.",
        code: "OTP_NOT_VERIFIED",
      });
    }

    if (!otpRecord.verified) {
      return res.status(400).json({
        message: "Please verify OTP before proceeding with enrollment.",
        code: "OTP_NOT_VERIFIED",
      });
    }

    if (Date.now() - otpRecord.verifiedAt > 30 * 60 * 1000) {
      // OTP verification expires after 30 minutes
      courseOtpStore.delete(normalizedPhone);
      return res.status(400).json({
        message: "OTP verification expired. Please request a new OTP.",
        code: "OTP_VERIFICATION_EXPIRED",
      });
    }

    // ============================
    // 🔥 FIND OR CREATE PARTICIPANT
    // ============================
    let participant = await Participant.findOne({
      $or: [{ email: cleanEmail }, { phone: normalizedPhone }],
    });

    if (!participant) {
      participant = await Participant.create({
        name,
        email: cleanEmail,
        phone: normalizedPhone,
        degree,
        college,
        year,
        countryCode,
      });
    } else {
      // Update participant data if already exists
      participant.name = name;
      participant.email = cleanEmail;
      participant.phone = normalizedPhone;
      participant.degree = degree;
      participant.college = college;
      participant.year = year;
      participant.countryCode = countryCode;
      await participant.save();
    }

    // ============================
    // 🚫 PREVENT DUPLICATE ENROLLMENT
    // ============================
    const alreadyEnrolled = await Enrollment.findOne({
      participantId: participant._id,
      courseId,
    });

    if (alreadyEnrolled) {
      return res.status(400).json({
        message: "You are already enrolled in this course",
      });
    }

    // ============================
    // ✅ SAVE COURSE ACCESS
    // ============================
    const enrollment = await Enrollment.create({
      participantId: participant._id,
      courseId,
      paymentId: razorpay_payment_id,
      paymentStatus: "completed",
      enrolledAt: new Date(),
    });

    // ============================
    // 🧹 CLEANUP OTP AFTER SUCCESSFUL ENROLLMENT
    // ============================
    courseOtpStore.delete(normalizedPhone);

    // ============================
    // 🎉 RESPONSE
    // ============================
    res.json({
      success: true,
      message: "Enrollment successful",
      enrollment: {
        _id: enrollment._id,
        participantId: enrollment.participantId,
        courseId: enrollment.courseId,
        enrolledAt: enrollment.enrolledAt,
      },
    });

  } catch (error) {
    console.error("Verify Payment Error:", error);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

export default router;