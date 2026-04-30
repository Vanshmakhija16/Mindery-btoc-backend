// routes/companyPortalRoutes.js
// Multi-tenant company portal — all routes under /api/company-portal/:slug/...
// Validates user ↔ company mapping on every protected endpoint.

import express from "express";
import mongoose from "mongoose";
import Company   from "../models/Company.js";
import Employee  from "../models/Employee.js";
import BtoDoctor from "../models/btocDoctor.js";
import Booking   from "../models/Booking.js";
import { authEmployee } from "../middlewares/authEmployee.js";
import { buildAvailabilityMap } from "../utils/timeUtils.js";
import { sendBookingConfirmation } from "../services/whatsapp.service.js";
import { notifyDoctorByEmail } from "../utils/notifyDoctor.js";

const router = express.Router({ mergeParams: true });

// ─── Helper: load & validate company by slug ─────────────────────────────────
async function getCompany(slug) {
  if (!slug) return null;
  return Company.findOne({ slug: slug.toLowerCase() })
    .populate("doctors")
    .populate("assignedAssessments.assessmentId");
}

// ─── Helper: verify employee belongs to this company ─────────────────────────
async function verifyAccess(employeeId, company) {
  if (!employeeId || !company) return false;
  const emp = await Employee.findById(employeeId);
  if (!emp) return false;
  return emp.companyId?.toString() === company._id.toString();
}

