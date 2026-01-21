import express from "express";
import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";
import btocDoctor from "../models/btocDoctor.js";
import Booking from "../models/Booking.js";
import Employee from "../models/Employee.js";
import { sendBookingConfirmation } from "../services/whatsapp.service.js";
import { generateGoogleMeetLink } from "../googlemeet.js";
import { notifyDoctorByEmail } from "../utils/notifyDoctor.js"; // adjust path

const router = express.Router();

/**
 * ----------------------------------
 * CREATE ORDER
 * ----------------------------------
 */
router.post("/create-order", async (req, res) => {
  try {
    console.log("🔥 create-order called");
    console.log("📦 Body:", req.body);

    const { doctorId, employeeId } = req.body;

    const doctor = await btocDoctor.findById(doctorId);
    console.log("👨‍⚕️ Doctor:", doctor);

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    let finalAmount = doctor.consultationOptions?.[0]?.price;

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ message: "Doctor price not configured" });
    }

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
      duration: doctor.consultationOptions?.[0]?.duration || 30,
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
// router.post("/verify-and-book", async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       bookingPayload,
//     } = req.body;

//     if (
//       !razorpay_order_id ||
//       !razorpay_payment_id ||
//       !razorpay_signature ||
//       !bookingPayload
//     ) {
//       return res.status(400).json({ message: "Invalid payment payload" });
//     }

//     /* ---------------- VERIFY SIGNATURE ---------------- */
//     const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
//     const expectedSign = crypto
//       .createHmac("sha256", process.env.RAZORPAY_SECRET)
//       .update(sign)
//       .digest("hex");

//     if (expectedSign !== razorpay_signature) {
//       return res.status(400).json({ message: "Payment verification failed" });
//     }

//     /* ---------------- FETCH DOCTOR ---------------- */
//     const doctor = await btocDoctor.findById(bookingPayload.doctorId);
//     if (!doctor) {
//       return res.status(404).json({ message: "Doctor not found" });
//     }

//     /* ---------------- CREATE BOOKING ---------------- */
//     const booking = await Booking.create({
//       doctorId: bookingPayload.doctorId,
//       employeeId: bookingPayload.employeeId,
//       name: bookingPayload.name,
//       email: bookingPayload.email,
//        phone: bookingPayload.phone, 
//       date: bookingPayload.date,
//       slot: bookingPayload.slot,
//       mode: bookingPayload.mode,
//       amount:
//         bookingPayload.price ||
//         doctor.consultationOptions?.[0]?.price ||
//         500,
//       duration:
//         bookingPayload.duration ||
//         doctor.consultationOptions?.[0]?.duration ||
//         30,
//       payment: {
//         orderId: razorpay_order_id,
//         paymentId: razorpay_payment_id,
//         status: "paid",
//       },
//     });

//     console.log("✅ Booking created successfully:", booking._id);

//     /* ---------------- SEND WHATSAPP CONFIRMATION ---------------- */
//     try {
//       const employee = await Employee.findById(booking.employeeId);

//       if (employee?.phone) {
//         await sendBookingConfirmation(employee.phone, {
//           employeeName: booking.name,
//           doctorName: doctor.name,
//           date: booking.date,
//           time: booking.slot,
//           mode: booking.mode,
//           bookingId: booking._id.toString(),
//         });
//       }
//     } catch (wpErr) {
//       console.error(
//         "⚠️ WhatsApp booking confirmation failed:",
//         wpErr.message
//       );
//       // ❗ DO NOT fail booking
//     }

//     return res.status(200).json({
//       success: true,
//       booking,
//     });
//   } catch (err) {
//     console.error("❌ Verify & book error:", err.message);
//     console.error("Stack:", err.stack);
//     return res.status(500).json({
//       success: false,
//       message: err.message || "Booking failed after payment",
//     });
//   }
// });





// /* ------------------------------------------------
//    CREATE OFFER ORDER (₹99 FIXED)
// ------------------------------------------------ */
// router.post("/create-offer-order", async (req, res) => {
//   try {
//     const { doctorId, employeeId } = req.body;

//     if (!doctorId || !employeeId) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing doctorId or employeeId",
//       });
//     }

//     // 🔒 STEP 1: Check if user already used offer
//     const existingOfferBooking = await Booking.findOne({
//       employeeId,
//       isOfferBooking: true,
//       "payment.status": "paid", // ✅ ensure completed booking
//     });

