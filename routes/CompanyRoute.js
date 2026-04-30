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
import axios from "axios";

const router = express.Router();

// ─── EMAIL TRANSPORTER ───────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === "true",
  auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
      return res.status(401).json({ error: "No token provided" });
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("id email role");
    if (!user) return res.status(404).json({ error: "User not found" });
    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role)
    return res.status(403).json({ error: "Access denied" });
  next();
};

// ─── PUBLIC: Get company by slug ─────────────────────────────────
// Used by TenantPortal to load branding, doctors, etc.
router.get("/slug/:slug", async (req, res) => {
  try {
    const company = await Company.findOne({ slug: req.params.slug.toLowerCase() }).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });

    // Check contract validity
    if (company.contractExpiry && new Date(company.contractExpiry) < new Date())
      return res.status(403).json({ error: "This portal has expired. Please contact your admin." });

    res.json({ ...company, logo: company.logo || "" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PUBLIC: Get doctors for a company (by slug) ─────────────────
router.get("/slug/:slug/doctors", async (req, res) => {
  try {
    const company = await Company.findOne({ slug: req.params.slug.toLowerCase() })
      .populate(
        "doctors",
        "name specialization profession profilePhoto imageUrl experience expertise languages charges consultationOptions availabilityType dateAvailability weeklyAvailability isAvailable displayOrder"
      );
    if (!company) return res.status(404).json({ error: "Company not found" });
    res.json({ doctors: company.doctors || [] });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── PUBLIC: Get assessments for a company (by slug) ─────────────
router.get("/slug/:slug/assessments", async (req, res) => {
  try {
    const company = await Company.findOne({ slug: req.params.slug.toLowerCase() }).lean();
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
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ─── NEW: WordPress booking webhook ──────────────────────────────
// POST /api/companies/slug/:slug/book
// Called when a referral-mapped user books a session (₹0 flow)
router.post("/slug/:slug/book", async (req, res) => {
  try {
    const company = await Company.findOne({ slug: req.params.slug.toLowerCase() });
    if (!company) return res.status(404).json({ error: "Company not found" });

    const { employeeId, doctorId, doctorName, date, slot, mode, employeeName, employeeEmail, employeePhone } = req.body;

    // 1. Save booking to DB with ₹0 price
    const booking = await Booking.create({
      employeeId,
      doctorId,
      companyId: company._id,
      date,
      slot,
      mode:   mode || "online",
      name:   employeeName,
      phone:  employeePhone,
      email:  employeeEmail,
      price:  0,
      currency: "INR",
      status: "confirmed",
    });

    // 2. Forward to WordPress webhook (if configured)
    if (company.wordpressWebhookUrl) {
      try {
        await axios.post(company.wordpressWebhookUrl, {
          company:  company.name,
          slug:     company.slug,
          employee: { name: employeeName, email: employeeEmail, phone: employeePhone },
          doctor:   { id: doctorId, name: doctorName },
          date,
          slot,
          mode,
          price:    0,
          bookingId: booking._id,
        }, { timeout: 8000 });
      } catch (wpErr) {
        console.error("WordPress webhook failed:", wpErr.message);
        // Don't fail the booking — just log
      }
    }

    // 3. Increment sessions used
    await Company.findByIdAndUpdate(company._id, { $inc: { sessionsUsed: 1 } });

    res.json({ success: true, bookingId: booking._id, message: "Session booked at ₹0" });
  } catch (err) {
    console.error("Tenant booking error:", err);
    res.status(500).json({ error: "Booking failed" });
  }
});

// ─── ADMIN: Add a new company ─────────────────────────────────────
router.post("/add", async (req, res) => {
  try {
    const {
      name, logo, domainPatterns, sessionQuota, contractExpiry, hrContactEmail,
      slug, referralCodes, primaryColor, accentColor, tagline, website, wordpressWebhookUrl,
    } = req.body;

    if (!name || !Array.isArray(domainPatterns))
      return res.status(400).json({ error: "Company name is required" });

    if (slug) {
      const existing = await Company.findOne({ slug: slug.toLowerCase() });
      if (existing) return res.status(400).json({ error: "Slug already in use" });
    }

    const company = new Company({
      name, logo: logo || "", domainPatterns,
      sessionQuota: sessionQuota || 50,
      contractExpiry: contractExpiry || null,
      hrContactEmail: hrContactEmail || "",
      slug:               slug ? slug.toLowerCase() : undefined,
      referralCodes:      Array.isArray(referralCodes) ? referralCodes.map(c => c.toUpperCase()) : [],
      primaryColor:       primaryColor || "#DE6875",
      accentColor:        accentColor  || "#10191F",
      tagline:            tagline      || "",
      website:            website      || "",
      wordpressWebhookUrl: wordpressWebhookUrl || "",
    });

    await company.save();
    res.status(201).json({ message: "Company added successfully", company });
  } catch (err) {
    console.error("Error adding company:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Get all companies ────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.status(200).json(companies);
  } catch { res.status(500).json({ error: "Internal Server Error" }); }
});

// ─── Get all doctors (for BookEmployeeSession) ────────────────────
router.get("/assigned-doctors", async (req, res) => {
  try {
    const doctors = await Doctor.find({}, "name email specialization imageUrl").sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json({ data: doctors });
  } catch { res.status(500).json({ error: "Failed to fetch doctors" }); }
});

router.get("/doctors/all", async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .select("name specialization imageUrl experience expertise languages charges consultationOptions")
      .sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json({ data: doctors });
  } catch { res.status(500).json({ error: "Failed to fetch all doctors" }); }
});

router.get("/all", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const companies = await Company.find().select("name email doctors slug referralCodes");
    res.status(200).json({ data: companies });
  } catch { res.status(500).json({ error: "Failed to fetch companies" }); }
});

// ─── Update company ───────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const {
      name, logo, domainPatterns, sessionQuota, contractExpiry, hrContactEmail,
      slug, referralCodes, primaryColor, accentColor, tagline, website, wordpressWebhookUrl,
    } = req.body;

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: "Company not found" });

    if (name)                  company.name            = name;
    if (logo !== undefined)    company.logo            = logo;
    if (domainPatterns)        company.domainPatterns  = domainPatterns;
    if (sessionQuota !== undefined) company.sessionQuota = sessionQuota;
    if (contractExpiry !== undefined) company.contractExpiry = contractExpiry;
    if (hrContactEmail !== undefined) company.hrContactEmail = hrContactEmail;
    if (slug !== undefined)    company.slug            = slug ? slug.toLowerCase() : company.slug;
    if (referralCodes !== undefined) company.referralCodes = Array.isArray(referralCodes) ? referralCodes.map(c => c.toUpperCase()) : [];
    if (primaryColor !== undefined) company.primaryColor  = primaryColor;
    if (accentColor  !== undefined) company.accentColor   = accentColor;
    if (tagline      !== undefined) company.tagline        = tagline;
    if (website      !== undefined) company.website        = website;
    if (wordpressWebhookUrl !== undefined) company.wordpressWebhookUrl = wordpressWebhookUrl;

    await company.save();
    res.status(200).json({ message: "Company updated successfully", company });
  } catch (err) {
    console.error("Error updating company:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─── Delete a company ─────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.status(200).json({ message: "Company deleted successfully" });
  } catch { res.status(500).json({ message: "Server error while deleting company" }); }
});

// ─── Get company bookings ─────────────────────────────────────────
router.get("/:companyId/bookings", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const bookings = await Booking.find({ companyId: req.params.companyId })
      .populate("employeeId", "name email phone")
      .populate("doctorId",   "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      company: { name: company.name, sessionQuota: company.sessionQuota, sessionsUsed: company.sessionsUsed, contractExpiry: company.contractExpiry },
      count: bookings.length,
      bookings,
    });
  } catch { res.status(500).json({ error: "Failed to fetch company bookings" }); }
});

