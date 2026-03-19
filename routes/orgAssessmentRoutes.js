import express from "express";
import OrgAssessmentResult from "../models/OrgAssessmentResult.js";
import { authOrgMember } from "../middlewares/authOrgMember.js";

const router = express.Router();

// POST /api/org-assessments/submit
router.post("/submit", authOrgMember, async (req, res) => {
  try {
    const {
      assessmentSlug,
      assessmentTitle,
      answers,
      totalScore,
      severity,
    } = req.body;

    const result = new OrgAssessmentResult({
      employeeId: req.orgMember._id,
      companyId:  req.orgMember.companyId || req.companyId,
      assessmentSlug,
      assessmentTitle,
      answers,
      totalScore,
      severity,
    });

    await result.save();
    res.status(201).json({ success: true, result });
  } catch (err) {
    console.error("Submit org assessment error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/org-assessments/my-results
router.get("/my-results", authOrgMember, async (req, res) => {
  try {
    const results = await OrgAssessmentResult.find({
      employeeId: req.orgMember._id,
    }).sort({ completedAt: -1 });

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/org-assessments/company/:companyId
router.get("/company/:companyId", async (req, res) => {
  try {
    const results = await OrgAssessmentResult.find({
      companyId: req.params.companyId,
    })
      .populate("employeeId", "name email")
      .populate("companyId", "name")
      .sort({ completedAt: -1 });

    const formatted = results.map((r) => ({
      _id:            r._id,
      employeeName:   r.employeeId?.name  || "Unknown",
      employeeEmail:  r.employeeId?.email || "",
      companyName:    r.companyId?.name   || "",
      assessmentSlug:  r.assessmentSlug,
      assessmentTitle: r.assessmentTitle,
      totalScore:      r.totalScore,
      severity:        r.severity,
      completedAt:     r.completedAt,
    }));

    res.json({ success: true, results: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/org-assessments/company/:companyId/summary
router.get("/company/:companyId/summary", async (req, res) => {
  try {
    const mongoose = await import("mongoose");
    const summary = await OrgAssessmentResult.aggregate([
      {
        $match: {
          companyId: new mongoose.default.Types.ObjectId(req.params.companyId),
        },
      },
      {
        $group: {
          _id:        "$assessmentSlug",
          avgScore:   { $avg: "$totalScore" },
          count:      { $sum: 1 },
          severities: { $push: "$severity" },
        },
      },
    ]);

    const result = summary.map((item) => {
      const severityBreakdown = item.severities.reduce((acc, s) => {
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});
      return {
        assessmentSlug:    item._id,
        avgScore:          Math.round(item.avgScore * 10) / 10,
        totalSubmissions:  item.count,
        severityBreakdown,
      };
    });

    res.json({ success: true, summary: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;