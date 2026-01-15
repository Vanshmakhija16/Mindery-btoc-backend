import express from "express";
import bcrypt from "bcryptjs";
import BtocDoctor from "../models/btocDoctor.js";
import EmployeeAppointment from "../models/EmployeeAppointment.js";
import Booking from "../models/Booking.js";
import adminAuth from "../middlewares/adminAuth.js";

const router = express.Router();

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
// router.post("/doctors", async (req, res) => {
//   try {
//     const doctor = new BtocDoctor(req.body);
//     await doctor.save();

//     const docObj = doctor.toObject();
//     delete docObj.password;

//     res.status(201).json({
//       message: "Doctor added successfully",
//       doctor: docObj
//     });
//   } catch (error) {
//     res.status(400).json({
//       message: "Failed to add doctor",
//       error: error.message
//     });
//   }
// });


router.post("/doctors",adminAuth, async (req, res) => {
  try {
    let displayOrder = 9999;

    // Validate and accept displayOrder from request body
    if (req.body.displayOrder !== undefined && req.body.displayOrder !== null) {
      const val = Number(req.body.displayOrder);
      // Only accept positive integers
      if (Number.isInteger(val) && val >= 1) {
        displayOrder = val;
      } else {
        // Invalid value - silently use default 9999
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
// router.put("/doctors/:doctorId", async (req, res) => {
//   try {
//     const { doctorId } = req.params;
//     const updateData = { ...req.body };

//     // 🔐 Handle password safely
//     if (updateData.password) {
//       updateData.password = await bcrypt.hash(updateData.password, 10);
//     } else {
//       delete updateData.password;
//     }

//     const doctor = await BtocDoctor.findByIdAndUpdate(
//       doctorId,
//       updateData,
//       { new: true, runValidators: true }
//     ).lean();

//     if (!doctor) {
//       return res.status(404).json({ message: "Doctor not found" });
//     }

//     delete doctor.password;

//     res.json({
//       message: "Doctor updated successfully",
//       doctor
//     });
//   } catch (error) {
//     res.status(400).json({
//       message: "Failed to update doctor",
//       error: error.message
//     });
//   }
// });


router.put("/doctors/:doctorId", adminAuth, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const updateData = { ...req.body };

    // 🔐 Handle password safely
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    // ⭐ PRIORITY LOGIC - Handle displayOrder
    if (updateData.displayOrder !== undefined && updateData.displayOrder !== null && updateData.displayOrder !== "") {
      const val = Number(updateData.displayOrder);
      // Only accept positive integers or 9999
      if (Number.isInteger(val) && (val >= 1 || val === 9999)) {
        updateData.displayOrder = val;
      } else {
        // Invalid value - silently use default 9999
        updateData.displayOrder = 9999;
      }
    } else {
      // If no displayOrder provided, fetch current and keep it
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
// router.get("/doctors", adminAuth, async (req, res) => {
//   try {
//     const doctors = await BtocDoctor.find()
//       .select("-password")
//       .sort({ displayOrder: 1, createdAt: -1 })
//       .lean();

//     res.json(doctors);
//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to fetch doctors",
//       error: error.message
//     });
//   }
// });

/* ================= GET ALL BTODR DOCTORS ================= */
router.get("/doctors", adminAuth, async (req, res) => {
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
router.get("/doctors/:doctorId", adminAuth, async (req, res) => {
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


router.get("/doctors/:doctorId/appointments", adminAuth,async (req, res) => {
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






/* ================= GET DOCTOR'S APPOINTMENTS ================= */
// router.get("/doctors/:doctorId/appointments", async (req, res) => {
//   try {
//     const { doctorId } = req.params;

//     const now = new Date();

//     // Fetch all appointments for this doctor and populate employee details
//     const appointments = await EmployeeAppointment.find({ doctor: doctorId })
//       .populate("employee", "name email phone")
//       .sort({ slotStart: -1 })
//       .lean();

//     if (!appointments) {
//       return res.status(404).json({ message: "No appointments found" });
//     }

//     // Fetch booking amounts for all appointments
//     const appointmentIds = appointments.map(app => app._id);
//     const bookings = await Booking.find({ _id: { $in: appointmentIds } })
//       .lean();

//     const bookingMap = {};
//     bookings.forEach(booking => {
//       bookingMap[booking._id] = booking.amount || 0;
//     });

//     // Format appointments for frontend
//     const formattedAppointments = appointments.map(app => ({
//       _id: app._id,
//       employeeName: app.employee?.name || "N/A",
//       employeeEmail: app.employee?.email || "N/A",
//       employeePhone: app.employee?.phone || "N/A",
//       date: app.slotStart,
//       slot: app.slotStart ? new Date(app.slotStart).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "N/A",
//       mode: app.mode === "video" ? "online_video" : app.mode === "audio" ? "online_audio" : "offline",
//       amount: bookingMap[app._id] || 0,
//     }));

//     // Separate into upcoming and past
//     const upcoming = formattedAppointments.filter(app => new Date(app.date) >= now);
//     const past = formattedAppointments.filter(app => new Date(app.date) < now);
      
//     res.json({
//       upcoming,
//       past
//     });
//   } catch (error) {
//     console.error("Error fetching appointments:", error);
//     res.status(500).json({
//       message: "Failed to fetch appointments",
//       error: error.message
//     });
//   }
// });



export default router;
