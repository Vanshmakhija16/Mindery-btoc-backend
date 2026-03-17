import express from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import Booking from "../models/Booking.js";
import Company from "../models/Company.js";
import OrgMember from "../models/OrgMember.js";
import Doctor from "../models/btocDoctor.js";
import { sendOrgBookingConfirmation } from "../services/whatsapp.service.js";

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { doctorId, date, slot, mode, name, email, phone } = req.body;
    const companyId = req.user.companyId;
    const memberId = req.user.id;

    if (!doctorId || !date || !slot) {
      return res.status(400).json({ message: "doctorId, date and slot are required." });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Organization not found." });
    }

    if (company.contractExpiry && new Date() > new Date(company.contractExpiry)) {
      return res.status(403).json({
        message: "Your organization's contract has expired. Please contact your HR.",
      });
    }

    if (company.sessionsUsed >= company.sessionQuota) {
      return res.status(403).json({
        message: "Your organization has used all allocated sessions for this period.",
      });
    }

    // ── Fetch doctor (meetLink lives here) ──────────────────────────
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found." });
    }

    const meetLink = doctor.meetLink || null;

    const member = await OrgMember.findById(memberId);
    const memberName = name || member?.name || "Employee";
    const memberEmail = email || member?.email || "";
    const memberPhone = phone || member?.phone || "";

    // ── Create booking with meetLink saved ──────────────────────────
    const booking = await Booking.create({
      doctorId,
      employeeId: memberId,
      name: memberName,
      email: memberEmail,
      phone: memberPhone,
      date,
      slot,
      mode: mode || "online",
      amount: 0,
      bookingType: "org_free",
      companyId,
      meetLink: meetLink,
      payment: { status: "org_free" },
    });

    await Company.findByIdAndUpdate(companyId, { $inc: { sessionsUsed: 1 } });

    // ── Email to employee ────────────────────────────────────────────
    if (memberEmail) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: memberEmail,
          subject: "Mindery — Session Booking Confirmed ✅",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
              <h2 style="color:#DE6875">Mindery</h2>
              <p>Hi <strong>${memberName}</strong>,</p>
              <p>Your wellness session has been successfully booked.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:8px;color:#6b7280">Therapist</td><td style="padding:8px;font-weight:600">Dr. ${doctor.name}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Date</td><td style="padding:8px;font-weight:600">${date}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Time</td><td style="padding:8px;font-weight:600">${slot}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Mode</td><td style="padding:8px;font-weight:600">${mode || "Online"}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Meet Link</td><td style="padding:8px;font-weight:600"><a href="${meetLink || '#'}" style="color:#DE6875">${meetLink || "Will be shared before your session"}</a></td></tr>
                <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:600;color:#059669">Covered by your organization</td></tr>
              </table>
              <p style="color:#6b7280;font-size:13px">If you have any questions, please contact your HR or reply to this email.</p>
              <p>— Mindery Team</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Employee email failed:", emailErr.message);
      }
    }

    // ── Email to doctor ──────────────────────────────────────────────
    if (doctor.email) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: doctor.email,
          subject: "Mindery — New Session Booking",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
              <h2 style="color:#DE6875">Mindery</h2>
              <p>Hi <strong>Dr. ${doctor.name}</strong>,</p>
              <p>New booking from <strong>${company.name}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0">
                <tr><td style="padding:8px;color:#6b7280">Patient</td><td style="padding:8px;font-weight:600">${memberName}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Email</td><td style="padding:8px;font-weight:600">${memberEmail}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Phone</td><td style="padding:8px;font-weight:600">${memberPhone}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Date</td><td style="padding:8px;font-weight:600">${date}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Time</td><td style="padding:8px;font-weight:600">${slot}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Mode</td><td style="padding:8px;font-weight:600">${mode || "Online"}</td></tr>
              </table>
              <p>— Mindery Team</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Doctor email failed:", emailErr.message);
      }
    }

    // ── WhatsApp to employee ─────────────────────────────────────────
    if (memberPhone) {
      try {
        await sendOrgBookingConfirmation(memberPhone, {
          employeeName: memberName,
          doctorName: doctor.name,
          date,
          time: slot,
          meetLink: meetLink || "Link will be shared shortly",
        });
      } catch (waErr) {
        console.error("WhatsApp notification failed:", waErr.message);
      }
    }

    // ── Return booking with meetLink ─────────────────────────────────
    return res.status(201).json({
      success: true,
      message: "Session booked successfully.",
      booking: {
        ...booking.toObject(),
        meetLink: meetLink,
        doctorName: doctor.name,
      },
    });

  } catch (err) {
    console.error("orgBooking error:", err);
    return res.status(500).json({ message: "Booking failed. Please try again." });
  }
});

export default router;

// import express from "express";
// import jwt from "jsonwebtoken";
// import nodemailer from "nodemailer";
// import Booking from "../models/Booking.js";
// import Company from "../models/Company.js";
// import OrgMember from "../models/OrgMember.js";
// import Doctor from "../models/btocDoctor.js";
// import { sendOrgBookingConfirmation } from "../services/whatsapp.service.js";

