/* =============================================================
 * data/testimonials.js — Client testimonials (content layer)
 * -------------------------------------------------------------
 * FUTURE BACKEND INTEGRATION:
 *   Replace with: GET /api/testimonials
 *   or sync from Google Business Profile reviews via a backend.
 *
 * NOTE ON ACCURACY:
 *   Do NOT invent reviews or star ratings. Every entry below is a
 *   clearly marked PLACEHOLDER (`placeholder: true`) so the layout
 *   can be built and reviewed without publishing fake reviews.
 *   Replace with real, consented client feedback before launch.
 * ============================================================= */

var TESTIMONIALS = [
  {
    name: "[Client Name]",
    projectType: "Residential Construction",
    location: "[Location]",
    placeholder: true,
    quote:
      "[Placeholder testimonial — replace with a real, consented client review. Describe the client's experience with scope clarity, communication and handover.]"
  },
  {
    name: "[Client Name]",
    projectType: "Renovation & Remodeling",
    location: "[Location]",
    placeholder: true,
    quote:
      "[Placeholder testimonial — replace with a real, consented client review about the renovation experience.]"
  },
  {
    name: "[Client Name]",
    projectType: "Commercial Construction",
    location: "[Location]",
    placeholder: true,
    quote:
      "[Placeholder testimonial — replace with a real, consented client review about the commercial project.]"
  }
];

if (typeof window !== "undefined") {
  window.TESTIMONIALS = TESTIMONIALS;
}