// ══════════════════════════════════════════════════════════════════
// PUBLIC — Get company info by slug (used to render portal header)
// GET /api/company-portal/:slug
// ══════════════════════════════════════════════════════════════════
router.get("/", async (req, res) => {
  try {
    const company = await Company.findOne({ slug: req.params.slug?.toLowerCase() })
      .select("-referralCodes -domainPatterns -wordpressWebhookUrl");
    if (!company) return res.status(404).json({ success: false, message: "Company portal not found" });
    res.json({ success: true, data: company });
  } catch (err) {
    console.error("Company portal fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════
// PROTECTED — Verify employee access to this slug
// GET /api/company-portal/:slug/verify-access
// ══════════════════════════════════════════════════════════════════
router.get("/verify-access", authEmployee, async (req, res) => {
  try {
    const company = await getCompany(req.params.slug);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const allowed = await verifyAccess(req.employee._id, company);
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied. You are not mapped to this company." });

    res.json({ success: true, company: { name: company.name, slug: company.slug, logo: company.logo, primaryColor: company.primaryColor, accentColor: company.accentColor, tagline: company.tagline } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════
// PROTECTED — Get therapists assigned to this company
// GET /api/company-portal/:slug/therapists
// ══════════════════════════════════════════════════════════════════
router.get("/therapists", authEmployee, async (req, res) => {
  try {
    const company = await getCompany(req.params.slug);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const allowed = await verifyAccess(req.employee._id, company);
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    const doctors = (company.doctors || []).filter(d => d && d.isActive);

    const therapists = doctors.map(d => {
      // Compute next available slot from the doctor's date+weekly availability
      let nextSlot = null;
      try {
        const av = typeof d.getUpcomingAvailability45 === "function"
          ? d.getUpcomingAvailability45(30)
          : (typeof d.getUpcomingAvailability === "function" ? d.getUpcomingAvailability(30) : {});
        const firstDate = Object.keys(av).sort()[0];
        if (firstDate && av[firstDate]?.length) {
          const firstSlot = av[firstDate][0];
          // slot strings look like "09:00 - 09:45" — take the start time
          const startTime = String(firstSlot).split(" - ")[0];
          nextSlot = { date: firstDate, time: startTime };
        }
      } catch (e) {
        nextSlot = null;
      }

      return {
        _id:                d._id,
        name:               d.name,
        profilePhoto:       d.profilePhoto,
        specialization:     d.specialization,
        profession:         d.profession,
        about:              d.about,
        experience:         d.experience,
        languages:          d.languages,
        consultationOptions: d.consultationOptions,
        originalPrice:      d.consultationOptions?.[0]?.price ?? null,
        finalPrice:         0,           // ₹0 for company users
        isAvailable:        d.isAvailable,
        location:           d.location,
        gender:             d.gender,
        nextSlot,
      };
    });

    res.json({ success: true, data: therapists });
  } catch (err) {
    console.error("Company therapists error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════
// PROTECTED — Get single therapist + availability
// GET /api/company-portal/:slug/therapists/:doctorId
// ══════════════════════════════════════════════════════════════════
router.get("/therapists/:doctorId", authEmployee, async (req, res) => {
  try {
    const company = await getCompany(req.params.slug);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const allowed = await verifyAccess(req.employee._id, company);
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    const isAssigned = (company.doctors || []).some(d => d._id?.toString() === req.params.doctorId);
    if (!isAssigned) return res.status(403).json({ success: false, message: "This therapist is not available in your portal" });

    const doctor = await BtoDoctor.findById(req.params.doctorId);
    if (!doctor || !doctor.isActive) return res.status(404).json({ success: false, message: "Therapist not found" });

    const availability = buildAvailabilityMap(doctor);

    res.json({
      success: true,
      data: {
        _id:                doctor._id,
        name:               doctor.name,
        profilePhoto:       doctor.profilePhoto,
        specialization:     doctor.specialization,
        profession:         doctor.profession,
        about:              doctor.about,
        experience:         doctor.experience,
        languages:          doctor.languages,
        consultationOptions: doctor.consultationOptions,
        originalPrice:      doctor.consultationOptions?.[0]?.price ?? null,
        finalPrice:         0,
        isAvailable:        doctor.isAvailable,
        location:           doctor.location,
        gender:             doctor.gender,
        meetLink:           doctor.meetLink,
        availability,
      },
    });
  } catch (err) {
    console.error("Company therapist detail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════
// PROTECTED — Book a session (₹0 for company users)
// POST /api/company-portal/:slug/book
// ══════════════════════════════════════════════════════════════════
router.post("/book", authEmployee, async (req, res) => {
  try {
    const company = await getCompany(req.params.slug);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const allowed = await verifyAccess(req.employee._id, company);
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    const { doctorId, date, slot, name, phone, email } = req.body;

    const isAssigned = (company.doctors || []).some(d => d._id?.toString() === doctorId);
    if (!isAssigned) return res.status(403).json({ success: false, message: "Therapist not in your portal" });

    const doctor = await BtoDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const booking = new Booking({
      doctorId:    doctor._id,
      doctorName:  doctor.name,
      employeeId:  req.employee._id,
      companyId:   company._id,
      name,
      phone,
      email:       email || null,
      date,
      slot,
      mode:        "online_video",
      amount:      0,
      currency:    "INR",
      isOfferBooking: true,
      payment: {
        orderId:   `COMPANY_${company.slug}_${Date.now()}`,
        paymentId: `FREE_${Date.now()}`,
        status:    "paid",
        provider:  "razorpay",
      },
      bookingType: "org_free",
      meetLink:         doctor.meetLink || null,
      confirmationSent: false,
      reminderSent:     false,
    });

    await booking.save();

    // Increment sessionsUsed
    await Company.findByIdAndUpdate(company._id, { $inc: { sessionsUsed: 1 } });

    // WhatsApp notification
    const toPhone = String(phone || "").replace(/\D/g, "");
    if (toPhone) {
      try {
        await sendBookingConfirmation(toPhone, {
          employeeName: name,
          doctorName:   doctor.name,
          date,
          time:         (slot || "").split(" - ")[0],
          meetLink:     doctor.meetLink || null,
        });
        booking.confirmationSent = true;
        await booking.save();
      } catch (e) { console.error("WhatsApp error:", e.message); }
    }

    notifyDoctorByEmail({ doctor, booking, employeeName: name }).catch(() => {});

    res.json({ success: true, booking: booking.toObject() });
  } catch (err) {
    console.error("Company booking error:", err);
    res.status(500).json({ success: false, message: "Booking failed" });
  }
});

// ══════════════════════════════════════════════════════════════════
// PROTECTED — Get assessments assigned to company
// GET /api/company-portal/:slug/assessments
// ══════════════════════════════════════════════════════════════════
router.get("/assessments", authEmployee, async (req, res) => {
  try {
    const company = await Company.findOne({ slug: req.params.slug?.toLowerCase() })
      .populate({ path: "assignedAssessments.assessmentId", match: { isActive: { $ne: false } } });
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const allowed = await verifyAccess(req.employee._id, company);
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    const assessments = (company.assignedAssessments || [])
      .filter(a => a.assessmentId && a.isUnlocked)
      .map(a => a.assessmentId);

    res.json({ success: true, data: assessments });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ══════════════════════════════════════════════════════════════════
// PROTECTED — Get my bookings
// GET /api/company-portal/:slug/my-bookings
// ══════════════════════════════════════════════════════════════════
router.get("/my-bookings", authEmployee, async (req, res) => {
  try {
    const company = await getCompany(req.params.slug);
    if (!company) return res.status(404).json({ success: false, message: "Company not found" });

    const allowed = await verifyAccess(req.employee._id, company);
    if (!allowed) return res.status(403).json({ success: false, message: "Access denied" });

    const bookings = await Booking.find({ employeeId: req.employee._id, companyId: company._id })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
