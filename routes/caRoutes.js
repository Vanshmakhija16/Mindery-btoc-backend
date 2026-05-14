import express from "express";
import crypto from "crypto";
import BtoDoctor from "../models/btocDoctor.js";
import CaTherapist from "../models/CaTherapist.js";
import Booking from "../models/Booking.js";
import Employee from "../models/Employee.js";
import adminAuth from "../middlewares/adminAuth.js";
import razorpayInstance from "../config/razorpay.js";
import { sendBookingConfirmation } from "../services/whatsapp.service.js";
import { notifyDoctorByEmail } from "../utils/notifyDoctor.js";
import { convertAvailabilityToTimezone, buildAvailabilityMap, getNextSlot } from "../utils/timeUtils.js";
import { createPayPalOrder, capturePayPalOrder } from "../config/paypal.js";
import { authEmployee } from "../middlewares/authEmployee.js";

const router = express.Router();

// ─── Shape therapist response — reads canadianPrice from doctor model directly ─
function shapeTherapist(doc, entry) {
  return {
    _id: doc._id, name: doc.name, email: doc.email, phone: doc.phone,
    profilePhoto: doc.profilePhoto,
    description: doc.description || doc.about || "",
    about: doc.about || "",
    specialization: doc.specialization || "",
    profession: doc.profession || "",
    experience: doc.experience ?? null,
    languages: doc.languages || [],
    qualification: doc.qualification || [],
    gender: doc.gender || "",
    availabilityType: doc.availabilityType,
    onlineModes: doc.onlineModes || [],
    location: doc.location || "",
    consultationOptions: doc.consultationOptions || [],
    isActive: doc.isActive,
    isAvailable: doc.isAvailable || "available",
    // ✅ Now comes directly from doctor model — no CaTherapist override needed
    canadianPrice:      doc.canadianPrice      ?? 55,
    canadianOfferPrice: doc.canadianOfferPrice ?? 10,
    // Keep cadPrice/firstSessionCadPrice for backward compat with older frontend code
    cadPrice:             doc.canadianPrice      ?? 55,
    firstSessionCadPrice: doc.canadianOfferPrice ?? 10,
    displayTimezone: entry?.displayTimezone || "America/Toronto",
    caEntryId: entry?._id || null,
  };
}

