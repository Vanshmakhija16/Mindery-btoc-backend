import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import BtocDoctor from "../models/btocDoctor.js";
import EmployeeAppointment from "../models/EmployeeAppointment.js";
import Booking from "../models/Booking.js";
import adminAuth from "../middlewares/adminAuth.js";
import CaTherapist from "../models/CaTherapist.js";
import Company from "../models/Company.js";

const router = express.Router();

// ── Multer for company logo uploads ──────────────────────────────────────────
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/logos";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `logo_${Date.now()}${path.extname(file.originalname)}`);
  },
});
const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: 2 * 1024 * 1024 } });

/* ================= ADMIN DASHBOARD ================= */
router.get("/dashboard", async (req, res) => {
  try {
    const totalDoctors = await BtocDoctor.countDocuments();
    const totalAppointments = await EmployeeAppointment.countDocuments();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayAppointments = await EmployeeAppointment.countDocuments({
      slotStart: { $gte: today, $lt: tomorrow }
    });

    const doctorsWithoutSchedule = await BtocDoctor.countDocuments({
      weeklyAvailability: { $size: 0 }
    });

    res.json({
      totalDoctors,
      totalAppointments,
      todayAppointments,
      todayRevenue: 0,
      appointmentsByDay: [],
      appointmentsByDoctor: [],
      appointmentsByMode: [],
      doctorsWithoutSchedule
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Dashboard fetch failed" });
  }
});

/* ================= ADD BTODR DOCTOR ================= */

router.post("/doctors", async (req, res) => {
  try {
    let displayOrder = 9999;

    if (req.body.displayOrder !== undefined && req.body.displayOrder !== null) {
      const val = Number(req.body.displayOrder);
      if (Number.isInteger(val) && val >= 1) {
        displayOrder = val;
      } else {
        displayOrder = 9999;
      }
    }

    const doctor = new BtocDoctor({
      ...req.body,
      displayOrder
    });

    await doctor.save();

    const docObj = doctor.toObject();
    delete docObj.password;

    res.status(201).json({
      message: "Doctor added successfully",
      doctor: docObj
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to add doctor",
      error: error.message
    });
  }
});

/* ================= UPDATE BTODR DOCTOR ================= */

router.put("/doctors/:doctorId",  async (req, res) => {
  try {
    const { doctorId } = req.params;
    const updateData = { ...req.body };

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    if (updateData.displayOrder !== undefined && updateData.displayOrder !== null && updateData.displayOrder !== "") {
      const val = Number(updateData.displayOrder);
      if (Number.isInteger(val) && (val >= 1 || val === 9999)) {
        updateData.displayOrder = val;
      } else {
        updateData.displayOrder = 9999;
      }
    } else {
      const currentDoctor = await BtocDoctor.findById(doctorId);
      if (currentDoctor) {
        updateData.displayOrder = currentDoctor.displayOrder;
      } else {
        updateData.displayOrder = 9999;
      }
    }

    const doctor = await BtocDoctor.findByIdAndUpdate(
      doctorId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    delete doctor.password;

    res.json({
      message: "Doctor updated successfully",
      doctor
    });
  } catch (error) {
    res.status(400).json({
      message: "Failed to update doctor",
      error: error.message
    });
  }
});

/* ================= DELETE BTODR DOCTOR ================= */
router.delete("/doctors/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await BtocDoctor.findByIdAndDelete(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json({ message: "Doctor deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete doctor",
      error: error.message
    });
  }
});


/* ================= GET ALL BTODR DOCTORS ================= */
router.get("/doctors", async (req, res) => {
  try {
    const doctors = await BtocDoctor.find({ role: "doctor", isActive: true })
      .select("-password")
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    res.json(doctors);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch doctors",
      error: error.message
    });
  }
});


/* ================= GET SINGLE BTODR DOCTOR ================= */
router.get("/doctors/:doctorId",  async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await BtocDoctor.findById(doctorId)
      .select("-password")
      .lean();

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.json(doctor);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch doctor",
      error: error.message
    });
  }
});

