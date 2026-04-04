import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId:   { type: String, required: true },
    questionText: { type: String, default: "" },
    answer:       { type: String, required: true },
  },
  { _id: false }
);

const feedbackSchema = new mongoose.Schema(
  {
    userId:             { type: String, default: "" },
    userName:           { type: String, default: "" },
    userEmail:          { type: String, default: "" },
    userPhone:          { type: String, default: "" },
    answers:            { type: [answerSchema], default: [] },
    additionalFeedback: { type: String, default: "" },
    submittedAt:        { type: Date, default: Date.now },
    platform:           { type: String, enum: ["web", "app"], default: "web" },
  },
  { timestamps: true }
);

const Feedback =
  mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);

export default Feedback;
