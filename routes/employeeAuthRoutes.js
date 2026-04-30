import express from "express";
import {
  sendOtp,
  registerEmployee,
  loginEmployee,
  forgotPasswordSendOtp,
  resetPassword,
  getMe,
  validateReferralCode,
  validateCaReferralCode,
} from "../controllers/employeeAuthController.js";
import { authEmployee } from "../middlewares/authEmployee.js";

const router = express.Router();

router.post("/send-otp",              sendOtp);
router.post("/signup",                registerEmployee);
router.post("/login",                 loginEmployee);
router.post("/forgot-password-otp",   forgotPasswordSendOtp);
router.post("/reset-password",        resetPassword);
router.post("/validate-referral",     validateReferralCode);     // company referral code
router.post("/validate-ca-referral",  validateCaReferralCode);   // personal CA referral code

router.get("/me", authEmployee, getMe);

export default router;
