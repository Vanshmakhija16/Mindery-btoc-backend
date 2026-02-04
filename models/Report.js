import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
userPhone: { 
  type: String, 
  required: true, 
  unique: true, // Prevents duplicate entries for the same number
  trim: true    // Removes accidental spaces at the start or end
},

userName: { type: String, required: true },

    assessmentSlug: { type: String, required: true }, 
    assessmentTitle: { type: String },

    // Basic Score Info
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    percentage: { type: Number, required: true },
    status: { type: String },
    message: { type: String },

    // ⭐ NEW IMPORTANT FIELDS ⭐
    domainScores: {
      type: Object,
      default: {},       // example: { anxiety: 12, mood: 18 }
    },

    chartData: {
      type: Array,
      default: [],       // example: [ { name: "anxiety", value: 60 }, ... ]
    },

    insight: {
      type: String,
      default: "",
    },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