// const router = express.Router();

// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: Number(process.env.SMTP_PORT),
//   secure: process.env.SMTP_SECURE === "true",
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

// function authMiddleware(req, res, next) {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({ message: "No token provided." });
//     }
//     const token = authHeader.split(" ")[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     return res.status(401).json({ message: "Invalid or expired token." });
//   }
// }

// router.post("/", authMiddleware, async (req, res) => {
//   try {
//     const { doctorId, date, slot, mode, name, email, phone } = req.body;
//     const companyId = req.user.companyId;
//     const memberId = req.user.id;

//     if (!doctorId || !date || !slot || !mode) {
//       return res.status(400).json({ message: "doctorId, date, slot and mode are required." });
//     }

//     const company = await Company.findById(companyId);
//     if (!company) {
//       return res.status(404).json({ message: "Organization not found." });
//     }

//     if (company.contractExpiry && new Date() > new Date(company.contractExpiry)) {
//       return res.status(403).json({
//         message: "Your organization's contract has expired. Please contact your HR.",
//       });
//     }

//     if (company.sessionsUsed >= company.sessionQuota) {
//       return res.status(403).json({
//         message: "Your organization has used all allocated sessions for this period.",
//       });
//     }

//     const doctor = await Doctor.findById(doctorId);
//     if (!doctor) {
//       return res.status(404).json({ message: "Doctor not found." });
//     }

//     const member = await OrgMember.findById(memberId);
//     const memberName = name || member?.name || "Employee";
//     const memberEmail = email || member?.email || "";
//     const memberPhone = phone || member?.phone || "";

//     const booking = await Booking.create({
//       doctorId,
//       employeeId: memberId,
//       name: memberName,
//       email: memberEmail,
//       phone: memberPhone,
//       date,
//       slot,
//       mode,
//       amount: 0,
//       bookingType: "org_free",
//       companyId,
//       payment: "not_required",
//     });

//     await Company.findByIdAndUpdate(companyId, { $inc: { sessionsUsed: 1 } });

//     if (memberEmail) {
//       await transporter.sendMail({
//         from: process.env.SMTP_FROM,
//         to: memberEmail,
//         subject: "Mindery — Session Booking Confirmed",
//         html: `
//           <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
//             <h2 style="color:#6366f1">Mindery</h2>
//             <p>Hi <strong>${memberName}</strong>,</p>
//             <p>Your session has been successfully booked.</p>
//             <table style="width:100%;border-collapse:collapse;margin:16px 0">
//               <tr><td style="padding:8px;color:#6b7280">Doctor</td><td style="padding:8px;font-weight:600">Dr. ${doctor.name}</td></tr>
//               <tr><td style="padding:8px;color:#6b7280">Date</td><td style="padding:8px;font-weight:600">${date}</td></tr>
//               <tr><td style="padding:8px;color:#6b7280">Time</td><td style="padding:8px;font-weight:600">${slot}</td></tr>
//               <tr><td style="padding:8px;color:#6b7280">Mode</td><td style="padding:8px;font-weight:600">${mode}</td></tr>
//               <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:600">Covered by your organization</td></tr>
//             </table>
//           </div>
//         `,
//       });
//     }

//     if (doctor.email) {
//       await transporter.sendMail({
//         from: process.env.SMTP_FROM,
//         to: doctor.email,
//         subject: "Mindery — New Session Booking",
//         html: `
//           <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
//             <h2 style="color:#6366f1">Mindery</h2>
//             <p>Hi <strong>Dr. ${doctor.name}</strong>,</p>
//             <p>New booking from <strong>${company.name}</strong>.</p>
//             <table style="width:100%;border-collapse:collapse;margin:16px 0">
//               <tr><td style="padding:8px;color:#6b7280">Patient</td><td style="padding:8px;font-weight:600">${memberName}</td></tr>
//               <tr><td style="padding:8px;color:#6b7280">Date</td><td style="padding:8px;font-weight:600">${date}</td></tr>
//               <tr><td style="padding:8px;color:#6b7280">Time</td><td style="padding:8px;font-weight:600">${slot}</td></tr>
//               <tr><td style="padding:8px;color:#6b7280">Mode</td><td style="padding:8px;font-weight:600">${mode}</td></tr>
//             </table>
//           </div>
//         `,
//       });
//     }

//     if (memberPhone) {
//       try {


//         await sendOrgBookingConfirmation(memberPhone, {
//   employeeName: memberName,
//   doctorName: doctor.name,
//   date,
//   time: slot,
//   companyName: company.name,
//   mode : "online" , 
//   meetLink: doctor.meetLink || "Link will be shared shortly",

// });
//       } catch (waErr) {
//         console.error("WhatsApp notification failed:", waErr.message);
//       }
//     }

//     return res.status(201).json({ message: "Session booked successfully.", booking });
//   } catch (err) {
//     console.error("orgBooking error:", err);
//     return res.status(500).json({ message: "Booking failed. Please try again." });
//   }
// });

// export default router;