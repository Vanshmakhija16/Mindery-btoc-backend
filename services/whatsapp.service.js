import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();

const GETGABS_URL = "https://app.getgabs.com/whatsappbusiness/send-templated-message";

console.log("GETGABS_API_KEY:", process.env.GETGABS_API_KEY ? "LOADED" : "MISSING");
console.log("GETGABS_SENDER:", process.env.GETGABS_SENDER);
console.log("GETGABS_CAMPAIGN_ID:", process.env.GETGABS_CAMPAIGN_ID);

// Normalize phone number to international format
const normalizePhone = (phone) => {
  let p = phone.replace(/\D/g, "");
  if (p.length === 10) p = "91" + p; 
  if (!p.startsWith("+")) p = "+" + p; 
  return p;
};

/**
 * SEND OTP
 */
export const sendWhatsAppOtp = async (fullPhone, otp) => {
  try {
    const payload = {
      api_key: process.env.GETGABS_API_KEY,
      sender: process.env.GETGABS_SENDER,
      campaign_id: process.env.GETGABS_CAMPAIGN_ID,
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: fullPhone,
      type: "template",
      template: {
        name: "otp_auth",
        language: { code: "en_US" },
        components: [
          {
            type: "BODY",
            parameters: [{ type: "text", text: otp }],
          },
          {
            type: "button",
            sub_type: "URL",
            index: 0,
            parameters: [{ type: "text", text: otp }],
          },
        ],
      },
    };

    const response = await axios.post(GETGABS_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error) {
    console.error("GetGabs OTP error:", error.response?.data || error.message);
    throw new Error("WhatsApp OTP failed");
  }
};

/**
 * SEND BOOKING CONFIRMATION (Template: session_details)
 * Triggered ONLY at payment success.
 */
// export const sendBookingConfirmation = async (fullPhone, bookingDetails) => {
//   try {
//     // 🛡️ GUARD: Ensure this template is NEVER sent if called during reminder time
//     if (bookingDetails.isReminderCall) {
//       console.warn("⚠️ Blocked attempt to send session_details during reminder time.");
//       return null;
//     }

//     const to = String(fullPhone).replace(/\D/g, "");
//     const { employeeName, doctorName, date, time, mode, meetLink } = bookingDetails;
     
//     const payload = {
//       api_key: process.env.GETGABS_API_KEY,
//       sender: process.env.GETGABS_SENDER,
//       campaign_id: process.env.GETGABS_CAMPAIGN_ID,
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to,
//       type: "template",
//       template: {
//         name: "session_details",
//         language: { code: "en" },
//         components: [
//           {
//             type: "body",
//             parameters: [
//               {type: "text", text: employeeName} ,// {{1}}
//               { type: "text", text: doctorName },   // {{2}}
//               { type: "text", text: date },           // {{3}}
//               { type: "text", text: time },           // {{4}}
//               { type: "text", text: mode || "Online" },  // {{5}}}
//               { type: "text", text: meetLink || "Link will be shared shortly" }, // {{6}}
//             ],
//           },
//         ],
//       },
//     };

//     console.log("📤 Sending Confirmation (session_details) to:", to);
//     const response = await axios.post(GETGABS_URL, payload, {
//       headers: { "Content-Type": "application/json" },
//     });
//     return response.data;
//   } catch (error) {
//     console.log("❌ GetGabs Confirmation error:", error.response?.data || error.message);
//     return null;
//   }
// };
export const sendBookingConfirmation = async (fullPhone, bookingDetails) => {
  try {
    // 🔍 DEBUG TRACE (keep while stabilizing)
    console.error(
      "🚨 sendBookingConfirmation CALLED",
      "\n⏰ Time:", new Date().toISOString(),
      "\n📦 Payload:", bookingDetails,
      "\n📍 Stack:\n", new Error().stack
    );

    /* ------------------------------------------------
       🛑 HARD BLOCKS (MOST IMPORTANT)
    ------------------------------------------------ */

    // ❌ Never allow confirmation from reminder / cron
    if (bookingDetails?.isReminderCall === true) {
      console.error("🚫 Blocked WhatsApp confirmation from reminder/cron");
      return null;
    }

    // ❌ Never allow duplicate confirmation
    if (bookingDetails?.__alreadyConfirmed === true) {
      console.warn("🛑 Duplicate WhatsApp confirmation blocked");
      return null;
    }

    /* ------------------------------------------------
       📞 PHONE NORMALIZATION (+91 REQUIRED)
    ------------------------------------------------ */
    const normalizePhone = (phone) => {
      let p = String(phone).replace(/\D/g, "");
      if (p.length === 10) p = "91" + p;
      if (!p.startsWith("+")) p = "+" + p;
      return p;
    };

    const to = normalizePhone(fullPhone);

    /* ------------------------------------------------
       📦 PAYLOAD VALIDATION
    ------------------------------------------------ */
    const {
      employeeName,
      doctorName,
      date,
      time,
      meetLink,
    } = bookingDetails;

    if (!employeeName || !doctorName || !date || !time) {
      console.error("🚫 Invalid WhatsApp confirmation payload", bookingDetails);
      return null;
    }

    /* ------------------------------------------------
       📤 WHATSAPP TEMPLATE PAYLOAD
    ------------------------------------------------ */
    const payload = {
      api_key: process.env.GETGABS_API_KEY,
      sender: process.env.GETGABS_SENDER,
      campaign_id: process.env.GETGABS_CAMPAIGN_ID,
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: "session_details",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: employeeName }, // {{1}}
              { type: "text", text: doctorName },   // {{2}}
              { type: "text", text: date },         // {{3}}
              { type: "text", text: time },         // {{4}}
              {
                type: "text",
                text: meetLink || "Link will be shared shortly",
              }, // {{5}}
            ],
          },
        ],
      },
    };

    /* ------------------------------------------------
       🚀 SEND TO GETGABS
    ------------------------------------------------ */
    return await axios.post(GETGABS_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ GetGabs Confirmation error:", err);
    return null;
  }
};

