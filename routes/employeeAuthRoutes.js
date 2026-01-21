import express from "express";
import {   sendOtp, registerEmployee, loginEmployee ,forgotPasswordSendOtp ,resetPassword,  getMe } from "../controllers/employeeAuthController.js";
import { authEmployee } from "../middlewares/authEmployee.js";
const router = express.Router();

router.post("/send-otp", sendOtp);   // ✅ new route
router.post("/signup", registerEmployee);
router.post("/login", loginEmployee);
router.post("/forgot-password-otp", forgotPasswordSendOtp);
router.post("/reset-password", resetPassword);

router.get("/me", authEmployee, getMe);


export default router;