//     if (existingOfferBooking) {
//       return res.status(400).json({
//         success: false,
//         code: "OFFER_ALREADY_USED",
//         message: "You have already availed this offer",
//       });
//     }

//     // 🔥 STEP 2: Create Razorpay order
//     const OFFER_PRICE = 99;

//     const order = await razorpayInstance.orders.create({
//       amount: OFFER_PRICE * 100, // paise
//       currency: "INR",
//       receipt: `offer_${Date.now()}`,
//       notes: {
//         doctorId,
//         employeeId,
//         offerPrice: OFFER_PRICE,
//         isOffer: true,
//       },
//     });

//     // ✅ STEP 3: Send response
//     res.status(200).json({
//       success: true,
//       orderId: order.id,
//       amount: OFFER_PRICE,
//       currency: "INR",
//     });
//   } catch (err) {
//     console.error("❌ Create offer order error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create offer order",
//     });
//   }
// });


// /* ------------------------------------------------
//    VERIFY OFFER PAYMENT + BOOK SESSION
// ------------------------------------------------ */
// router.post("/verify-offer-and-book", async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       bookingPayload,
//     } = req.body;

//     if (
//       !razorpay_order_id ||
//       !razorpay_payment_id ||
//       !razorpay_signature ||
//       !bookingPayload
//     ) {
//       return res.status(400).json({ message: "Missing payment data" });
//     }

//     /* ---------------- VERIFY SIGNATURE ---------------- */
//     const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
//     const expectedSign = crypto
//       .createHmac("sha256", process.env.RAZORPAY_SECRET)
//       .update(sign)
//       .digest("hex");

//     if (expectedSign !== razorpay_signature) {
//       return res.status(400).json({ message: "Payment verification failed" });
//     }

//     /* ---------------- EXTRACT BOOKING DATA ---------------- */
//     const {
//       doctorId,
//       employeeId,
//       name,
//       email,
//       date,
//       slot,
//       mode,
//     } = bookingPayload;

//     /* ---------------- FETCH DOCTOR ---------------- */
//     const doctor = await btocDoctor.findById(doctorId);
//     if (!doctor) {
//       return res.status(404).json({ message: "Doctor not found" });
//     }

//     if (!doctor.isFirstSessionOffer || !doctor.firstSessionPrice) {
//       return res.status(400).json({ message: "Offer not valid for this doctor" });
//     }

//     /* ---------------- CREATE BOOKING ---------------- */
//     const booking = await Booking.create({
//       doctorId,
//       employeeId,
//       name,
//       email,
//       date,
//       slot,
//       mode,

//       amount: doctor.firstSessionPrice,
//       duration: doctor.charges.duration || "Offer Session",
//       isOfferBooking: true,

//       payment: {
//         orderId: razorpay_order_id,
//         paymentId: razorpay_payment_id,
//         status: "paid",
//       },
//     });

//     res.status(200).json({
//       success: true,
//       booking,
//     });
//   } catch (err) {
//     console.error("Verify offer booking error:", err);
//     res.status(500).json({ message: "Offer booking failed" });
//   }
// });


// router.get("/check-offer-status/:employeeId" , async (req,res) => {
//   try{
//     const { employeeId } = req.params;
//     const used = await Booking.findOne({
//       employeeId ,
//       isOfferBooking : true ,
//       "payment.status" : "paid",
//     })

//     res.status(200).json({
//       success : true ,
//             offerUsed: !!used,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: "Failed to check offer status",
//     });
//   }
// }
  
