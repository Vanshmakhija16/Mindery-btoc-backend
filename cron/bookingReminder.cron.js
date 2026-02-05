import cron from "node-cron";
import Booking from "../models/Booking.js";
import { sendBookingReminder } from "../services/whatsapp.service.js";

cron.schedule("* * * * *", async () => {
  const now = new Date();

  const bookings = await Booking.find({
    reminderSent: false,
    reminderAt: { $lte: now },
  });

  for (const booking of bookings) {
    await sendBookingReminder(booking.phone, {
      doctorName: booking.doctorName,
      date: booking.date,
      time: booking.slot,
      mode: booking.mode,
      bookingId: booking._id,
     employeeId: booking.employeeId, // ✅ REQUIRED

    });

    booking.reminderSent = true;
    await booking.save();
  }
});
