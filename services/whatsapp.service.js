import axios from "axios";

const normalizePhone = (phone) => {
  let p = phone.replace(/\D/g, "");
  if (p.length === 10) p = "91" + p;
  return p;
};

export const sendWhatsAppOtp = async (phone, otp) => {
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error("WhatsApp env variables missing");
  }

  const to = normalizePhone(phone);

  await axios.post(
    `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: `Your verification code is ${otp}. It will expire in 5 minutes.`,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
};
