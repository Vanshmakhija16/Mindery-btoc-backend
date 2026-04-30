import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name:  { type: String, required: true },
    logo:  { type: String, default: "" },

    // ── Slug: used as URL path e.g. /amazon, /raw ─────────────
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },

    // ── Referral / Coupon codes ────────────────────────────────
    // Array so each company can have multiple codes
    referralCodes: {
      type: [String],
      default: [],
    },

    // ── Domain-based auto-detection (existing) ─────────────────
    domainPatterns: { type: [String], default: [] },

    doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "BtoDoctor" }],

    // null = unlimited (default for tenant/coupon-based companies)
    sessionQuota:  { type: Number, default: null },
    sessionsUsed:  { type: Number, default: 0 },
    contractExpiry: { type: Date, default: null },
    hrContactEmail: { type: String, lowercase: true, trim: true, default: "" },

    // ── Branding ───────────────────────────────────────────────
    primaryColor: { type: String, default: "#DE6875" },
    accentColor:  { type: String, default: "#10191F" },
    tagline:      { type: String, default: "" },
    website:      { type: String, default: "" },

    // ── WordPress booking bridge ───────────────────────────────
    wordpressWebhookUrl: { type: String, default: "" },

    assignedAssessments: [
      {
        assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
        isUnlocked:   { type: Boolean, default: true },
        assignedAt:   { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const Company = mongoose.model("Company", companySchema);
export default Company;
