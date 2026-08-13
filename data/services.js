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
    title: "Residential & Commercial Construction",
    icon: "home",
    confirmed: true,
    short:
      "Ground-up homes, villas and commercial buildings — built through clear scope, transparent costing and structured milestones.",
    forWho: [
      "Families planning a new independent house or villa",
      "Business owners building retail, office or commercial space",
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
    title: "Repairing & Renovation",
    icon: "building",
    confirmed: true,
    short:
      "Structural repairs, restoration and renovation that extend the life of your existing building — with minimal disruption.",
    forWho: [
      "Owners repairing or restoring an existing building",
      "Homeowners planning a renovation or upgrade",
      "Clients needing structural strengthening or repair"
    ],
    scope: [
      "Condition assessment of the existing structure",
      "Structural repair, strengthening and waterproofing",
      "Renovation of finishes, plumbing and electricals",
      "Phased execution to reduce disruption"
    ],
    benefits: [
      "A realistic scope after site assessment",
      "Careful handling of the existing structure",
      "Clear before / after on what changes"
    ]
  },
  {
    slug: "renovation",
    page: "renovation.html",
    title: "Interior & Exterior Works",
    icon: "layers",
    confirmed: true,
    short:
      "Interior and exterior finishing — from flooring, painting and false ceilings to façades, plaster and weatherproofing.",
    forWho: [
      "Owners finishing a newly built home or office",
      "Clients refreshing their interiors or exteriors",
      "Anyone wanting a coordinated finishing package"
    ],
    scope: [
      "Flooring, tiling, painting and false ceilings",
      "Woodwork, joinery and fixtures",
      "External plaster, façade and weatherproofing",
      "A coordinated finishing schedule"
    ],
    benefits: [
      "A single team for interior and exterior finishes",
      "Consistent quality and finish",
      "Clear scope and timeline"
    ]
  },
  {
    slug: "civil-engineering",
    page: "civil-engineering.html",
    title: "Civil & Structural Engineering",
    icon: "compass",
    confirmed: true,
    short:
      "Civil and structural engineering — from site works and RCC framework to structural design coordination and supervision.",
    forWho: [
      "Property owners needing civil / site works",
      "Projects requiring RCC / structural framework",
      "Clients needing engineering-led execution"
    ],
    scope: [
      "Site preparation and civil groundworks",
      "RCC framework and structural works",
      "Structural design coordination and supervision",
      "Material and workmanship quality checks"
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
    title: "Geo Technical Investigation",
    icon: "grid",
    confirmed: true,
    short:
      "Soil investigation and geotechnical testing to inform safe, cost-effective foundation design.",
    forWho: [
      "Owners planning a new build on an untested site",
      "Projects needing foundation recommendations",
      "Clients wanting to reduce foundation risk"
    ],
    scope: [
      "Soil sampling and boreholes",
      "Laboratory and field testing",
      "Bearing capacity and soil analysis",
      "A foundation recommendations report"
    ],
    benefits: [
      "Foundation decisions backed by real site data",
      "Reduced risk of settlement or failure",
      "Cost-appropriate foundation design"
    ]
  },
  {
    slug: "turnkey-construction",
    page: "services.html",
    title: "Project Management & Turnkey Construction",
    icon: "key",
    confirmed: true,
    short:
      "End-to-end delivery and structured project management — from planning and coordination to an accountable handover.",
    forWho: [
      "Clients wanting a single end-to-end partner",
      "Owners preferring a managed, hands-off build",
      "Projects needing organised coordination and reporting"
    ],
    scope: [
      "Scope definition and milestone planning",
      "Design coordination through to finishing",
      "Cost tracking and progress reporting",
      "Single-contract execution and documented handover"
    ],
    benefits: [
      "One accountable point of contact",
      "Milestone-based progress visibility",
      "Clear scope and structured handover"
    ]
  },
  // {
  //   slug: "project-management",
  //   page: "project-management.html",
  //   title: "Project Management",
  //   icon: "clipboard",
  //   confirmed: true,
  //   short:
  //     "Structured coordination of scope, cost, timeline and quality — with visibility at every stage.",
  //   forWho: [
  //     "Clients managing larger or multi-stage projects",
  //     "Owners who want a single accountable coordinator",
  //     "Anyone who wants organised progress reporting"
  //   ],
  //   scope: [
  //     "Scope definition and milestone planning",
  //     "Cost tracking against the agreed estimate",
  //     "Progress reporting and site coordination",
  //     "Quality checkpoints and handover management"
  //   ],
  //   benefits: [
  //     "One accountable point of contact",
  //     "Milestone-based progress visibility",
  //     "Fewer surprises on cost and timeline"
  //   ]
  // }
];

if (typeof window !== "undefined") {
  window.SERVICES = SERVICES;
}
