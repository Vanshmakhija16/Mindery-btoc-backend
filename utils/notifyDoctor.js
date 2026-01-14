import { sendEmail } from "./emails.js";

export async function notifyDoctorByEmail({ doctor, booking, employeeName }) {
  try {
    if (!doctor?.email) {
      console.log("⚠️ Doctor email missing, cannot send mail");
      return;
    }

    const modeText = booking?.mode || "online";
    const link = booking?.meetLink || "Link will be shared shortly";

    await sendEmail({
      to: doctor.email,
      subject: `New Booking: ${booking.date} ${booking.slot}`,
      text: `Hi Dr. ${doctor.name},

A new session has been booked.

Client: ${employeeName}
Date: ${booking.date}
Time: ${booking.slot}
Mode: ${modeText}
Session Link: ${link}

Warm Regards,
Team Mindery`,
      html: `
        <p>Hi Dr. ${doctor.name},</p>

        <p>A new session has been booked.</p>

        <p>
          <b>Client:</b> ${employeeName}<br/>
          <b>Date:</b> ${booking.date}<br/>
          <b>Time:</b> ${booking.slot}<br/>
          <b>Mode:</b> ${modeText}<br/>
          <b>Session Link:</b> ${
            link === "Link will be shared shortly"
              ? link
              : `<a href="${link}">${link}</a>`
          }
        </p>

        <p>
          Warm Regards,<br/>
          <b>Team Mindery</b>
        </p>
      `,
    });

    console.log("✅ Doctor email triggered to:", doctor.email);
  } catch (err) {
    console.error("❌ notifyDoctorByEmail failed:", err);
    throw err;
  }
}
