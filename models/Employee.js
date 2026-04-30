import mongoose from "mongoose";
import crypto from "crypto";

const employeeSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: {
      type: String, unique: true, required: true, sparse: true,
      match: [/^[0-9]{10,15}$/, "Invalid phone number"],
    },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    otp:        { type: String },
    otpExpires: { type: Date },

    // ── REFERRAL SYSTEM ────────────────────────────────────────────────
    // Each user gets a unique referral code on signup (e.g. MIN-A1B2C3)
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
    },
    // The employee._id of whoever referred this user (null if no referral)
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    // CAD wallet balance — credited manually when referral is validated
    // Admin credits 5 CAD to the referrer's wallet after referral is confirmed
    caWalletBalance: {
      type: Number,
      default: 0,
    },
    // ──────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

// Auto-generate referral code before saving if not set
employeeSchema.pre("save", function (next) {
  if (!this.referralCode) {
    // Format: MIN-XXXXXX (6 random uppercase alphanumeric chars)
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    this.referralCode = `MIN-${rand}`;
  }
  next();
});

export default mongoose.model("Employee", employeeSchema);
