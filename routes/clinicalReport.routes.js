import express from "express";
import doctorAuthMiddleware from "../middlewares/doctorAuth.middleware.js";
import {
  createClinicalReport,
  getClinicalReportsByPatient,
} from "../controllers/clinicalReport.controller.js";

const router = express.Router();

router.post("/", doctorAuthMiddleware, createClinicalReport);

router.get(
  "/doctor/:doctorId/patient/:employeeId",
  doctorAuthMiddleware,
  getClinicalReportsByPatient
);

export default router;
