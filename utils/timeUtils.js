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
export function buildAvailabilityMap(doctor) {
  const toMinutes = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const minutesToTime = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

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
      const isBreak = breaks.some((b) => t < b.end && t + duration > b.start);
      if (!isBreak) {
        slots.push({
          startTime: minutesToTime(t),
          endTime: minutesToTime(t + duration),
        });
      }
    }
    return slots;
  };

  const result = {};
  const today = new Date();

  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    // Date-specific rule takes priority
    const dateRule = (doctor.dateAvailability || []).find(
      (da) => da.date === dateStr && da.isActive
    );
    if (dateRule) {
      const slots = buildSlots(dateRule);
      if (slots.length) result[dateStr] = slots;
      continue;
    }

    // Weekly recurring rule
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    const weeklyRule = (doctor.weeklyAvailability || []).find(
      (w) => w.day === dayName && w.isActive
    );
    if (weeklyRule) {
      const slots = buildSlots(weeklyRule);
      if (slots.length) result[dateStr] = slots;
    }
  }

  return result;
}
