import express from "express";
import {
  createRequest,
  getTherapistRequests,
  replyToRequest,
  getUserRequests,
  markRequestBooked
} from "../controllers/therapyRequestController.js";

import { authEmployee } from "../middlewares/authEmployee.js";
import doctorAuthMiddleware from "../middlewares/doctorAuth.middleware.js";

const router = express.Router();

/* ================= USER ROUTES ================= */

// user creates request
router.post("/create", authEmployee, createRequest);

// user sees his requests
router.get("/user", authEmployee, getUserRequests);

router.post("/mark-booked", authEmployee, markRequestBooked);



/* ================= THERAPIST ROUTES ================= */

// therapist sees assigned requests
router.get("/therapist", doctorAuthMiddleware, getTherapistRequests);

// therapist replies
router.post("/reply/:id", doctorAuthMiddleware, replyToRequest);



export default router;
