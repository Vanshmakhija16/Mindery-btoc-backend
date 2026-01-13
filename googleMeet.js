// import fs from "fs";
// import { google } from "googleapis";
// import path from "path";

// // Absolute path handling (VERY IMPORTANT for Windows)
// const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/+/, "");
// const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
// const TOKEN_PATH = path.join(__dirname, "token.json");

// // Read credentials.json
// const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
// const { client_id, client_secret, redirect_uris } = credentials.web;

// // Create OAuth client
// export const oAuth2Client = new google.auth.OAuth2(
//   client_id,
//   client_secret,
//   redirect_uris[0] // http://localhost:5000/oauth2callback
// );

// // Load token if already authorized
// if (fs.existsSync(TOKEN_PATH)) {
//   const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
//   oAuth2Client.setCredentials(token);
// }

// // Generate Google Meet link
// export async function generateGoogleMeetLink({ start, end }) {
//   const calendar = google.calendar({
//     version: "v3",
//     auth: oAuth2Client,
//   });

//   const event = {
//     summary: "Mindery Therapy Session",
//     start: {
//       dateTime: start,
//       timeZone: "Asia/Kolkata",
//     },
//     end: {
//       dateTime: end,
//       timeZone: "Asia/Kolkata",
//     },
//     conferenceData: {
//       createRequest: {
//         requestId: `meet-${Date.now()}`,
//         conferenceSolutionKey: {
//           type: "hangoutsMeet",
//         },
//       },
//     },
//   };

//   const response = await calendar.events.insert({
//     calendarId: "primary",
//     resource: event,
//     conferenceDataVersion: 1,
//   });

//   return response.data.hangoutLink;
// }

import { google } from "googleapis";
import GoogleToken from "./models/GoogleToken.js";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error(
    "Missing Google OAuth env vars. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
  );
}

export const oAuth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

export async function generateGoogleMeetLink({ start, end }) {
  // Load tokens from MongoDB
  const doc = await GoogleToken.findOne({ owner: "admin" });
  if (!doc?.tokens) {
    throw new Error("Google tokens not found. Please authorize again.");
  }

  oAuth2Client.setCredentials(doc.tokens);

  const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

  const event = {
    summary: "Mindery Therapy Session",
    start: { dateTime: start, timeZone: "Asia/Kolkata" },
    end: { dateTime: end, timeZone: "Asia/Kolkata" },
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    resource: event,
    conferenceDataVersion: 1,
  });

  return response.data.hangoutLink;
}