// );


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

    /* ---------- VERIFY RAZORPAY SIGNATURE ---------- */
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    /* ---------- FETCH DOCTOR ---------- */
    const doctor = await btocDoctor.findById(bookingPayload.doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    /* ---------- CREATE BOOKING ---------- */
    const booking = await Booking.create({
      doctorId: bookingPayload.doctorId,
      employeeId: bookingPayload.employeeId,
      name: bookingPayload.name,
      phone: bookingPayload.phone,
      email: bookingPayload.email || null,
      date: bookingPayload.date,
      slot: bookingPayload.slot,
      mode: bookingPayload.mode,
      amount:
        bookingPayload.price ||
        doctor.consultationOptions?.[0]?.price ||
        500,
      duration:
        bookingPayload.duration ||
        doctor.consultationOptions?.[0]?.duration ||
        30,
      payment: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        status: "paid",
      },
    });

    console.log("✅ Booking created:", booking._id);

    /* ---------- GENERATE GOOGLE MEET ---------- */
    try {
      const [startTime, endTime] = booking.slot.split(" - ");

      const startDateTime = `${booking.date}T${startTime}:00`;
      const endDateTime = `${booking.date}T${endTime}:00`;

      const meetLink = await generateGoogleMeetLink({
        start: startDateTime,
        end: endDateTime,
      });

      booking.meetLink = meetLink;
      await booking.save();
try {
  await notifyDoctorByEmail({
    doctor,
    booking,
    employeeName: booking.name, // ✅ fixed (name was undefined)
  });

  console.log("✅ Doctor email sent successfully to:", doctor.email);
} catch (e) {
  console.error("⚠️ Doctor email failed:", e);
}



      console.log("✅ Meet link generated:", meetLink);
    } catch (meetErr) {
      console.error("⚠️ Meet generation failed:", meetErr.message);
    }

    /* ---------- SEND WHATSAPP ---------- */
    try {
      const employee = await Employee.findById(booking.employeeId);

      if (employee?.phone) {
        await sendBookingConfirmation(employee.phone, {
          employeeName: booking.name,
          doctorName: doctor.name,
          date: booking.date,
          time: booking.slot,
          mode: booking.mode,
          meetLink: booking.meetLink,
        });
      }
    } catch (wpErr) {
      console.error("⚠️ WhatsApp failed:", wpErr.message);
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("❌ Verify & book error:", err.message);
    return res.status(500).json({
      success: false,
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

    if (!doctorId || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "Missing doctorId or employeeId",
      });
    }

    // 🔒 Check if user already used offer
    const existingOfferBooking = await Booking.findOne({
      employeeId,
      isOfferBooking: true,
      "payment.status": "paid",
    });

    if (existingOfferBooking) {
      return res.status(400).json({
        success: false,
        code: "OFFER_ALREADY_USED",
        message: "You have already availed this offer",
      });
    }

    const OFFER_PRICE = 99;

    const order = await razorpayInstance.orders.create({
      amount: OFFER_PRICE * 100,
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
      success: true,
      orderId: order.id,
      amount: OFFER_PRICE,
      currency: "INR",
    });
  } catch (err) {
    console.error("❌ Create offer order error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create offer order",
    });
  }
});

// router.post("/verify-offer-and-book", async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       bookingPayload,
//     } = req.body;

//     if (
//       !razorpay_order_id ||
//       !razorpay_payment_id ||
//       !razorpay_signature ||
//       !bookingPayload
//     ) {
//       return res.status(400).json({ message: "Missing payment data" });
//     }

//     /* ---------- VERIFY RAZORPAY ---------- */
//     const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
//     const expectedSign = crypto
//       .createHmac("sha256", process.env.RAZORPAY_SECRET)
//       .update(sign)
//       .digest("hex");

//     if (expectedSign !== razorpay_signature) {
//       return res.status(400).json({ message: "Payment verification failed" });
//     }

//     const {
//       doctorId,
//       employeeId,
//       name,
//       phone,
//       email,
//       date,
//       slot,
//       mode,
//     } = bookingPayload;

//     /* ---------- FETCH DOCTOR ---------- */
//     const doctor = await btocDoctor.findById(doctorId);
//     if (!doctor) {
//       return res.status(404).json({ message: "Doctor not found" });
//     }

//     if (!doctor.isFirstSessionOffer || !doctor.firstSessionPrice) {
//       return res
//         .status(400)
//         .json({ message: "Offer not valid for this doctor" });
//     }

//     /* ---------- CREATE BOOKING ---------- */
//     const booking = await Booking.create({
//       doctorId,
//       employeeId,
//       name,
//       phone,
//       email: email || null,
//       date,
//       slot,
//       mode,
//       amount: doctor.firstSessionPrice,
//       duration: doctor.charges?.duration || 30,
//       isOfferBooking: true,
//       payment: {
//         orderId: razorpay_order_id,
//         paymentId: razorpay_payment_id,
//         status: "paid",
//       },
//     });

//     console.log("✅ Offer booking created:", booking._id);

//     /* ---------- GENERATE GOOGLE MEET ---------- */
//     try {
//       const [startTime, endTime] = booking.slot.split(" - ");

//       const startDateTime = `${booking.date}T${startTime}:00`;
//       const endDateTime = `${booking.date}T${endTime}:00`;

//       const meetLink = await generateGoogleMeetLink({
//         start: startDateTime,
//         end: endDateTime,
//       });

//       booking.meetLink = meetLink;
//       await booking.save();

