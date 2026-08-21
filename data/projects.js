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
    page: "",
    name: "A Category G+2",
    location: "Jamuguri, Nagaon",
    type: "Residential",
    scope: "Ground-up independent house",
    // year: "[Year]",
    //  image:"assets/images/project-1.jpeg", // e.g. "assets/images/project-01.jpg"
    image: "assets/images/project-01.jpeg",
    imageAlt:
      "Placeholder for a residential construction project by DW Nirman Engineerings",
    placeholder: false,
    summary:
      "Project with Foundation ,Ground floor, full finishing project of Mr. Papu kumar Nath known as P.K (Content creator).",
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
      Location: "[Location]",
      Scope: "Ground-up construction",
      Status: "[Completed / In progress]",
      // Year: "[Year]",
    },
    gallery: [], // add real image paths when available
  },
  {
    slug: "project-02",
    page: "",
    name: "G+1 Full Finishing",
    location: "Senchoa, Nagaon",
    type: "Residential ",
    scope: "Retail / office space",
    // year: "[Year]",
    image: "assets/images/project-02.jpeg",
    imageAlt:
      "Placeholder for a commercial construction project by DW Nirman Engineerings",
    placeholder: false,
    summary:
      "A wonderful project delivered to <strong>Mr. Pankaj Baruah & Ranjan Baruah</strong>.",
    requirement: "[Client requirement to be supplied.]",
    challenge: "[Project challenge to be supplied.]",
    approach: "[Approach to be supplied.]",
    execution: "[Execution notes to be supplied.]",
    outcome: "[Outcome to be supplied once verified.]",
    details: {
      "Project Type": "Commercial Construction",
      Location: "[Location]",
      Scope: "Commercial build",
      Status: "[Completed / In progress]",
      // Year: "[Year]",
    },
    gallery: [],
  },
  {
    slug: "project-03",
    page: "",
    name: "A Category Assam Type ",
    location: "Baulabari, Nagaon",
    type: "Residential",
    scope: "Full home renovation",
    // year: "[Year]",
    image: "assets/images/project-03.jpeg",
    imageAlt: "Placeholder for a renovation project by DW Nirman Engineerings",
    placeholder: false,
    hasBeforeAfter: true, // renovation projects can show a before/after slider
    summary:
      "Assam Type Banglow project of <strong>Mrs. Rinku Moni Devi</strong>",
    requirement: "[Client requirement to be supplied.]",
    challenge: "[Project challenge to be supplied.]",
    approach: "[Approach to be supplied.]",
    execution: "[Execution notes to be supplied.]",
    outcome: "[Outcome to be supplied once verified.]",
    details: {
      "Project Type": "Renovation & Remodeling",
      Location: "[Location]",
      Scope: "Renovation & remodeling",
      Status: "[Completed / In progress]",
      // Year: "[Year]",
    },
    gallery: [],
  },
  {
    slug: "project-04",
    page: "",
    name: "Semi Dulpex Premium category",
    location: "Kuruabahi, Nagaon",
    type: "Residential Construction",
    scope: "Independent villa",
    // year: "[Year]",
    image: "assets/images/project-04.jpeg",
    imageAlt:
      "Placeholder for a villa construction project by DW Nirman Engineerings",
    placeholder: false,
    summary:
      "Delivered with clear scope, transparent costing and quality checks to Client <strong>Mrs. Banashri Bhuyan</strong>.",
    requirement: "[Client requirement to be supplied.]",
    challenge: "[Project challenge to be supplied.]",
    approach: "[Approach to be supplied.]",
    execution: "[Execution notes to be supplied.]",
    outcome: "[Outcome to be supplied once verified.]",
    details: {
      "Project Type": "Residential Construction",
      Location: "[Location]",
      Scope: "Villa construction",
      Status: "[Completed / In progress]",
      // Year: "[Year]",
    },
    gallery: [],
  },
  {
    slug: "project-05",
    page: "",
    name: "Commercial cum Residential",
    location: "Barama Road, Nalbari",
    type: "Commercial Construction",
    // scope: "Office space & fit-out",
    // year: "[Year]",
    // image: "assets/images/project-05.png",
    image: "assets/images/image1.jpg",
    imageAlt:
      "Placeholder for a commercial office fit-out project by DW Nirman Engineerings",
    placeholder: false,
    summary:
      "A commercial cum residential project of <strong>Mr. Papu Moni Deka</strong>.",
    requirement: "[Client requirement to be supplied.]",
    challenge: "[Project challenge to be supplied.]",
    approach: "[Approach to be supplied.]",
    execution: "[Execution notes to be supplied.]",
    outcome: "[Outcome to be supplied once verified.]",
    details: {
      "Project Type": "Commercial Construction",
      Location: "[Location]",
      Scope: "Office fit-out",
      Status: "[Completed / In progress]",
      // Year: "[Year]",
    },
    gallery: [],
  },
  {
    slug: "project-06",
    page: "",
    name: "Residential Project",
    location: "Dolbari, Morigaon",
    type: "Residential",
    scope: "Site & civil works",
    // year: "[Year]",
    image: "assets/images/project-06.jpeg",
    imageAlt:
      "Placeholder for a residential project by DW Nirman Engineerings",
    placeholder: false,
    summary:
      "A Residential project of <strong>Mr. Afsaruddin Ahmed</strong>.",
    requirement: "[Client requirement to be supplied.]",
    challenge: "[Project challenge to be supplied.]",
    approach: "[Approach to be supplied.]",
    execution: "[Execution notes to be supplied.]",
    outcome: "[Outcome to be supplied once verified.]",
    details: {
      "Project Type": "Residential",
      Location: "[Location]",
      Scope: "Civil & site works",
      Status: "[Completed / In progress]",
      // Year: "[Year]",
    },
    gallery: [],
  },
];

if (typeof window !== "undefined") {
  window.PROJECTS = PROJECTS;
}
