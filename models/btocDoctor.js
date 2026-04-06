import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* ================= SUB SCHEMAS ================= */

const breakSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true }
  },
  { _id: false }
);

const weeklyAvailabilitySchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ],
      required: true
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDuration: { type: Number, required: true }, // minutes
    breaks: { type: [breakSchema], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

const dateAvailabilitySchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    slotDuration: { type: Number, required: true },
    breaks: { type: [breakSchema], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

const consultationOptionSchema = new mongoose.Schema(
  {
    duration: { type: Number, required: true }, // mins
    price: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

/* ================= MAIN SCHEMA ================= */

const btoDoctorSchema = new mongoose.Schema(
  {
    /* -------- BASIC INFO -------- */
    name: { type: String, required: true, trim: true },

    specialization: { type: String, default: "" },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    phone: { type: String, default: "" },

    password: { type: String, required: true },

    profession : 
      {type : String , 
      default : "",
      trim : true,
    },

    qualification : {
      type : [{
        type : String ,
        trim : true ,
      },
    ],
      default : "" ,
      
    },

    role: {
      type: String,
      enum: ["doctor", "admin"],
      default: "doctor"
    },

    experience: { type: Number, default: 0 }, // years

    profilePhoto: { type: String, default: "" },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other"
    },

    about: { type: String, default: "" },

    /* -------- LANGUAGE & MODE -------- */
    languages: {
      type: [String],
      default: ["English", "Hindi"]
    },

    availabilityType: {
      type: String,
      enum: ["online", "in_person", "both"],
      default: "both"
    },

    onlineModes: {
      type: [String],
      enum: ["audio", "video"],
      default: ["video", "audio"]
    },

    location: { type: String, default: "" },

    /* -------- PRICING -------- */
    consultationOptions: {
      type: [consultationOptionSchema],
      default: []
    },

    isFirstSessionOffer: {
      type: Boolean,
      default: false
    },

    firstSessionPrice: {
      type: Number,
      default: null
    },

    /* -------- AVAILABILITY -------- */
    isAvailable: {
      type: String,
      enum: ["available", "not_available"],
      default: "available"
    },

    weeklyAvailability: {
      type: [weeklyAvailabilitySchema],
      default: []
    },

    dateAvailability: {
      type: [dateAvailabilitySchema],
      default: []
    },

    displayOrder: {
    type: Number,
    default: 9999,
    index: true
  },
  meetLink: {
     type: String
    },

    /* -------- WEEKLY TEMPLATE -------- */
    weeklyTemplate: {
      type: [
        {
          day: {
            type: String,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            required: true
          },
          isActive: { type: Boolean, default: false },
          windows: [
            {
              startTime: { type: String, required: true },
              endTime: { type: String, required: true },
              _id: false
            }
          ]
        }
      ],
      default: []
    },

    /* -------- SYSTEM -------- */
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/* ================= PASSWORD HASH ================= */

btoDoctorSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

/* ================= SLOT GENERATION ================= */

btoDoctorSchema.methods.getSlotsForDate = function (
  dateStr,
  bookedSlots = []
) {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
      m % 60
    ).padStart(2, "0")}`;

  const buildSlots = (rule) => {
    const start = toMinutes(rule.startTime);
    const end = toMinutes(rule.endTime);
    const duration = rule.slotDuration;

    const breaks = rule.breaks.map((b) => ({
      start: toMinutes(b.startTime),
      end: toMinutes(b.endTime)
    }));

    const slots = [];

    for (let t = start; t + duration <= end; t += duration) {
      const isBreak = breaks.some(
        (b) => t < b.end && t + duration > b.start
      );
      const isBooked = bookedSlots.some(
        (s) => s.start === t && s.end === t + duration
      );

      if (!isBreak && !isBooked) {
        slots.push({
          startTime: minutesToTime(t),
          endTime: minutesToTime(t + duration)
        });
      }
    }
    return slots;
  };

  /* Date-specific override — collect ALL windows for this date and merge */
  const dateRules = this.dateAvailability.filter(
    (d) => d.date === dateStr && d.isActive
  );
  if (dateRules.length > 0) {
    return dateRules.flatMap((rule) => buildSlots(rule));
  }

  /* Weekly fallback */
  const dayName = new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long"
  });
  const weeklyRule = this.weeklyAvailability.find(
    (w) => w.day === dayName && w.isActive
  );

  if (!weeklyRule) return [];
  return buildSlots(weeklyRule);
};

// btoDoctorSchema.methods.getUpcomingAvailability = function (days = 30) {
//   const availability = {};
//   const today = new Date();

//   const toMinutes = (t) => {
//     const [h, m] = t.split(":").map(Number);
//     return h * 60 + m;
//   };

//   const toTime = (m) =>
//     `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

//   for (let i = 0; i < days; i++) {
//     const date = new Date(today);
//     date.setDate(today.getDate() + i);
//     const dateStr = date.toISOString().slice(0, 10);

//     const weekday = date.toLocaleDateString("en-US", { weekday: "long" });

//     // Priority: date-wise > weekly
//     const rule =
//       this.dateAvailability.find(d => d.date === dateStr) ||
//       this.weeklyAvailability.find(w => w.day === weekday);

//     if (!rule) continue;

//     let start = toMinutes(rule.startTime);
//     const end = toMinutes(rule.endTime);

//     const slots = [];
//     while (start + rule.slotDuration <= end) {
//       slots.push(`${toTime(start)} - ${toTime(start + rule.slotDuration)}`);
//       start += rule.slotDuration;
//     }

//     if (slots.length > 0) {
//       availability[dateStr] = slots;
//     }
//   }

//   return availability;
// };

// ✅ Get availability for a specific date

// btoDoctorSchema.methods.getUpcomingAvailability = function (days = 30) {
//   const availability = {};
//   const today = new Date();

//   const toMinutes = (t) => {
//     const [h, m] = String(t).split(":").map(Number);
//     return h * 60 + m;
//   };

//   const toTime = (m) =>
//     `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

//   for (let i = 0; i < days; i++) {
//     const date = new Date(today);
//     date.setDate(today.getDate() + i);
//     const dateStr = date.toISOString().slice(0, 10);

//     const weekday = date.toLocaleDateString("en-US", { weekday: "long" });

//     // ✅ Prefer dateAvailability; fallback weeklyAvailability (only active rules)
//     const dateRule = this.dateAvailability.find(
//       (d) => d.date === dateStr && d.isActive
//     );
//     const weeklyRule = this.weeklyAvailability.find(
//       (w) => w.day === weekday && w.isActive
//     );

//     const rule = dateRule || weeklyRule;
//     if (!rule) continue;

//     const duration = Number(rule.slotDuration || 30);
//     const start = toMinutes(rule.startTime);
//     const end = toMinutes(rule.endTime);

//     // ✅ IMPORTANT: if dateRule exists but has no breaks, fallback to weekly breaks
//     const effectiveBreaks =
//       dateRule?.breaks?.length ? dateRule.breaks : weeklyRule?.breaks || [];

//     const breaks = (effectiveBreaks || [])
//       .filter((b) => b?.startTime && b?.endTime && b.startTime < b.endTime)
//       .map((b) => ({
//         start: toMinutes(b.startTime),
//         end: toMinutes(b.endTime),
//       }));

//     const slots = [];
//     for (let t = start; t + duration <= end; t += duration) {
//       const overlapsBreak = breaks.some(
//         (b) => t < b.end && t + duration > b.start
//       );
//       if (overlapsBreak) continue;

//       slots.push(`${toTime(t)} - ${toTime(t + duration)}`);
//     }

//     if (slots.length > 0) availability[dateStr] = slots;
//   }

//   return availability;
// };

btoDoctorSchema.methods.getUpcomingAvailability = function (days = 30) {
  const availability = {};
  const today = new Date();

  const toMinutes = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
  };

  const toTime = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  // ✅ Always use 45-minute slots
  const activeDuration = 45;

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });

    // ✅ Collect ALL date-specific windows for this date (supports multiple gaps)
    const dateRules = this.dateAvailability.filter(
      (d) => d.date === dateStr && d.isActive
    );
    const weeklyRule = this.weeklyAvailability.find(
      (w) => w.day === weekday && w.isActive
    );

    const rules = dateRules.length > 0 ? dateRules : weeklyRule ? [weeklyRule] : [];
    if (rules.length === 0) continue;

    const duration = activeDuration;

    const allSlots = [];
    for (const rule of rules) {
      const start = toMinutes(rule.startTime);
      const end = toMinutes(rule.endTime);

      const breaks = (rule.breaks || [])
        .filter((b) => b?.startTime && b?.endTime && b.startTime < b.endTime)
        .map((b) => ({
          start: toMinutes(b.startTime),
          end: toMinutes(b.endTime),
        }));

      for (let t = start; t + duration <= end; t += duration) {
        const overlapsBreak = breaks.some(
          (b) => t < b.end && t + duration > b.start
        );
        if (overlapsBreak) continue;
        allSlots.push(`${toTime(t)} - ${toTime(t + duration)}`);
      }
    }

    if (allSlots.length > 0) availability[dateStr] = allSlots;
  }

  return availability;
};