// ─── PUBLIC: List all CA therapists ──────────────────────────────────────────
router.get("/therapists", async (req, res) => {
  try {
    const caEntries = await CaTherapist.find({ isActive: true }).populate("doctorId");
    
    // Calculate nextSlot for each therapist
    const therapistsWithSlots = await Promise.all(
      caEntries
        .filter((e) => e.doctorId)
        .map(async (e) => {
          const nextSlot = await getNextSlot(e.doctorId, e.doctorId._id, Booking);
          return { ...e.toObject(), nextSlot };
        })
    );

    // Filter therapists with available slots
// Sort therapists:
// 1. Available therapists first
// 2. Earliest slot first
// 3. No-slot therapists at bottom

therapistsWithSlots.sort((a, b) => {
  const hasSlotA = !!a.nextSlot;
  const hasSlotB = !!b.nextSlot;

  // Available first
  if (hasSlotA && !hasSlotB) return -1;
  if (!hasSlotA && hasSlotB) return 1;

  // If both have slots, sort by nearest slot
  if (hasSlotA && hasSlotB) {
    const timeA =
      a.nextSlot?.dateTime?.getTime() ||
      Number.MAX_VALUE;

    const timeB =
      b.nextSlot?.dateTime?.getTime() ||
      Number.MAX_VALUE;

    return timeA - timeB;
  }

  return 0;
});

// Format response
const formattedTherapists = therapistsWithSlots.map((entry) => ({
  ...shapeTherapist(entry.doctorId, entry),
  nextSlot: entry.nextSlot
}));

    res.json({ success: true, data: formattedTherapists });
  } catch (err) {
    console.error("CA therapists error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PUBLIC: Single CA therapist ─────────────────────────────────────────────
router.get("/therapists/:doctorId", async (req, res) => {
  try {
    const caEntry = await CaTherapist.findOne({ doctorId: req.params.doctorId, isActive: true }).populate("doctorId");
    if (!caEntry?.doctorId) return res.status(404).json({ success: false, message: "Therapist not found in CA portal" });
    res.json({ success: true, data: shapeTherapist(caEntry.doctorId, caEntry) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PUBLIC: Availability (IST → Canadian timezone) ──────────────────────────
router.get("/therapists/:doctorId/availability", async (req, res) => {
  try {
    const caEntry = await CaTherapist.findOne({ doctorId: req.params.doctorId, isActive: true }).populate("doctorId");
    if (!caEntry?.doctorId) return res.status(404).json({ success: false, message: "Therapist not found" });
    const targetTZ = req.query.tz || caEntry.displayTimezone || "America/Toronto";
    const istAvailability = buildAvailabilityMap(caEntry.doctorId);
    const caAvailability  = convertAvailabilityToTimezone(istAvailability, targetTZ);
    res.json({ success: true, timezone: targetTZ, data: caAvailability });
  } catch (err) {
    console.error("CA availability error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PUBLIC: Check if employee's first-ever CA booking ───────────────────────
// Returns isFirstSession: true if they have never paid for a CA booking
router.get("/check-first-session/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) return res.status(400).json({ success: false, message: "employeeId required" });
    const existing = await Booking.findOne({
      employeeId,
      "payment.status": "paid",
      "payment.countryCode": "ca",
    });
    res.json({ success: true, isFirstSession: !existing });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PUBLIC: Validate referral code ──────────────────────────────────────────
// Returns referrer name so frontend can show "You earned X CAD for [Name]"
router.get("/validate-referral/:code", async (req, res) => {
  try {
    const code = req.params.code?.toUpperCase().trim();
    if (!code) return res.status(400).json({ success: false, message: "Code required" });
    const referrer = await Employee.findOne({ referralCode: code }).select("name referralCode");
    if (!referrer) return res.status(404).json({ success: false, message: "Invalid referral code" });
    res.json({ success: true, referrerName: referrer.name, referralCode: referrer.referralCode });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PayPal: Create Order ─────────────────────────────────────────────────────
router.post("/paypal/create-order", authEmployee, async (req, res) => {
  try {
    const { doctorId, employeeId } = req.body;
    if (!doctorId || !employeeId) return res.status(400).json({ success: false, message: "doctorId and employeeId required" });

    const doctor = await BtoDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    // Check first session — only CA paid bookings count
    const existingCaBooking = await Booking.findOne({
      employeeId,
      "payment.status": "paid",
      "payment.countryCode": "ca",
    });
    const isFirstSession = !existingCaBooking;

    // ✅ Use canadianPrice / canadianOfferPrice from doctor model directly
    const regularPrice = doctor.canadianPrice      ?? 55;
    const offerPrice   = doctor.canadianOfferPrice ?? 10;
    const price        = isFirstSession ? offerPrice : regularPrice;

    const order = await createPayPalOrder({ cadPrice: price, doctorId, employeeId, isFirstSession });
    console.log(`PayPal order: ${order.id} | CAD $${price} | first=${isFirstSession}`);

    res.json({
      success: true, orderID: order.id, cadPrice: price,
      regularPrice, offerPrice, isFirstSession, doctorName: doctor.name,
    });
  } catch (err) {
    console.error("PayPal create-order error:", err?.response?.data || err.message);
    res.status(500).json({ success: false, message: err?.response?.data?.message || "Failed to create PayPal order" });
  }
});

router.post("/test-booking-flow", authEmployee, async (req, res) => {
  try {
    const { bookingPayload } = req.body;

    if (!bookingPayload) {
      return res.status(400).json({
        success: false,
        message: "Booking payload missing",
      });
    }

    const doctor = await BtoDoctor.findById(
      bookingPayload.doctorId
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Fake booking object
    const booking = {
      doctorId: doctor._id,
      doctorName: doctor.name,

      name: bookingPayload.name,
      phone: bookingPayload.phone,
      email: bookingPayload.email,

      // Therapist gets IST
      date: bookingPayload.istDate,
      slot: `${bookingPayload.istSlot} IST`,

      // User gets ET
      caDate: bookingPayload.caDate,
      caSlot: `${bookingPayload.caSlot} ET`,

      mode: "online_video",

      meetLink:
        doctor.meetLink ||
        "https://meet.google.com/test",
    };

    // EMAIL TO THERAPIST
    await notifyDoctorByEmail({
      doctor,
      booking,
      employeeName: booking.name,
    });

    // WHATSAPP TO USER
    await sendBookingConfirmation(
      booking.phone,
      {
        employeeName: booking.name,
        doctorName: booking.doctorName,

        // User sees ET
        date: booking.caDate,
        time: booking.caSlot,

        meetLink: booking.meetLink,
      }
    );

    res.json({
      success: true,
      message: "Test notifications sent",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ─── PayPal: Capture + Save Booking ──────────────────────────────────────────
router.post("/paypal/capture-order", authEmployee, async (req, res) => {
  try {
    const { orderID, bookingPayload } = req.body;
    if (!orderID || !bookingPayload) return res.status(400).json({ success: false, message: "Missing data" });

    const capture = await capturePayPalOrder(orderID);
    if (capture.status !== "COMPLETED") return res.status(400).json({ success: false, message: `PayPal status: ${capture.status}` });

    const unit = capture.purchase_units[0];
    let meta = {};
    try { meta = JSON.parse(unit.custom_id || "{}"); } catch {}

    const doctor = await BtoDoctor.findById(bookingPayload.doctorId || meta.doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const booking = new Booking({
      doctorId:   doctor._id,
      doctorName: doctor.name,
      employeeId: bookingPayload.employeeId || meta.employeeId,
      name:  bookingPayload.name,
      phone: bookingPayload.phone,
      email: bookingPayload.email || null,
      date:  bookingPayload.istDate,
      slot:  bookingPayload.istSlot,
      mode:  "online_video",
      amount:   meta.cadPrice || parseFloat(unit.amount?.value || 0),
      currency: "CAD",
      isOfferBooking: meta.isFirstSession || false,
      payment: {
        orderId:     orderID,
        paymentId:   capture.id,
        status:      "paid",
        provider:    "paypal",
        countryCode: "ca",
      },
      meetLink: doctor.meetLink || null,
      confirmationSent: false,
      reminderSent: false,
    });
    await booking.save();

    // Therapist is in India → email uses IST.
    // Client is in Canada → WhatsApp uses the timezone they picked on the platform.
    const istTime = bookingPayload.istSlot || booking.slot || "";
    const istSlotLabeled = /IST/i.test(istTime) ? istTime : `${istTime} IST`.trim();

    notifyDoctorByEmail({
      doctor,
      booking: {
        ...booking.toObject(),
        date: bookingPayload.istDate || booking.date,
        slot: istSlotLabeled,
      },
      employeeName: booking.name,
    }).catch((e) => console.error("notifyDoctorByEmail error:", e.message));

    const toPhone = String(bookingPayload.phone || "").replace(/\D/g, "");
    if (toPhone) {
      try {
        const caSlotForUser = bookingPayload.caSlot || booking.slot || "";
        await sendBookingConfirmation(toPhone, {
          employeeName: booking.name, doctorName: booking.doctorName,
          date: bookingPayload.caDate || booking.date,
          time: caSlotForUser,
          meetLink: booking.meetLink || null,
        });
        booking.confirmationSent = true;
        await booking.save();
      } catch (e) { console.error("WhatsApp CA error:", e.message); }
    }

    res.json({
      success: true,
      booking: { ...booking.toObject(), cadPrice: meta.cadPrice, caDate: bookingPayload.caDate, caSlot: bookingPayload.caSlot },
    });
  } catch (err) {
    console.error("PayPal capture error:", err?.response?.data || err.message);
    res.status(500).json({ success: false, message: "Failed to capture payment" });
  }
});

// ─── ADMIN: List all doctors with CA status ───────────────────────────────────
router.get("/admin/all-doctors", adminAuth, async (req, res) => {
  try {
    const doctors = await BtoDoctor.find({ isActive: true }).select(
      "name email profilePhoto availabilityType consultationOptions onlineModes specialization profession languages experience canadianPrice canadianOfferPrice"
    );
    const caEntries = await CaTherapist.find({}).select("doctorId isActive displayTimezone");
    const caMap = {};
    caEntries.forEach((e) => { caMap[e.doctorId.toString()] = e; });

    const result = doctors.map((d) => ({
      _id: d._id, name: d.name, email: d.email, profilePhoto: d.profilePhoto,
      availabilityType: d.availabilityType, onlineModes: d.onlineModes,
      consultationOptions: d.consultationOptions, specialization: d.specialization,
      profession: d.profession, languages: d.languages, experience: d.experience,
      // ✅ Canadian prices now come from the doctor model
      canadianPrice:      d.canadianPrice      ?? 55,
      canadianOfferPrice: d.canadianOfferPrice ?? 10,
      caAssigned:  !!caMap[d._id.toString()],
      caActive:    caMap[d._id.toString()]?.isActive || false,
      displayTimezone: caMap[d._id.toString()]?.displayTimezone || "America/Toronto",
      caEntryId:   caMap[d._id.toString()]?._id || null,
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── ADMIN: Assign doctor to CA portal ───────────────────────────────────────
router.post("/admin/assign", adminAuth, async (req, res) => {
  try {
    const { doctorId, canadianPrice, canadianOfferPrice, displayTimezone } = req.body;
    if (!doctorId) return res.status(400).json({ success: false, message: "doctorId required" });
    const doctor = await BtoDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    // Update pricing on the doctor model directly
    if (canadianPrice      !== undefined) doctor.canadianPrice      = canadianPrice;
    if (canadianOfferPrice !== undefined) doctor.canadianOfferPrice = canadianOfferPrice;
    await doctor.save();

    const entry = await CaTherapist.findOneAndUpdate(
      { doctorId },
      { doctorId, isActive: true, displayTimezone: displayTimezone || "America/Toronto", assignedBy: "admin" },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: "Doctor assigned to CA portal", data: entry });
  } catch (err) {
    console.error("CA assign error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── ADMIN: Remove doctor from CA portal ─────────────────────────────────────
router.delete("/admin/remove/:doctorId", adminAuth, async (req, res) => {
  try {
    await CaTherapist.findOneAndUpdate({ doctorId: req.params.doctorId }, { isActive: false });
    res.json({ success: true, message: "Doctor removed from CA portal" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── ADMIN: Update CA pricing for a doctor ───────────────────────────────────
router.patch("/admin/update/:doctorId", adminAuth, async (req, res) => {
  try {
    const { canadianPrice, canadianOfferPrice, displayTimezone, isActive } = req.body;

    // Update pricing on the doctor model
    const doctorUpdate = {};
    if (canadianPrice      !== undefined) doctorUpdate.canadianPrice      = canadianPrice;
    if (canadianOfferPrice !== undefined) doctorUpdate.canadianOfferPrice = canadianOfferPrice;
    if (Object.keys(doctorUpdate).length > 0) {
      await BtoDoctor.findByIdAndUpdate(req.params.doctorId, doctorUpdate);
    }

    // Update CA entry
    const entryUpdate = {};
    if (displayTimezone !== undefined) entryUpdate.displayTimezone = displayTimezone;
    if (isActive        !== undefined) entryUpdate.isActive        = isActive;

    const entry = await CaTherapist.findOneAndUpdate(
      { doctorId: req.params.doctorId }, entryUpdate, { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: "CA entry not found" });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
