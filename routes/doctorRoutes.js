// routes/doctor.routes.js
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
// import Doctor from "../models/Doctor.js";
import btocDoctor from "../models/btocDoctor.js";
import User from "../models/User.js";
import upload from "../middlewares/upload.js"; 
import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import Booking from "../models/Booking.js";

const router = express.Router();

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id || decoded._id; // depends on how you sign token
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const formatDoctorResponse = (doctor) => {
  const today = new Date().toISOString().slice(0, 10);
  const todaySlots = doctor.getAvailabilityForDate
    ? doctor.getAvailabilityForDate(today)
    : [];

  // Debugging logs

  if (doctor.dateSlots) {
    console.log(`- DateSlots keys:`, Array.from(doctor.dateSlots.keys()));
  }

  // Convert to plain object
  const obj = doctor.toObject();

  // ✅ Ensure charges are preserved
  obj.charges = doctor.charges;

  // Add today's schedule
  obj.todaySchedule = {
    date: today,
    available: true, // always show available for now
    slots: todaySlots,
  };

  // Normalize slots/dateSlots
  obj.weeklySchedule = obj.weeklySchedule || [];
  if (obj.dateSlots && obj.dateSlots instanceof Map) {
    const dateSlotObj = {};
    for (const [key, value] of obj.dateSlots.entries()) {
      dateSlotObj[key] = value;
    }
    obj.slots = dateSlotObj;
    obj.dateSlots = dateSlotObj;
  } else if (obj.dateSlots && typeof obj.dateSlots === "object") {
    obj.slots = obj.dateSlots;
  }

  // ✅ Add profileImage field before returning
  obj.profileImage = doctor.imageUrl
    ? `${process.env.BASE_URL}${doctor.imageUrl}`
    : null;

  return obj;
};


// Validate MongoDB ObjectId
const validateObjectId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid doctor ID" });
  }
  next();
};

// Generate random password
const generatePassword = () => {
  return Math.random().toString(36).slice(-8);
};

// --------------------- ROUTES ---------------------

