import express from "express";
import ContactMessage from "../models/ContactMessage.js";

const router = express.Router();

// POST /api/contact
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ success: false, message: "Required fields missing" });
    }

    await ContactMessage.create({
      name,
      email,
      phone,
      message,
    });

    res.json({ success: true, message: "Message saved successfully" });
  } catch (error) {
    console.error("Contact save error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
