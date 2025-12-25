import express from "express";
import {
  getAllJobs,
  getJobBySlug,
  applyForJob
} from "../controllers/jobController.js";

const router = express.Router();

router.get("/", getAllJobs);
router.get("/:slug", getJobBySlug);
router.post("/apply", applyForJob);

export default router;
