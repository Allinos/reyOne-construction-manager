/* =============================================================
 * data/projects.js — Project portfolio (content layer)
 * -------------------------------------------------------------
 * FUTURE BACKEND INTEGRATION:
 *   Replace with: GET /api/projects
 *
 * NOTE ON ACCURACY:
 *   Do NOT invent project data. Every entry below is marked as a
 *   PLACEHOLDER until the company supplies real project details
 *   and images. `placeholder: true` renders a clearly marked
 *   sample so the layout is testable without faking company work.
 *
 * IMAGE GUIDANCE:
 *   - `image` should point to a real project photo when available.
 *   - Until then, the UI renders a labelled placeholder block.
 *   - Provide width/height so images do not cause layout shift.
 * ============================================================= */

var PROJECTS = [
  {
    slug: "project-01",
    page: "projects/project-01.html",
    name: "[Project Name — Residence]",
    location: "[Location]",
    type: "Residential Construction",
    scope: "Ground-up independent house",
    year: "[Year]",
    image: "", // e.g. "assets/images/project-01.jpg"
    imageAlt: "Placeholder for a residential construction project by DW Nirman Engineerings",
    placeholder: true,
    summary:
      "A structured residential build delivered through clear scope, milestone planning and stage-wise quality checks.",
    requirement:
      "[Client requirement to be supplied — e.g. a durable family home delivered on a predictable timeline.]",
    challenge:
      "[Project challenge to be supplied — e.g. site constraints, phasing or budget clarity.]",
    approach:
      "[Approach to be supplied — how scope, costing and milestones were structured.]",
    execution:
      "[Execution notes to be supplied — key stages, quality checkpoints and coordination.]",
    outcome:
      "[Outcome to be supplied — handover result and client feedback, once verified.]",
    details: {
      "Project Type": "Residential Construction",
      "Location": "[Location]",
      "Scope": "Ground-up construction",
      "Status": "[Completed / In progress]",
      "Year": "[Year]"
    },
    gallery: [] // add real image paths when available
  },
  {
    slug: "project-02",
    page: "projects/project-02.html",
    name: "[Project Name — Commercial]",
    location: "[Location]",
    type: "Commercial Construction",
    scope: "Retail / office space",
    year: "[Year]",
    image: "",
    imageAlt: "Placeholder for a commercial construction project by DW Nirman Engineerings",
    placeholder: true,
    summary:
      "A commercial space executed with structured milestones and transparent progress reporting.",
    requirement: "[Client requirement to be supplied.]",
    challenge: "[Project challenge to be supplied.]",
    approach: "[Approach to be supplied.]",
    execution: "[Execution notes to be supplied.]",
    outcome: "[Outcome to be supplied once verified.]",
    details: {
      "Project Type": "Commercial Construction",
      "Location": "[Location]",
      "Scope": "Commercial build",
      "Status": "[Completed / In progress]",
      "Year": "[Year]"
    },
    gallery: []
  },
  {
    slug: "project-03",
    page: "projects/project-03.html",
    name: "[Project Name — Renovation]",
    location: "[Location]",
    type: "Renovation & Remodeling",
    scope: "Full home renovation",
    year: "[Year]",
    image: "",
    imageAlt: "Placeholder for a renovation project by DW Nirman Engineerings",
    placeholder: true,
    hasBeforeAfter: true, // renovation projects can show a before/after slider
    summary:
      "A renovation delivered with a realistic scope after site assessment and phased, low-disruption execution.",
    requirement: "[Client requirement to be supplied.]",
    challenge: "[Project challenge to be supplied.]",
    approach: "[Approach to be supplied.]",
    execution: "[Execution notes to be supplied.]",
    outcome: "[Outcome to be supplied once verified.]",
    details: {
      "Project Type": "Renovation & Remodeling",
      "Location": "[Location]",
      "Scope": "Renovation & remodeling",
      "Status": "[Completed / In progress]",
      "Year": "[Year]"
    },
    gallery: []
  }
];

if (typeof window !== "undefined") {
  window.PROJECTS = PROJECTS;
}
