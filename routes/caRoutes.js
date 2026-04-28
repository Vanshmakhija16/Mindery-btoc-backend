import express from "express";
import crypto from "crypto";
import BtoDoctor from "../models/btocDoctor.js";
import CaTherapist from "../models/CaTherapist.js";
import Booking from "../models/Booking.js";
import adminAuth from "../middlewares/adminAuth.js";
import razorpayInstance from "../config/razorpay.js";
import { sendBookingConfirmation } from "../services/whatsapp.service.js";
import { notifyDoctorByEmail } from "../utils/notifyDoctor.js";
import { convertAvailabilityToTimezone, buildAvailabilityMap } from "../utils/timeUtils.js";
import { createPayPalOrder, capturePayPalOrder } from "../config/paypal.js";

const router = express.Router();

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
    cadPrice: entry.cadPrice ?? null,
    firstSessionCadPrice: entry.firstSessionCadPrice ?? null,
    displayTimezone: entry.displayTimezone,
    caEntryId: entry._id,
  };
}

router.get("/therapists", async (req, res) => {
  try {
    const caEntries = await CaTherapist.find({ isActive: true }).populate("doctorId");
    const therapists = caEntries.filter((e) => e.doctorId).map((entry) => shapeTherapist(entry.doctorId, entry));
    res.json({ success: true, data: therapists });
  } catch (err) {
    console.error("CA therapists error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/therapists/:doctorId", async (req, res) => {
  try {
    const caEntry = await CaTherapist.findOne({ doctorId: req.params.doctorId, isActive: true }).populate("doctorId");
    if (!caEntry || !caEntry.doctorId) return res.status(404).json({ success: false, message: "Therapist not found in CA portal" });
    res.json({ success: true, data: shapeTherapist(caEntry.doctorId, caEntry) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/therapists/:doctorId/availability", async (req, res) => {
  try {
    const caEntry = await CaTherapist.findOne({ doctorId: req.params.doctorId, isActive: true }).populate("doctorId");
    if (!caEntry || !caEntry.doctorId) return res.status(404).json({ success: false, message: "Therapist not found" });
    const doctor = caEntry.doctorId;
    const targetTZ = req.query.tz || caEntry.displayTimezone || "America/Toronto";
    const istAvailability = buildAvailabilityMap(doctor);
    const caAvailability = convertAvailabilityToTimezone(istAvailability, targetTZ);
    res.json({ success: true, timezone: targetTZ, data: caAvailability });
  } catch (err) {
    console.error("CA availability error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Check if this employee's first booking ever
router.get("/check-first-session/:employeeId", async (req, res) => {
  try {
    const existing = await Booking.findOne({ employeeId: req.params.employeeId, "payment.status": "paid" });
    res.json({ success: true, isFirstSession: !existing });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PayPal: Create Order ─────────────────────────────────────────────────────
router.post("/paypal/create-order", async (req, res) => {
  try {
    const { doctorId, employeeId } = req.body;

    if (!doctorId || !employeeId) {
      return res.status(400).json({ success: false, message: "doctorId and employeeId required" });
    }

    const [doctor, caEntry] = await Promise.all([
      BtoDoctor.findById(doctorId),
      CaTherapist.findOne({ doctorId, isActive: true }),
    ]);

    if (!doctor || !caEntry) {
      return res.status(404).json({ success: false, message: "Doctor not found in CA portal" });
    }

    const existingBooking = await Booking.findOne({ employeeId, "payment.status": "paid" });
    const isFirstSession = !existingBooking;

    const regularPrice = caEntry.cadPrice || 25;
    const firstPrice   = caEntry.firstSessionCadPrice || 5;
    const price        = isFirstSession ? firstPrice : regularPrice;

    // Create order via PayPal REST API directly (no SDK)
    const order = await createPayPalOrder({ cadPrice: price, doctorId, employeeId, isFirstSession });

    console.log(`PayPal order created: ${order.id} | CAD $${price} | firstSession=${isFirstSession}`);

    res.json({
      success:        true,
      orderID:        order.id,
      cadPrice:       price,
      doctorName:     doctor.name,
      isFirstSession,
    });
  } catch (err) {
    console.error("PayPal create-order error:", err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err?.response?.data?.message || "Failed to create PayPal order",
    });
  }
});

// ─── PayPal: Capture Order + Save Booking ────────────────────────────────────
router.post("/paypal/capture-order", async (req, res) => {
  try {
    const { orderID, bookingPayload } = req.body;

    if (!orderID || !bookingPayload) {
      return res.status(400).json({ success: false, message: "orderID and bookingPayload required" });
    }

    // Capture payment via PayPal REST API
    const capture = await capturePayPalOrder(orderID);

    if (capture.status !== "COMPLETED") {
      return res.status(400).json({ success: false, message: `PayPal capture status: ${capture.status}` });
    }

    const unit   = capture.purchase_units[0];
    const meta   = JSON.parse(unit.custom_id || "{}");
    const doctor = await BtoDoctor.findById(bookingPayload.doctorId || meta.doctorId);

    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    // Save booking
    const booking = new Booking({
      doctorId:    doctor._id,
      doctorName:  doctor.name,
      employeeId:  bookingPayload.employeeId || meta.employeeId,
      name:        bookingPayload.name,
      phone:       bookingPayload.phone,
      email:       bookingPayload.email || null,
      date:        bookingPayload.istDate,
      slot:        bookingPayload.istSlot,
      mode:        "online_video",
      amount:      meta.cadPrice || parseFloat(unit.amount?.value || 0),
      currency:    "CAD",
      isOfferBooking: meta.isFirstSession || false,
      payment: {
        orderId:     orderID,
        paymentId:   capture.id,
        status:      "paid",
        provider:    "paypal",
        countryCode: "ca",
      },
      meetLink:         doctor.meetLink || null,
      confirmationSent: false,
      reminderSent:     false,
    });

    await booking.save();

    // Notify doctor by email
    notifyDoctorByEmail({ doctor, booking, employeeName: booking.name }).catch(() => {});

    // Send WhatsApp confirmation with Canadian time
    const toPhone = String(bookingPayload.phone || "").replace(/\D/g, "");
    if (toPhone) {
      try {
        await sendBookingConfirmation(toPhone, {
          employeeName: booking.name,
          doctorName:   booking.doctorName,
          date:         bookingPayload.caDate  || booking.date,
          time:         bookingPayload.caSlot  || (booking.slot || "").split(" - ")[0],
          meetLink:     booking.meetLink || null,
        });
        booking.confirmationSent = true;
        await booking.save();
      } catch (waErr) {
        console.error("WhatsApp confirmation failed:", waErr.message);
      }
    }

    console.log(`PayPal booking saved: ${booking._id} | ${booking.doctorName}`);

    res.json({
      success: true,
      booking: {
        ...booking.toObject(),
        cadPrice:  meta.cadPrice,
        caDate:    bookingPayload.caDate,
        caSlot:    bookingPayload.caSlot,
      },
    });
  } catch (err) {
    console.error("PayPal capture-order error:", err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err?.response?.data?.message || "Failed to capture PayPal payment",
    });
  }
});

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.get("/admin/all-doctors", adminAuth, async (req, res) => {
  try {
    const doctors = await BtoDoctor.find({ isActive: true }).select("name email profilePhoto availabilityType consultationOptions onlineModes specialization profession languages experience");
    const caEntries = await CaTherapist.find({}).select("doctorId isActive cadPrice firstSessionCadPrice displayTimezone");
    const caMap = {};
    caEntries.forEach((e) => { caMap[e.doctorId.toString()] = e; });
    const result = doctors.map((d) => ({
      _id: d._id, name: d.name, email: d.email, profilePhoto: d.profilePhoto,
      availabilityType: d.availabilityType, onlineModes: d.onlineModes,
      consultationOptions: d.consultationOptions, specialization: d.specialization,
      profession: d.profession, languages: d.languages, experience: d.experience,
      caAssigned: !!caMap[d._id.toString()], caActive: caMap[d._id.toString()]?.isActive || false,
      cadPrice: caMap[d._id.toString()]?.cadPrice || null,
      firstSessionCadPrice: caMap[d._id.toString()]?.firstSessionCadPrice || null,
      displayTimezone: caMap[d._id.toString()]?.displayTimezone || "America/Toronto",
      caEntryId: caMap[d._id.toString()]?._id || null,
    }));
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/admin/assign", adminAuth, async (req, res) => {
  try {
    const { doctorId, cadPrice, firstSessionCadPrice, displayTimezone } = req.body;
    if (!doctorId) return res.status(400).json({ success: false, message: "doctorId required" });
    const doctor = await BtoDoctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
    const entry = await CaTherapist.findOneAndUpdate(
      { doctorId },
      { doctorId, isActive: true, cadPrice: cadPrice ?? null, firstSessionCadPrice: firstSessionCadPrice ?? null, displayTimezone: displayTimezone || "America/Toronto", assignedBy: "admin" },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: "Doctor assigned to CA portal", data: entry });
  } catch (err) {
    console.error("CA assign error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/admin/remove/:doctorId", adminAuth, async (req, res) => {
  try {
    await CaTherapist.findOneAndUpdate({ doctorId: req.params.doctorId }, { isActive: false });
    res.json({ success: true, message: "Doctor removed from CA portal" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/admin/update/:doctorId", adminAuth, async (req, res) => {
  try {
    const { cadPrice, firstSessionCadPrice, displayTimezone, isActive } = req.body;
    const update = {};
    if (cadPrice !== undefined) update.cadPrice = cadPrice;
    if (firstSessionCadPrice !== undefined) update.firstSessionCadPrice = firstSessionCadPrice;
    if (displayTimezone !== undefined) update.displayTimezone = displayTimezone;
    if (isActive !== undefined) update.isActive = isActive;
    const entry = await CaTherapist.findOneAndUpdate({ doctorId: req.params.doctorId }, update, { new: true });
    if (!entry) return res.status(404).json({ success: false, message: "CA entry not found" });
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
