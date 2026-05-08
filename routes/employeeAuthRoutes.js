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
  sendSignupOtpEmail,
  sendLoginOtp,
  verifyLoginOtp,
} from "../controllers/employeeAuthController.js";
import { authEmployee } from "../middlewares/authEmployee.js";

const router = express.Router();

router.post("/send-otp",              sendOtp);
router.post("/send-otp-email",        sendSignupOtpEmail);       // signup email fallback
router.post("/signup",                registerEmployee);
router.post("/login",                 loginEmployee);            // password login (unchanged)
router.post("/login-otp/send",        sendLoginOtp);             // OTP login — phone or email
router.post("/login-otp/verify",      verifyLoginOtp);
router.post("/forgot-password-otp",   forgotPasswordSendOtp);
router.post("/reset-password",        resetPassword);
router.post("/validate-referral",     validateReferralCode);     // company referral code
router.post("/validate-ca-referral",  validateCaReferralCode);   // personal CA referral code

router.get("/me", authEmployee, getMe);

export default router;
