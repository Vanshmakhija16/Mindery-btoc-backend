import express from "express";
import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";
import Doctor from "../models/Doctor.js";
import Booking from "../models/Booking.js";

const router = express.Router();

/**
 * ----------------------------------
 * CREATE ORDER (NO OFFER LOGIC)
 * ----------------------------------
 */
router.post("/create-order", async (req, res) => {
  try {
    console.log("🔥 create-order called");
    console.log("📦 Body:", req.body);

    const { doctorId, employeeId } = req.body;

    const doctor = await Doctor.findById(doctorId);
    console.log("👨‍⚕️ Doctor:", doctor);

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    console.log("💰 Charges:", doctor.charges);

    let finalAmount = doctor.charges?.amount;

    if (!finalAmount || finalAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Doctor price not configured" });
    }

    console.log("💵 Final amount:", finalAmount);

    const order = await razorpayInstance.orders.create({
      amount: finalAmount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    console.log("✅ Razorpay order created:", order.id);

    res.status(200).json({
      orderId: order.id,
      amount: finalAmount,
      doctorName: doctor.name,
    });
  } catch (err) {
    console.error("❌ CREATE ORDER ERROR:", err);
    res.status(500).json({
      message: "Create order failed",
      error: err.message,
    });
  }
});

/**
 * ----------------------------------
 * VERIFY PAYMENT + BOOK SESSION
 * ----------------------------------
 */
router.post("/verify-and-book", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingPayload,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !bookingPayload
    ) {
      return res.status(400).json({ message: "Invalid payment payload" });
    }

    /* ---------------- VERIFY SIGNATURE ---------------- */
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    /* ---------------- FETCH DOCTOR ---------------- */
    const doctor = await Doctor.findById(bookingPayload.doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    /* ---------------- CREATE BOOKING ---------------- */
    const booking = await Booking.create({
      doctorId: bookingPayload.doctorId,
      employeeId: bookingPayload.employeeId,

      // ✅ REQUIRED FIELDS (FIX)
      name: bookingPayload.name,
      email: bookingPayload.email,

      date: bookingPayload.date,
      slot: bookingPayload.slot,
      mode: bookingPayload.mode,

      amount: doctor.charges.amount,
      duration: doctor.charges.duration,

      payment: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        status: "paid",
      },
    });

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("❌ Verify & book error:", err);
    return res.status(500).json({
      message: "Booking failed after payment",
    });
  }
});



/* ------------------------------------------------
   CREATE OFFER ORDER (₹99 FIXED)
------------------------------------------------ */
router.post("/create-offer-order", async (req, res) => {
  try {
    const { doctorId, employeeId } = req.body;

    const OFFER_PRICE = 99; // 🔥 FIXED OFFER PRICE

    const order = await razorpayInstance.orders.create({
      amount: OFFER_PRICE * 100, // paise
      currency: "INR",
      receipt: `offer_${Date.now()}`,
      notes: {
        doctorId,
        employeeId,
        offerPrice: OFFER_PRICE,
        isOffer: true,
      },
    });

    res.status(200).json({
      orderId: order.id,
      amount: OFFER_PRICE,
      currency: "INR",
    });
  } catch (err) {
    console.error("Create offer order error:", err);
    res.status(500).json({ message: "Failed to create offer order" });
  }
});

/* ------------------------------------------------
   VERIFY OFFER PAYMENT + BOOK SESSION
------------------------------------------------ */

/* ------------------------------------------------
   VERIFY OFFER PAYMENT + BOOK SESSION
------------------------------------------------ */
router.post("/verify-offer-and-book", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingPayload,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !bookingPayload
    ) {
      return res.status(400).json({ message: "Missing payment data" });
    }

    /* ---------------- VERIFY SIGNATURE ---------------- */
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    /* ---------------- EXTRACT BOOKING DATA ---------------- */
    const {
      doctorId,
      employeeId,
      name,
      email,
      date,
      slot,
      mode,
    } = bookingPayload;

    /* ---------------- FETCH DOCTOR ---------------- */
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (!doctor.isFirstSessionOffer || !doctor.firstSessionPrice) {
      return res.status(400).json({ message: "Offer not valid for this doctor" });
    }

    /* ---------------- CREATE BOOKING ---------------- */
    const booking = await Booking.create({
      doctorId,
      employeeId,
      name,
      email,
      date,
      slot,
      mode,

      amount: doctor.firstSessionPrice,
      duration: doctor.charges.duration || "Offer Session",
      isOfferBooking: true,

      payment: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        status: "paid",
      },
    });

    res.status(200).json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("Verify offer booking error:", err);
    res.status(500).json({ message: "Offer booking failed" });
  }
});

export default router;





