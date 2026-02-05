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
// import messagesRoutes from "./routes/messages.js"
import "./cron/bookingReminder.cron.js";


// ✅ for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));
// app.use(cors({
//   origin: process.env.CLIENT_URL ,
//   credentials: true
// }));
//  app.use(cors())

const allowedOrigins = [
  "https://mytherapy.minderytech.com",
  "https://www.mytherapy.minderytech.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

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

// // ✅ preflight for all routes (works in dev + prod; avoids path-to-regexp "*" crash)
// app.options("/*", cors(corsOptions));


// app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));
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

// Middleware factory to restrict access by role
// This middleware can check for multiple roles.
export const requireRole = (roles) => (req, res, next) => {
  // Ensure roles is always an array and convert them to lowercase for consistency
  const allowedRoles = Array.isArray(roles) ? roles.map(r => r.toLowerCase()) : [roles.toLowerCase()];

  // Check if the user's role is in the list of allowed roles
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
app.use("/api/doctors",doctorRoutes); // auth handled inside doctor.routes if needed
app.use("/api/appointments", authMiddleware, appointmentRoutes);
app.use("/api/admin", authMiddleware, adminRoutes);
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
app.use("/api/adminAuth", adminAuthRoutes);
app.use("/api/contact", contactRoutes);
// app.use("/api/messages",messagesRoutes);



app.get("/oauth2callback", async (req, res) => {
  try {

    const { code } = req.query;
console.log("REDIRECT USED:", process.env.GOOGLE_REDIRECT_URI);
     console.log(req.query , " query");
    if (!code) return res.status(400).send("Missing code");

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    await GoogleToken.findOneAndUpdate(
      { owner: "admin" },
      { tokens },
      { upsert: true, new: true }
    );
    console.log("CALLBACK HIT");
console.log("TOKENS FROM GOOGLE:", {
  hasAccess: !!tokens.access_token,
  hasRefresh: !!tokens.refresh_token,
  expiry: tokens.expiry_date,
});


    res.send("Google authorization successful. You can close this tab.");
  } catch (err) {
    console.error("OAuth error:", err.message);
    res.status(500).send("Authorization failed");
  }
});





app.get("/auth/google", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });

  res.redirect(authUrl);
});

app.get("/test-meet", async (req, res) => {
  try {
    const meetLink = await generateGoogleMeetLink({
      start: "2026-01-15T10:00:00",
      end: "2026-01-15T10:45:00",
    });

    res.json({ meetLink });
  } catch (err) {
    console.error("Meet error:", err.message);
    res.status(500).json({ error: "Meet generation failed" });
  }
});



// Get logged-in user info
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("name email role university");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/check",async(req,res)=> {
      res.status(200).json({ success: true, message: "Backend is running" });

})
// --------------------
// MongoDB Connection & Server Start
// --------------------
const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));


app.listen(PORT,"0.0.0.0", () => console.log(`Server running on port ${PORT}`));
