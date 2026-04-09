import express from "express";
import Company from "../models/Company.js";
import Booking from "../models/Booking.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import EmployeeAppointment from "../models/EmployeeAppointment.js";
import Employee from "../models/Employee.js";
import nodemailer from "nodemailer";
import Assessment from "../models/Assessment.js";

const router = express.Router();

// ─── EMAIL TRANSPORTER ───────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmployeeAppointmentEmail = async (appointment) => {
  try {
    const employee = await Employee.findById(appointment.employee);
    const doctor = await Doctor.findById(appointment.doctor);
    if (!employee || !doctor) return;

    const date = new Date(appointment.slotStart).toLocaleDateString();
    const startTime = new Date(appointment.slotStart).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const endTime = new Date(appointment.slotEnd).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const subject = "✅ Your session is confirmed";

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: employee.email,
      subject,
      text: `Hi ${employee.name},\n\nYour session with Dr. ${doctor.name} has been booked.\n\nDate: ${date}\nTime: ${startTime} - ${endTime}\nMode: ${appointment.mode || "N/A"}\n\nThank you!`,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: doctor.email,
      subject,
      text: `Hi Dr. ${doctor.name},\n\nA new session has been booked by ${employee.name}.\n\nDate: ${date}\nTime: ${startTime} - ${endTime}\nMode: ${appointment.mode || "N/A"}\n\nPlease be prepared.`,
    });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
};

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("id email role");
    if (!user) return res.status(404).json({ error: "User not found" });
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
};

// ─── ROUTES ──────────────────────────────────────────────────

// ✅ Add a new company (UPDATED — now accepts sessionQuota, contractExpiry, hrContactEmail)
router.post("/add", async (req, res) => {
  try {
const { name, logo, domainPatterns, sessionQuota, contractExpiry, hrContactEmail } = req.body;
    if (!name || !domainPatterns || !Array.isArray(domainPatterns) || domainPatterns.length === 0) {
      return res.status(400).json({ error: "Please provide company name and at least one domain pattern" });
    }

    const existingCompany = await Company.findOne({ domainPatterns: { $in: domainPatterns } });
    if (existingCompany) {
      return res.status(400).json({ error: "A company with one of these domains already exists" });
    }

    const company = new Company({
      name,
      logo: logo || "",
      domainPatterns,
      sessionQuota: sessionQuota || 50,
      contractExpiry: contractExpiry || null,
      hrContactEmail: hrContactEmail || "",
    });

    await company.save();

    res.status(201).json({ message: "Company added successfully", company });
  } catch (error) {
    console.error("Error adding company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Get all companies
router.get("/", async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.status(200).json(companies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Get all doctors (for BookEmployeeSession)
router.get("/assigned-doctors", async (req, res) => {
  try {
    const doctors = await Doctor.find({}, "name email specialization imageUrl").sort({
      displayOrder: 1,
      createdAt: -1,
    });
    res.status(200).json({ data: doctors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch doctors" });
  }
});

// ✅ Get all doctors (admin)
router.get("/doctors/all", async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .select("name specialization imageUrl experience expertise languages charges consultationOptions")
      .sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json({ data: doctors });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch all doctors" });
  }
});

// ✅ Get all companies helper (admin)
router.get("/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const companies = await Company.find().select("name email doctors");
    res.status(200).json({ data: companies });
  } catch (err) {
    console.error("Failed to fetch companies:", err);
    res.status(500).json({ error: "Failed to fetch companies" });
  }
});

// ✅ Update company details (name, quota, expiry, hrEmail)
router.put("/:id", async (req, res) => {
  try {
    const { name, logo, domainPatterns, sessionQuota, contractExpiry, hrContactEmail } = req.body;

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });

    if (name) company.name = name;
    if (logo !== undefined) company.logo = logo;
    if (domainPatterns) company.domainPatterns = domainPatterns;
    if (sessionQuota !== undefined) company.sessionQuota = sessionQuota;
    if (contractExpiry !== undefined) company.contractExpiry = contractExpiry;
    if (hrContactEmail !== undefined) company.hrContactEmail = hrContactEmail;

    await company.save();

    res.status(200).json({ message: "Company updated successfully", company });
  } catch (error) {
    console.error("Error updating company:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});



// ✅ Delete a company
router.delete("/:id", async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.status(200).json({ message: "Company deleted successfully" });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({ message: "Server error while deleting company" });
  }
});

// ✅ Get all bookings for a specific company (NEW)
router.get("/:companyId/bookings", async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const bookings = await Booking.find({ companyId })
      .populate("employeeId", "name email phone")
      .populate("doctorId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      company: {
        name: company.name,
        sessionQuota: company.sessionQuota,
        sessionsUsed: company.sessionsUsed,
        contractExpiry: company.contractExpiry,
      },
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Error fetching company bookings:", error);
    res.status(500).json({ error: "Failed to fetch company bookings" });
  }
});

router.patch("/:companyId/assign-doctors", async (req, res) => {
  try {
    const { companyId } = req.params;
    const { doctorIds } = req.body;

    if (!Array.isArray(doctorIds)) {
      return res.status(400).json({ message: "doctorIds must be an array." });
    }

    const company = await Company.findByIdAndUpdate(
      companyId,
      { $set: { doctors: doctorIds } },
      { new: true }
    ).populate("doctors");

    if (!company) {
      return res.status(404).json({ message: "Company not found." });
    }

    return res.status(200).json({
      message: "Doctors assigned successfully.",
      company,
    });
  } catch (err) {
    console.error("Assign doctors error:", err);
    return res.status(500).json({ message: "Failed to assign doctors." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ error: "Not found" });
    // Ensure logo field always exists in response (handles companies created before logo field was added)
    res.json({ ...company, logo: company.logo || "" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get doctors assigned to a specific company
router.get("/:companyId/doctors", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId)
      .populate(
        "doctors",
        "name specialization profession profilePhoto experience expertise languages charges consultationOptions availabilityType dateAvailability isAvailable displayOrder"
        // ✅ Added: profession, displayOrder
      );

    if (!company) return res.status(404).json({ message: "Company not found." });

    return res.status(200).json({ doctors: company.doctors });
  } catch (err) {
    console.error("Get company doctors error:", err);
    return res.status(500).json({ message: "Failed to fetch doctors." });
  }
});
// ✅ Assign a doctor to a company
router.post("/:companyId/doctors", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ error: "Doctor ID is required" });

    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    if (company.doctors.includes(doctorId)) {
      return res.status(400).json({ error: "Doctor already assigned to this company" });
    }

    company.doctors.push(doctorId);
    await company.save();

    res.status(200).json({ message: "Doctor assigned successfully" });
  } catch (err) {
    console.error("Failed to assign doctor:", err);
    res.status(500).json({ error: "Failed to assign doctor" });
  }
});

