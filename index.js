import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import jwt from "jsonwebtoken";

import employeeQuestionnaireRoutes from "./routes/employeeQuestionnaireRoutes.js";
import authRoutes from "./routes/auth.js";
import whatsappRoutes from "./routes/whatsappRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import doctorAuthRoutes from "./routes/doctorAuthRoutes.js";
import User from "./models/User.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import assessmentsRoute from "./routes/assessments.js";
// ✅ FIX: Admin assessment routes (getall, seed) must be registered BEFORE assessmentsRoute
// because assessmentsRoute has a wildcard /:slug that swallows /getall etc.
import adminAssessmentRoutes from "./routes/adminAssessmentRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import CompanyRoute from "./routes/CompanyRoute.js";
import employeeAuthRoutes from "./routes/employeeAuthRoutes.js";
import bookingRoute from "./routes/bookingRoute.js";
import ArticleRoutes from "./routes/ArticleRoute.js";
import offerRoutes from "./routes/offerchecking.js";
import paymentRoutes from "./routes/payment.js"
import btocAdminRoutes from "./routes/btocAdminRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import clinicalReportRoutes from "./routes/clinicalReport.routes.js";
import { oAuth2Client } from "./googlemeet.js";
import {generateGoogleMeetLink} from "./googlemeet.js"
import GoogleToken from "./models/GoogleToken.js";
import path from "path";
import { fileURLToPath } from "url";
import adminAuthRoutes from "./routes/adminauthRoutes.js";
import contactRoutes from "./routes/contact.js"
import therapyRequestRoutes from "./routes/therapyRequestRoutes.js";
import orgMemberRoutes from "./routes/orgMemberRoutes.js";
import orgAuthRoutes  from "./routes/orgAuthRoutes.js";
import orgBookingRoute from "./routes/orgBookingRoute.js";
import orgMemberProfileRoutes from "./routes/orgMemberProfile.routes.js";
import orgAssessmentRoutes from "./routes/orgAssessmentRoutes.js";
import monitorAuthRoutes from "./routes/monitorAuthRoutes.js";
import monitorRoutes from "./routes/monitorRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import coursePaymentRoutes from "./routes/coursePaymentRoutes.js";


// ✅ for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

const allowedOrigins = [
  "https://mytherapy.minderytech.com",
  "https://www.mytherapy.minderytech.com",
  "https://dashboard-frontend-wheat-kappa.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  // dynamically include CLIENT_URL and BASE_URL from .env if set
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  ...(process.env.BASE_URL   ? [process.env.BASE_URL]   : []),
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // allow same-origin / server-to-server / curl / postman (no Origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
};

app.use(cors(corsOptions));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// --------------------
// Auth Middleware
// --------------------
export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id || decoded._id;
    req.userRole = (decoded.role || "").toLowerCase();
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: "Invalid or expired token" });
  }
};

export const requireRole = (roles) => (req, res, next) => {
  const allowedRoles = Array.isArray(roles) ? roles.map(r => r.toLowerCase()) : [roles.toLowerCase()];
  if (!allowedRoles.includes(req.userRole)) {
    return res.status(403).json({ success: false, message: "Access denied: insufficient permissions" });
  }
  next();
};

// --------------------
// Routes
// --------------------
app.use("/api/auth", authRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/doctor-auth", doctorAuthRoutes);
app.use("/api/sessions", authMiddleware, sessionRoutes);
app.use("/api/doctors",doctorRoutes);
app.use("/api/appointments", authMiddleware, appointmentRoutes);
app.use("/api/admin", authMiddleware, adminRoutes);

// ✅ IMPORTANT: adminAssessmentRoutes MUST come before assessmentsRoute
// so /getall, /seed, /user/reports, /report/:id are matched before /:slug wildcard
app.use("/api/assessments", adminAssessmentRoutes);
app.use("/api/assessments", assessmentsRoute);

app.use("/api/reports", reportRoutes);
app.use("/api/companies", CompanyRoute);
app.use("/api/employee", employeeAuthRoutes);
app.use("/api/employee-questionnaire", employeeQuestionnaireRoutes);
app.use("/api/bookingRoute", bookingRoute);
app.use("/api/articles", ArticleRoutes);
app.use("/api/offer", offerRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/btocAdmin",btocAdminRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/clinical-reports", clinicalReportRoutes);
app.use("/api/admin-auth", adminAuthRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/therapy-requests", therapyRequestRoutes);
app.use("/api/org-members", orgMemberRoutes);
app.use("/api/org-auth", orgAuthRoutes);
app.use("/api/org-bookings", orgBookingRoute);
app.use("/api/org-member-profile", orgMemberProfileRoutes);
app.use("/api/org-assessments", orgAssessmentRoutes);
app.use("/api/monitor-auth", monitorAuthRoutes);
app.use("/api/monitor", monitorRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/course-payment", coursePaymentRoutes);

// -------------------- 
// Google OAuth / Meet
// --------------------
app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    let googleToken = await GoogleToken.findOne();
    if (!googleToken) {
      googleToken = new GoogleToken({ tokens });
    } else {
      googleToken.tokens = tokens;
    }
    await googleToken.save();

    res.send("Google authentication successful! You can now generate Google Meet links.");
  } catch (error) {
    console.error("Error during Google OAuth callback:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/generate-meet", async (req, res) => {
  try {
    const meetLink = await generateGoogleMeetLink();
    res.json({ meetLink });
  } catch (error) {
    console.error("Error generating Google Meet link:", error);
    res.status(500).json({ error: "Failed to generate Google Meet link" });
  }
});


// --------------------
// MongoDB + Server
// --------------------
const PORT = process.env.PORT || 3000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
