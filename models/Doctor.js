// import mongoose from "mongoose";
// import bcrypt from "bcryptjs";

// // ✅ Time slot schema
// const timeSlotSchema = new mongoose.Schema({
//   startTime: { type: String, required: true }, // "HH:MM"
//   endTime: { type: String, required: true },   // "HH:MM"
//   isAvailable: { type: Boolean, default: true }
// });

// // ✅ Daily schedule schema for weeklySchedule
// const dayScheduleSchema = new mongoose.Schema({
//   day: {
//     type: String,
//     required: true,
//     enum: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
//   },
//   slots: { type: [timeSlotSchema], default: [] }
// });

// // ✅ Schema for today's schedule
// const todayScheduleSchema = new mongoose.Schema({
//   date: { type: String, required: true }, // YYYY-MM-DD
//   available: { type: Boolean, default: false },
//   slots: { type: [timeSlotSchema], default: [] }
// });

// const doctorSchema = new mongoose.Schema(
//   {
//     /* ---------------- BASIC INFO ---------------- */
//     name: {
//       type: String,
//       required: true,
//       trim: true,
//     },

//     specialization: {
//       type: String,
//       default: "",
//     },

//     expertise: {
//       type: String,
//       default: "",
//     },

//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//     },

//     phone: {
//       type: String,
//       default: "",
//     },

//     password: {
//       type: String,
//       default: "", // for login (hashed)
//     },

//     role: {
//       type: String,
//       enum: ["doctor", "admin"],
//       default: "doctor",
//     },

//     experience: {
//       type: Number,
//       default: 0,
//     },

//     imageUrl: {
//       type: String,
//       default: "",
//     },

//     gender: {
//       type: String,
//       enum: ["male", "female", "other"],
//       default: "other",
//     },

//     about: {
//       type: String,
//       default: "",
//     },

//     /* ---------------- LANGUAGE & MODE ---------------- */
//     languages: {
//       type: [String],
//       default: ["English", "Hindi"],
//     },

//     availabilityType: {
//       type: String,
//       enum: ["online", "offline", "both"],
//       default: "both",
//     },

//     onlineModes: {
//       type: [String], // ["video", "audio"]
//       enum: ["video", "audio"],
//       default: ["video", "audio"],
//     },

//     /* ---------------- PRICING ---------------- */
//     charges: {
//       amount: {
//         type: Number,
//         default: 0, // e.g. 1600
//       },
//       duration: {
//         type: String,
//         default: "70 mins",
//       },
//     },

//     isFirstSessionOffer: {
//       type: Boolean,
//       default: false,
//     },

//     firstSessionPrice: {
//       type: Number,
//       default: null,
//     },

//     /* ---------------- AVAILABILITY ---------------- */
//     isAvailable: {
//       type: String,
//       enum: ["available", "not_available"],
//       default: "available",
//     },

//     weeklySchedule: {
//       type: [mongoose.Schema.Types.Mixed], // dayScheduleSchema
//       default: [],
//     },

//     todaySchedule: {
//       type: mongoose.Schema.Types.Mixed, // todayScheduleSchema
//       default: () => ({
//         date: new Date().toISOString().split("T")[0],
//         available: false,
//         slots: [],
//       }),
//     },

//     dateSlots: {
//       type: Map,
//       of: [mongoose.Schema.Types.Mixed], // timeSlotSchema
//       default: new Map(),
//     },

//     /* ---------------- RELATIONS ---------------- */
//     universities: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "University",
//       },
//     ],
//   },
//   { timestamps: true }
// );


// // ✅ Pre-save hooks
// doctorSchema.pre('save', async function (next) {
//   if (this.universities) {
//     this.universities = this.universities.filter(id => mongoose.Types.ObjectId.isValid(id));
//   }

//   if (this.isModified('password') && this.password && !this.password.startsWith('$2b$')) {
//     const salt = await bcrypt.genSalt(10);
//     this.password = await bcrypt.hash(this.password, salt);
//   }

//   next();
// });

// // ✅ Helper methods
// doctorSchema.methods.addUniversity = async function (universityId) {
//   if (!this.universities.includes(universityId)) {
//     this.universities.push(universityId);
//     await this.save();
//   }
// };

// doctorSchema.methods.removeUniversity = async function (universityId) {
//   this.universities = this.universities.filter(id => id.toString() !== universityId.toString());
//   await this.save();
// };