// ─── Assign doctors to company ────────────────────────────────────
router.patch("/:companyId/assign-doctors", async (req, res) => {
  try {
    const { doctorIds } = req.body;
    if (!Array.isArray(doctorIds)) return res.status(400).json({ message: "doctorIds must be an array." });
    const company = await Company.findByIdAndUpdate(req.params.companyId, { $set: { doctors: doctorIds } }, { new: true }).populate("doctors");
    if (!company) return res.status(404).json({ message: "Company not found." });
    return res.status(200).json({ message: "Doctors assigned successfully.", company });
  } catch { return res.status(500).json({ message: "Failed to assign doctors." }); }
});

// ─── Get company by ID ────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ error: "Not found" });
    res.json({ ...company, logo: company.logo || "" });
  } catch { res.status(500).json({ error: "Server error" }); }
});

// ─── Get doctors assigned to company ─────────────────────────────
router.get("/:companyId/doctors", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId)
      .populate("doctors", "name specialization profession profilePhoto experience expertise languages charges consultationOptions availabilityType dateAvailability isAvailable displayOrder");
    if (!company) return res.status(404).json({ message: "Company not found." });
    return res.status(200).json({ doctors: company.doctors });
  } catch { return res.status(500).json({ message: "Failed to fetch doctors." }); }
});

