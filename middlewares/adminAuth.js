import jwt from "jsonwebtoken";
import btocDoctor from "../models/btocDoctor.js";

export default async function adminAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await btocDoctor.findById(decoded.id).select("-password");
    if (!admin) return res.status(401).json({ success: false, message: "User not found" });

    if (admin.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admins only" });
    }

    req.admin = admin;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: "Invalid/expired token" });
  }
}
