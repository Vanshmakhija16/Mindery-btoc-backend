import mongoose from "mongoose";

const orgAssessmentResultSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgMember",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    assessmentSlug: { type: String, required: true },
    assessmentTitle: { type: String, required: true },
    answers: [
      {
        questionId: String,
        answer: String,
        score: Number,
      },
    ],
    totalScore: { type: Number, required: true },
    severity: { type: String, required: true },
    completedAt: { type: Date, default: Date.now },
    isPersonalized: { type: Boolean, default: false },
    personalizedFor: { type: String, default: null },
  },
  { timestamps: true }
);

const OrgAssessmentResult =
  mongoose.models.OrgAssessmentResult ||
  mongoose.model("OrgAssessmentResult", orgAssessmentResultSchema);

export default OrgAssessmentResult;