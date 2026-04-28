/**
 * countryConfig.js
 * Central configuration layer for all countries.
 * 
 * HOW TO ADD A NEW COUNTRY:
 *   1. Add an entry to COUNTRY_CONFIG below.
 *   2. Create a Mongoose model similar to CaTherapist.js for that country.
 *   3. Create a route file similar to caRoutes.js, importing from timeUtils.js.
 *   4. Register the route in index.js as /api/<countryCode>/...
 *   5. Add CORS origin for the new domain in index.js.
 *   6. Done — no other backend changes needed.
 * 
 * ADDING UAE EXAMPLE:
 *   "ae": { domain: "mindery.ae", timezone: "Asia/Dubai", currency: "AED", symbol: "AED", ... }
 */

export const COUNTRY_CONFIG = {
  /**
   * India — existing system (DO NOT MODIFY existing India routes)
   * Kept here for reference and future cross-country queries only.
   */
  in: {
    code: "in",
    name: "India",
    domain: "mytherapy.minderytech.com",
    timezone: "Asia/Kolkata",       // IST — all DB times are stored in this
    currency: "INR",
    symbol: "₹",
    paymentProvider: "razorpay",
    flag: "🇮🇳",
    phoneDefaultCountry: "in",
    firstSessionPrice: 99,          // INR
    regularSessionPrice: null,      // from doctor's consultationOptions
    insuranceSupported: false,
    dataRegulation: "IT Act 2000",
  },

  /**
   * Canada — new system, mindery.ca
   */
  ca: {
    code: "ca",
    name: "Canada",
    domain: "mindery.ca",
    timezone: "America/Toronto",    // default; user can switch to other CA zones
    currency: "CAD",
    symbol: "CAD $",
    paymentProvider: "stripe",      // Stripe (CAD)
    flag: "🍁",
    phoneDefaultCountry: "ca",
    firstSessionPrice: null,        // configurable per doctor in CaTherapist model
    regularSessionPrice: null,      // configurable per doctor in CaTherapist model
    insuranceSupported: true,
    dataRegulation: "PIPEDA",
    timezones: [
      { label: "ET — Toronto / Ottawa", value: "America/Toronto", abbr: "ET" },
      { label: "CT — Winnipeg",         value: "America/Winnipeg", abbr: "CT" },
      { label: "MT — Calgary / Edmonton", value: "America/Edmonton", abbr: "MT" },
      { label: "PT — Vancouver",        value: "America/Vancouver", abbr: "PT" },
      { label: "AT — Halifax",          value: "America/Halifax", abbr: "AT" },
      { label: "NT — St. John's",       value: "America/St_Johns", abbr: "NT" },
    ],
  },

  /**
   * UAE — placeholder for future implementation
   * Uncomment and fill in when ready.
   */
  // ae: {
  //   code: "ae",
  //   name: "UAE",
  //   domain: "mindery.ae",
  //   timezone: "Asia/Dubai",
  //   currency: "AED",
  //   symbol: "AED",
  //   paymentProvider: "stripe",
  //   flag: "🇦🇪",
  //   phoneDefaultCountry: "ae",
  //   firstSessionPrice: null,
  //   regularSessionPrice: null,
  //   insuranceSupported: false,
  //   dataRegulation: "UAE PDPL",
  //   timezones: [
  //     { label: "GST — Dubai / Abu Dhabi", value: "Asia/Dubai", abbr: "GST" },
  //   ],
  // },
};

/**
 * Get country config by country code.
 * @param {string} code - "ca", "in", "ae" etc.
 * @returns {Object|null}
 */
export function getCountryConfig(code) {
  return COUNTRY_CONFIG[code?.toLowerCase()] || null;
}

/**
 * Detect country from request hostname.
 * Used in middleware or route handlers.
 * @param {string} hostname - e.g. "mindery.ca" or "mytherapy.minderytech.com"
 * @returns {string} country code e.g. "ca", "in"
 */
export function detectCountryFromDomain(hostname = "") {
  if (hostname.includes("mindery.ca"))   return "ca";
  if (hostname.includes("mindery.ae"))   return "ae";
  if (hostname.includes("mindery.co.uk")) return "uk";
  // India is the default/fallback
  return "in";
}
