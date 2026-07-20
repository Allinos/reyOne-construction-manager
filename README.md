# reyOne Construction Manager

A modular, configurable construction-firm management platform designed as a
**reusable commercial product**. The same codebase is deployed per-client
(single-tenant, one MySQL database per deployment), and each client is
customized entirely through configuration — not code changes.

## Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Frontend   | React, Vite, React Router, Tailwind CSS, Axios |
| Backend    | Node.js, Express.js                          |
| Database   | MySQL (via Prisma ORM)                        |
| Auth       | JWT (access + refresh tokens)                |
| Deployment | Ubuntu, PM2, Nginx                           |

## Repository Layout

```
reyOne-construction-manager/
├── server/          Node/Express API (modular)
├── client/          React SPA (Vite + Tailwind, bootstrap-driven)
└── docs/            Architecture & decisions
```

## Core Architectural Principles

1. **Module-based.** Every feature is an independent module with its own
   routes, controller, service, repository, and validation. Disabling a
   module removes its API and UI with zero code changes.
2. **Configuration over code.** Nothing that varies per client is hardcoded.
   Modules, feature flags, lookup data, form fields, and branding all live in
   the database, seeded with sensible defaults.
3. **Single bootstrap.** On login the client fetches one `/api/v1/bootstrap`
   payload (enabled modules + feature flags + branding + the user's
   permissions) and renders everything from it.
4. **Extensible by design.** A polymorphic `attachments` table and the module
   registry mean future modules (File Manager, Attendance, Payroll, …) plug in
   without touching existing code.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Getting Started (server)

```bash
cd server
cp .env.example .env          # set DATABASE_URL + secrets
npm install
npx prisma migrate dev        # create schema
npm run seed                  # default roles, permissions, modules, admin
npm run dev                   # http://localhost:4000/api/v1/health
```

Default super-admin after seeding: `admin@reyone.local` / `Admin@123`
(change immediately in production).

## Getting Started (client)

```bash
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :4000)
```

The client fetches `/api/v1/bootstrap` on login and renders its sidebar and
routes from the enabled-module list — disabling a module in the backend hides
it in the UI with no frontend change.
