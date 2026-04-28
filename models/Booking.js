import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BtoDoctor",
      required: true,
    },

    doctorName: {
      type: String,
      trim: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    meetLink: {
      type: String,
    },

    reminderAt: {
      type: Date,
    },

    reminderSent: {
      type: Boolean,
      default: false,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },

    date: String,
    slot: String,
    mode: String,

    amount: Number,
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "CAD", "AED", "USD"]
    },
    duration: String,
    isOfferBooking: Boolean,

    payment: {
      orderId: String,
      paymentId: String,
      status: String,
      provider: {
        type: String,
        default: "razorpay",
        enum: ["razorpay", "stripe", "paypal"]
      },
      countryCode: {
        type: String,
        default: "in",
        enum: ["in", "ca", "ae", "uk"]
      }
    },

    confirmationSent: {
      type: Boolean,
      default: false,
    },

    // ─── NEW FIELDS ───────────────────────────────────────────
    bookingType: {
      type: String,
      enum: ["paid", "org_free"],
      default: "paid",
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    status: {
      type: String,
      enum: ["booked", "completed", "no_response", "rescheduled"],
      default: "booked",
    },

    rescheduleNote: {
      type: String,
      default: "",
    },
    // ──────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);