// // ✅ Get availability for a specific date
// doctorSchema.methods.getAvailabilityForDate = async function (date) {
//   if (this.dateSlots && this.dateSlots.has(date)) {
//     return this.dateSlots.get(date).filter(s => s.isAvailable);
//   }

//   const todayDate = new Date().toISOString().split("T")[0];

//   if (date === todayDate && this.weeklySchedule && this.weeklySchedule.length > 0) {
//     const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
//     const dayName = days[new Date().getDay()];
//     const weeklyDay = this.weeklySchedule.find(s => s.day === dayName);

//     if (weeklyDay && weeklyDay.slots.length > 0) {
//       const slotsCopy = weeklyDay.slots.map(s => ({ ...s.toObject(), isAvailable: true }));
//       this.dateSlots.set(date, slotsCopy);
//       this.markModified('dateSlots');
//       return slotsCopy.filter(s => s.isAvailable);
//     }
//   }

//   if (this.todaySchedule && this.todaySchedule.date === date && this.todaySchedule.available) {
//     return this.todaySchedule.slots.filter(s => s.isAvailable);
//   }

//   const dateObj = new Date(date);
//   const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dateObj.getDay()];
//   const weeklyDay = this.weeklySchedule.find(s => s.day === dayName);
//   return weeklyDay ? weeklyDay.slots.filter(s => s.isAvailable) : [];
// };

// // ✅ Get today’s availability
// doctorSchema.methods.getTodaysAvailability = async function () {
//   const todayDate = new Date().toISOString().split("T")[0];
//   return await this.getAvailabilityForDate(todayDate);
// };

// // ✅ Set slots for a specific date
// doctorSchema.methods.setSlotsForDate = async function (date, slots) {
//   if (!this.dateSlots) this.dateSlots = new Map();
//   this.dateSlots.set(date, slots);
//   this.markModified('dateSlots');
//   await this.save();
// };

// // ✅ Get all date-specific slots
// doctorSchema.methods.getAllDateSlots = function () {
//   if (!this.dateSlots) return {};
//   const result = {};
//   for (const [date, slots] of this.dateSlots.entries()) {
//     result[date] = slots.filter(s => s.isAvailable);
//   }
//   return result;
// };

// // ✅ Clear slots for a specific date
// doctorSchema.methods.clearSlotsForDate = async function (date) {
//   if (this.dateSlots && this.dateSlots.has(date)) {
//     this.dateSlots.delete(date);
//     this.markModified('dateSlots');
//     await this.save();
//   }
// };

// // ✅ Update multiple date slots at once
// doctorSchema.methods.updateMultipleDateSlots = async function (dateSlotMap) {
//   if (!this.dateSlots) this.dateSlots = new Map();

//   for (const [date, slots] of Object.entries(dateSlotMap)) {
//     if (slots && slots.length > 0) {
//       this.dateSlots.set(date, slots);
//     } else {
//       this.dateSlots.delete(date);
//     }
//   }

//   this.markModified('dateSlots');
//   await this.save();
// };

// // ✅ Get upcoming availability
// doctorSchema.methods.getUpcomingAvailability = async function (days = 7) {
//   const result = {};
//   const today = new Date();
//   for (let i = 0; i < days; i++) {
//     const date = new Date(today);
//     date.setDate(today.getDate() + i);
//     const dateStr = date.toISOString().split("T")[0];
//     const slots = await this.getAvailabilityForDate(dateStr);
//     if (slots && slots.length > 0) result[dateStr] = slots;
//   }
//   return result;
// };

// // ✅ Check if available at specific date/time
// doctorSchema.methods.isAvailableAtDateTime = async function (date, startTime, endTime) {
//   const toMinutes = (timeStr) => {
//     const [h, m] = timeStr.split(":").map(Number);
//     return h * 60 + m;
//   };

//   const reqStart = toMinutes(startTime);
//   const reqEnd = toMinutes(endTime);

//   const slots = await this.getAvailabilityForDate(date);
//   if (!slots || slots.length === 0) return false;

//   return slots.some(slot => {
//     const slotStart = toMinutes(slot.startTime);
//     const slotEnd = toMinutes(slot.endTime);
//     return slotStart <= reqStart && slotEnd >= reqEnd && slot.isAvailable;
//   });
// };

// // ✅ Book a slot
// doctorSchema.methods.bookSlot = async function (date, startTime, endTime) {
//   if (!this.dateSlots) this.dateSlots = new Map();

//   if (!this.dateSlots.has(date)) {
//     const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(date).getDay()];
//     const weeklyDay = this.weeklySchedule.find(s => s.day === dayName);
//     this.dateSlots.set(date, weeklyDay ? weeklyDay.slots.map(s => ({ ...s.toObject(), isAvailable: true })) : []);
//   }