/* ================= GET DOCTOR'S APPOINTMENTS ================= */
router.get("/doctors/:doctorId/appointments" , async (req, res) => {
  try {
    const { doctorId } = req.params;
    const now = new Date();

    const bookings = await Booking.find({ doctorId })
      .populate("employeeId", "name email phone")
      .sort({ date: -1 })
      .lean();

    if (bookings.length === 0) {
      return res.json({ upcoming: [], past: [] });
    }

    const formatted = bookings.map(b => {
      const slotStart = new Date(`${b.date} ${b.slot.split(" - ")[0]}`);

      return {
        _id: b._id,
        employeeName: b.name,
        employeeEmail: b.email,
        employeePhone: b.employeeId?.phone || "N/A",
        date: b.date,
        slot: b.slot,
        mode: b.mode,
        amount: b.amount,
        duration: b.duration,
        createdAt: b.createdAt,
        slotStart,
      };
    });

    res.json({
      upcoming: formatted.filter(a => a.slotStart >= now),
      past: formatted.filter(a => a.slotStart < now),
    });

  } catch (error) {
    console.error("❌ Error fetching appointments:", error);
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
});


// ─── CANADA PORTAL ADMIN ROUTES ──────────────────────────────────────────────

router.get("/ca/all-doctors", async (req, res) => {
  try {
    const doctors = await BtocDoctor.find({ isActive: true }).select(
      "name email profilePhoto availabilityType consultationOptions onlineModes"
    );
    const caEntries = await CaTherapist.find({}).select(
      "doctorId isActive cadPrice firstSessionCadPrice displayTimezone"
    );
    const caMap = {};
    caEntries.forEach((e) => { caMap[e.doctorId.toString()] = e; });

    const result = doctors.map((d) => ({
      _id: d._id,
      name: d.name,
      email: d.email,
      profilePhoto: d.profilePhoto,
      consultationOptions: d.consultationOptions,
      caAssigned: !!caMap[d._id.toString()],
      caActive: caMap[d._id.toString()]?.isActive || false,
      caEntryId: caMap[d._id.toString()]?._id || null,
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("CA all-doctors error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/ca/assign", async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ success: false, message: "doctorId required" });

    const doctor = await BtocDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const entry = await CaTherapist.findOneAndUpdate(
      { doctorId },
      { doctorId, isActive: true, displayTimezone: "America/Toronto", assignedBy: "admin" },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: "Doctor assigned to CA portal", data: entry });
  } catch (err) {
    console.error("CA assign error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/ca/remove/:doctorId", async (req, res) => {
  try {
    await CaTherapist.findOneAndUpdate(
      { doctorId: req.params.doctorId },
      { isActive: false }
    );
    res.json({ success: true, message: "Doctor removed from CA portal" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════
// COMPANY PORTAL MANAGEMENT (Admin)
// ══════════════════════════════════════════════════════════════════

// GET all companies
router.get("/companies", async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 })
      .populate("doctors", "name profilePhoto specialization");
    res.json({ success: true, data: companies });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET single company
router.get("/companies/:id", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate("doctors", "name profilePhoto specialization")
      .populate("assignedAssessments.assessmentId", "title");
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST create company
router.post("/companies", uploadLogo.single("logo"), async (req, res) => {
  try {
    const {
      name, slug, tagline, website,
      primaryColor, accentColor,
      hrContactEmail, contractExpiry, sessionQuota,
      referralCodes, domainPatterns,
    } = req.body;

    if (!name || !slug) return res.status(400).json({ success: false, message: "Name and slug are required" });

    const existing = await Company.findOne({ slug: slug.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: "Slug already taken" });

    const logo = req.file ? `/${req.file.path.replace(/\\/g, "/")}` : (req.body.logoUrl || "");

    const codes = Array.isArray(referralCodes)
      ? referralCodes.map(c => c.trim().toUpperCase()).filter(Boolean)
      : typeof referralCodes === "string"
        ? referralCodes.split(",").map(c => c.trim().toUpperCase()).filter(Boolean)
        : [];

    const domains = Array.isArray(domainPatterns)
      ? domainPatterns.map(d => d.trim().toLowerCase()).filter(Boolean)
      : typeof domainPatterns === "string"
        ? domainPatterns.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
        : [];

    // sessionQuota: null = unlimited (tenant companies default to unlimited)
    const quota = sessionQuota !== undefined && sessionQuota !== "" && sessionQuota !== null
      ? Number(sessionQuota)
      : null;

    const company = await Company.create({
      name, slug: slug.toLowerCase(), logo, tagline, website,
      primaryColor: primaryColor || "#DE6875",
      accentColor:  accentColor  || "#10191F",
      hrContactEmail, contractExpiry: contractExpiry || null,
      sessionQuota: quota,
      referralCodes: codes,
      domainPatterns: domains,
    });

    res.status(201).json({ success: true, data: company });
  } catch (err) {
    console.error("Create company error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

// PATCH update company
router.patch("/companies/:id", uploadLogo.single("logo"), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const fields = ["name","slug","tagline","website","primaryColor","accentColor","hrContactEmail","contractExpiry"];
    fields.forEach(f => { if (req.body[f] !== undefined) company[f] = req.body[f]; });

    // Handle sessionQuota separately: blank/empty → null (unlimited)
    if (req.body.sessionQuota !== undefined) {
      const sq = req.body.sessionQuota;
      company.sessionQuota = (sq !== "" && sq !== null && sq !== "null") ? Number(sq) : null;
    }

    if (req.file) company.logo = `/${req.file.path.replace(/\\/g, "/")}`;
    else if (req.body.logoUrl !== undefined) company.logo = req.body.logoUrl;

    if (req.body.referralCodes !== undefined) {
      const codes = Array.isArray(req.body.referralCodes)
        ? req.body.referralCodes
        : req.body.referralCodes.split(",");
      company.referralCodes = codes.map(c => c.trim().toUpperCase()).filter(Boolean);
    }

    if (req.body.domainPatterns !== undefined) {
      const domains = Array.isArray(req.body.domainPatterns)
        ? req.body.domainPatterns
        : req.body.domainPatterns.split(",");
      company.domainPatterns = domains.map(d => d.trim().toLowerCase()).filter(Boolean);
    }

    await company.save();
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

// DELETE company
router.delete("/companies/:id", async (req, res) => {
  try {
    await Company.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Company deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST assign doctors to company
router.post("/companies/:id/assign-doctors", async (req, res) => {
  try {
    const { doctorIds } = req.body;
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { doctors: { $each: doctorIds } } },
      { new: true }
    ).populate("doctors", "name profilePhoto specialization");
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE remove doctor from company
router.delete("/companies/:id/doctors/:doctorId", async (req, res) => {
  try {
    await Company.findByIdAndUpdate(req.params.id, { $pull: { doctors: req.params.doctorId } });
    res.json({ success: true, message: "Doctor removed from company" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
