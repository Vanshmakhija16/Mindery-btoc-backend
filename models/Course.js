import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema({
  title: String,
  description: String, // NEW (for detailed day explanation)
  points: [String],
});

const courseSchema = new mongoose.Schema(
  {
    title: String,
    description: [String],

    price: Number,
    duration: String,

    originalPrice: Number,  // crossed price (₹3999)


    // ✅ NEW: Why enroll section
    whyEnroll: {
      type: String,
    },

    // ✅ NEW: What you will learn
    whatYouWillLearn: [
      {
        title: String,
        description: String,
      },
    ],

    // ✅ UPDATED: Better modules
    modules: [moduleSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Course", courseSchema);