import jwt from "jsonwebtoken";
import OrgMember from "../models/OrgMember.js";

export const authOrgMember = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Must be an org_member token
    if (decoded.role !== "org_member") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const member = await OrgMember.findById(decoded.id).select("-password -otp -otpExpires");
    if (!member) {
      return res.status(401).json({ success: false, message: "OrgMember not found" });
    }

    req.orgMember = member;
    req.companyId = decoded.companyId || null; // from JWT
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};