//       console.log("✅ Offer Meet link generated:", meetLink);
//     } catch (meetErr) {
//       console.error("⚠️ Offer Meet failed:", meetErr.message);
//     }


//     console.log("📌 WHATSAPP DEBUG START");
// console.log("Employee ID:", employeeId);
// console.log("Booking Meet Link:", booking.meetLink);
// console.log("Booking Name:", name);
// console.log("Doctor Name:", doctor.name);
// console.log("Date:", date);
// console.log("Time:", slot);
// console.log("Mode:", mode);

//     /* ---------- SEND WHATSAPP ---------- */
//     try {
//       const employee = await Employee.findById(employeeId);

//       if (employee?.phone) {
//         await sendBookingConfirmation(employee.phone, {
//           employeeName: name,
//           doctorName: doctor.name,
//           date,
//           time: slot,
//           mode,
//           meetLink: booking.meetLink || "Will be shared shortly",
//         });
//       }
//     } catch (wpErr) {
//       console.error("⚠️ Offer WhatsApp failed:", wpErr.message);
//     }

//     return res.status(200).json({
//       success: true,
//       booking,
//     });
//   } catch (err) {
//     console.error("❌ Offer booking error:", err.message);
//     return res.status(500).json({
//       success: false,
//       message: "Offer booking failed",
//     });
//   }
// });

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

    /* ---------- VERIFY RAZORPAY ---------- */
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(sign)
      .digest("hex");

    if (expectedSign !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    const { doctorId, employeeId, name, phone, email, date, slot, mode } =
      bookingPayload;

    /* ---------- FETCH DOCTOR ---------- */
    const doctor = await btocDoctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (!doctor.isFirstSessionOffer || !doctor.firstSessionPrice) {
      return res
        .status(400)
        .json({ message: "Offer not valid for this doctor" });
    }

    /* ---------- CREATE BOOKING ---------- */
    const booking = await Booking.create({
      doctorId,
      doctorName: doctor.name, // ✅ save name snapshot
      employeeId,
      name,
      phone,
      email: email || null,
      date,
      slot,
      mode,
      amount: doctor.firstSessionPrice,
      duration: doctor.charges?.duration || 30,
      isOfferBooking: true,
      payment: {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        status: "paid",
      },
    });

    console.log("✅ Offer booking created:", booking._id);

    /* ---------- GENERATE GOOGLE MEET (REQUIRED) ---------- */
    const [startTime, endTime] = booking.slot.split(" - ");
    const startDateTime = `${booking.date}T${startTime}:00`;
    const endDateTime = `${booking.date}T${endTime}:00`;

    const meetLink = await doctor.meetLink;

    booking.meetLink = meetLink;
    await booking.save();

    console.log("✅ Offer Meet link from doctor db:", meetLink);


    // ✅ EMAIL DOCTOR (after meet link is saved)
try {
  console.log("DOCTOR EMAIL:", doctor.email);

  await notifyDoctorByEmail({
    doctor,
    booking,
    employeeName: booking.name,
  });

  console.log("✅ Doctor email sent successfully to:", doctor.email);
} catch (e) {
  console.error("⚠️ Doctor email failed:", e);
}


    /* ---------- SEND WHATSAPP (AFTER MEET LINK) ---------- */
try {
  const employee = await Employee.findById(employeeId);

  // ✅ Prefer phone from booking payload/booking (most reliable), fallback to DB
  const toPhone = booking?.phone || phone || employee?.phone;

  console.log("📲 WHATSAPP TO:", toPhone);

  if (toPhone) {
    await sendBookingConfirmation(toPhone, {
      employeeName: name,
      doctorName: doctor.name,
      date,
      time: slot,
      mode,
      meetLink: booking.meetLink, // guaranteed now
    });
  } else {
    console.log("⚠️ WhatsApp not sent: missing recipient phone");
  }
} catch (wpErr) {
  console.error("⚠️ Offer WhatsApp failed:", wpErr.response?.data || wpErr.message);
}


    /* ---------- RETURN AFTER EVERYTHING ---------- */
    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("❌ Offer booking error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Offer booking failed",
    });
  }
});


/* ------------------------------------------------
   CHECK OFFER STATUS
------------------------------------------------ */
router.get("/check-offer-status/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const used = await Booking.findOne({
      employeeId,
      isOfferBooking: true,
      "payment.status": "paid",
    });

    res.status(200).json({
      success: true,
      offerUsed: !!used,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to check offer status",
    });
  }
});

export default router;