btoDoctorSchema.methods.getAvailabilityForDate = function (dateStr) {
  return this.getSlotsForDate(dateStr);
};

// ✅ Clear slots for a specific date
btoDoctorSchema.methods.clearSlotsForDate = async function (date) {
  // Remove the date availability for this date
  this.dateAvailability = this.dateAvailability.filter(d => d.date !== date);
  this.markModified('dateAvailability');
  await this.save();
};

// ✅ Set slots for a specific date
btoDoctorSchema.methods.setSlotsForDate = async function (date, slots) {
  // Remove existing date availability for this date
  this.dateAvailability = this.dateAvailability.filter(d => d.date !== date);
  
  // Add the new slots as date availability if slots are provided
  if (slots && slots.length > 0) {
    // Get the first slot's time to determine start time
    let startTime = "09:00";
    let endTime = "17:00";
    let slotDuration = 30;
    
    // Try to infer from slots array
    if (typeof slots[0] === 'object' && slots[0].startTime) {
      startTime = slots[0].startTime;
      endTime = slots[slots.length - 1].endTime || "17:00";
    } else if (typeof slots[0] === 'string') {
      // If slots are strings like "09:00-10:00", extract times
      const firstSlot = slots[0].split('-');
      if (firstSlot.length >= 1) startTime = firstSlot[0].trim();
      const lastSlot = slots[slots.length - 1].split('-');
      if (lastSlot.length >= 2) endTime = lastSlot[1].trim();
    }
    
    // Use slotDuration from first weeklyAvailability or default to 30
    if (this.weeklyAvailability && this.weeklyAvailability.length > 0) {
      slotDuration = this.weeklyAvailability[0].slotDuration || 30;
    }
    
    const newDateAvailability = {
      date: date,
      startTime: startTime,
      endTime: endTime,
      slotDuration: slotDuration,
      breaks: [],
      isActive: true
    };
    this.dateAvailability.push(newDateAvailability);
  }
  
  this.markModified('dateAvailability');
  await this.save();
};

