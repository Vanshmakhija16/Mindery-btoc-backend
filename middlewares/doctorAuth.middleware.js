import jwt from "jsonwebtoken";
import btocDoctor from "../models/btocDoctor.js";

const doctorAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const doctor = await btocDoctor.findById(
      decoded.id || decoded._id
    );

    if (!doctor) {
      return res.status(401).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Attach doctor info to request
    req.doctorId = doctor._id;
    req.doctor = doctor;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export default doctorAuthMiddleware;
