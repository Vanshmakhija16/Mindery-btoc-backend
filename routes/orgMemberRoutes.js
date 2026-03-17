import express from "express";
import {
  sendOtp,
  registerOrgMember,
  loginOrgMember,
  forgotPasswordSendOtp,
  resetPassword,
  getMe,
} from "../controllers/orgMemberAuthController.js";
import { authOrgMember } from "../middlewares/authOrgMember.js";

const router = express.Router();

router.post("/send-otp",          sendOtp);
router.post("/signup",            registerOrgMember);
router.post("/login",             loginOrgMember);
router.post("/forgot-password",   forgotPasswordSendOtp);
router.post("/reset-password",    resetPassword);
router.get("/me",   authOrgMember, getMe);



export default router;