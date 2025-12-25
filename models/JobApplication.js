import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema({
  jobId: mongoose.Schema.Types.ObjectId,
  jobTitle: String,
  name: String,
  email: String,
  phone: String,
  resumeUrl: String,
  status: { type: String, default: "pending" }
}, { timestamps: true });

export default mongoose.model("JobApplication", jobApplicationSchema);
