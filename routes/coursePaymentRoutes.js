import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Participant from "../models/Participant.js";
import Enrollment from "../models/Enrollment.js";
import Course from "../models/Course.js";
import Employee from "../models/Employee.js";

const router = express.Router();

// ==============================
// 🔥 Razorpay Instance
// ==============================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
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
    const { email, phone, countryCode } = req.body;

    if (!email?.trim() && !phone?.trim()) {
      return res.status(400).json({ message: "Email or phone is required" });
    }

    const cleanEmail = email?.toLowerCase().trim();
    const cleanPhone = phone?.trim();
    const fullPhone = countryCode && cleanPhone ? `${countryCode}${cleanPhone}` : cleanPhone;

    const employee = await Employee.findOne({
      $or: [
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(fullPhone ? [{ phone: fullPhone }] : []),
      ],
    });

    if (!employee) {
      return res.json({ registered: false });
    }

    return res.json({ 
      registered: true, 
      employee: { 
        name: employee.name, 
        email: employee.email, 
        phone: employee.phone 
      } 
    });
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
    const cleanPhone = phone.trim();

    // ============================
    // 🔥 FIND OR CREATE PARTICIPANT
    // ============================
    let participant = await Participant.findOne({
      $or: [{ email: cleanEmail }, { phone: cleanPhone }],
    });

    if (!participant) {
      participant = await Participant.create({
        name,
        email: cleanEmail,
        phone: cleanPhone,
        degree,
        college,
        year,
        countryCode: "+91",
      });
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
    });

    // ============================
    // 🎉 RESPONSE
    // ============================
    res.json({
      success: true,
      message: "Enrollment successful",
      enrollment,
    });

  } catch (error) {
    console.error("Verify Payment Error:", error);
    res.status(500).json({ message: "Payment verification failed" });
  }
});

export default router;