/**
 * SEND BOOKING REMINDER (Template: booking_reminder_v2)
 * Triggered ONLY by the Cron job.
 */
// export const sendBookingReminder = async (fullPhone, bookingDetails) => {
//   try {
//     const to = String(fullPhone).replace(/\D/g, "");
//     const { employeeName, doctorName, date, time, mode, meetLink } = bookingDetails;

//     const payload = {
//       api_key: process.env.GETGABS_API_KEY,
//       sender: process.env.GETGABS_SENDER,
//       // Uses the dedicated Reminder Campaign ID
//       campaign_id: process.env.GETGABS_REMINDER_CAMPAIGN_ID,
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to,
//       type: "template",
//       template: {
//         name: "booking_reminder_v2",
//         language: { code: "en" },
//         components: [
//           {
//             type: "body",
//             parameters: [
//               { type: "text", text: employeeName }, // {{1}}
//               { type: "text", text: doctorName },   // {{2}}
//               { type: "text", text: date },         // {{3}}
//               { type: "text", text: time },         // {{4}}
//               { type: "text", text: mode },         // {{5}}
//               { type: "text", text: meetLink },     // {{6}}
//             ],
//           },
//         ],
//       },
//     };

//     console.log("📤 Sending Reminder (booking_reminder_v2) to:", to);
//     const response = await axios.post(GETGABS_URL, payload, {
//       headers: { "Content-Type": "application/json" },
//     });
//     return response.data;
//   } catch (error) {
//     console.error("❌ Booking reminder WhatsApp failed:", error.response?.data || error.message);
//     throw error;
//   }
// };

/**
 * SEND CANCELLATION (Direct Message)
 */
