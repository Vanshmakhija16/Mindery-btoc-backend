import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BtoDoctor",
      required: true,
    },

    message: {
      type: String,
      trim: true,
      required: true,
    },

    repliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const therapyRequestSchema = new mongoose.Schema(
  {
    /* ===== USER DETAILS ===== */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    /* ===== USER QUERY ===== */
    queryText: {
      type: String,
      required: true,
      trim: true,
    },

    /* ===== SELECTED PRICE ===== */
    selectedPrice: {
      type: Number,
      enum: [700, 1200, 1500],
      default: null,
    },

    /* ===== THERAPISTS WHO RECEIVED REQUEST ===== */
    therapistsTargeted: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BtoDoctor",
      },
    ],

    /* ===== MULTIPLE THERAPIST REPLIES ===== */
    replies: [replySchema],

    /* ===== FINAL THERAPIST USER BOOKED ===== */
    bookedTherapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BtoDoctor",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("TherapyRequest", therapyRequestSchema);
