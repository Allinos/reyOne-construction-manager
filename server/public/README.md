# Static assets

Files here are served from the site root.

## Brand logo

To use your own logo across the app (login screen + sidebar), drop a file named
**`logo.png`** in this folder:

```
client/public/logo.png
```

`BrandLogo` (`src/components/BrandLogo.jsx`) loads `/logo.png` automatically. If
the file is missing, it falls back to a built-in on-brand infinity mark, so the
UI always looks finished. A square, transparent PNG (e.g. 512×512) works best.
