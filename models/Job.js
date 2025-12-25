import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  title: String,
  slug: { type: String, unique: true },

  department: String,
  location: String,
  jobType: String,
  experience: String,

  skills: [String],          // ← ADD
  description: String,
  responsibilities: [String],
  requirements: [String],

  applyLink: String,         // ← ADD (Google Form / LinkedIn)
  applyType: {
    type: String,
    enum: ["google-form", "linkedin"],
    default: "linkedin"
  },

  order: { type: Number, default: 999 }, // ← ADD (sorting)

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Job", jobSchema);
