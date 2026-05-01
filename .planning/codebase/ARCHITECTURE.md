<!-- refreshed: 2026-05-01 -->
# Architecture

**Analysis Date:** 2026-05-01

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              Browser (Client-Side Rendering)                 │
├──────────────────────────────────────────────────────────────┤
│                     index.html                               │
│  ┌──────────────┬──────────────────┬────────────────────┐   │
│  │  Inline CSS  │   HTML Content   │  Inline JavaScript  │   │
│  │  (~1574 ln)  │  (blog entries,  │  (DOM generation,   │   │
│  │  (all styles │   interactive    │   interactivity,    │   │
│  │  in <style>) │   widgets)       │   timers)           │   │
│  └──────────────┴──────────────────┴────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │                                         │
         ▼                                         ▼
┌──────────────────────┐               ┌─────────────────────┐
│  Google Fonts CDN    │               │  Local Image Assets  │
│  (4 typefaces via    │               │  1000002317.jpg      │
│   @import)           │               │  1000002351.jpg      │
└──────────────────────┘               └─────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Netlify (Static Host)                       │
│  - Publishes from repo root "."                             │
│  - Custom domain: www.powderrhythm.com (CNAME)              │
│  - Security headers applied at CDN edge                      │
└─────────────────────────────────────────────────────────────┘
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

**Overall:** Single-file static site (monolithic HTML)

**Key Characteristics:**
- Zero build step — the repository root is served directly by Netlify (`publish = "."`)
- All CSS is in a single `<style>` block inside `<head>`; no external stylesheet
- All JavaScript is in a single `<script>` block at the bottom of `<body>`; no external scripts
- No JavaScript framework, no npm dependencies, no bundler
- Fonts loaded via Google Fonts `@import` URL (only external dependency at runtime)
- Content is hard-coded HTML; no CMS, no templating engine, no database

## Layers

**Presentation Layer (CSS):**
- Purpose: Visual identity — psychedelic neon aesthetic, animations, responsive breakpoints
- Location: `index.html` `<style>` block, lines 10–1574
- Contains: CSS custom properties (design tokens), component classes, keyframe animations, two `@media` breakpoints (`max-width: 640px`, `max-width: 600px`)
- Depends on: Google Fonts CDN
- Used by: All HTML in `<body>`

**Content Layer (HTML):**
- Purpose: Blog entries, copy, structural markup
- Location: `index.html` `<body>`, lines 1577–2413
- Contains: `<article>` elements per entry, `<nav>`, `<header>`, `<footer>`, widget HTML (board, wall, counter)
- Depends on: CSS classes defined above; images on disk
- Used by: Browser render tree, JavaScript selectors

**Behavior Layer (JavaScript):**
- Purpose: Runtime interactivity — ambient visuals, counter, draggable evidence board, brick teardown
- Location: `index.html` `<script>` block, lines 2414–2656
- Contains: Four IIFE/function blocks, each scoped to a widget
- Depends on: DOM IDs/classes set in the HTML layer
- Used by: Browser event loop

## Data Flow

### Page Load

1. Browser fetches `index.html` from Netlify CDN
2. `<style>` parsed; Google Fonts loaded asynchronously via `@import`
3. HTML body rendered: fixed background layers, sticky nav, marquee, header, blog feed, footer
4. `<script>` executes at end of body:
   - 120 star `<div>` elements injected into `#stars`
   - 25 snowflake `<div>` elements injected into `#snowflakes`
   - Count-up timer starts (ticking from `2026-04-02T00:00:00`)
   - Evidence board pins placed by `data-x`/`data-y` percentages; SVG yarn drawn
   - Brick teardown event listeners attached to all `.brick` buttons

### Evidence Board Interaction

1. User grabs a `.pin-item` (pointerdown)
2. `drag` state captures offset from board origin
3. pointermove updates `pin.style.left/top` and calls `drawStrings()`
4. `drawStrings()` recomputes SVG `<path>` quadratic Bézier curves for each connection pair
5. pointerup/cancel saves back to `data-x`/`data-y` for resize-safe reflow

### Brick Teardown Interaction

1. User clicks a `.brick` button
2. `brick.classList.add('fallen')` triggers CSS transition (translateY + rotate + opacity → 0)
3. Counter in `#bricks-left` decrements
4. When all 12 bricks fallen: `#wall-finale` element receives `.shown` class, revealing message via CSS `max-height` transition

### Count-Up Timer

1. `updateCounter()` called immediately on load
2. `setInterval(updateCounter, 1000)` updates `#cd-days`, `#cd-hours`, `#cd-mins`, `#cd-secs` every second
3. Counts elapsed time since `2026-04-02T00:00:00` (first blog entry date)

## Key Abstractions

**Blog Entry (`<article class="entry">`):**
- Purpose: Self-contained dated post with header, content panels, testimonials, and optional interactive widget
- Examples: `#wall`, `#evidence`, `#circus`, `#the-thing`
- Pattern: `entry-header` (date + rule + tag) followed by one or more `.section > .panel` blocks, optional `.testimonial` blocks, optional widget

**Panel (`.panel`):**
- Purpose: Styled content card with neon-teal border and subtle grid overlay via `::before`
- Examples: Used inside every entry for prose sections
- Pattern: Semantic container; `panel-title` optional heading; `<p>` tags for prose

**Pin Item (`.pin-item`):**
- Purpose: Draggable evidence card on the cork board; types: `paper`, `napkin`, `sticky`, `clipping`, `receipt`, `photo`, `setlist`
- Examples: Inside `#board` in the evidence entry
- Pattern: `data-id`, `data-x`, `data-y` attributes drive JS placement and string connections; `.pin-dot` for pushpin visual

**Brick (`.brick`):**
- Purpose: Clickable `<button>` overlaid on hidden `.brick-text`; clicking "falls" the brick to reveal the text beneath
- Pattern: CSS custom property `--fall-rot` set randomly per brick at runtime

## Entry Points

**Site Entry:**
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

**What happens:** Images are referenced as `1000002317.jpg` and `1000002351.jpg` (phone camera roll filenames).
**Why it's wrong:** Filenames carry no semantic meaning; difficult to identify which image is which without opening the HTML.
**Do this instead:** Rename to descriptive slugs, e.g., `poster-circus-tigers.jpg` and `roller-dome-wall-construction.jpg`, and update the `src` attributes in `index.html`.

### No alt-text fallback strategy for decorative CSS pseudo-elements

**What happens:** Complex visual effects (cork texture, tinted photo overlays) are implemented entirely in CSS `::before`/`::after` with no ARIA labeling.
**Why it's wrong:** Screen reader users receive no description of these decorative elements.
**Do this instead:** Use `aria-hidden="true"` on purely decorative wrapper elements; ensure the `<img>` `alt` attributes (which are present and descriptive) carry the full semantic load.

## Error Handling

**Strategy:** None — static site with no server-side logic and no async data fetching beyond fonts.

**Patterns:**
- Evidence board and brick wall scripts both guard with `if (!board) return` / `if (!wall) return` before attaching event listeners
- Count-up timer has no error boundary; silently fails if DOM IDs are missing

## Cross-Cutting Concerns

**Responsive design:** Two breakpoints (`max-width: 640px` for evidence board pin cards; `max-width: 600px` for wall/door components); `clamp()` used for fluid font sizing on title and mountain scene
**Animation performance:** Ambient animations (stars, snowflakes, marquee) use `transform` and `opacity` only — GPU-compositable properties
**Security headers:** Defined in `netlify.toml`; `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` applied at CDN edge

---

*Architecture analysis: 2026-05-01*