//   const slots = this.dateSlots.get(date);
//   const slotIndex = slots.findIndex(slot =>
//     slot.startTime === startTime && slot.endTime === endTime && slot.isAvailable
//   );

//   if (slotIndex === -1) return false;

//   slots[slotIndex].isAvailable = false;
//   this.dateSlots.set(date, slots);
//   this.markModified('dateSlots');
//   await this.save();
//   return true;
// };

// // ✅ Unbook a slot
// doctorSchema.methods.unbookSlot = async function (date, startTime, endTime) {
//   if (!this.dateSlots || !this.dateSlots.has(date)) return false;

//   const slots = this.dateSlots.get(date);
//   const slotIndex = slots.findIndex(slot =>
//     slot.startTime === startTime && slot.endTime === endTime && !slot.isAvailable
//   );

//   if (slotIndex === -1) return false;

//   slots[slotIndex].isAvailable = true;
//   this.dateSlots.set(date, slots);
//   this.markModified('dateSlots');
//   await this.save();
//   return true;
// };

// // ✅ Get total available slots
// doctorSchema.methods.getAvailableSlotsCount = async function (date) {
//   const slots = await this.getAvailabilityForDate(date);
//   return slots.length;
// };

// // ✅ Get all dates with slots
// doctorSchema.methods.getDatesWithSlots = function () {
//   if (!this.dateSlots) return [];
//   return Array.from(this.dateSlots.keys()).sort();
// };

// // ✅ Compare password
// doctorSchema.methods.comparePassword = async function (enteredPassword) {
//   return bcrypt.compare(enteredPassword, this.password);
// };

// // ✅ Transform for JSON output
// doctorSchema.set('toJSON', {
//   transform: function(doc, ret) {
//     if (ret.dateSlots) {
//       const dateSlotObj = {};
//       for (const [key, value] of ret.dateSlots.entries()) {
//         dateSlotObj[key] = value;
//       }
//       ret.slots = dateSlotObj;
//       ret.dateSlots = dateSlotObj;
//     }
//     return ret;
//   }
// });

// // ✅ Indexes
// doctorSchema.index({ email: 1 });
// doctorSchema.index({ specialization: 1 });
// doctorSchema.index({ availabilityType: 1 });
// doctorSchema.index({ "universities": 1 });

// export default mongoose.model("Doctor", doctorSchema);



import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* ---------- SUB SCHEMAS ---------- */

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
      enum: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
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
    duration: { type: Number, required: true },
    price: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  { _id: false }
);

/* ---------- MAIN SCHEMA ---------- */

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: String,
    profilePhoto: String,
    description: String,

    password: { type: String, required: true },
    role: { type: String, enum: ["doctor", "admin"], default: "doctor" },

    availabilityType: {
      type: String,
      enum: ["online", "in_person"],
      required: true
    },
    onlineModes: {
      type: [String],
      enum: ["audio", "video"],
      default: []
    },
    location: String,

    consultationOptions: [consultationOptionSchema],

    weeklyAvailability: [weeklyAvailabilitySchema],
    dateAvailability: [dateAvailabilitySchema],

    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/* ---------- PASSWORD ---------- */

doctorSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

/* ---------- SLOT GENERATION ---------- */

doctorSchema.methods.getSlotsForDate = function (dateStr, bookedSlots = []) {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const buildSlots = (rule) => {
    const start = toMinutes(rule.startTime);
    const end = toMinutes(rule.endTime);
    const duration = rule.slotDuration;

    const breaks = rule.breaks.map(b => ({
      start: toMinutes(b.startTime),
      end: toMinutes(b.endTime)
    }));

    const slots = [];

    for (let t = start; t + duration <= end; t += duration) {
      const isBreak = breaks.some(b => t < b.end && t + duration > b.start);
      const isBooked = bookedSlots.some(
        s => s.start === t && s.end === t + duration
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

  const minutesToTime = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  /* 1️⃣ Date override */
  const dateRule = this.dateAvailability.find(d => d.date === dateStr && d.isActive);
  if (dateRule) return buildSlots(dateRule);

  /* 2️⃣ Weekly fallback */
  const dayName = new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });
  const weeklyRule = this.weeklyAvailability.find(w => w.day === dayName && w.isActive);

  if (!weeklyRule) return [];
  return buildSlots(weeklyRule);
};

export default mongoose.model("Doctor", doctorSchema);