// ✅ Unassign a doctor from a company
router.delete("/:companyId/doctors/:doctorId", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { companyId, doctorId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    company.doctors = company.doctors.filter((d) => d.toString() !== doctorId);
    await company.save();

    res.status(200).json({ message: "Doctor unassigned successfully" });
  } catch (err) {
    console.error("Failed to unassign doctor:", err);
    res.status(500).json({ error: "Failed to unassign doctor" });
  }
});



// ✅ Create employee appointment (existing — unchanged)
router.post("/", async (req, res) => {
  try {
    const { employeeId, doctorId, slotStart, slotEnd, notes, mode } = req.body;

    if (!employeeId || !doctorId || !slotStart || !slotEnd) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const overlappingSession = await EmployeeAppointment.findOne({
      doctor: doctorId,
      $or: [{ slotStart: { $lt: slotEnd }, slotEnd: { $gt: slotStart } }],
    });

    if (overlappingSession) {
      return res.status(400).json({
        error: "This time slot is already booked for the selected doctor.",
      });
    }

    const newAppointment = new EmployeeAppointment({
      employee: employeeId,
      doctor: doctorId,
      slotStart,
      slotEnd,
      notes,
      mode,
    });

    await newAppointment.save();
    await sendEmployeeAppointmentEmail(newAppointment);

    res.status(201).json({
      message: "Employee session booked successfully!",
      appointment: newAppointment,
    });
  } catch (err) {
    console.error("Booking failed:", err);
    res.status(500).json({ error: "Failed to create appointment" });
  }
});



// ✅ GET assessments for a company (global free + company unlocked paid)
router.get("/:companyId/assessments", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });

    const unlockedIds = (company.assignedAssessments || [])
      .filter((a) => a.isUnlocked)
      .map((a) => a.assessmentId.toString());

    const all = await Assessment.find({ isActive: { $ne: false } }).lean();

    const result = all.map((a) => ({
      ...a,
      isLocked: a.isPaid === true && !unlockedIds.includes(a._id.toString()),
    }));

    res.json({ assessments: result });
  } catch (err) {
    console.error("Get company assessments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ PATCH assign assessments to company (admin)
router.patch("/:companyId/assign-assessments", async (req, res) => {
  try {
    const { assessmentIds } = req.body;
    if (!Array.isArray(assessmentIds))
      return res.status(400).json({ message: "assessmentIds must be an array" });

    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    company.assignedAssessments = assessmentIds.map((id) => ({
      assessmentId: id,
      isUnlocked: true,
      assignedAt: new Date(),
    }));

    await company.save();
    res.json({ success: true, message: "Assessments assigned", company });
  } catch (err) {
    console.error("Assign assessments error:", err);
    res.status(500).json({ message: "Failed to assign assessments" });
  }
});

// ✅ GET all assessments with lock status for a company (used by admin)
router.get("/:companyId/assessments-admin", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });

    const unlockedIds = (company.assignedAssessments || [])
      .filter((a) => a.isUnlocked)
      .map((a) => a.assessmentId.toString());

    const all = await Assessment.find({ isActive: { $ne: false } }).lean();
    const result = all.map((a) => ({
      ...a,
      isAssigned: unlockedIds.includes(a._id.toString()),
    }));

    res.json({ assessments: result });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;