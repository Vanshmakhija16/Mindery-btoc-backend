import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import MonitorUser from "../models/MonitorUser.js";

const router = express.Router();

// POST /api/monitor-auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const user = await MonitorUser.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: "monitor", email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: "monitor" },
    });
  } catch (err) {
    console.error("Monitor login error:", err);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
});

// POST /api/monitor-auth/create  (for admin to create monitor accounts)
router.post("/create", async (req, res) => {
  try {
    const { name, email, password, adminSecret } = req.body;

    if (adminSecret !== process.env.MONITOR_ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email and password required" });
    }

    const existing = await MonitorUser.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const user = await MonitorUser.create({ name, email, password });

    return res.status(201).json({
      success: true,
      message: "Monitor user created",
      user: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Create monitor user error:", err);
    return res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

export default router;
