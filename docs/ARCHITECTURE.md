# Architecture

## 1. Deployment / Tenancy Model — Single-tenant per deployment

Each client runs their own instance (own Node process, own MySQL database)
from the **same codebase**. There is no `tenant_id`; isolation is physical.

Why: SMB construction firms, a full-database backup requirement, and
per-client form/branding customization all favor physical isolation. It keeps
every query simple and makes the "download entire DB backup" feature a plain
`mysqldump`. Per-client differences are expressed purely as different rows in
the `settings` / `modules` / lookup tables of that client's database.

## 2. Module System

A module is a self-contained folder under `server/src/modules/<key>/` with:

```
<key>.module.js       Manifest: key, name, basePath, permissions, registerRoutes, isCore, dependsOn
<key>.routes.js       Express router
<key>.controller.js   HTTP layer (thin — parse req, call service, send response)
<key>.service.js      Business logic
<key>.repository.js    Data access (wraps Prisma)
<key>.validation.js   Zod schemas
```

### Enable / disable

- The `modules` table stores `{ key, enabled, isCore }`.
- On boot the **registry** (`core/modules/registry.js`) discovers every
  `*.module.js` manifest, checks the DB, and mounts routes **only for enabled
  modules**. Core modules (`isCore = true`) are always mounted.
- Disabled modules return `404`. The frontend hides their nav + routes because
  the enabled-module list is part of the bootstrap payload.
- Manifests declare `dependsOn` so the Module Manager can refuse incoherent
  states (e.g. Finance requires Projects).

## 3. Configuration Layers

| Kind | Where it lives | Example |
|------|----------------|---------|
| Module on/off | `modules` table | Disable Finance |
| Feature flag inside a module | `settings` table | Projects → show "Advance Amount" |
| Custom form fields | `field_definitions` + JSON value column | Project form ⚙️ |
| Lookup / reference data | dedicated tables | categories, statuses, payment methods |
| Branding | `company` singleton | name, logo, colors |

## 4. RBAC — permission-based, roles are bundles

- **Permissions** are strings `module.action` (`projects.create`, `users.read`).
- **Roles** map to a set of permissions. Seven default roles are seeded;
  more can be added at runtime.
- The Owner role holds the wildcard `*`.
- `authenticate` loads the user + role + permission keys onto `req.user`.
  `authorize('projects.create')` checks membership (or `*`).

## 5. Correctness Decisions

- **Money** is `Decimal(15,2)`, never float.
- **Account balances** are derived from an immutable transaction/ledger, not
  a stored mutable number. Payment writes run inside a DB transaction.
- **Project phases** are *snapshotted* onto each project at creation from a
  template, so editing a template never rewrites historical projects.
- **Custom fields**: standard fields are real columns; client-specific fields
  live in a `custom_fields` JSON column governed by `field_definitions`.
- **Attachments** use one polymorphic table (`entity_type`, `entity_id`) so
  the future File Manager attaches to any module without a migration.

## 6. Cross-cutting Standards

- **Response envelope:** `{ success, data, meta }` / `{ success, error }`.
- **Errors:** a single `AppError` + central error handler; no leaking stacks.
- **Validation:** Zod schemas per module via a `validate` middleware.
- **Auth:** short-lived JWT access token + rotating refresh token (hashed at
  rest). Password reset + change-password included.
- **Activity log:** middleware records mutating actions to `activity_logs`.
- **API versioning:** everything under `/api/v1`.

## 7. Build Order (Phase 1)

1. **Foundation / chassis** — registry, core schema, middleware, seed. *(this step)*
2. **Auth** — login, refresh, me, change/reset password. *(this step)*
3. **Users / Roles / Permissions** endpoints.
4. **Settings / Module Manager / Activity Logs / Bootstrap**.
5. **Client foundation** — theme, layout, bootstrap-driven nav, auth.
6. **Projects** (+ phase templates & custom fields).
7. **Finance** (ledger, project + company).
8. **Dashboard** (aggregations last).
