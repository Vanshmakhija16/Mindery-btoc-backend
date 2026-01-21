import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js"; // adjust path if needed

export const authEmployee = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const employee = await Employee.findById(decoded.id).select("-password -otp -otpExpires");
    if (!employee) return res.status(401).json({ success: false, message: "Employee not found" });

    req.employee = employee; // ✅ important
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid/Expired token" });
  }
};
