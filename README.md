# DW Nirman Engineerings LLP — Website

A production-quality, **static** marketing website for a construction &
engineering firm. Built with **HTML5 + CSS3 + Vanilla JavaScript only** — no
frameworks, no build step, no dependencies. Designed to be fast, SEO-friendly,
fully responsive, and easy to upgrade later to a Node.js/Express + database +
REST API (and, if desired, React/Next.js) architecture.

> **Primary conversion channel is WhatsApp**, not a traditional lead form.

---

## 1. Getting started

It's a static site — just open `index.html` in a browser, or serve the folder:

```bash
# any static server works, e.g.
python3 -m http.server 8080
# then visit http://localhost:8080
```

## 2. Before you go live — REQUIRED edits

All business-specific values live in **`js/config.js`**. Search the codebase
for `REPLACE_WITH_` and `[ ... ]` placeholders and fill in real, **verified**
information only:

| What | Where |
|------|-------|
| WhatsApp number, phone, email | `js/config.js` |
| Service area, office address, business hours | `js/config.js` |
| Google Maps embed, Google Reviews URL | `js/config.js` |
| Social links | `js/config.js` |
| LLPIN / GST / certifications | `js/config.js` (only when verified) |
| Live domain (canonical, sitemap, robots, manifest) | `sitemap.xml`, `robots.txt`, each page's `<link rel="canonical">` |
| Real project data & photos | `data/projects.js` + `assets/images/` |
| Real, consented testimonials | `data/testimonials.js` |
| Hero / section images | `assets/images/` (referenced from data or HTML) |

**Do not invent** statistics, review text, project details, registration
numbers or company history. Placeholders are intentional and clearly marked.

## 3. Project structure

```
/                     root pages (index, about, services, contact, legal, 404…)
                      (Process page removed; Transparent Build stays on home)
/projects/            project detail pages
/blog/                blog index + article
/css/                 style.css (design system), responsive.css, animations.css
/js/                  config.js + modular scripts (see below)
/data/                content layer: projects, services, testimonials, faqs
/assets/              images, icons (favicon.svg), fonts
robots.txt sitemap.xml site.webmanifest
```

### Separation of concerns
- **Content / data** → `data/*.js` (arrays of plain objects)
- **Configuration** → `js/config.js`
- **UI** → HTML + `css/*`
- **Interactions** → `js/*` modules

This separation is what makes a future backend migration straightforward.

### JavaScript modules
| File | Responsibility |
|------|----------------|
| `config.js` | Single source of truth for business values |
| `main.js` | Injects config text; renders services & testimonials |
| `navigation.js` | Sticky header + accessible mobile menu |
| `animations.js` | Lightweight scroll-reveal (IntersectionObserver) |
| `whatsapp.js` | Builds context-aware WhatsApp links (`[data-wa]`) |
| `faq.js` | Accessible FAQ accordion (data- or markup-driven) |
| `projects.js` | Renders project cards + before/after slider |
| `lead.js` | Multi-step "Project Planner" → WhatsApp handoff |
| `modal.js` | Lead-capture popup (auto-opens after 5s, dismissible) |

### Navigation & single-page sections
The **Services, Projects, Reviews and FAQ** nav tabs are on-page sections of
the homepage — clicking them smooth-scrolls to the section (cross-page they
resolve via `index.html#services` etc., with a sticky-header scroll offset).
**About** and **Contact** remain standalone pages. Standalone
`services.html`, `projects.html`, `reviews.html` and `faq.html` pages still
exist (linked from "View all…" buttons) for deep content and SEO.

### Lead popup
A global popup (`#lead-modal`, in every page's footer include) contains the
same Project Planner. It **auto-opens 5 seconds after load, once per browser
session** (so it doesn't nag on every navigation), and is dismissible via the
close button, the backdrop, or Esc. Any element with `data-open-modal` opens
it on demand (e.g. the homepage "Plan Your Project" button).

### Branding
The brand mark is `assets/images/logo.svg` (blue gear + buildings, matching
the DW Nirman logo). To use the exact raster logo instead, drop it in
`assets/images/` and update the two `.brand__logo` `src` references
(header + footer) — or swap the SVG file. Brand colours are derived from the
logo and live as CSS tokens in `css/style.css` (`--color-accent` = logo blue).

**Script load order** (already set on every page): `config.js` → `data/*` →
core modules → page-specific modules.

## 4. Design system

Colours, typography, spacing, radii and shadows are all CSS custom properties
in `css/style.css` (`:root`). Change a token once and it applies everywhere —
never hard-code a colour. Font is **Manrope** (Google Fonts, `display=swap`,
with a system-sans fallback).

## 5. WhatsApp / conversion system

Any element with `data-wa` becomes a WhatsApp link. Context is set via
attributes:

```html
<a data-wa>…</a>                              <!-- default message -->
<a data-wa data-wa-service="Renovation">…</a>  <!-- service message -->
<a data-wa data-wa-project="Villa X">…</a>     <!-- project message -->
<a data-wa data-wa-message="Custom text">…</a> <!-- explicit message -->
```

- Desktop: floating WhatsApp button (bottom-right).
- Mobile: fixed bottom bar — **Call · WhatsApp · Enquire**.

## 6. Upgrading to a backend later (roadmap)

The site is intentionally architected so you can add a backend without a
rewrite. Search the code for `FUTURE BACKEND INTEGRATION` comments. The
recommended path:

```
Website  →  POST /api/leads  →  Node.js + Express  →  Google Sheets API / Database  →  CSV/Excel export (GET /api/leads/export.csv)
```

- The **Project Planner** (`js/lead.js`) already collects a `lead` object
  shaped to match a future `POST /api/leads` payload
  (`name, phone, projectType, location, area, budget, timeline, source,
  landingPage, createdAt`). Today it hands off to WhatsApp and stores nothing.
- Data files (`data/*.js`) can be swapped for `fetch()` calls to
  `GET /api/services`, `/api/projects`, `/api/testimonials`, `/api/faqs`.
- **Never** expose Google API credentials in the static site — those belong
  behind the backend only.

## 7. SEO & performance notes

- Semantic HTML5, unique `<title>`/meta description per page, canonical tags,
  Open Graph tags, JSON-LD (`GeneralContractor` on home, `Article` on blog).
- `sitemap.xml` + `robots.txt` included (update the domain).
- Images use `loading="lazy"` and width/height where applicable to avoid
  layout shift. No render-blocking JS; fonts load with `swap`.
- Respects `prefers-reduced-motion`.

## 8. Accessibility

- Skip link, keyboard-navigable header/menu, `aria-*` on interactive widgets,
  visible focus states, sufficient colour contrast, reduced-motion support.
