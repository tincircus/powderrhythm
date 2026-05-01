# External Integrations

**Analysis Date:** 2026-05-01

## APIs & External Services

**Typography CDN:**
- Google Fonts — delivers four typefaces at page load
  - Endpoint: `https://fonts.googleapis.com/css2?family=Boogaloo&family=Fredoka+One&family=Permanent+Marker&family=Special+Elite&display=swap`
  - Loaded via CSS `@import` inside the `<style>` block in `index.html` line 11
  - Auth: None (public CDN)

No other external APIs or third-party services are integrated.

## Data Storage

**Databases:**
- None — no database used

**File Storage:**
- Local filesystem only — images (`1000002317.jpg`, `1000002351.jpg`) are committed to the repository and served as static assets

**Caching:**
- None — no explicit caching layer; browser default caching applies

## Authentication & Identity

**Auth Provider:**
- None — no authentication or user accounts

## Monitoring & Observability

**Error Tracking:**
- None detected

**Analytics:**
- None detected — no Google Analytics, Plausible, Fathom, or similar script found in `index.html`

**Logs:**
- None — static site; no server-side logging

## CI/CD & Deployment

**Hosting:**
- Netlify — static site hosting
  - Configured via `netlify.toml`
  - Publish directory: `.` (repo root)
  - Deployment triggers on push to connected branch (standard Netlify Git integration)

**CI Pipeline:**
- Netlify's built-in CI handles deployment; no separate CI service (GitHub Actions, CircleCI, etc.) detected

**Custom Domain:**
- `www.powderrhythm.com` — configured via `CNAME` file (Netlify custom domain)

## Environment Configuration

**Required env vars:**
- None — the site has no runtime environment variables

**Secrets location:**
- No secrets used

## Security Headers (via Netlify)

Set globally for all routes in `netlify.toml`:
- `X-Frame-Options: DENY` — prevents clickjacking via iframes
- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — controls referrer information

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integration audit: 2026-05-01*
