/* =============================================================
 * config.js — Global Site Configuration
 * DW Nirman Engineerings LLP
 * -------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for all business-specific values.
 * Update the values below once and they propagate across the
 * entire website (WhatsApp links, phone links, email, etc.).
 *
 * IMPORTANT:
 *   - Replace every REPLACE_WITH_* placeholder with real,
 *     verified company information before going live.
 *   - Do NOT invent registration numbers, GST numbers, or
 *     statistics. Leave placeholders until verified.
 *
 * FUTURE BACKEND INTEGRATION:
 *   When migrating to Node.js/Express, these values can be
 *   served from an environment config or an API endpoint
 *   (e.g. GET /api/config) instead of a static file.
 * ============================================================= */

var SITE_CONFIG = {
  /* ---- Core identity ---- */
  companyName: "DW Nirman Engineerings LLP",
  shortName: "DW Nirman",
  tagline: "We Build Your Dream",

  /* ---- Contact channels ---- */
  // WhatsApp number in full international format WITHOUT "+", spaces or dashes.
  // India country code (91) + number.
  whatsappNumber: "919435173665",
  // Primary phone number for tel: links (may include leading +).
  phoneNumber: "+91 9435173665",
  // Secondary phone number (shown alongside the primary).
  phoneNumberAlt: "+91 9435171984",
  email: "dwnirmanengineeringllp@gmail.com",

  /* ---- Location / service area (REPLACE before launch) ---- */
  serviceArea: "North East",
  officeAddress: "Motiram, Bimala Bora Rd, in front of Hotel AM Palace, Haibargaon, Fauzdaripatty, Nagaon, Assam 782001",
  businessHours: "Mon – Sat, 9:30 AM – 6:30 PM",
  // Google Maps embed src (contact page) — paste the "embed" iframe src.
  googleMapsEmbedUrl: "REPLACE_WITH_GOOGLE_MAPS_EMBED_URL",
  // NOTE: The "Where we work" section uses an illustrative SVG map of
  // North-East India (assets/images/northeast-india-map.svg). To move the red
  // locator pin, edit the pinLon/pinLat values inside that SVG file.

  /* ---- Online presence (REPLACE before launch) ---- */
  websiteDomain: "http://dwnirmanengineering.in/",
  googleReviewsUrl: "https://share.google/ogCb8XuDuomKHowDZ",
  social: {
    instagram: "REPLACE_WITH_INSTAGRAM_URL",
    facebook: "https://www.facebook.com/p/DW-Nirman-Engineering-61572439651128/",
    linkedin: "REPLACE_WITH_LINKEDIN_URL",
    youtube: "https://www.youtube.com/@washiulhoque"
  },

  /* ---- Legal / credentials (REPLACE with verified values only) ---- */
  credentials: {
    llpin: "[LLPIN]",
    gstNumber: "[GST NUMBER]",
    registrationDetails: "[REGISTRATION DETAILS]"
  },

  /* ---- Default WhatsApp prefilled message ---- */
  defaultWhatsappMessage:
    "Hi DW Nirman Engineerings, I am interested in discussing a construction project. I would like to know more about your services."
};

/* Expose for module-style access without bundlers. */
if (typeof window !== "undefined") {
  window.SITE_CONFIG = SITE_CONFIG;
}
