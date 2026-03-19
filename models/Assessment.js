import mongoose from "mongoose";

const assessmentSchema = new mongoose.Schema({
  id: Number,
  title: String,
  slug: String,
  category: String,
  description: String,
  questions: [
    {
      id: String,
      text: String,
      options: [String],
      optionsWithWeights: Object
    }
  ],
  maxScore: Number,
  isPaid:    { type: Boolean, default: false },
  isActive:  { type: Boolean, default: true },
  createdBy: { type: String,  default: "admin" }
});

export default mongoose.model("Assessment", assessmentSchema);