// Add new doctor
router.post("/", upload.single("profileImage"), async (req, res) => {
  try {
    const {
      name,
      specialization,
      email,
      phone,
      availabilityType,
      weeklySchedule,
      todaySchedule,
      universities,
    } = req.body;

    console.log("👉 Body received:", req.body);
    console.log("👉 File received:", req.file); 
    
    if (!name || !specialization || !email) {
      return res.status(400).json({
        success: false,
        message: "Name, specialization, and email are required",
      });
    }

    const existingDoctor = await btocDoctor.findOne({ email: email.toLowerCase() });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: "Doctor with this email already exists",
      });
    }

    // Parse possible JSON fields
    const safeWeeklySchedule =
      weeklySchedule
        ? typeof weeklySchedule === "string"
          ? JSON.parse(weeklySchedule)
          : Array.isArray(weeklySchedule)
          ? weeklySchedule
          : []
        : [];

    const parsedTodaySchedule =
      todaySchedule
        ? typeof todaySchedule === "string"
          ? JSON.parse(todaySchedule)
          : todaySchedule
        : null;

    const safeTodaySchedule = parsedTodaySchedule
      ? {
          date: parsedTodaySchedule.date || new Date().toISOString().slice(0, 10),
          available: parsedTodaySchedule.available ?? false,
          slots: Array.isArray(parsedTodaySchedule.slots) ? parsedTodaySchedule.slots : [],
        }
      : { date: new Date().toISOString().slice(0, 10), available: false, slots: [] };

    const safeUniversities =
      universities
        ? typeof universities === "string"
          ? JSON.parse(universities)
          : Array.isArray(universities)
          ? universities
          : []
        : [];

    // Generate random password
    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const doctor = new Doctor({
      name,
      specialization,
      email: email.toLowerCase(),
      phone: phone || "",
      password: hashedPassword,
      role: "doctor",
      availabilityType: availabilityType || "both",
      weeklySchedule: safeWeeklySchedule,
      todaySchedule: safeTodaySchedule,
      universities: safeUniversities,
      dateSlots: new Map(), // Initialize empty dateSlots
      profileImage: req.file ? `${BASE_URL}/uploads/doctors/${req.file.filename}` : "",

    });

    await doctor.save();

    res.status(201).json({
      success: true,
      data: formatDoctorResponse(doctor),
      generatedPassword: rawPassword,
    });
  } catch (err) {
    console.error("Error creating doctor:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all doctors (admin)
router.get("/", async (req, res) => {
  try {
    const { specialization, availabilityType, search } = req.query;
    
    let filter = {};
    
    if (specialization) {
      filter.specialization = { $regex: specialization, $options: "i" };
    }
    
    if (availabilityType) {
      filter.availabilityType = availabilityType;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } }
      ];
    }

    const doctors = await btocDoctor.find(filter)
      .select('-password')
      .populate('name')
      .sort({ displayOrder: 1, createdAt: -1 });
    
    res.status(200).json({ 
      success: true, 
      data: doctors.map(formatDoctorResponse) 
    });
  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// router.get("/all", async (req, res) => {


//   try {
//     const doctors = await btocDoctor.find()
//       .select(
//         "name imageUrl experience charges languages availabilityType about specialization expertise gender dateSlots"
//       )
//       .lean();

//     if (!doctors || doctors.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No doctors found in the database",
//       });
//     }

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const enrichedDoctors = doctors.map((doctor) => {
//       const dateSlots = doctor.dateSlots || {};

//       const hasAvailability = Object.entries(dateSlots).some(
//         ([dateStr, slots]) => {
//           if (!Array.isArray(slots) || slots.length === 0) return false;

//           const slotDate = new Date(dateStr);
//           slotDate.setHours(0, 0, 0, 0);

//           return slotDate >= today;
//         }
//       );

//       return {
//         ...doctor,
//         hasAvailability,
//       };
//     });

//     res.status(200).json({
//       success: true,
//       count: enrichedDoctors.length,
//       data: enrichedDoctors,
//     });
//   } catch (error) {
//     console.error("Error fetching doctors:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching doctors",
//       error: error.message,
//     });
//   }
// });


// Doctors with Rs 99 offer


// GET ALL ACTIVE DOCTORS (FOR FRONTEND LISTING)
// router.get("/all", async (req, res) => {
//   try {
//     const doctors = await btocDoctor
//       .find({ isActive: true })
//       .select(
//         `
//         name
//         specialization
//         experience
//         profilePhoto
//         gender
//         about
//         languages
//         availabilityType
//         location
//         consultationOptions
//         isFirstSessionOffer
//         firstSessionPrice
//         isAvailable
//         weeklyAvailability
//         dateAvailability
//         profession
//         qualification
//         displayOrder
//         `
//       )
//       .sort({ displayOrder: 1, createdAt: -1 })
//       .lean();

//     res.status(200).json(doctors);
//   } catch (error) {
//     console.error("❌ Error fetching doctors:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch doctors",
//     });
//   }
// });


router.get("/all", async (req, res) => {
  try {
    const doctors = await btocDoctor
      .find({ isActive: true, role: "doctor" })   // ✅ add this
      .select(`
        name
        specialization
        experience
        profilePhoto
        gender
        about
        languages
        availabilityType
        location
        consultationOptions
        isFirstSessionOffer
        firstSessionPrice
        isAvailable
        weeklyAvailability
        dateAvailability
        profession
        qualification
        displayOrder
        role
      `)
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    res.status(200).json(doctors);
  } catch (error) {
    console.error("❌ Error fetching doctors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch doctors",
    });
  }
});


router.get("/offer", async (req, res) => {
  try {
    const doctors = await btocDoctor
      .find({ isFirstSessionOffer: true, isActive: true })
      .select(
        `
        name imageUrl experience charges languages availabilityType
        about specialization expertise gender profilePhoto
        isFirstSessionOffer firstSessionPrice
        dateSlots
        weeklyAvailability
        dateAvailability
        displayOrder
        profession
        `
      )
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    if (!doctors || doctors.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No offer doctors found",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enrichedDoctors = doctors.map((doctor) => {
      /** -----------------------------
       * DATE SLOTS (existing logic)
       * ----------------------------- */
      const dateSlots = doctor.dateSlots || {};

      const hasDateSlots = Object.entries(dateSlots).some(
        ([dateStr, slots]) => {
          if (!Array.isArray(slots) || slots.length === 0) return false;

          const slotDate = new Date(dateStr);
          slotDate.setHours(0, 0, 0, 0);

          return slotDate >= today;
        }
      );

      /** -----------------------------
       * WEEKLY AVAILABILITY (NEW)
       * ----------------------------- */
      const hasWeeklyAvailability =
        Array.isArray(doctor.weeklyAvailability) &&
        doctor.weeklyAvailability.some(
          (slot) =>
            slot.isActive === true &&
            slot.startTime &&
            slot.endTime
        );

      /** -----------------------------
       * DATE AVAILABILITY (NEW)
       * ----------------------------- */
      const hasDateAvailability =
        Array.isArray(doctor.dateAvailability) &&
        doctor.dateAvailability.some(
          (d) =>
            d.date &&
            Array.isArray(d.slots) &&
            d.slots.length > 0
        );

      /** -----------------------------
       * FINAL AVAILABILITY FLAG
       * ----------------------------- */
      const hasAvailability =
        hasDateSlots || hasWeeklyAvailability || hasDateAvailability;

      return {
        ...doctor,
        hasAvailability, // ✅ frontend + other routes can rely on this
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedDoctors.length,
      doctors: enrichedDoctors,
    });
  } catch (error) {
    console.error("Error fetching offer doctors:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching doctors",
    });
  }
});


// Get doctors for student's university
router.get("/my-university",  authMiddleware, async (req, res) => {
  try {

    const student = await User.findById(req.userId).select("university");
            console.log(req.userId)

    if (!student || !student.university) {
      return res.status(404).json({ success: false, message: "Student's university not found" });
    }
    const doctors = await Doctor.find({ universities: student.university })
      .select('-password')
      .populate('universities', 'name')
      .sort({ displayOrder: 1, createdAt: -1 });
    
    // Use Promise.all since formatDoctorResponse is now async
    const formattedDoctors = await Promise.all(doctors.map(formatDoctorResponse));
    
    res.status(200).json({ 
      success: true, 
      data: formattedDoctors
    });
  } catch (err) {
    console.error("Failed to fetch university doctors:", err);
    res.status(500).json({ success: false, message: "Failed to fetch university doctors" });
  }
});

// Get doctor by ID
router.get("/:id", validateObjectId, upload.single("profileImage"), async (req, res) => {
  try {

    const doctor = await btocDoctor.findById(req.params.id)
      .select('-password')
      .populate('name');
    
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }
    
    res.status(200).json({ 
      success: true, 
      data: formatDoctorResponse(doctor) 
    });
  } catch (err) {
    console.error("Error fetching doctor:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update full doctor info

router.put("/:id", validateObjectId, upload.single("profileImage"), async (req, res) => {
  try {
    // req.body values will be strings if FormData is used, so be safe
    const {
      name,
      specialization,
      email,
      phone,
      availabilityType,
      weeklySchedule,
      todaySchedule,
      universities,
    } = req.body;

    // Validate required fields
    if (!name || !specialization || !email) {
      return res.status(400).json({
        success: false,
        message: "Name, specialization, and email are required",
      });
    }

    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Check for email conflicts if email is changed
    if (email.toLowerCase() !== doctor.email) {
      const existingDoctor = await btocDoctor.findOne({ email: email.toLowerCase() });
      if (existingDoctor) {
        return res.status(400).json({
          success: false,
          message: "Doctor with this email already exists",
        });
      }
    }

    // ✅ Update fields safely
    doctor.name = name || doctor.name;
    doctor.specialization = specialization || doctor.specialization;
    doctor.email = email ? email.toLowerCase() : doctor.email;
    doctor.phone = phone || doctor.phone;
    doctor.availabilityType = availabilityType || doctor.availabilityType;

    // Parse weeklySchedule/universities if they come as JSON string from FormData
    if (weeklySchedule) {
      doctor.weeklySchedule =
        typeof weeklySchedule === "string"
          ? JSON.parse(weeklySchedule)
          : Array.isArray(weeklySchedule)
          ? weeklySchedule
          : doctor.weeklySchedule;
    }

    if (universities) {
      doctor.universities =
        typeof universities === "string"
          ? JSON.parse(universities)
          : Array.isArray(universities)
          ? universities
          : doctor.universities;
    }

    if (todaySchedule) {
      const parsedToday =
        typeof todaySchedule === "string"
          ? JSON.parse(todaySchedule)
          : todaySchedule;

      doctor.todaySchedule = {
        date: parsedToday.date || new Date().toISOString().slice(0, 10),
        available: parsedToday.available ?? false,
        slots: Array.isArray(parsedToday.slots) ? parsedToday.slots : [],
      };
    }

    // ✅ Handle new image if uploaded
    if (req.file) {
      doctor.imageUrl = `/uploads/doctors/${req.file.filename}`;
    }

    await doctor.save();

    res.status(200).json({
      success: true,
      data: formatDoctorResponse(doctor),
    });
  } catch (err) {
    console.error("Error updating doctor:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ NEW: Get all date slots for a doctor
router.get("/:id/all-slots", validateObjectId, async (req, res) => {
  try {
    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const allSlots = doctor.getUpcomingAvailability(30);
    res.json({ success: true, data: allSlots });
  } catch (error) {
    console.error("Error fetching all slots:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// ✅ NEW: Update multiple date slots for a doctor
// ✅ Update multiple date slots for a doctor with availability check
router.patch("/:id/all-slots", validateObjectId, async (req, res) => {
  try {
    const { dateSlots, isAvailable } = req.body; // Accept isAvailable from frontend

    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    if (isAvailable === "not_available") {
      // Clear all slots if doctor is marked as not available
      await doctor.updateMultipleDateSlots({});
      doctor.isAvailable = "not_available";
      await doctor.save();

      return res.json({ 
        success: true, 
        message: "Doctor marked as not available. All slots cleared.", 
        data: {}
      });
    }

    // Normal update when doctor is available
    if (!dateSlots || typeof dateSlots !== "object") {
      return res.status(400).json({ success: false, message: "Valid dateSlots object is required" });
    }

    await doctor.updateMultipleDateSlots(dateSlots);
    doctor.isAvailable = "available"; // Ensure status is updated
    await doctor.save();

    res.json({
      success: true,
      message: "Date slots updated successfully",
      data: doctor.getAllDateSlots()
    });

  } catch (error) {
    console.error("Error updating date slots:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});


// ✅ UPDATED: Get slots for a specific date (supports both old and new methods)
router.get("/:id/slots", validateObjectId, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: "date query parameter is required" });
    }

    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    // Use the new method that checks dateSlots first, then falls back to old methods
    const slots = doctor.getAvailabilityForDate(date);

    res.status(200).json({ 
      success: true, 
      data: { date, slots } 
    });
  } catch (err) {
    console.error("Error fetching slots:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ UPDATED: Update slots for a specific date (supports new dateSlots method)
router.patch("/:id/slots", validateObjectId, async (req, res) => {
  try {
    const { date, slots } = req.body;
    
    if (!date) {
      return res.status(400).json({ success: false, message: "date is required" });
    }

    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    // Use the new method to set slots for specific date
    await doctor.setSlotsForDate(date, slots || []);
    
    res.json({ 
      success: true, 
      message: "Slots updated successfully",
      data: { date, slots: doctor.getAvailabilityForDate(date) }
    });
  } catch (error) {
    console.error("Error updating slots:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Clear slots for a specific date
router.delete("/:id/slots/:date", validateObjectId, async (req, res) => {
  try {
    const { date } = req.params;
    
    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    await doctor.clearSlotsForDate(date);
    
    res.json({ 
      success: true, 
      message: "Slots cleared successfully"
    });
  } catch (error) {
    console.error("Error clearing slots:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Get Doctor's availability for a specific date
router.get("/:id/availability/:date", validateObjectId, async (req, res) => {
  try {
    const { date } = req.params;
    const doctor = await btocDoctor.findById(req.params.id);
    
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const availability = doctor.getAvailabilityForDate(date);
    
    res.json({
      success: true,
      data: {
        doctorId: doctor._id,
        doctorName: doctor.name,
        date: date,
        slots: availability
      }
    });
  } catch (error) {
    console.error("Error fetching availability for date:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Get Doctor's availability for today
router.get("/:id/availability", validateObjectId, async (req, res) => {
  try {
    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const availability = doctor.getTodaysAvailability();
    
    res.json({
      success: true,
      data: {
        doctorId: doctor._id,
        doctorName: doctor.name,
        date: new Date().toISOString().split("T")[0],
        slots: availability
      }
    });
  } catch (error) {
    console.error("Error fetching availability:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Get upcoming availability for next N days
router.get("/:id/upcoming-availability", validateObjectId, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const doctor = await btocDoctor.findById(req.params.id);
    
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const upcomingAvailability = doctor.getUpcomingAvailability(parseInt(days));
    
    res.json({
      success: true,
      data: {
        doctorId: doctor._id,
        doctorName: doctor.name,
        upcomingSlots: upcomingAvailability
      }
    });
  } catch (error) {
    console.error("Error fetching upcoming availability:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Book a specific slot
router.patch("/:id/book-slot", validateObjectId, async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false, 
        message: "date, startTime, and endTime are required" 
      });
    }

    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const booked = await doctor.bookSlot(date, startTime, endTime);
    
    if (booked) {
      res.json({ 
        success: true, 
        message: "Slot booked successfully" 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: "Slot not available or not found" 
      });
    }
  } catch (error) {
    console.error("Error booking slot:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ NEW: Unbook a specific slot
router.patch("/:id/unbook-slot", validateObjectId, async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false, 
        message: "date, startTime, and endTime are required" 
      });
    }

    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const unbooked = await doctor.unbookSlot(date, startTime, endTime);
    
    if (unbooked) {
      res.json({ 
        success: true, 
        message: "Slot unbooked successfully" 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: "Slot was not booked or not found" 
      });
    }
  } catch (error) {
    console.error("Error unbooking slot:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update today's availability only (backward compatibility)
router.patch("/:id/today", validateObjectId, async (req, res) => {
  try {
    const { available, slots } = req.body;
    if (available === undefined) {
      return res.status(400).json({ success: false, message: "available is required" });
    }

    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    doctor.todaySchedule = {
      date: new Date().toISOString().slice(0, 10),
      available,
      slots: available && Array.isArray(slots) ? slots : [],
    };

    await doctor.save();
    res.status(200).json({ 
      success: true, 
      data: formatDoctorResponse(doctor) 
    });
  } catch (err) {
    console.error("Error updating today's schedule:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete doctor
router.delete("/:id", validateObjectId, async (req, res) => {
  try {
    const doctor = await btocDoctor.findByIdAndDelete(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }
    res.status(200).json({ success: true, message: "Doctor deleted successfully" });
  } catch (err) {
    console.error("Error deleting doctor:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/doctors/:id/available-dates?days=14
// router.get("/:id/available-dates", validateObjectId, async (req, res) => {
//   try {
//     const days = parseInt(req.query.days, 10) || 14;
//     const doctor = await Doctor.findById(req.params.id).select("-password");
//     if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

//     // Use the new helper (or existing one you already have)
//     const grouped = doctor.getAvailableDates ? doctor.getAvailableDates(days) : doctor.getAllDateSlots ? doctor.getAllDateSlots() : (doctor.dateSlots || doctor.slots || {});
//     // Ensure sorted ascending by date
//     const sortedDates = Object.keys(grouped).sort((a,b) => new Date(a) - new Date(b));
//     const availableDates = sortedDates.map(date => ({ date, slots: grouped[date] || [] }));

//     res.json({ success: true, data: availableDates });
//   } catch (err) {
//     console.error("Error fetching available dates:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });


router.get("/:id/available-dates", validateObjectId, async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 14;
    const doctor = await btocDoctor.findById(req.params.id).select("-password");

    if (!doctor)
      return res.status(404).json({ success: false, message: "Doctor not found" });

    // ✅ Get all booked sessions (except cancelled)
    const bookedSessions = await Session.find({
      doctorId: doctor._id,
      status: { $ne: "cancelled" },
    }).lean();

    // ✅ Build a set of normalized booked slot start times
    const bookedMap = new Set(
      bookedSessions.map((s) =>
        new Date(s.slotStart).toISOString().slice(0, 16) // keep up to minute precision
      )
    );

    // ✅ Load doctor’s available slot data
    const grouped =
      doctor.getAvailableDates?.(days) ??
      doctor.getAllDateSlots?.() ??
      doctor.dateSlots ??
      doctor.slots ??
      {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedDates = Object.keys(grouped).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    // ✅ Filter out booked & past slots
    const availableDates = sortedDates
      .filter((date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d >= today;
      })
      .map((date) => {
        const slots = grouped[date] || [];

        const freeSlots = slots.filter((slot) => {
          const startTime =
            slot.startTime || slot.start || slot.slotStart || slot.time;
          if (!startTime) return false;

          // normalize slot datetime
          const slotISO = new Date(`${date}T${startTime}:00`)
            .toISOString()
            .slice(0, 16);

          // ❌ If this slot time exists in bookedMap → remove it
          if (bookedMap.has(slotISO)) return false;

          // ✅ Keep only available ones
          return slot.isAvailable !== false;
        });

        return { date, slots: freeSlots };
      })
      .filter((entry) => entry.slots.length > 0);

    res.json({ success: true, data: availableDates });
  } catch (err) {
    console.error("Error fetching available dates:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// routes/doctors.js
router.get("/:id/available-dates/employee", async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 14;
    const doctor = await btocDoctor.findById(req.params.id).select("-password");
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    // 🩺 Get all booked sessions (excluding cancelled)
    const bookedSessions = await Session.find({
      doctorId: doctor._id,
      status: { $ne: "cancelled" },
    }).lean();

    // Create a Set of all booked slot start times (ISO)
    const bookedMap = new Set(
      bookedSessions.map((s) => new Date(s.slotStart).toISOString())
    );

    // 🗓️ Get doctor’s defined slots (assuming doctor.slots or doctor.getAvailableDates())
    const grouped =
      doctor.getAvailableDates?.(days) ??
      doctor.dateSlots ??
      doctor.slots ??
      {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedDates = Object.keys(grouped).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    // 🧮 Filter out booked slots and past dates
    const availableDates = sortedDates
      .filter((date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d >= today;
      })
      .map((date) => {
        const slots = grouped[date] || [];
        const freeSlots = slots.filter((slot) => {
          const startTime =
            slot.startTime || slot.start || slot.slotStart || slot.time;
          if (!startTime) return false;
          
          const slotDateTime = new Date(`${date}T${startTime}:00Z`); // <— force UTC
          if (isNaN(slotDateTime)) return false;

          return !bookedMap.has(slotDateTime.toISOString());

        });

        return { date, slots: freeSlots };
      })
      .filter((entry) => entry.slots.length > 0);

    res.json({ success: true, data: availableDates });
  } catch (err) {
    console.error("Error fetching available dates:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// routes/doctorRoutes.js
// router.get("/:id/availabilitybtoc", async (req, res) => {
//   try {
//     const doctor = await Doctor.findById(req.params.id);
//     if (!doctor) return res.status(404).json({ message: "Doctor not found" });

//     const availability = await doctor.getUpcomingAvailability(30);
//     res.json(availability); // { "2025-10-29": ["07:00", "08:30"], "2025-10-30": ["10:00", "16:30"] }
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });




router.get("/:id/availabilitybtoc", async (req, res) => {
  try {
    const doctor = await btocDoctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    /* -----------------------------
       1️⃣ Generate raw availability
    ------------------------------*/
    let availability = {};
    if (typeof doctor.getUpcomingAvailability === "function") {
      availability = await doctor.getUpcomingAvailability(30);
    }

    /* -----------------------------
       2️⃣ Fetch bookings
    ------------------------------*/
    const bookings = await Booking.find({ doctorId: doctor._id });

    /* -----------------------------
       3️⃣ Helpers (CRITICAL)
    ------------------------------*/
    const normalizeSlot = (s) =>
      s.replace(/\s+/g, " ").trim();

    const normalizeDate = (d) =>
      new Date(d).toISOString().slice(0, 10);

    /* -----------------------------
       4️⃣ Remove booked slots safely
    ------------------------------*/
    const availableSlots = {};

    for (const [date, slots] of Object.entries(availability)) {
      const bookedSlots = bookings
        .filter((b) => normalizeDate(b.date) === date)
        .map((b) => normalizeSlot(b.slot));

      availableSlots[date] = (slots || []).filter((s) => {
        const slotStr =
          typeof s === "string"
            ? normalizeSlot(s)
            : normalizeSlot(`${s.startTime} - ${s.endTime}`);

        return !bookedSlots.includes(slotStr);
      });
    }
       console.log( "availability",availability);
    console.log("availableslots",availableSlots);

    /* -----------------------------
       5️⃣ Return ALL dates (important)
    ------------------------------*/
    res.json( availableSlots);
 
    

  } catch (err) {
    console.error("❌ Error fetching availability:", err);
    res.status(500).json({ error: err.message });
  }
});

// About /View Profile of DR

router.get("/doctors/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Doctor ID is required",
      });
    }

    const doctor = await Doctor.findById(id).select("-password");

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    console.error("Get Doctor Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});




export default router;

