import cron from "node-cron";
import { sendEmailReminders } from "../services/emailReminder.service.js";

console.log("🔥 EMAIL REMINDER CRON LOADED 🔥");

// Run every minute
cron.schedule("* * * * *", async () => {
  console.log("⏰ EMAIL REMINDER CRON RUN:", new Date().toISOString());

  try {
    await sendEmailReminders();
  } catch (err) {
    console.error("❌ Email reminder cron error:", err);
  }
});
