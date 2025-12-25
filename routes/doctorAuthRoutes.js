import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import btocDoctor from "../models/btocDoctor.js";

const router = express.Router();

// Middleware to verify doctor token
const doctorAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.doctorId = decoded.id || decoded._id;
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ✅ Doctor Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    const doctor = await btocDoctor.findOne({ email: email.toLowerCase() });
    if (!doctor) {
      return res.status(401).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, doctor.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: doctor._id, email: doctor.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
      },
    });
  } catch (err) {
    console.error("Doctor login error:", err);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

// ✅ Get Doctor Appointments
router.get("/appointments", doctorAuthMiddleware, async (req, res) => {
  try {
    const doctor = await btocDoctor.findById(req.doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Import Booking model
    const { default: Booking } = await import("../models/Booking.js");
    
    const appointments = await Booking.find({ doctorId: req.doctorId })
      .sort({ date: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
    });
  }
});

// ✅ Verify Doctor Token
router.get("/verify", doctorAuthMiddleware, async (req, res) => {
  try {
    const doctor = await btocDoctor.findById(req.doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.status(200).json({
      success: true,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        specialization: doctor.specialization,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
});

export default router;
