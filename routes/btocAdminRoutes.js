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

// Raised limit to 5 MB — logos are compressed on the frontend before upload
// so in practice they'll be well under 1 MB, but this gives headroom.
const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    if (allowed.test(ext)) return cb(null, true);
    cb(new Error("Only image files are allowed (jpg, png, gif, webp, svg)"));
  },
});

// ── Multer error handler wrapper ─────────────────────────────────────────────
// Wraps uploadLogo.single() so MulterError is caught and returned as JSON
// instead of crashing the server with an unhandled exception.
function uploadLogoSingle(req, res, next) {
  uploadLogo.single("logo")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Logo file is too large. Maximum allowed size is 5 MB. Please compress the image and try again.",
      });
    }
    return res.status(400).json({ success: false, message: err.message || "File upload error" });
  });
}

// ── Helper: normalise multer file path → URL-safe "/uploads/logos/file.png" ──
function normalizePath(filePath) {
  return "/" + filePath.replace(/\\/g, "/");
}

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
      if (Number.isInteger(val) && val >= 1) displayOrder = val;
    }
    const doctor = new BtocDoctor({ ...req.body, displayOrder });
    await doctor.save();
    const docObj = doctor.toObject();
    delete docObj.password;
    res.status(201).json({ message: "Doctor added successfully", doctor: docObj });
  } catch (error) {
    res.status(400).json({ message: "Failed to add doctor", error: error.message });
  }
});

/* ================= UPDATE BTODR DOCTOR ================= */
router.put("/doctors/:doctorId", async (req, res) => {
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
      updateData.displayOrder = (Number.isInteger(val) && (val >= 1 || val === 9999)) ? val : 9999;
    } else {
      const currentDoctor = await BtocDoctor.findById(doctorId);
      updateData.displayOrder = currentDoctor ? currentDoctor.displayOrder : 9999;
    }

    const doctor = await BtocDoctor.findByIdAndUpdate(doctorId, updateData, { new: true, runValidators: true }).lean();
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    delete doctor.password;
    res.json({ message: "Doctor updated successfully", doctor });
  } catch (error) {
    res.status(400).json({ message: "Failed to update doctor", error: error.message });
  }
});

/* ================= DELETE BTODR DOCTOR ================= */
router.delete("/doctors/:doctorId", async (req, res) => {
  try {
    const doctor = await BtocDoctor.findByIdAndDelete(req.params.doctorId);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json({ message: "Doctor deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete doctor", error: error.message });
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
    res.status(500).json({ message: "Failed to fetch doctors", error: error.message });
  }
});

/* ================= GET SINGLE BTODR DOCTOR ================= */
router.get("/doctors/:doctorId", async (req, res) => {
  try {
    const doctor = await BtocDoctor.findById(req.params.doctorId).select("-password").lean();
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch doctor", error: error.message });
  }
});

/* ================= GET DOCTOR'S APPOINTMENTS ================= */
router.get("/doctors/:doctorId/appointments", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const now = new Date();
    const bookings = await Booking.find({ doctorId }).populate("employeeId", "name email phone").sort({ date: -1 }).lean();

    if (bookings.length === 0) return res.json({ upcoming: [], past: [] });

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
    await CaTherapist.findOneAndUpdate({ doctorId: req.params.doctorId }, { isActive: false });
    res.json({ success: true, message: "Doctor removed from CA portal" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════
// COMPANY PORTAL MANAGEMENT (Admin)
// ══════════════════════════════════════════════════════════════════

router.get("/companies", async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 })
      .populate("doctors", "name profilePhoto specialization");
    res.json({ success: true, data: companies });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

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

// POST create company — JSON only; logo is stored as a base64 data URL
// (or an external https URL via `logoUrl`). No multer, no disk writes.
router.post("/companies", async (req, res) => {
  try {
    const { name, slug, tagline, website, primaryColor, accentColor,
            hrContactEmail, contractExpiry, sessionQuota,
            referralCodes, domainPatterns,
            logoBase64, logoUrl } = req.body;

    if (!name || !slug) return res.status(400).json({ success: false, message: "Name and slug are required" });

    const existing = await Company.findOne({ slug: slug.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: "Slug already taken" });

    // Prefer the inline data URL; fall back to external URL; otherwise blank.
    const logo = (typeof logoBase64 === "string" && logoBase64.startsWith("data:"))
      ? logoBase64
      : (logoUrl || "");

    const codes = typeof referralCodes === "string"
      ? referralCodes.split(",").map(c => c.trim().toUpperCase()).filter(Boolean)
      : (Array.isArray(referralCodes) ? referralCodes.map(c => c.trim().toUpperCase()).filter(Boolean) : []);

    const domains = typeof domainPatterns === "string"
      ? domainPatterns.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
      : (Array.isArray(domainPatterns) ? domainPatterns.map(d => d.trim().toLowerCase()).filter(Boolean) : []);

    const quota = (sessionQuota !== undefined && sessionQuota !== "" && sessionQuota !== null)
      ? Number(sessionQuota) : null;

    const company = await Company.create({
      name, slug: slug.toLowerCase(), logo, tagline, website,
      primaryColor: primaryColor || "#DE6875",
      accentColor:  accentColor  || "#10191F",
      hrContactEmail, contractExpiry: contractExpiry || null,
      sessionQuota: quota, referralCodes: codes, domainPatterns: domains,
    });

    res.status(201).json({ success: true, data: company });
  } catch (err) {
    console.error("Create company error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

// PATCH update company — JSON only; logo via base64 data URL or external URL.
router.patch("/companies/:id", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const fields = ["name","slug","tagline","website","primaryColor","accentColor","hrContactEmail","contractExpiry"];
    fields.forEach(f => { if (req.body[f] !== undefined) company[f] = req.body[f]; });

    if (req.body.sessionQuota !== undefined) {
      const sq = req.body.sessionQuota;
      company.sessionQuota = (sq !== "" && sq !== null && sq !== "null") ? Number(sq) : null;
    }

    // Logo: data URL takes precedence; explicit empty string clears it.
    if (typeof req.body.logoBase64 === "string" && req.body.logoBase64.startsWith("data:")) {
      company.logo = req.body.logoBase64;
    } else if (req.body.logoUrl !== undefined) {
      company.logo = req.body.logoUrl;
    }

    if (req.body.referralCodes !== undefined) {
      const codes = Array.isArray(req.body.referralCodes)
        ? req.body.referralCodes : req.body.referralCodes.split(",");
      company.referralCodes = codes.map(c => c.trim().toUpperCase()).filter(Boolean);
    }

    if (req.body.domainPatterns !== undefined) {
      const domains = Array.isArray(req.body.domainPatterns)
        ? req.body.domainPatterns : req.body.domainPatterns.split(",");
      company.domainPatterns = domains.map(d => d.trim().toLowerCase()).filter(Boolean);
    }

    await company.save();
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

router.delete("/companies/:id", async (req, res) => {
  try {
    await Company.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Company deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

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

router.delete("/companies/:id/doctors/:doctorId", async (req, res) => {
  try {
    await Company.findByIdAndUpdate(req.params.id, { $pull: { doctors: req.params.doctorId } });
    res.json({ success: true, message: "Doctor removed from company" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
