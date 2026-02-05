import mongoose from "mongoose";

const anonymousMessageSchema = new mongoose.Schema(
  {
    // INTERNAL OWNERSHIP (KEEP THIS)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true
    },

    displayName: {
      type: String,
      required: true,
      trim: true
    },

    // ✅ REAL USER DETAILS (NESTED OBJECT)
    realUser: {
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      phone: {
        type: String,
        required: true
      }
    },

    problem: {
      type: String,
      required: true
    },

    budget: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["OPEN", "ACCEPTED"],
      default: "OPEN"
    }
  },
  { timestamps: true }
);

export default mongoose.model("AnonymousMessage", anonymousMessageSchema);
