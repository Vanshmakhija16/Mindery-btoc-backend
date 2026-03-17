import express from "express";
import {
  sendSignupOtp,
  verifyOtpAndRegister,
  loginOrgMember,
  forgotPasswordSendOtp,
  resetPassword,
} from "../controllers/orgAuthController.js";

const router = express.Router();

router.post("/send-otp", sendSignupOtp);
router.post("/verify-otp", verifyOtpAndRegister);
router.post("/login", loginOrgMember);
router.post("/forgot-password", forgotPasswordSendOtp);
router.post("/reset-password", resetPassword);

export default router;