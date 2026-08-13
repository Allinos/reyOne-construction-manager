/* =============================================================
 * data/faqs.js — Frequently Asked Questions (content layer)
 * -------------------------------------------------------------
 * FUTURE BACKEND INTEGRATION:
 *   Replace with: GET /api/faqs
 *
 * Content is fully editable. Answers avoid unverified claims
 * (no fixed minimum budget, no invented statistics). Update
 * answers to reflect the company's confirmed policies.
 * ============================================================= */

var FAQS = [
  {
    q: "What services do you provide?",
    a: "We provide residential and commercial construction; repairing and renovation; interior and exterior works; civil and structural engineering; geotechnical investigation; and project management and turnkey construction. Share your specific requirement with us on WhatsApp and we'll confirm how we can help."
  },
  {
    q: "How does the construction process work?",
    a: "We follow a structured approach: consultation, site assessment, requirement and scope definition, estimate, planning, execution, quality checks and handover. The goal is to keep scope, cost and timeline clear at every stage."
  },
  {
    q: "Do you provide site visits?",
    a: "Site assessment is part of our structured approach so that the scope and estimate reflect real site conditions. Share your location on WhatsApp and we can discuss the next steps."
  },
  {
    q: "How is the project estimate prepared?",
    a: "An estimate is prepared after understanding your requirement, scope and site conditions. Indicative figures are not a final quotation — final commercial terms are set out in a formal agreement."
  },
  {
    q: "What information is required before starting?",
    a: "Typically your location, the type of project, an approximate size and your rough budget and timeline expectations. Our Project Planner helps you share these quickly over WhatsApp."
  },
  {
    q: "How do you handle project timelines?",
    a: "Timelines are planned around milestones. Actual timelines can vary with scope, specifications, site conditions, approvals and material availability, and any change is communicated clearly."
  },
  {
    q: "How can clients track project progress?",
    a: "Our approach emphasises progress visibility through milestone-based updates and direct communication, so you are not left guessing about what is happening at the site."
  },
  {
    q: "Do you handle renovation?",
    a: "Yes. Renovation and remodeling is a core service. We begin with a condition assessment of the existing structure, then plan a realistic, phased scope to reduce disruption."
  },
  {
    q: "What locations do you serve?",
    a: "We serve clients across our active service area. Please confirm your location with us on WhatsApp so we can tell you whether your project falls within the areas we currently cover."
  },
  {
    q: "How can I discuss my project?",
    a: "The quickest way is WhatsApp — use any WhatsApp button on this site, or the Project Planner, and we will respond to discuss your requirement."
  },
  {
    q: "What is the minimum project size or budget?",
    a: "This depends on the type and scope of work. Rather than publish a fixed figure, we prefer to understand your requirement first. Share your details on WhatsApp and we will guide you."
  }
];

if (typeof window !== "undefined") {
  window.FAQS = FAQS;
}
