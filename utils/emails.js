// import nodemailer from "nodemailer";

// export const sendEmail = async ({ to, subject, text }) => {
//   try {
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS,
//       },
//     });

//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to,
//       subject,
//       text,
//     });
//   } catch (err) {
//     console.error("Error sending email:", err);
//   }
// };
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// // OPTION A: use SMTP_* env vars (from your .env)
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,                 // smtp.gmail.com
//   port: Number(process.env.SMTP_PORT || 465),  // 465
//   secure: String(process.env.SMTP_SECURE) === "true", // true/false
//   auth: {
//     user: process.env.SMTP_USER,               // minderytechno@gmail.com
//     pass: process.env.SMTP_PASS,               // Gmail App Password
//   },
// });

const port = Number(process.env.SMTP_PORT || 465);

console.log("SMTP RUNTIME", {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === "465",
});


const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


export const sendEmail = async ({ to, subject, text, html }) => {
  try {

    
  //     console.log("SMTP RUNTIME INSIDE sendEmail", {
  //   host: process.env.SMTP_HOST,
  //   port: process.env.SMTP_PORT,
  //   secure: process.env.SMTP_PORT === "465",
  // });
  
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });

    // console.log("✅ Mail sent:", {
    //   to,
    //   messageId: info.messageId,
    //   response: info.response,
    //   accepted: info.accepted,
    //   rejected: info.rejected,
    // });

    return info;
  } catch (err) {
    console.error("❌ Error sending email:", err);
    throw err;
  }
};
