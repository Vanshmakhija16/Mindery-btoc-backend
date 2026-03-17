import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    domainPatterns: {
      type: [String],
      default: [],
    },

  doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "BtoDoctor" }],

    // ─── NEW FIELDS ───────────────────────────────────────────
    sessionQuota: {
      type: Number,
      default: 50,
    },

    sessionsUsed: {
      type: Number,
      default: 0,
    },

    contractExpiry: {
      type: Date,
      default: null,
    },

    hrContactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },
    accessCode: {
    type: String,
    default: "",
    uppercase: true,
    trim: true,
  },
    // ──────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

const Company = mongoose.model("Company", companySchema);
export default Company;