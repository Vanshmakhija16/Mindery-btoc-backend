import express from "express";
import Booking from "../models/Booking.js";
import { authOrgMember } from "../middlewares/authOrgMember.js";

const router = express.Router();

// ✅ GET PROFILE + BOOKINGS TOGETHER
router.get("/me", authOrgMember, async (req, res) => {
  try {
    const member = req.orgMember;

    const bookings = await Booking.find({
      email: member.email
    })
      .populate("doctorId", "name specialization") // ✅ THIS LINE
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      profile: member,
      bookings,
    });

  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

export default router;