/**
 * timeUtils.js
 * Central timezone conversion utility for the multi-country system.
 * 
 * DESIGN PRINCIPLE:
 *   - All times are stored in IST (Indian Standard Time, UTC+5:30) in the DB.
 *   - This file provides helpers to convert IST → any target timezone.
 *   - New countries (UAE, UK, USA) just pass a different IANA timezone string.
 *   - India routes continue to work unchanged — this file is purely additive.
 */

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Convert an IST date+time string into any target IANA timezone.
 * 
 * @param {string} dateStr - "YYYY-MM-DD" (IST date)
 * @param {string} timeStr - "HH:MM" (IST time, 24h)
 * @param {string} targetTZ - IANA timezone e.g. "America/Toronto", "Asia/Dubai"
 * @returns {{ date: string, time: string, utcMs: number }}
 */
export function convertISTtoTimezone(dateStr, timeStr, targetTZ = "America/Toronto") {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // IST = UTC+5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - istOffsetMs;
  const utcDate = new Date(utcMs);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: targetTZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(utcDate);
  const getPart = (type) => parts.find((p) => p.type === type)?.value || "00";

  return {
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    time: `${getPart("hour")}:${getPart("minute")}`,
    utcMs,
  };
}

/**
 * Convert a full IST availability map into any target timezone.
 * Availability map shape: { "YYYY-MM-DD": [{ startTime, endTime }] }
 * 
 * @param {Object} availability - IST availability map from buildAvailabilityMap()
 * @param {string} targetTZ - IANA timezone string
 * @returns {Object} - Availability map keyed by target-timezone dates
 */
export function convertAvailabilityToTimezone(availability, targetTZ) {
  const result = {};

  for (const [istDate, slots] of Object.entries(availability)) {
    for (const slot of slots) {
      if (!slot.startTime || !slot.endTime) continue;

      const startConverted = convertISTtoTimezone(istDate, slot.startTime, targetTZ);
      const endConverted = convertISTtoTimezone(istDate, slot.endTime, targetTZ);
      const targetDate = startConverted.date;

      if (!result[targetDate]) result[targetDate] = [];
      result[targetDate].push({
        startTime: startConverted.time,
        endTime: endConverted.time,
        startTimeIST: slot.startTime,
        endTimeIST: slot.endTime,
        istDate,
      });
    }
  }

  return result;
}

/**
 * Build an IST availability map from a Doctor model instance.
 * Generates slots for the next 60 days using weeklyAvailability + dateAvailability.
 * 
 * @param {Object} doctor - Mongoose Doctor document
 * @returns {Object} - IST availability map { "YYYY-MM-DD": [{ startTime, endTime }] }
 */
// export function buildAvailabilityMap(doctor) {
//   const toMinutes = (t) => {
//     const [h, m] = t.split(":").map(Number);
//     return h * 60 + m;
//   };
//   const minutesToTime = (m) =>
//     `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

//   const buildSlots = (rule) => {
//     const start = toMinutes(rule.startTime);
//     const end = toMinutes(rule.endTime);
//     const duration = rule.slotDuration;
//     const breaks = (rule.breaks || []).map((b) => ({
//       start: toMinutes(b.startTime),
//       end: toMinutes(b.endTime),
//     }));

//     const slots = [];
//     for (let t = start; t + duration <= end; t += duration) {
//       const isBreak = breaks.some((b) => t < b.end && t + duration > b.start);
//       if (!isBreak) {
//         slots.push({
//           startTime: minutesToTime(t),
//           endTime: minutesToTime(t + duration),
//         });
//       }
//     }
//     return slots;
//   };

//   const result = {};
//   const today = new Date();

//   for (let i = 0; i < 60; i++) {
//     const d = new Date(today);
//     d.setDate(today.getDate() + i);
//     const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

//     // Date-specific rule takes priority
//     const dateRule = (doctor.dateAvailability || []).find(
//       (da) => da.date === dateStr && da.isActive
//     );
//     if (dateRule) {
//       const slots = buildSlots(dateRule);
//       if (slots.length) result[dateStr] = slots;
//       continue;
//     }

//     // Weekly recurring rule
//     const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
//     const weeklyRule = (doctor.weeklyAvailability || []).find(
//       (w) => w.day === dayName && w.isActive
//     );
//     if (weeklyRule) {
//       const slots = buildSlots(weeklyRule);
//       if (slots.length) result[dateStr] = slots;
//     }
//   }

//   return result;
// }

