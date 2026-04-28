import mongoose from "mongoose";

/**
 * CaTherapist.js
 * Tracks which doctors are assigned to the Canadian (mindery.ca) portal.
 * 
 * One record per doctor. isActive controls visibility on the CA portal.
 * Pricing fields are optional overrides; if null, the system falls back to
 * the doctor's consultationOptions converted to CAD.
 */
const caTherapistSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BtoDoctor",
      required: true,
      unique: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: String,
      default: "admin",
    },

    // ── Pricing ──────────────────────────────────────────────────────────────
    // CAD price for a regular session (optional override)
    // If null → system converts from doctor's INR consultationOptions[0].price
    cadPrice: {
      type: Number,
      default: null,
    },
    // CAD price for the FIRST session (shown prominently on therapist cards)
    // If null → same as cadPrice (no first-session discount)
    firstSessionCadPrice: {
      type: Number,
      default: null,
    },

    // ── Timezone ─────────────────────────────────────────────────────────────
    // Which Canadian timezone to default to for this therapist's display
    // Users can always switch timezone on the frontend
    displayTimezone: {
      type: String,
      default: "America/Toronto", // Eastern Time
    },

    // ── Status ───────────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CaTherapist", caTherapistSchema);
