import express from "express";
import doctorAuthMiddleware from "../middlewares/doctorAuth.middleware.js";
import {
  createClinicalReport,
  getClinicalReportsByPatient,
  updateClinicalReport,
  deleteClinicalReport,
} from "../controllers/clinicalReport.controller.js";

const router = express.Router();

router.post("/", doctorAuthMiddleware, createClinicalReport);
router.get("/doctor/:doctorId/patient/:employeeId", doctorAuthMiddleware, getClinicalReportsByPatient);
router.put("/:reportId", doctorAuthMiddleware, updateClinicalReport);
router.delete("/:reportId", doctorAuthMiddleware, deleteClinicalReport);

export default router;
