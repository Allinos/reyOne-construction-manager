/* =============================================================
 * data/services.js — Service catalogue (content layer)
 * -------------------------------------------------------------
 * Content is intentionally separated from UI so it can later be
 * served from a database / REST API without touching markup.
 *
 * FUTURE BACKEND INTEGRATION:
 *   Replace this array with data fetched from:
 *     GET /api/services
 *
 * NOTE ON ACCURACY:
 *   `confirmed: true`  -> service is verified as offered.
 *   `confirmed: false` -> shown as a CONFIGURABLE/proposed
 *                         service until the company confirms it.
 *   Do not present unconfirmed services as guaranteed offerings.
 * ============================================================= */

var SERVICES = [
  {
    slug: "residential-construction",
    page: "residential-construction.html",
    title: "Residential Construction",
    icon: "home",
    confirmed: true,
    short:
      "Ground-up homes and villas built through a clear scope, transparent costing and structured milestones.",
    forWho: [
      "Families planning a new independent house or villa",
      "Plot owners wanting an end-to-end managed build",
      "Clients who value transparent costing and progress visibility"
    ],
    scope: [
      "Structural design coordination and drawings review",
      "Foundation, RCC framework and masonry",
      "Plumbing, electrical and finishing works",
      "Interior-ready or turnkey handover options"
    ],
    benefits: [
      "A documented scope before work begins",
      "Milestone-linked progress you can actually see",
      "Quality checks at each key construction stage"
    ]
  },
  {
    slug: "commercial-construction",
    page: "commercial-construction.html",
    title: "Commercial Construction",
    icon: "building",
    confirmed: true,
    short:
      "Retail, office and mixed-use spaces delivered with structured execution and accountable timelines.",
    forWho: [
      "Business owners building retail or office space",
      "Property developers needing dependable execution",
      "Clients who need clear reporting for stakeholders"
    ],
    scope: [
      "Commercial structural and civil works",
      "Services coordination (electrical, plumbing, HVAC-ready)",
      "Fit-out coordination and finishing",
      "Compliance-aware documentation support"
    ],
    benefits: [
      "Predictable milestone planning",
      "Transparent cost breakdowns",
      "Clear single point of accountability"
    ]
  },
  {
    slug: "renovation",
    page: "renovation.html",
    title: "Renovation & Remodeling",
    icon: "layers",
    confirmed: true,
    short:
      "Structured upgrades and remodeling that respect your existing structure, budget and timeline.",
    forWho: [
      "Homeowners upgrading an existing property",
      "Owners repurposing or extending a space",
      "Clients wanting minimal disruption and clear scope"
    ],
    scope: [
      "Condition assessment of the existing structure",
      "Selective demolition and structural strengthening",
      "Modernisation of finishes, plumbing and electricals",
      "Phased execution to reduce disruption"
    ],
    benefits: [
      "A realistic scope after site assessment",
      "Before / after clarity on what changes",
      "Careful handling of the existing structure"
    ]
  },
  {
    slug: "civil-engineering",
    page: "civil-engineering.html",
    title: "Civil Engineering",
    icon: "compass",
    confirmed: true,
    short:
      "Civil works grounded in sound engineering practice, from site works to structural coordination.",
    forWho: [
      "Property owners needing civil / site works",
      "Clients requiring engineering-led execution",
      "Projects needing structured technical oversight"
    ],
    scope: [
      "Site preparation and civil groundworks",
      "Structural coordination and supervision",
      "Material and workmanship quality checks",
      "Documentation of key civil stages"
    ],
    benefits: [
      "Engineering-informed decisions",
      "Documented quality checkpoints",
      "Clear technical communication"
    ]
  },
  {
    slug: "structural-works",
    page: "services.html",
    title: "Structural Works",
    icon: "grid",
    confirmed: false, // CONFIGURABLE — confirm with company before presenting as offered
    short:
      "Structural framework and strengthening works. (Configurable — pending company confirmation.)",
    forWho: [
      "Projects requiring RCC / structural framework",
      "Owners needing structural strengthening or repair"
    ],
    scope: [
      "RCC framework execution",
      "Structural strengthening and retrofitting",
      "Coordination with structural consultants"
    ],
    benefits: [
      "Structured, checked execution",
      "Engineering-led supervision"
    ]
  },
  {
    slug: "project-management",
    page: "project-management.html",
    title: "Project Management",
    icon: "clipboard",
    confirmed: true,
    short:
      "Structured coordination of scope, cost, timeline and quality — with visibility at every stage.",
    forWho: [
      "Clients managing larger or multi-stage projects",
      "Owners who want a single accountable coordinator",
      "Anyone who wants organised progress reporting"
    ],
    scope: [
      "Scope definition and milestone planning",
      "Cost tracking against the agreed estimate",
      "Progress reporting and site coordination",
      "Quality checkpoints and handover management"
    ],
    benefits: [
      "One accountable point of contact",
      "Milestone-based progress visibility",
      "Fewer surprises on cost and timeline"
    ]
  },
  {
    slug: "turnkey-construction",
    page: "services.html",
    title: "Turnkey Construction",
    icon: "key",
    confirmed: false, // CONFIGURABLE — confirm with company before presenting as offered
    short:
      "End-to-end delivery from planning to handover. (Configurable — pending company confirmation.)",
    forWho: [
      "Clients wanting a single end-to-end partner",
      "Owners preferring a managed, hands-off build"
    ],
    scope: [
      "Design coordination through to finishing",
      "Single-contract execution",
      "Systematic, documented handover"
    ],
    benefits: [
      "One partner, start to finish",
      "Clear scope and structured handover"
    ]
  }
];

if (typeof window !== "undefined") {
  window.SERVICES = SERVICES;
}
