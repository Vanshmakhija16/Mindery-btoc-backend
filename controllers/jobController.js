import Job from "../models/Job.js";
import JobApplication from "../models/JobApplication.js";

export const getAllJobs = async (req, res) => {
  const jobs = await Job.find({ isActive: true }).sort({ createdAt: 1 });
  res.json(jobs);
};

export const getJobBySlug = async (req, res) => {
  const job = await Job.findOne({ slug: req.params.slug });
  res.json(job);
};

export const applyForJob = async (req, res) => {
  const application = await JobApplication.create(req.body);
  res.json({ success: true, application });
};
