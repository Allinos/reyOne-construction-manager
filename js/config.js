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
  tagline: "Build With Clarity. Build With Confidence.",

  /* ---- Contact channels (REPLACE before launch) ---- */
  // WhatsApp number in full international format WITHOUT "+", spaces or dashes.
  // Example for India: "919876543210"
  whatsappNumber: "REPLACE_WITH_REAL_NUMBER",
  // Phone number for tel: links (may include leading +).
  phoneNumber: "REPLACE_WITH_REAL_NUMBER",
  email: "REPLACE_WITH_REAL_EMAIL",

  /* ---- Location / service area (REPLACE before launch) ---- */
  serviceArea: "[SERVICE AREA]",
  officeAddress: "[LEGAL BUSINESS ADDRESS]",
  businessHours: "Mon – Sat, 9:30 AM – 6:30 PM",
  // Google Maps embed src — paste the "embed" iframe src from Google Maps.
  googleMapsEmbedUrl: "REPLACE_WITH_GOOGLE_MAPS_EMBED_URL",

  /* ---- Online presence (REPLACE before launch) ---- */
  websiteDomain: "REPLACE_WITH_WEBSITE_DOMAIN",
  googleReviewsUrl: "REPLACE_WITH_GOOGLE_BUSINESS_PROFILE_URL",
  social: {
    instagram: "REPLACE_WITH_INSTAGRAM_URL",
    facebook: "REPLACE_WITH_FACEBOOK_URL",
    linkedin: "REPLACE_WITH_LINKEDIN_URL",
    youtube: "REPLACE_WITH_YOUTUBE_URL"
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
