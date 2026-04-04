import express from "express";
import jwt from "jsonwebtoken";
import Feedback from "../models/Feedback.js";
import Booking from "../models/Booking.js";
import Employee from "../models/Employee.js";

const router = express.Router();

// ── Middleware: require any logged-in user ────────────────────────────────────
function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Login required" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId   = decoded.id || decoded._id;
    req.userName = decoded.name || decoded.userName || "";
    req.userRole = (decoded.role || "").toLowerCase();
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// ── Middleware: admin only ────────────────────────────────────────────────────
function adminOnly(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const role = (decoded.role || "").toLowerCase();
    if (role !== "admin") return res.status(403).json({ success: false, message: "Access denied" });
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// GET /api/feedback/eligibility — check if logged-in user has any bookings
router.get("/eligibility", requireAuth, async (req, res) => {
  try {
    const bookingCount = await Booking.countDocuments({ employeeId: req.userId });
    return res.json({ success: true, eligible: bookingCount > 0 });
  } catch (err) {
    console.error("Eligibility check error:", err);
    return res.status(500).json({ success: false, message: "Failed to check eligibility" });
  }
});

// POST /api/feedback — requires login + must have a booking
router.post("/", requireAuth, async (req, res) => {
  try {
    const { answers, additionalFeedback, platform } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ success: false, message: "answers array is required" });
    }

    // Verify the user has at least one booking
    const bookingCount = await Booking.countDocuments({ employeeId: req.userId });
    if (bookingCount === 0) {
      return res.status(403).json({ success: false, message: "Only users who have booked a session can submit feedback." });
    }

    // Fetch full employee details from DB
    const employee = await Employee.findById(req.userId).select("name email phone").lean();

    const feedback = await Feedback.create({
      userId:             req.userId,
      userName:           employee?.name  || req.userName || "",
      userEmail:          employee?.email || "",
      userPhone:          employee?.phone || "",
      answers,
      additionalFeedback: additionalFeedback || "",
      submittedAt:        new Date(),
      platform:           platform || "web",
    });

    return res.status(201).json({ success: true, message: "Feedback submitted. Thank you!", data: feedback });
  } catch (err) {
    console.error("Feedback POST error:", err);
    return res.status(500).json({ success: false, message: "Failed to save feedback" });
  }
});

// GET /api/feedback — admin view (frontend protected by ProtectedRoute)
router.get("/", async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ submittedAt: -1 }).lean();
    return res.json({ success: true, total: feedbacks.length, data: feedbacks });
  } catch (err) {
    console.error("Feedback GET error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch feedback" });
  }
});

export default router;
