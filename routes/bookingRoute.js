import express from "express";
import nodemailer from "nodemailer";
import Booking from "../models/Booking.js";
import Doctor from "../models/Doctor.js";
import Company from "../models/Company.js";

import {
  sendBookingConfirmation,
  // sendBookingReminder,
  sendBookingCancellation,
} from "../services/whatsapp.service.js";

const router = express.Router();

/* ------------------------------
   EMAIL SENDER (inline helper)
------------------------------ */
const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true", // true for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });

    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
  }
};

/* -----------------------------------
   ADD A NEW BOOKING + SEND EMAILS & WHATSAPP
----------------------------------- */
router.post("/", async (req, res) => {
  try {
    const { doctorId, name, email, phone, date, slot, mode } = req.body;

    if (!doctorId || !date || !slot || !name || !email) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // 1️⃣ Create booking
    const booking = await Booking.create({
      doctorId,
      name,
      email,
      phone,
      date,
      slot,
      mode,
    });

    // 2️⃣ Update doctor's available slots
    const doctor = await Doctor.findById(doctorId);
    if (doctor && doctor.dateSlots && doctor.dateSlots.has(date)) {
      const updatedSlots = doctor.dateSlots.get(date).filter((s) => s !== slot);
      doctor.dateSlots.set(date, updatedSlots);
      await doctor.save();
    }

    // 3️⃣ Send confirmation emails
    if (doctor) {
      // To Doctor
      await sendEmail(
        doctor.email,
        "📅 New Appointment Booked",
        `Hello Dr. ${doctor.name},\n\nA new appointment has been booked:\n\n🧑 Patient: ${name}\n📧 Email: ${email}\n📞 Phone: ${phone || "N/A"}\n📅 Date: ${date}\n⏰ Time: ${slot}\n💬 Mode: ${mode || "video"}\n\nPlease check your dashboard for details.\n\n— Mindery Team`
      );

      // To Patient
      await sendEmail(
        email,
        "✅ Appointment Confirmation",
        `Hello ${name},\n\nYour session with Dr. ${doctor.name} has been successfully booked.\n\n📅 Date: ${date}\n⏰ Time: ${slot}\n💬 Mode: ${mode || "video"}\n\nYou'll receive reminders closer to your appointment.\n\n— Mindery Team`
      );
      console.log(name, doctor.name);
    }

    // 4️⃣ Send WhatsApp confirmation (if phone is provided)
    if (phone && doctor) {
      const bookingDetails = {
        doctorName: doctor.name,
        date,
        time: slot,
        mode: mode || "video",
        bookingId: booking._id.toString().slice(-8),
        amount: doctor.charges || "Contact Doctor",
        doctorPhone: doctor.phone || "N/A",
      };

      await sendBookingConfirmation(phone, bookingDetails);
    }

    // 5️⃣ Respond
    res.status(201).json({
      success: true,
      message: "Booking created and notifications sent successfully",
      data: booking,
    });
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: err.message,
    });
  }
});


