// adminAssessmentRoutes.js
// Handles admin-specific assessment endpoints that must come BEFORE the /:slug wildcard route.
// Mount this at /api/assessments in index.js BEFORE the main assessments router.

import express from "express";
import Assessment from "../models/Assessment.js";

const router = express.Router();

// ── Minimal seed data (just titles, slugs, categories, descriptions, maxScores) ──
// Full question data lives in the main assessments.js file.
// This seed only inserts stub records so the admin page can show them and toggle lock/unlock.
// The actual questions are already in the DB if you ran seedAssessments.js; this is a fallback.
const SEED_DATA = [
  { id: 1,  slug: "bdi",             title: "Beck Depression Inventory (BDI)",      category: "mental",   maxScore: 63,  description: "A self-assessment to measure levels of depression." },
  { id: 2,  slug: "gad7",            title: "GAD-7 Anxiety Assessment",              category: "mental",   maxScore: 21,  description: "A 7-question screening tool to measure anxiety levels." },
  { id: 3,  slug: "pss",             title: "Perceived Stress Scale (PSS)",          category: "stress",   maxScore: 40,  description: "A 10-item questionnaire to measure perceived stress levels." },
  { id: 4,  slug: "who5",            title: "WHO-5 Well-being Index",                category: "mental",   maxScore: 25,  description: "A short 5-item measure of current mental well-being." },
  { id: 5,  slug: "sqs",             title: "Sleep Quality Scale (SQS)",             category: "sleep",    maxScore: 84,  description: "A 28-item scale assessing six key domains of sleep quality." },
  { id: 6,  slug: "big-five",        title: "Big Five Personality Test",             category: "personality", maxScore: 50, description: "A 50-item assessment of five core personality dimensions." },
  { id: 7,  slug: "leadership-style", title: "Leadership Style Assessment",          category: "leadership", maxScore: 30, description: "Identify your dominant leadership approach." },
  { id: 8,  slug: "beis10",          title: "Brief Emotional Intelligence Scale",    category: "emotional-intelligence", maxScore: 50, description: "A 10-item emotional intelligence scale." },
];

// ─────────────────────────────────────────────────────────────
// GET /api/assessments/getall  — Admin: return ALL assessments (no filter)
// IMPORTANT: This must be registered before the wildcard /:slug route.
// ─────────────────────────────────────────────────────────────
router.get("/getall", async (req, res) => {
  try {
    const all = await Assessment.find({}).lean();
    res.status(200).json(all);
  } catch (error) {
    console.error("Error fetching all assessments:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/assessments/seed  — Admin: seed missing assessments into DB
// ─────────────────────────────────────────────────────────────
router.post("/seed", async (req, res) => {
  try {
    let added = 0;
    let skipped = 0;

    for (const item of SEED_DATA) {
      const exists = await Assessment.findOne({ slug: item.slug }).lean();
      if (exists) {
        skipped++;
        continue;
      }
      await Assessment.create({
        ...item,
        questions: [],
        isPaid: false,
        isActive: true,
        createdBy: "admin-seed",
      });
      added++;
    }

    res.json({
      success: true,
      message: `Seed complete. Added: ${added}, Already existed: ${skipped}.${added > 0 ? " Reload the page to see them." : ""}`,
      added,
      skipped,
    });
  } catch (err) {
    console.error("Seed error:", err);
    res.status(500).json({ error: "Seed failed", details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/assessments/user/reports
// ─────────────────────────────────────────────────────────────
router.get("/user/reports", async (req, res) => {
  // Re-exported here so it can be found before /:slug
  // The main assessments.js also defines this but /:slug would swallow it
  const Report = (await import("../models/Report.js")).default;
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: "Phone number is required" });
    const reports = await Report.find({ userPhone: phone }).sort({ createdAt: -1 }).lean();
    res.json(reports);
  } catch (err) {
    console.error("Error fetching user reports:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/assessments/report/:id
// ─────────────────────────────────────────────────────────────
router.get("/report/:id", async (req, res) => {
  const Report = (await import("../models/Report.js")).default;
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ message: "Error fetching report", error });
  }
});

export default router;
