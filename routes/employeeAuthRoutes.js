import express from "express";
import {   sendOtp, registerEmployee, loginEmployee ,forgotPasswordSendOtp ,resetPassword  } from "../controllers/employeeAuthController.js";

const router = express.Router();

router.post("/send-otp", sendOtp);   // ✅ new route
router.post("/signup", registerEmployee);
router.post("/login", loginEmployee);
router.post("/forgot-password-otp", forgotPasswordSendOtp);
router.post("/reset-password", resetPassword);

export default router;
