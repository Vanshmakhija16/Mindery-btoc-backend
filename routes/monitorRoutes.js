import express from "express";
import jwt from "jsonwebtoken";
import Booking from "../models/Booking.js";
import Company from "../models/Company.js";

const router = express.Router();

// ── Auth middleware: only "monitor" role allowed ──────────────────────────────
function monitorAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    if (decoded.role !== "monitor") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    req.monitor = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// ── GET /api/monitor/bookings ─────────────────────────────────────────────────
// Query params: companyId, doctorId, bookingType, date, page, limit
router.get("/bookings", monitorAuth, async (req, res) => {
  try {
    const { companyId, doctorId, bookingType, date, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (companyId) filter.companyId = companyId;
    if (doctorId)  filter.doctorId  = doctorId;
    if (date)      filter.date      = date;  // date is stored as a string e.g. "2024-12-24"

    // "paid" = explicitly "paid" OR field missing/null (older B2C bookings)
    if (bookingType === "paid") {
      filter.$or = [
        { bookingType: "paid" },
        { bookingType: { $exists: false } },
        { bookingType: null },
      ];
    } else if (bookingType === "org_free") {
      filter.bookingType = "org_free";
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("doctorId", "name email specialization")
        .populate("companyId", "name")
        .populate("employeeId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: bookings,
    });
  } catch (err) {
    console.error("Monitor bookings error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
});

// ── GET /api/monitor/bookings/by-company ──────────────────────────────────────
router.get("/bookings/by-company", monitorAuth, async (req, res) => {
  try {
    const groups = await Booking.aggregate([
      {
        $group: {
          _id: { $ifNull: ["$companyId", null] },
          totalBookings: { $sum: 1 },
          paidBookings:    { $sum: { $cond: [{ $eq: ["$bookingType", "paid"] },     1, 0] } },
          orgFreeBookings: { $sum: { $cond: [{ $eq: ["$bookingType", "org_free"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "companies",
          localField: "_id",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $project: {
          companyId: "$_id",
          companyName: {
            $cond: {
              if: { $gt: [{ $size: "$company" }, 0] },
              then: { $arrayElemAt: ["$company.name", 0] },
              else: "Individual / Paid",
            },
          },
          totalBookings: 1,
          paidBookings: 1,
          orgFreeBookings: 1,
        },
      },
      { $sort: { totalBookings: -1 } },
    ]);

    return res.json({ success: true, data: groups });
  } catch (err) {
    console.error("Monitor by-company error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch data" });
  }
});

// ── GET /api/monitor/bookings/by-doctor ───────────────────────────────────────
router.get("/bookings/by-doctor", monitorAuth, async (req, res) => {
  try {
    const groups = await Booking.aggregate([
      {
        $group: {
          _id: "$doctorId",
          totalBookings: { $sum: 1 },
          paidBookings:    { $sum: { $cond: [{ $eq: ["$bookingType", "paid"] },     1, 0] } },
          orgFreeBookings: { $sum: { $cond: [{ $eq: ["$bookingType", "org_free"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "btodoctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      // Also pull the stored doctorName from bookings for fallback
      {
        $lookup: {
          from: "bookings",
          localField: "_id",
          foreignField: "doctorId",
          as: "sampleBooking",
        },
      },
      {
        $project: {
          doctorId: "$_id",
          doctorName: {
            $cond: {
              if: { $gt: [{ $size: "$doctor" }, 0] },
              then: { $arrayElemAt: ["$doctor.name", 0] },
              // fall back to doctorName stored on the booking record
              else: {
                $ifNull: [
                  { $arrayElemAt: ["$sampleBooking.doctorName", 0] },
                  "Unknown Therapist",
                ],
              },
            },
          },
          doctorEmail: {
            $cond: {
              if: { $gt: [{ $size: "$doctor" }, 0] },
              then: { $arrayElemAt: ["$doctor.email", 0] },
              else: "",
            },
          },
          totalBookings: 1,
          paidBookings: 1,
          orgFreeBookings: 1,
        },
      },
      { $sort: { totalBookings: -1 } },
    ]);

    return res.json({ success: true, data: groups });
  } catch (err) {
    console.error("Monitor by-doctor error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch data" });
  }
});

// ── GET /api/monitor/companies ────────────────────────────────────────────────
router.get("/companies", monitorAuth, async (req, res) => {
  try {
    const companies = await Company.find()
      .select("name sessionQuota sessionsUsed contractExpiry hrContactEmail")
      .lean();

    return res.json({ success: true, data: companies });
  } catch (err) {
    console.error("Monitor companies error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch companies" });
  }
});

export default router;
