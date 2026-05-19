// import { sendEmail } from "./emails.js";

// export async function notifyDoctorByEmail({ doctor, booking, employeeName }) {
//   try {
//     const clientName =
//       employeeName ||
//       booking?.name ||
//       "Client";

//     const doctorName = doctor?.name || "Doctor";

//     const recipients = [
//       doctor?.email,
//       process.env.ADMIN_EMAIL_1,
//       process.env.ADMIN_EMAIL_2,
//       process.env.ADMIN_EMAIL_3,
//     ].filter(Boolean);

//     if (!recipients.length) {
//       console.log("⚠️ No email recipients available");
//       return;
//     }

//     const modeText = booking?.mode || "online";
//     const link = booking?.meetLink || "Link will be shared shortly";

//     await sendEmail({
//       to: recipients,
//       subject: `New Booking: ${booking.date} ${booking.slot}`,
//       text: `Hi Dr. ${doctorName},

// A new session has been booked.

// Client: ${clientName}
// Date: ${booking.date}
// Time: ${booking.slot}
// Mode: ${modeText}
// Session Link: ${link}

// Warm Regards,
// Team Mindery`,
//       html: `
//         <p>Hi Dr. ${doctorName},</p>

//         <p>A new session has been booked.</p>

//         <p>
//           <b>Client:</b> ${clientName}<br/>
//           <b>Date:</b> ${booking.date}<br/>
//           <b>Time:</b> ${booking.slot}<br/>
//           <b>Mode:</b> ${modeText}<br/>
//           <b>Session Link:</b> ${
//             link === "Link will be shared shortly"
//               ? link
//               : `<a href="${link}">${link}</a>`
//           }
//         </p>

//         <p>
//           Warm Regards,<br/>
//           <b>Team Mindery</b>
//         </p>
//       `,
//     });

//     console.log("✅ Booking email sent to:", recipients.join(", "));
//   } catch (err) {
//     console.error("❌ notifyDoctorByEmail failed:", err);
//     throw err;
//   }
// }
import { sendEmail } from "./emails.js";

export async function notifyDoctorByEmail({
  doctor,
  booking,
  employeeName,
  isCaBooking = false,
  caDate,
  caSlot,
  caTimezoneLabel = "ET",
}) {
  try {
    const clientName =
      employeeName ||
      booking?.name ||
      "Client";

    const doctorName = doctor?.name || "Doctor";

    const recipients = isCaBooking
      ? [
          "www.vansh1624@gmail.com",
          process.env.ADMIN_EMAIL_1,
          process.env.ADMIN_EMAIL_2,
          process.env.ADMIN_EMAIL_3,
        ].filter(Boolean)
      : [
          doctor?.email,
          process.env.ADMIN_EMAIL_1,
          process.env.ADMIN_EMAIL_2,
          process.env.ADMIN_EMAIL_3,
        ].filter(Boolean);

    if (!recipients.length) {
      console.log("⚠️ No email recipients available");
      return;
    }

    const modeText = booking?.mode || "online";
    const link = booking?.meetLink || "Link will be shared shortly";
    const istSlotShort = (booking.slot || "").split(" - ")[0];
    const caSlotShort = (caSlot || "").split(" - ")[0];

    const to12h = (t) => {
      const m = String(t || "").match(/^(\d{1,2}):(\d{2})/);
      if (!m) return "";
      let h = parseInt(m[1], 10);
      const min = m[2];
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h}:${min} ${period}`;
    };

    const istSlot12h = to12h(istSlotShort);
    const caSlot12h = to12h(caSlotShort);
    const istDisplay = istSlot12h ? `${istSlotShort} (${istSlot12h})` : istSlotShort;
    const caDisplay  = caSlot12h  ? `${caSlotShort} (${caSlot12h})`   : caSlotShort;

    const subject = isCaBooking
      ? `New CA Booking: ${booking.date} ${istSlot12h || istSlotShort} IST (${caDate || ""} ${caSlot12h || caSlotShort} ${caTimezoneLabel})`
      : `New Booking: ${booking.date} ${istSlot12h || istSlotShort}`;

    const greeting = isCaBooking
      ? `Hi Team,`
      : `Hi Dr. ${doctorName},`;

    const timeBlockText = isCaBooking
      ? `IST Time: ${booking.date} ${istDisplay}
${caTimezoneLabel} Time: ${caDate || "-"} ${caDisplay || "-"}`
      : `Date: ${booking.date}
Time: ${istDisplay}`;

    const timeBlockHtml = isCaBooking
      ? `<b>IST Time:</b> ${booking.date} ${istDisplay}<br/>
         <b>${caTimezoneLabel} Time:</b> ${caDate || "-"} ${caDisplay || "-"}<br/>`
      : `<b>Date:</b> ${booking.date}<br/>
         <b>Time:</b> ${istDisplay}<br/>`;

    const therapistLine = isCaBooking
      ? `<b>Therapist:</b> ${doctorName}<br/>`
      : "";

    const therapistLineText = isCaBooking
      ? `Therapist: ${doctorName}\n`
      : "";

    await sendEmail({
      to: recipients,
      subject,
      text: `${greeting}

A new session has been booked.

${therapistLineText}Client: ${clientName}
${timeBlockText}
Mode: ${modeText}
Session Link: ${link}

Warm Regards,
Team Mindery`,
      html: `
        <p>${greeting}</p>

        <p>A new session has been booked.</p>

        <p>
          ${therapistLine}
          <b>Client:</b> ${clientName}<br/>
          ${timeBlockHtml}
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

    console.log(
      `✅ Booking email sent (${isCaBooking ? "CA" : "default"}) to:`,
      recipients.join(", ")
    );
  } catch (err) {
    console.error("❌ notifyDoctorByEmail failed:", err);
    throw err;
  }
}
