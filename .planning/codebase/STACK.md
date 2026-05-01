# Technology Stack

**Analysis Date:** 2026-05-01

## Languages

**Primary:**
- HTML5 - Single-page site markup (`index.html`)
- CSS3 - All styling, inline within `<style>` block in `index.html`
- JavaScript (ES2015+) - Interactive behavior, inline `<script>` block in `index.html`

**Secondary:**
- SVG - Used inline within the evidence board for yarn/string connections (`index.html`)

## Runtime

**Environment:**
- Browser (no server-side runtime)
- Static site — all logic runs client-side

**Package Manager:**
- None — no `package.json`, no lockfile, no build tooling

## Frameworks

**Core:**
- None — vanilla HTML, CSS, and JavaScript with no frameworks or libraries

**Testing:**
- None detected

**Build/Dev:**
- None — no bundler, no transpiler, no build step
- Files are served directly as authored

## Key Dependencies

**Critical:**
- Google Fonts (CDN) — typography via `@import url('https://fonts.googleapis.com/...')` in `index.html` line 11
  - Families loaded: Boogaloo, Fredoka One, Permanent Marker, Special Elite

**Infrastructure:**
- Netlify — static hosting and deployment (configured in `netlify.toml`)

## Configuration

**Environment:**
- No `.env` files detected
- No environment variables used at runtime (static site)

**Build:**
- `netlify.toml` — Netlify deployment configuration
  - `publish = "."` — serves the repo root directly
  - `NODE_VERSION = "20"` — Node 20 specified in build environment (for Netlify's build runner, though no build step is defined)
  - Security headers set for all routes: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`

## Platform Requirements

**Development:**
- Any text editor and a browser
- No local server required (static HTML file can be opened directly)

**Production:**
- Netlify static hosting
- Custom domain: `www.powderrhythm.com` (configured via `CNAME`)

## Assets

**Images:**
- `1000002317.jpg` (~440 KB) — referenced locally
- `1000002351.jpg` (~621 KB) — referenced locally

**Fonts:**
- Loaded from Google Fonts CDN at page render time

**Scripts:**
- Single inline `<script>` block (lines 2414–2656 of `index.html`)
- Responsibilities: star/snowflake generation, elapsed-time counter, interactive evidence board (drag + SVG yarn), interactive brick wall teardown

---

*Stack analysis: 2026-05-01*
