import express from "express";
import EmployeeAppointment from "../models/EmployeeAppointment.js";

const router = express.Router();

// Check if employee already booked at least one session
router.get("/status/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const existingBooking = await EmployeeAppointment.findOne({
      employee: employeeId,
    });

    // If user has NEVER booked => eligible
    const eligible = existingBooking ? false : true;

    res.json({ eligible });
  } catch (err) {
    console.error("Offer check error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
