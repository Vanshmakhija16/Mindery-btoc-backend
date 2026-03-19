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
import OrgMember from "../models/OrgMember.js";

const router = express.Router();

router.post("/send-otp",          sendOtp);
router.post("/signup",            registerOrgMember);
router.post("/login",             loginOrgMember);
router.post("/forgot-password",   forgotPasswordSendOtp);
router.post("/reset-password",    resetPassword);
router.get("/me",   authOrgMember, getMe);

// ✅ GET all members of a company — used by admin in ComapnyPage
router.get("/company/:companyId/members", async (req, res) => {
  try {
    const members = await OrgMember.find(
      { companyId: req.params.companyId },
      "name email phone createdAt"
    ).sort({ createdAt: -1 }).lean();

    res.json({ success: true, members });
  } catch (err) {
    console.error("Get company members error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;