export function buildAvailabilityMap(doctor, bookedStartSet = null) {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(
      m % 60
    ).padStart(2, "0")}`;

  const buildSlots = (rule) => {
    const start = toMinutes(rule.startTime);
    const end = toMinutes(rule.endTime);
    const duration = rule.slotDuration;

    const breaks = (rule.breaks || []).map((b) => ({
      start: toMinutes(b.startTime),
      end: toMinutes(b.endTime),
    }));

    const slots = [];

    for (let t = start; t + duration <= end; t += duration) {
      const isBreak = breaks.some(
        (b) => t < b.end && t + duration > b.start
      );

      if (!isBreak) {
        slots.push({
          startTime: minutesToTime(t),
          endTime: minutesToTime(t + duration),
        });
      }
    }

    return slots;
  };

  const effectiveBookedSet =
    bookedStartSet instanceof Set
      ? bookedStartSet
      : doctor.__bookedSet instanceof Set
      ? doctor.__bookedSet
      : null;
  const isBookedSlot = (date, slotStartTime) => {
    if (effectiveBookedSet) {
      return effectiveBookedSet.has(`${date}|${slotStartTime}`);
    }
    return (doctor.bookedSlots || []).some((b) => {
      return (
        b.date === date &&
        toMinutes(b.startTime) === toMinutes(slotStartTime)
      );
    });
  };

  const result = {};

  const today = new Date();

  const todayStr = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const nowMinutes =
    today.getHours() * 60 + today.getMinutes();

  for (let i = 0; i < 60; i++) {
    const d = new Date(today);

    d.setDate(today.getDate() + i);

    const dateStr = `${d.getFullYear()}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const isToday = dateStr === todayStr;

    // Date-specific rules — there may be MORE than one entry per date
    // (e.g. an evening 17:30–23:59 window + a next-morning 00:00–08:30 window
    // stored under that next date). Process all of them and merge their slots.
    const dateRules = (doctor.dateAvailability || []).filter(
      (da) => da.date === dateStr && da.isActive
    );

    if (dateRules.length > 0) {
      const allSlots = [];
      for (const dateRule of dateRules) {
        let slots = buildSlots(dateRule);

        slots = slots.filter((slot) => {
          // remove past slots
          if (
            isToday &&
            toMinutes(slot.startTime) <= nowMinutes
          ) {
            return false;
          }

          // remove booked slots
          if (isBookedSlot(dateStr, slot.startTime)) {
            return false;
          }

          return true;
        });

        allSlots.push(...slots);
      }

      // Deduplicate by startTime and sort
      const seen = new Set();
      const merged = [];
      for (const s of allSlots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))) {
        if (seen.has(s.startTime)) continue;
        seen.add(s.startTime);
        merged.push(s);
      }

      if (merged.length) {
        result[dateStr] = merged;
      }

      continue;
    }

    // Weekly rule
    const dayName = d.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const weeklyRule = (doctor.weeklyAvailability || []).find(
      (w) => w.day === dayName && w.isActive
    );

    if (weeklyRule) {
      let slots = buildSlots(weeklyRule);

      slots = slots.filter((slot) => {
        // remove past slots
        if (
          isToday &&
          toMinutes(slot.startTime) <= nowMinutes
        ) {
          return false;
        }

        // remove booked slots
        if (isBookedSlot(dateStr, slot.startTime)) {
          return false;
        }

        return true;
      });

      if (slots.length) {
        result[dateStr] = slots;
      }
    }
  }

  return result;
}

/**
 * Calculate the next available slot for a doctor with proper filtering.
 * Considers availability, booked slots, and 4-hour buffer rule.
 * 
 * @param {Object} doctor - Doctor document
 * @param {string} doctorId - Doctor's ID (optional, for querying bookings)
 * @param {Object} Booking - Booking model (optional, for fetching booked slots)
 * @returns {Promise<{date: string, time: string, dateTime: Date}|null>}
 */
export async function getNextSlot(doctor, doctorId, Booking, bufferHours = 4) {
  try {
    if (!doctor) return null;

    const IST = "Asia/Kolkata";

    // Get booked slots first so buildAvailabilityMap can filter them
    let bookedSet = new Set();
    let bookedStartSet = new Set();
    if (Booking && doctorId) {
      const bookedBookings = await Booking.find({
        doctorId,
        status: { $ne: "cancelled" }
      }).select("date slot").lean();

      bookedSet = new Set(
        bookedBookings.map(b => `${b.date}|${b.slot}`)
      );
      bookedStartSet = new Set(
        bookedBookings.map(b => {
          const start = String(b.slot || "").trim().split(" - ")[0].trim();
          return `${b.date}|${start}`;
        })
      );
    }

    // Get availability using doctor's methods
    let availability = {};
    if (typeof doctor.getUpcomingAvailability === "function") {
      availability = doctor.getUpcomingAvailability(30) || {};
    } else if (typeof doctor.getUpcomingAvailability45 === "function") {
      availability = doctor.getUpcomingAvailability45(30) || {};
    } else {
      availability = buildAvailabilityMap(doctor, bookedStartSet) || {};
    }

    // Current time + buffer (IST)
    const nowPlusBuffer = dayjs().tz(IST).add(bufferHours, "hour");

    // Loop through availability to find first free slot
    const sortedDates = Object.keys(availability).sort();
    
    for (const date of sortedDates) {
      const slots = availability[date] || [];
      
      for (const slot of slots) {
        // Normalize slot format
        const slotStr = typeof slot === "string"
          ? slot.trim()
          : `${slot.startTime} - ${slot.endTime}`;

        // Extract start time
        const startTime = slotStr.split(" - ")[0].trim();

        // Skip if already booked (match by full slot OR start time alone)
        if (
          bookedSet.has(`${date}|${slotStr}`) ||
          bookedStartSet.has(`${date}|${startTime}`)
        ) {
          continue;
        }
        
        // Parse slot datetime in IST
        const slotDateTime = dayjs.tz(
          `${date} ${startTime}`,
          "YYYY-MM-DD HH:mm",
          IST
        );

        if (!slotDateTime.isValid()) {
          continue;
        }

        // Skip slots before now + 4 hours
        if (slotDateTime.isBefore(nowPlusBuffer)) {
          continue;
        }

        // Found valid slot!
        return {
          date,
          time: startTime,
          dateTime: slotDateTime.toDate(),
          dateTimeISO: slotDateTime.toISOString()
        };
      }
    }

    // No available slots found
    return null;
  } catch (err) {
    console.error("Error calculating next slot:", err);
    return null;
  }
}