// ✅ 45-min slot generator (does NOT change DB values)
// btoDoctorSchema.methods.getUpcomingAvailability45 = function (days = 30) {
//   const availability = {};
//   const today = new Date();
//   const DURATION = 45;

//   const toMinutes = (t) => {
//     const [h, m] = t.split(":").map(Number);
//     return h * 60 + m;
//   };

//   const toTime = (m) =>
//     `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(
//       2,
//       "0"
//     )}`;

//   for (let i = 0; i < days; i++) {
//     const date = new Date(today);
//     date.setDate(today.getDate() + i);
//     const dateStr = date.toISOString().slice(0, 10);

//     const weekday = date.toLocaleDateString("en-US", { weekday: "long" });

//     // Priority: date-wise > weekly (same as your existing logic)
//     const rule =
//       this.dateAvailability.find((d) => d.date === dateStr && d.isActive) ||
//       this.weeklyAvailability.find((w) => w.day === weekday && w.isActive);

//     if (!rule) continue;

//     let start = toMinutes(rule.startTime);
//     const end = toMinutes(rule.endTime);

//     const slots = [];
//     while (start + DURATION <= end) {
//       slots.push(`${toTime(start)} - ${toTime(start + DURATION)}`);
//       start += DURATION;
//     }

//     if (slots.length > 0) availability[dateStr] = slots;
//   }

//   return availability;
// };

btoDoctorSchema.methods.getUpcomingAvailability45 = function (days = 30) {
  const availability = {};
  const DURATION = 45;
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

  // Get today's date in IST
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);

  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const toTime = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  // Return YYYY-MM-DD for a date shifted by IST offset
  const toISTDateStr = (d) => {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    return ist.toISOString().slice(0, 10);
  };

  // Return weekday name for a date in IST
  const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const toISTWeekday = (d) => {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    return WEEKDAYS[ist.getUTCDay()];
  };

  for (let i = 0; i < days; i++) {
    const date = new Date(nowIST);
    date.setUTCDate(nowIST.getUTCDate() + i);
    const dateStr = toISTDateStr(date);

    const weekday = toISTWeekday(date);

    // ✅ Collect ALL date-specific windows for this date
    const dateRules45 = this.dateAvailability.filter(
      (d) => d.date === dateStr && d.isActive
    );
    const weeklyRule45 = this.weeklyAvailability.find(
      (w) => w.day === weekday && w.isActive
    );

    const rules45 = dateRules45.length > 0 ? dateRules45 : weeklyRule45 ? [weeklyRule45] : [];
    if (rules45.length === 0) continue;

    const allSlots45 = [];
    for (const rule of rules45) {
      const start = toMinutes(rule.startTime);
      const end = toMinutes(rule.endTime);

      const breaks = (rule.breaks || []).map((b) => ({
        start: toMinutes(b.startTime),
        end: toMinutes(b.endTime),
      }));

      for (let t = start; t + DURATION <= end; t += DURATION) {
        const overlapsBreak = breaks.some((b) => t < b.end && t + DURATION > b.start);
        if (overlapsBreak) continue;
        allSlots45.push(`${toTime(t)} - ${toTime(t + DURATION)}`);
      }
    }

    if (allSlots45.length > 0) availability[dateStr] = allSlots45;
  }

  return availability;
};

const BtoDoctor =
  mongoose.models.BtoDoctor || mongoose.model("BtoDoctor", btoDoctorSchema);

export default BtoDoctor;
