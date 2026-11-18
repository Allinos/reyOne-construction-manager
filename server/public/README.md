# server/public

Static hosting folder. Drop a built frontend (e.g. a Vite/React `dist/` output)
here and the API server will serve it automatically:

- Files in this folder are served at the site root (`/`).
- Any non-API `GET` request that doesn't match a file falls back to
  `index.html` (SPA client-side routing support).
- API routes (`/api/v1/...`) and `/health` are unaffected.

To deploy the client into this folder:

```bash
cd client
npm run build
cp -r dist/* ../server/public/
```

The API also stays reachable at `/api/v1`. Build artifacts copied here are
gitignored (except this README) so they don't bloat the repo.