export const sendBookingCancellation = async (phone, bookingDetails) => {
  try {
    const { doctorName, date, bookingId, refundAmount } = bookingDetails;
    const to = String(phone).replace(/\D/g, "");

    const messageBody = `❌ *Booking Cancelled*\n\nYour booking has been cancelled.\n\n📋 *Booking ID:* ${bookingId}\n👨‍⚕️ *Doctor:* Dr. ${doctorName}\n📅 *Session Date:* ${date}\n\n💰 *Refund Amount:* ₹${refundAmount}\nThe refund will be processed within 3-5 business days.`;

    // Note: This assumes a generic sendWhatsAppMessage helper exists or can use a raw axios call
    const payload = {
        api_key: process.env.GETGABS_API_KEY,
        sender: process.env.GETGABS_SENDER,
        to,
        type: "text",
        text: { body: messageBody }
    };

    return await axios.post(GETGABS_URL, payload, {
        headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Cancellation WhatsApp failed:", err.message);
  }
};


// import axios from "axios";
// import dotenv from 'dotenv';
// dotenv.config();
// const GETGABS_URL =
//   "https://app.getgabs.com/whatsappbusiness/send-templated-message";

// const WHATSAPP_API_VERSION = "v22.0";

// console.log("GETGABS_API_KEY:", process.env.GETGABS_API_KEY ? "LOADED" : "MISSING");
// console.log("GETGABS_SENDER:", process.env.GETGABS_SENDER);
// console.log("GETGABS_CAMPAIGN_ID:", process.env.GETGABS_CAMPAIGN_ID);


// // Normalize phone number to international format
// const normalizePhone = (phone) => {
//   let p = phone.replace(/\D/g, "");
//   if (p.length === 10) p = "91" + p; // India +91
//   if (!p.startsWith("+")) p = "+" + p; // Add + if not present
//   return p;
// };

// // Validate WhatsApp credentials
// const validateWhatsAppConfig = () => {
//   const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
//   const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

//   if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
//     console.warn("⚠️ WhatsApp env variables missing. Messages will not be sent.");
//     return false;
//   }
//   return true;
// };


// export const sendWhatsAppOtp = async (fullPhone, otp) => {
//   try {
//     const payload = {
//       api_key: process.env.GETGABS_API_KEY,
//       sender: process.env.GETGABS_SENDER,
//       campaign_id: process.env.GETGABS_CAMPAIGN_ID,
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to: fullPhone, // example: 919876543210
//       type: "template",
//       template: {
//         name: "otp_auth",
//         language: {
//           code: "en_US",
//         },
//         components: [
//           {
//             type: "BODY",
//             parameters: [
//               {
//                 type: "text",
//                 text: otp,
//               },
//             ],
//           },
//           {
//             type: "button",
//             sub_type: "URL",
//             index: 0,
//             parameters: [
//               {
//                 type: "text",
//                 text: otp,
//               },
//             ],
//           },
//         ],
//       },
//     };

//     const response = await axios.post(GETGABS_URL, payload, {
//       headers: {
//         "Content-Type": "application/json",
//       },
//     });

//     return response.data;

//   } catch (error) {
//     console.error(
//       "GetGabs OTP error:",
//       error.response?.data || error.message
//     );
//     throw new Error("WhatsApp OTP failed");
//   }
// };



// export const sendBookingConfirmation = async (fullPhone, bookingDetails) => {
//   try {
   


//     const to = String(fullPhone).replace(/\D/g, ""); // ✅ remove +, spaces, etc.

//     const { employeeName, doctorName, date, time, mode, meetLink } = bookingDetails;
     
//     const payload = {
//       api_key: process.env.GETGABS_API_KEY,
//       sender: process.env.GETGABS_SENDER,
//       campaign_id: process.env.GETGABS_CAMPAIGN_ID,
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to, // ✅ use cleaned number
//       type: "template",
//       template: {
//         name: "session_details",
//         language: { code: "en" },
//         components: [
//           {
//             type: "body",
//             parameters: [
//               { type: "text", text: doctorName },    // {{1}} Therapist Name
//               { type: "text", text: date },           // {{2}} Date
//               { type: "text", text: time },           // {{3}} Time
//               { type: "text", text: mode || "Online" },  // {{4}} Mode
//               { type: "text", text: meetLink || "Link will be shared shortly" },  // {{5}} Session Link
//             ],
//           },
//         ],
//       },
//     };

//     console.log("📤 WhatsApp sending to:", to);

//     const response = await axios.post(GETGABS_URL, payload, {
//       headers: { "Content-Type": "application/json" },
//     });

//     console.log("✅ GetGabs response:", response.data);
//     return response.data;
//   } catch (error) {
//     console.log("❌ GetGabs error:", error.response?.data || error.message);
//     return null;
//   }
// };



// // export const sendBookingReminder = async (fullPhone, bookingDetails) => {
// //   const to = String(fullPhone).replace(/\D/g, "");

// //   const { doctorName, date, time, mode, bookingId } = bookingDetails;

// //   const payload = {
// //     api_key: process.env.GETGABS_API_KEY,        // 🔐 env
// //     sender: process.env.GETGABS_SENDER,
// //     campaign_id: process.env.GETGABS_CAMPAIGN_ID,
// //     messaging_product: "whatsapp",
// //     recipient_type: "individual",
// //     to,
// //     type: "template",
// //     template: {
// //       name: "session_reminder",                 // ✅ NEW TEMPLATE
// //       language: { code: "en_US" },               // ✅ matches GetGabs
// //       components: [
// //         {
// //           type: "body",
// //           parameters: [
// //             { type: "text", text: doctorName }, // {{1}}
// //             { type: "text", text: date },       // {{2}}
// //             { type: "text", text: time },       // {{3}}
// //             { type: "text", text: mode },       // {{4}}
// //             { type: "text", text: bookingId },  // {{5}}
// //           ],
// //         },
// //       ],
// //     },
// //   };

// //   return axios.post(GETGABS_URL, payload, {
// //     headers: { "Content-Type": "application/json" },
// //   });
// // };


// export const sendBookingReminder = async (fullPhone, bookingDetails) => {
//   try {
//     const to = String(fullPhone).replace(/\D/g, "");

//     const {
//       employeeName, // {{1}}
//       doctorName,   // {{2}}
//       date,         // {{3}}
//       time,         // {{4}}
//       mode,         // {{5}}
//       meetLink,     // {{6}}
//     } = bookingDetails;

//     const payload = {
//       api_key: process.env.GETGABS_API_KEY,
//       sender: process.env.GETGABS_SENDER,
//       campaign_id: process.env.GETGABS_REMINDER_CAMPAIGN_ID,
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to,
//       type: "template",
//       template: {
//         name: "booking_reminder_v2",
//         language: { code: "en" }, // ✅ must match template language
//         components: [
//           {
//             type: "body",
//             parameters: [
//               { type: "text", text: employeeName },
//               { type: "text", text: doctorName },
//               { type: "text", text: date },
//               { type: "text", text: time },
//               { type: "text", text: mode },
//               { type: "text", text: meetLink },
//             ],
//           },
//         ],
//       },
//     };

//     console.log("📢 Reminder campaign:",
//   process.env.GETGABS_REMINDER_CAMPAIGN_ID
// );

//     const response = await axios.post(GETGABS_URL, payload, {
//       headers: { "Content-Type": "application/json" },
//     });

//     return response.data;
//   } catch (error) {
//     console.error(
//       "❌ Booking reminder WhatsApp failed:",
//       error.response?.data || error.message
//     );
//     throw error;
//   }
// };


// export const sendBookingCancellation = async (phone, bookingDetails) => {
//   const { doctorName, date, bookingId, refundAmount } = bookingDetails;

//   const messageBody = `❌ *Booking Cancelled*

// Your booking has been cancelled.

// 📋 *Booking ID:* ${bookingId}
// 👨‍⚕️ *Doctor:* Dr. ${doctorName}
// 📅 *Session Date:* ${date}

// 💰 *Refund Amount:* ₹${refundAmount}
// The refund will be processed within 3-5 business days.

// If you have any questions, please contact our support team.`;

//   return sendWhatsAppMessage(phone, messageBody);
// };