// GET BOOKINGS (supports employee, doctor, or email)
router.get("/get-bookings", async (req, res) => {
  try {
    const { userId, employeeId, doctorId, email } = req.query;

    const filter = {};

    // ✅ correct field
    if (employeeId) {
      filter.employeeId = employeeId;
    }

    // ✅ backward compatibility
    if (userId) {
      filter.employeeId = userId;
    }

    if (doctorId) {
      filter.doctorId = doctorId;
    }

    if (email) {
      filter.email = email;
    }

    const bookings = await Booking.find(filter)
      .populate("doctorId", "name specialization email")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("❌ Failed to fetch bookings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

// GET DOCTOR APPOINTMENTS
router.get("/doctor/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;

    const bookings = await Booking.find({ doctorId })
      .sort({ date: -1, slot: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("❌ Failed to fetch doctor appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch doctor appointments",
    });
  }
});


// Check if user has booked ANY session before
router.get("/has-any-booking/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const booking = await Booking.findOne({ employeeId });
    console.log(booking)

    res.json({ hasBooked: !!booking });
  } catch (err) {
    res.status(500).json({ hasBooked: false });
  }
});

// CANCEL BOOKING + SEND WHATSAPP NOTIFICATION
// router.delete("/:bookingId", async (req, res) => {
//   try {
//     const { bookingId } = req.params;

//     const booking = await Booking.findById(bookingId).populate("doctorId");

//     if (!booking) {
//       return res.status(404).json({
//         success: false,
//         message: "Booking not found",
//       });
//     }

//     const doctor = booking.doctorId;
//     const refundAmount = booking.amount || 0;

//     // Delete the booking
//     await Booking.findByIdAndDelete(bookingId);

//     // Restore doctor's available slots
//     if (doctor && doctor.dateSlots && doctor.dateSlots.has(booking.date)) {
//       const slots = doctor.dateSlots.get(booking.date) || [];
//       if (!slots.includes(booking.slot)) {
//         slots.push(booking.slot);
//         doctor.dateSlots.set(booking.date, slots);
//         await doctor.save();
//       }
//     }

//     // Send cancellation email to patient
//     await sendEmail(
//       booking.email,
//       "❌ Appointment Cancelled",
//       `Hello ${booking.name},\n\nYour appointment with Dr. ${doctor?.name} on ${booking.date} at ${booking.slot} has been cancelled.\n\nRefund Amount: ₹${refundAmount}\nRefund will be processed within 3-5 business days.\n\nIf you need to reschedule, please visit our website.\n\n— Mindery Team`
//     );

//     // Send cancellation WhatsApp to patient
//     if (booking.phone && doctor) {
//       const cancelDetails = {
//         doctorName: doctor.name,
//         date: booking.date,
//         bookingId: bookingId.toString().slice(-8),
//         refundAmount,
//       };
//       await sendBookingCancellation(booking.phone, cancelDetails);
//     }

//     // Notify doctor
//     if (doctor) {
//       await sendEmail(
//         doctor.email,
//         "❌ Appointment Cancelled",
//         `Hello Dr. ${doctor.name},\n\nThe appointment scheduled for ${booking.date} at ${booking.slot} with ${booking.name} has been cancelled.\n\n— Mindery Team`
//       );
//     }

//     res.status(200).json({
//       success: true,
//       message: "Booking cancelled and notifications sent",
//       data: booking,
//     });
//   } catch (error) {
//     console.error("Error cancelling booking:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error cancelling booking",
//       error: error.message,
//     });
//   }
// });

router.delete("/:bookingId", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    await Booking.findByIdAndDelete(req.params.bookingId);

    // ── ADDED: Decrement sessionsUsed if this was an org_free booking ─────────
    if (booking.bookingType === "org_free" && booking.companyId) {
      await Company.findByIdAndUpdate(booking.companyId, {
        $inc: { sessionsUsed: -1 },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json({ message: "Booking cancelled successfully." });
  } catch (err) {
    console.error("Cancel booking error:", err);
    return res.status(500).json({ message: "Failed to cancel booking." });
  }
});

// ✅ GET ALL BOOKINGS OF A PARTICULAR EMPLOYEE
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const bookings = await Booking.find({ employeeId })
      .populate("doctorId", "name specialization email")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("❌ Failed to fetch employee bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee bookings",
      error: error.message,
    });
  }
});



router.get("/btocbookings-admin", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .sort({ createdAt: -1 }) // newest first
      .populate("doctorId", "name email")
      .populate("employeeId", "name email phone");

    res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (err) {
    console.error("❌ Fetch bookings error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

// DELETE booking by ID
router.delete("/booking/:id", async (req, res) => {
  try {

    const { id } = req.params;

    const booking = await Booking.findByIdAndDelete(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }


    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
    });

  } catch (err) {
    console.error("Delete booking error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete booking",
    });
  }
});


export default router;
