<!-- GSD:project-start source:PROJECT.md -->
## Project

**Powder Rhythm Ticketing**

A lightweight event ticketing backend for Powder Rhythm, a record store and music venue in Baker City, Oregon. Buyers purchase tickets via Square, receive a QR code on a confirmation page, and present it at the door to be scanned from a phone browser. Lives in the `/ticketing` subfolder of the main repo, served from a subdomain (`tickets.powderrhythm.com`) via Railway.

**Core Value:** A buyer can purchase a ticket and present a valid QR code at the door without any friction — no account, no app, no email required.

### Constraints

- **Tech stack:** Node.js + Express (Square SDK best supported here)
- **Database:** SQLite for dev, Postgres for prod (Railway includes managed Postgres)
- **Payments:** Square Checkout Links API only — no custom card UI, no PCI scope
- **Hosting:** Railway — supports webhooks, Postgres, easy env vars, free tier available
- **Timeline:** Must be live before May 29, 2026
- **Auth:** Single shared password per env var for admin and scanner routes — no user management
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- HTML5 - Single-page site markup (`index.html`)
- CSS3 - All styling, inline within `<style>` block in `index.html`
- JavaScript (ES2015+) - Interactive behavior, inline `<script>` block in `index.html`
- SVG - Used inline within the evidence board for yarn/string connections (`index.html`)
## Runtime
- Browser (no server-side runtime)
- Static site — all logic runs client-side
- None — no `package.json`, no lockfile, no build tooling
## Frameworks
- None — vanilla HTML, CSS, and JavaScript with no frameworks or libraries
- None detected
- None — no bundler, no transpiler, no build step
- Files are served directly as authored
## Key Dependencies
- Google Fonts (CDN) — typography via `@import url('https://fonts.googleapis.com/...')` in `index.html` line 11
- Netlify — static hosting and deployment (configured in `netlify.toml`)
## Configuration
- No `.env` files detected
- No environment variables used at runtime (static site)
- `netlify.toml` — Netlify deployment configuration
## Platform Requirements
- Any text editor and a browser
- No local server required (static HTML file can be opened directly)
- Netlify static hosting
- Custom domain: `www.powderrhythm.com` (configured via `CNAME`)
## Assets
- `1000002317.jpg` (~440 KB) — referenced locally
- `1000002351.jpg` (~621 KB) — referenced locally
- Loaded from Google Fonts CDN at page render time
- Single inline `<script>` block (lines 2414–2656 of `index.html`)
- Responsibilities: star/snowflake generation, elapsed-time counter, interactive evidence board (drag + SVG yarn), interactive brick wall teardown
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Overview
## HTML Structure
- `<nav>` with `aria-label` for site navigation
- `<header>` for the page header
- `<article>` for each blog entry (entries use `id` attributes for anchor navigation)
- `<footer>` for the page footer
## CSS Naming Conventions
#tweaks-panel.open { }
## CSS Architecture
- `@media (max-width: 640px)` — evidence board and pin card sizing
- `@media (max-width: 600px)` — door wrap, brick wall, and wall finale sizing
| Font | Role |
|------|------|
| `'Special Elite'` | Body text, prose, paper-card content |
| `'Permanent Marker'` | Headings, panel titles, bold UI labels |
| `'Fredoka One'` | Subtitle, countdown numerals, receipt headlines |
| `'Boogaloo'` | Navigation, metadata, labels, captions, UI chrome |
| Layer | z-index |
|-------|---------|
| Fixed background stars | 0 |
| Snowflakes | 1 |
| Evidence board strings | 2 |
| Pin items | 3 |
| Board title tape / drag hint | 4–5 |
| Header, blog feed | 5 |
| Marquee | 10 |
| Corner stickers | 20 |
| Pin items while dragging | 20 |
| Sticky nav | 100 |
| Tweaks panel | 200 |
## JavaScript Conventions
- `document.getElementById` for unique elements
- `querySelectorAll` / `querySelector` for scoped lookups within components
- `Array.from(...)` to convert NodeLists when iteration methods are needed
- `classList.add` / `classList.remove` / `classList.contains` for state toggling
- `style.cssText` for bulk inline style assignment during procedural generation
- `innerHTML` for SVG string construction (evidence board strings)
## Accessibility Patterns
## Comment Conventions
## Content Conventions (from `STYLE_GUIDE.md`)
- **No em-dashes in prose.** Use periods, commas, or ellipses. Em-dashes are permitted only in testimonial attributions (`— me, at the gas station`).
- **Exclamation points used sparingly.** Excitement conveyed through word choice, not punctuation.
- **No internet-slang.** ("slaps", "no cap", "hits different", "manifesting" are prohibited.)
- **No marketing language.** No calls-to-action that sound like copy.
- **Testimonial blocks** quote the character speaking out loud. Attribution uses an em-dash: `— me, [location], [time]`.
- **Entries are dated**, newest-first. Dates appear in the `.entry-date` span.
- **Navigation** stays anchor-link based ("lo-fi").
- **All-caps text in UI** (marquees, headings) represents the site's energy, not the prose register.
## Formatting Standards
- 2-space indentation for HTML
- 4-space indentation inside `<style>` (CSS rules)
- 4-space indentation inside `<script>` (JS)
- Opening braces on the same line as selectors/function declarations
- Closing braces on their own line
- One blank line between CSS rule blocks
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| Inline `<style>` block | All visual styling — layout, animations, component variants | `index.html` lines 10–1574 |
| `<nav class="site-nav">` | Sticky anchor-link navigation to blog entries | `index.html` ~line 1590 |
| `.marquee-wrap` / `.marquee-inner` | CSS-animated scrolling text banners (top + bottom) | `index.html` ~line 1608 |
| `<header>` | Hero area — title, eyebrow text, subtitle, tagline | `index.html` ~line 1617 |
| `<div class="blog-feed">` | Ordered container for all blog `<article>` entries | `index.html` ~line 1634 |
| `<article class="entry" id="wall">` | "The Wall" entry — newest, includes interactive brick teardown | `index.html` ~line 1639 |
| `<article class="entry" id="evidence">` | Evidence Board entry — draggable pin board with SVG yarn | `index.html` ~line 1884 |
| `<article class="entry" id="circus">` | Circus Poster entry — poster image with styled frame | `index.html` (between evidence and the-thing) |
| `<article class="entry" id="the-thing">` | Origin entry — first post, why-good list, letter, facts | `index.html` ~line 2206 |
| `#stars` + `#snowflakes` | JS-generated ambient background particles | `index.html` (DOM targets) |
| `#tweaks-panel` | Fixed floating panel for vibe/mode toggles | `index.html` ~line 988 (CSS), HTML in body |
| Inline `<script>` | Stars generation, snowflakes, live count-up timer, evidence board drag + SVG strings, brick teardown | `index.html` lines 2414–2656 |
| `<footer>` | Minimal site credit line | `index.html` ~line 2407 |
## Pattern Overview
- Zero build step — the repository root is served directly by Netlify (`publish = "."`)
- All CSS is in a single `<style>` block inside `<head>`; no external stylesheet
- All JavaScript is in a single `<script>` block at the bottom of `<body>`; no external scripts
- No JavaScript framework, no npm dependencies, no bundler
- Fonts loaded via Google Fonts `@import` URL (only external dependency at runtime)
- Content is hard-coded HTML; no CMS, no templating engine, no database
## Layers
- Purpose: Visual identity — psychedelic neon aesthetic, animations, responsive breakpoints
- Location: `index.html` `<style>` block, lines 10–1574
- Contains: CSS custom properties (design tokens), component classes, keyframe animations, two `@media` breakpoints (`max-width: 640px`, `max-width: 600px`)
- Depends on: Google Fonts CDN
- Used by: All HTML in `<body>`
- Purpose: Blog entries, copy, structural markup
- Location: `index.html` `<body>`, lines 1577–2413
- Contains: `<article>` elements per entry, `<nav>`, `<header>`, `<footer>`, widget HTML (board, wall, counter)
- Depends on: CSS classes defined above; images on disk
- Used by: Browser render tree, JavaScript selectors
- Purpose: Runtime interactivity — ambient visuals, counter, draggable evidence board, brick teardown
- Location: `index.html` `<script>` block, lines 2414–2656
- Contains: Four IIFE/function blocks, each scoped to a widget
- Depends on: DOM IDs/classes set in the HTML layer
- Used by: Browser event loop
## Data Flow
### Page Load
### Evidence Board Interaction
### Brick Teardown Interaction
### Count-Up Timer
## Key Abstractions
- Purpose: Self-contained dated post with header, content panels, testimonials, and optional interactive widget
- Examples: `#wall`, `#evidence`, `#circus`, `#the-thing`
- Pattern: `entry-header` (date + rule + tag) followed by one or more `.section > .panel` blocks, optional `.testimonial` blocks, optional widget
- Purpose: Styled content card with neon-teal border and subtle grid overlay via `::before`
- Examples: Used inside every entry for prose sections
- Pattern: Semantic container; `panel-title` optional heading; `<p>` tags for prose
- Purpose: Draggable evidence card on the cork board; types: `paper`, `napkin`, `sticky`, `clipping`, `receipt`, `photo`, `setlist`
- Examples: Inside `#board` in the evidence entry
- Pattern: `data-id`, `data-x`, `data-y` attributes drive JS placement and string connections; `.pin-dot` for pushpin visual
- Purpose: Clickable `<button>` overlaid on hidden `.brick-text`; clicking "falls" the brick to reveal the text beneath
- Pattern: CSS custom property `--fall-rot` set randomly per brick at runtime
## Entry Points
- Location: `index.html` (root)
- Triggers: Any HTTP request to `www.powderrhythm.com`
- Responsibilities: Delivers the complete site — all styles, all content, all interactivity in one file
## Architectural Constraints
- **No build step:** Changes require direct edits to `index.html`; no preprocessing or compilation
- **Single file coupling:** CSS, HTML, and JS are co-located; changes to one layer require reading context of the others
- **Global state:** JavaScript state is scoped to IIFE closures; `drag` object (evidence board) and `fallen` counter (brick wall) are module-level within their IIFEs
- **Font dependency:** Page relies on Google Fonts CDN; offline or blocked CDN degrades typography to browser fallbacks
- **No state persistence:** Interactive widget state (pin positions, fallen bricks) resets on page reload
- **Image filenames are opaque:** `1000002317.jpg` and `1000002351.jpg` are device-generated names with no semantic meaning
## Anti-Patterns
### Opaque image filenames
### No alt-text fallback strategy for decorative CSS pseudo-elements
## Error Handling
- Evidence board and brick wall scripts both guard with `if (!board) return` / `if (!wall) return` before attaching event listeners
- Count-up timer has no error boundary; silently fails if DOM IDs are missing
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
