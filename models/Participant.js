import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    countryCode: {
      type: String,
      default: "+91",
    },
    degree: String,
    college: String,
    year: String,
  },
  { timestamps: true }
);

export default mongoose.model("Participant", participantSchema);