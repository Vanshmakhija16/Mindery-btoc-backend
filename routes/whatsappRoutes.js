import express from "express";
import { sendWhatsAppOtp } from "../services/whatsapp.service.js";
import { generateOTP, storeOTP, verifyOTP, deleteOTP } from "../utils/otp.js";

const router = express.Router();

/**
 * @route   POST /api/auth/send-otp
 * @desc    Send OTP to WhatsApp during signup
 * @body    { phone: "9876543210" }
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Generate OTP
    const otp = generateOTP();
    console.log(`Generated OTP for ${phone}: ${otp}`);

    // Store OTP in memory
    storeOTP(phone, otp);

    // Send via WhatsApp
    const whatsappResult = await sendWhatsAppOtp(phone, otp);

    if (!whatsappResult.success) {
      // Still succeed in dev mode, but warn about WhatsApp
      console.warn("WhatsApp not available, using fallback mode");
      return res.status(200).json({
        success: true,
        message: "OTP generated (WhatsApp not configured)",
        phone: phone.slice(-4), // Return last 4 digits for privacy
        mode: "development",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to WhatsApp",
      phone: phone.slice(-4), // Return last 4 digits for privacy
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP sent to WhatsApp
 * @body    { phone: "9876543210", otp: "123456" }
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required" });
    }

    const result = verifyOTP(phone, otp);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      phone,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP to WhatsApp
 * @body    { phone: "9876543210" }
 */
router.post("/resend-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Delete old OTP
    deleteOTP(phone);

    // Generate new OTP
    const otp = generateOTP();
    storeOTP(phone, otp);

    // Send via WhatsApp
    const whatsappResult = await sendWhatsAppOtp(phone, otp);

    if (!whatsappResult.success) {
      return res.status(200).json({
        success: true,
        message: "OTP regenerated (WhatsApp not configured)",
        phone: phone.slice(-4),
        mode: "development",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP resent successfully to WhatsApp",
      phone: phone.slice(-4),
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
      error: error.message,
    });
  }
});

export default router;
