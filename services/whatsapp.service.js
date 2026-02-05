import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();
const GETGABS_URL =
  "https://app.getgabs.com/whatsappbusiness/send-templated-message";

const WHATSAPP_API_VERSION = "v22.0";

console.log("GETGABS_API_KEY:", process.env.GETGABS_API_KEY ? "LOADED" : "MISSING");
console.log("GETGABS_SENDER:", process.env.GETGABS_SENDER);
console.log("GETGABS_CAMPAIGN_ID:", process.env.GETGABS_CAMPAIGN_ID);


// Normalize phone number to international format
const normalizePhone = (phone) => {
  let p = phone.replace(/\D/g, "");
  if (p.length === 10) p = "91" + p; // India +91
  if (!p.startsWith("+")) p = "+" + p; // Add + if not present
  return p;
};

// Validate WhatsApp credentials
const validateWhatsAppConfig = () => {
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn("⚠️ WhatsApp env variables missing. Messages will not be sent.");
    return false;
  }
  return true;
};


export const sendWhatsAppOtp = async (fullPhone, otp) => {
  try {
    const payload = {
      api_key: process.env.GETGABS_API_KEY,
      sender: process.env.GETGABS_SENDER,
      campaign_id: process.env.GETGABS_CAMPAIGN_ID,
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: fullPhone, // example: 919876543210
      type: "template",
      template: {
        name: "otp_auth",
        language: {
          code: "en_US",
        },
        components: [
          {
            type: "BODY",
            parameters: [
              {
                type: "text",
                text: otp,
              },
            ],
          },
          {
            type: "button",
            sub_type: "URL",
            index: 0,
            parameters: [
              {
                type: "text",
                text: otp,
              },
            ],
          },
        ],
      },
    };

    const response = await axios.post(GETGABS_URL, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;

  } catch (error) {
    console.error(
      "GetGabs OTP error:",
      error.response?.data || error.message
    );
    throw new Error("WhatsApp OTP failed");
  }
};


// export const sendBookingConfirmation = async (fullPhone, bookingDetails) => {
//   try {
    

//     const {

//       employeeName,
//       doctorName,
//       date,
//       time,
//       mode,
//       bookingId,
//       meetLink,
//     } = bookingDetails;

//     const payload = {
//       api_key: process.env.GETGABS_API_KEY,
//       sender: process.env.GETGABS_SENDER,
//       campaign_id: process.env.GETGABS_CAMPAIGN_ID,
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to: fullPhone, // countryCode + phone
//       type: "template",
//       template: {
//         name: "session_details",
//         language: { code: "en" },
//              components: [
//         {
//           type: "body",
//             parameters: [
//               { type: "text", text: employeeName }, // {{1}}
//               { type: "text", text: doctorName },   // {{2}}
//               { type: "text", text: date },         // {{3}}
//               { type: "text", text: time },         // {{4}}
//               { type: "text", text: meetLink || "Link will be shared shortly" }, // {{5}}
//             ],
//         },
//       ],
//       },
//     };



//     // console.log("📤 Sending WhatsApp payload:", payload);

//     const response = await axios.post(GETGABS_URL, payload, {
//       headers: { "Content-Type": "application/json" },
//     });
//     // console.log("📨 GetGabs response:", response.data);

//     return response.data;

//   } catch (error) {
//     console.error(
//       "GetGabs booking confirmation error:",
//       error.response?.data || error.message
//     );
//     // ❗ Do NOT throw — booking should not fail if WhatsApp fails
//     return null;
//   }
// };

// Send booking reminder via WhatsApp



export const sendBookingConfirmation = async (fullPhone, bookingDetails) => {
  try {
   


    const to = String(fullPhone).replace(/\D/g, ""); // ✅ remove +, spaces, etc.

    const { employeeName, doctorName, date, time, meetLink } = bookingDetails;
     
    const payload = {
      api_key: process.env.GETGABS_API_KEY,
      sender: process.env.GETGABS_SENDER,
      campaign_id: process.env.GETGABS_CAMPAIGN_ID,
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to, // ✅ use cleaned number
      type: "template",
      template: {
        name: "session_details",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: employeeName },
              { type: "text", text: doctorName },
              { type: "text", text: date },
              { type: "text", text: time },
              { type: "text", text: meetLink || "Link will be shared shortly" },
            ],
          },
        ],
      },
    };

    console.log("📤 WhatsApp sending to:", to);

    const response = await axios.post(GETGABS_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });

    console.log("✅ GetGabs response:", response.data);
    return response.data;
  } catch (error) {
    console.log("❌ GetGabs error:", error.response?.data || error.message);
    return null;
  }
};


// export const sendBookingReminder = async (phone, bookingDetails) => {
//   const { doctorName, date, time, mode, bookingId } = bookingDetails;

//   const messageBody = `⏰ *Booking Reminder*

// Your session with Dr. ${doctorName} is coming up!

// 📅 *Date:* ${date}
// ⏰ *Time:* ${time}
// 📱 *Mode:* ${mode}

// Please be ready 5 minutes before your scheduled time.

// 📋 *Booking ID:* ${bookingId}`;

//   return sendWhatsAppMessage(phone, messageBody);
// };

// Send cancellation notice via WhatsApp

export const sendBookingReminder = async (fullPhone, bookingDetails) => {
  const to = String(fullPhone).replace(/\D/g, "");

  const { doctorName, date, time, mode, bookingId } = bookingDetails;

  const payload = {
    api_key: process.env.GETGABS_API_KEY,
    sender: process.env.GETGABS_SENDER,
    campaign_id: process.env.GETGABS_CAMPAIGN_ID,
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: "session_details", // 🔴 MUST be approved in GetGabs
      language: { code: "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: doctorName },
            { type: "text", text: date },
            { type: "text", text: time },
            { type: "text", text: mode },
            { type: "text", text: bookingId },
          ],
        },
      ],
    },
  };

  return axios.post(GETGABS_URL, payload);
};


export const sendBookingCancellation = async (phone, bookingDetails) => {
  const { doctorName, date, bookingId, refundAmount } = bookingDetails;

  const messageBody = `❌ *Booking Cancelled*

Your booking has been cancelled.

📋 *Booking ID:* ${bookingId}
👨‍⚕️ *Doctor:* Dr. ${doctorName}
📅 *Session Date:* ${date}

💰 *Refund Amount:* ₹${refundAmount}
The refund will be processed within 3-5 business days.

If you have any questions, please contact our support team.`;

  return sendWhatsAppMessage(phone, messageBody);
};
