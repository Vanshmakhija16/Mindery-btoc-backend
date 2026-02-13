import Booking from "../models/Booking.js";
import Employee from "../models/Employee.js";
import {sendEmail} from "../utils/emails.js";

/**
 * Runs from CRON
 * Sends reminder email ONCE per booking
 */
export async function sendEmailReminders() {
  try {
    const now = new Date();

    const bookings = await Booking.find({
      reminderAt: { $lte: now },
      reminderSent: false,
      "payment.status": "paid",
    });

    if (!bookings.length) return;

    for (const booking of bookings) {
      const employee = await Employee.findById(booking.employeeId);

      const toEmail =
        booking.email ||
        employee?.email ||
        null;

      if (!toEmail) continue;

      await sendEmail({
        to: toEmail,
        subject: "Session Reminder",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6">
            <p>Hello ${booking.name},</p>

            <p>This is a reminder for your upcoming session.</p>

            <p>
              <b>Doctor:</b> ${booking.doctorName}<br/>
              <b>Date:</b> ${booking.date}<br/>
              <b>Time:</b> ${booking.slot}<br/>
              <b>Mode:</b> ${booking.mode}
            </p>

            ${
              booking.meetLink
                ? `<p><b>Meeting Link:</b> <a href="${booking.meetLink}">${booking.meetLink}</a></p>`
                : ""
            }

            <p>Please join 5 minutes early.</p>

            <p>Regards,<br/>Team</p>
          </div>
        `,
      });

      booking.reminderSent = true;
      await booking.save();

      console.log("📧 Email reminder sent:", booking._id);
    }
  } catch (err) {
    console.error("❌ Email reminder service error:", err);
  }
}
