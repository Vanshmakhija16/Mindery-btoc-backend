// seedPaidAssessment.js
// Run: node seed/seedPaidAssessment.js
// Adds "Workplace Burnout Scale (WBS)" as a paid/locked assessment

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Assessment from "../models/Assessment.js";

const burnoutAssessment = {
  id: 6,
  title: "Workplace Burnout Scale (WBS)",
  slug: "wbs",
  category: "stress",
  description:
    "A clinically validated 15-item scale that measures the three core dimensions of workplace burnout — emotional exhaustion, depersonalisation, and reduced personal accomplishment. Designed specifically for working professionals.",
  maxScore: 60,
  isPaid: true,
  isActive: true,
  createdBy: "admin",
  questions: [
    {
      id: "q1",
      text: "I feel emotionally drained by my work.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q2",
      text: "I feel used up at the end of the workday.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q3",
      text: "I feel fatigued when I get up in the morning and have to face another day on the job.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q4",
      text: "Working with people all day is really a strain for me.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q5",
      text: "I feel burned out from my work.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q6",
      text: "I feel frustrated by my job.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q7",
      text: "I feel I am working too hard on my job.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q8",
      text: "I have become less interested in my work since I started this job.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q9",
      text: "I have become more callous toward people since I started this job.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q10",
      text: "I worry that this job is hardening me emotionally.",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      optionsWithWeights: { Never: 0, Rarely: 1, Sometimes: 2, Often: 3, Always: 4 },
    },
    {
      id: "q11",
      text: "I feel I have accomplished many worthwhile things in my work.",
      options: ["Always", "Often", "Sometimes", "Rarely", "Never"],
      optionsWithWeights: { Always: 0, Often: 1, Sometimes: 2, Rarely: 3, Never: 4 },
    },
    {
      id: "q12",
      text: "I feel confident that I am effective at getting things done.",
      options: ["Always", "Often", "Sometimes", "Rarely", "Never"],
      optionsWithWeights: { Always: 0, Often: 1, Sometimes: 2, Rarely: 3, Never: 4 },
    },
    {
      id: "q13",
      text: "In my work, I deal with emotional problems calmly.",
      options: ["Always", "Often", "Sometimes", "Rarely", "Never"],
      optionsWithWeights: { Always: 0, Often: 1, Sometimes: 2, Rarely: 3, Never: 4 },
    },
    {
      id: "q14",
      text: "I can easily create a relaxed atmosphere with people I work with.",
      options: ["Always", "Often", "Sometimes", "Rarely", "Never"],
      optionsWithWeights: { Always: 0, Often: 1, Sometimes: 2, Rarely: 3, Never: 4 },
    },
    {
      id: "q15",
      text: "I feel I make a positive difference through my work.",
      options: ["Always", "Often", "Sometimes", "Rarely", "Never"],
      optionsWithWeights: { Always: 0, Often: 1, Sometimes: 2, Rarely: 3, Never: 4 },
    },
  ],
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ MongoDB connected");

    // Remove existing if re-running
    await Assessment.deleteOne({ slug: "wbs" });

    const assessment = new Assessment(burnoutAssessment);
    await assessment.save();

    console.log("✅ Workplace Burnout Scale (WBS) inserted successfully");
    console.log("   isPaid  :", assessment.isPaid);
    console.log("   isActive:", assessment.isActive);
    console.log("   slug    :", assessment.slug);
    console.log("");
    console.log("👉 It will appear as LOCKED for all companies by default.");
    console.log("👉 Go to Admin → Organizations → Assign Assessments to unlock it for a company.");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected");
  }
}

seed();