// ─── Assign a doctor to a company ────────────────────────────────
router.post("/:companyId/doctors", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) return res.status(400).json({ error: "Doctor ID is required" });
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    if (company.doctors.includes(doctorId)) return res.status(400).json({ error: "Doctor already assigned" });
    company.doctors.push(doctorId);
    await company.save();
    res.status(200).json({ message: "Doctor assigned successfully" });
  } catch { res.status(500).json({ error: "Failed to assign doctor" }); }
});

// ─── Unassign a doctor ────────────────────────────────────────────
router.delete("/:companyId/doctors/:doctorId", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });
    company.doctors = company.doctors.filter((d) => d.toString() !== req.params.doctorId);
    await company.save();
    res.status(200).json({ message: "Doctor unassigned successfully" });
  } catch { res.status(500).json({ error: "Failed to unassign doctor" }); }
});

// ─── Company assessments ──────────────────────────────────────────
router.get("/:companyId/assessments", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    const unlockedIds = (company.assignedAssessments || []).filter((a) => a.isUnlocked).map((a) => a.assessmentId.toString());
    const all = await Assessment.find({ isActive: { $ne: false } }).lean();
    const result = all.map((a) => ({ ...a, isLocked: a.isPaid === true && !unlockedIds.includes(a._id.toString()) }));
    res.json({ assessments: result });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.patch("/:companyId/assign-assessments", async (req, res) => {
  try {
    const { assessmentIds } = req.body;
    if (!Array.isArray(assessmentIds)) return res.status(400).json({ message: "assessmentIds must be an array" });
    const company = await Company.findById(req.params.companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });
    company.assignedAssessments = assessmentIds.map((id) => ({ assessmentId: id, isUnlocked: true, assignedAt: new Date() }));
    await company.save();
    res.json({ success: true, message: "Assessments assigned", company });
  } catch { res.status(500).json({ message: "Failed to assign assessments" }); }
});

router.get("/:companyId/assessments-admin", async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });
    const unlockedIds = (company.assignedAssessments || []).filter((a) => a.isUnlocked).map((a) => a.assessmentId.toString());
    const all = await Assessment.find({ isActive: { $ne: false } }).lean();
    const result = all.map((a) => ({ ...a, isAssigned: unlockedIds.includes(a._id.toString()) }));
    res.json({ assessments: result });
  } catch { res.status(500).json({ error: "Server error" }); }
});

export default router;
