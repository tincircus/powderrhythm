# Coding Conventions

**Analysis Date:** 2026-05-01

## Overview

This is a single-file static site: all HTML, CSS, and JavaScript live in `index.html`. There is no build step, no preprocessor, and no separate asset pipeline. All conventions described here are observed in that one file.

---

## HTML Structure

**Document type:** Standard HTML5 (`<!DOCTYPE html>`) with `lang="en"` on `<html>`.

**Semantic elements used:**
- `<nav>` with `aria-label` for site navigation
- `<header>` for the page header
- `<article>` for each blog entry (entries use `id` attributes for anchor navigation)
- `<footer>` for the page footer

**Entry markup pattern:**
```html
<article class="entry" id="wall">
  <div class="entry-header">
    <span class="entry-date">April 28, 2026</span>
    <div class="entry-rule"></div>
    <span class="entry-tag">NEW</span>
  </div>
  <div class="section">
    <div class="panel">
      <div class="panel-title">...</div>
      <p>...</p>
    </div>
  </div>
</article>
```

**Interactive elements:** Interactive controls use semantic `<button type="button">` elements, not `<div>` click handlers.

```html
<button class="brick" type="button"><span class="brick-label">...</span></button>
```

**Navigation:** Old-school anchor links. Each blog entry has a unique `id`; nav items use `href="#entry-id"`. No JavaScript routing.

**Inline styles:** Used sparingly for one-off per-element overrides (e.g., `margin-top`, `text-align`, specific color/font overrides that don't warrant a separate class). Structural layout always uses classes.

---

## CSS Naming Conventions

**Approach:** Semantic, component-oriented class names. Not BEM, not utility-first. Names describe the component's role or content, not its visual properties.

**Pattern:** kebab-case for all class names and IDs.

```css
/* Good: component names */
.entry-header { }
.entry-date { }
.pin-card { }
.brick-wall { }
.countdown-box { }
.wall-finale { }
.bricks-progress { }

/* Modifier pattern: base class + descriptor class */
.pin-card.paper { }
.pin-card.napkin { }
.pin-card.sticky { }
.pin-card.sticky.pink { }
.pin-item.pin-teal { }
.pin-item.pin-yellow { }
.brick.fallen { }
#tweaks-panel.open { }
```

**State classes:** Applied via JavaScript to reflect component state. Examples: `.fallen` (brick removed), `.dragging` (pin being dragged), `.shown` (finale revealed), `.open` (tweaks panel visible), `.active` (button selected), `.new-tag` (nav link marker).

**ID naming:** IDs are used for JavaScript targets and anchor destinations. Same kebab-case pattern: `#board`, `#strings`, `#the-wall`, `#wall-finale`, `#bricks-left`, `#bricks-progress`, `#tweaks-panel`, `#cd-days`, `#cd-hours`, `#cd-mins`, `#cd-secs`.

---

## CSS Architecture

**All CSS is in a single `<style>` block** inside `<head>`. No external stylesheets (except the Google Fonts `@import`).

**Custom properties (CSS variables):** Defined on `:root`. All brand colors are variables:
```css
:root {
  --neon-pink: #ff00cc;
  --hot-pink: #ff4da6;
  --neon-teal: #00ffcc;
  --neon-yellow: #ffff00;
  --snow-white: #f0f8ff;
  --sky-blue: #87ceeb;
  --deep-purple: #1a0033;
}
```

Use these variables for any color reference. Do not hard-code brand colors inline.

**Section comments:** CSS sections are separated with banner comments using box-drawing characters:
```css
/* ═══════════════════════
   SECTION NAME
═══════════════════════ */
```

**Responsive breakpoints:** Two media query breakpoints observed:
- `@media (max-width: 640px)` — evidence board and pin card sizing
- `@media (max-width: 600px)` — door wrap, brick wall, and wall finale sizing

**Typography:** Four Google Fonts families, each assigned to specific UI roles:
| Font | Role |
|------|------|
| `'Special Elite'` | Body text, prose, paper-card content |
| `'Permanent Marker'` | Headings, panel titles, bold UI labels |
| `'Fredoka One'` | Subtitle, countdown numerals, receipt headlines |
| `'Boogaloo'` | Navigation, metadata, labels, captions, UI chrome |

**Animations:** All defined as `@keyframes` blocks. Named descriptively: `twinkle`, `fall`, `marquee`, `pulse-glow`, `blink`, `wiggle`, `sway`, `bob`, `cta-pulse`, `color-cycle`, `spin-slow`. Duration and timing are set per-element either in the class rule or via a CSS custom property (`--dur` on `.star`).

**z-index layering:**
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

---

## JavaScript Conventions

**No framework, no imports.** Vanilla JavaScript only, written inline in a `<script>` block at the bottom of `<body>`.

**Module pattern:** Each interactive feature is wrapped in an IIFE or immediately-invoked block to limit scope:
```js
// Procedural (stars, snowflakes, counter):
const starsEl = document.getElementById('stars');
for (let i = 0; i < 120; i++) { ... }

// IIFE scope (evidence board):
(() => {
  const board = document.getElementById('board');
  if (!board) return;
  // ...
})();

// Named IIFE (brick wall):
(function () {
  const wall = document.getElementById('the-wall');
  if (!wall) return;
  // ...
})();
```

**Guard pattern:** Every interactive feature starts with a null check and early return:
```js
const board = document.getElementById('board');
if (!board) return;
```

**Variable naming:** camelCase throughout (`starsEl`, `snowEl`, `startDate`, `measureBoard`, `pinCenter`, `drawStrings`).

**Function naming:** camelCase verbs describing the action: `updateCounter`, `measureBoard`, `placePin`, `pinCenter`, `drawStrings`, `endDrag`.

**Constants:** UPPER_SNAKE_CASE for true constants (connection data):
```js
const CONNECTIONS = [
  ['poster', 'clipping'],
  // ...
];
```

**Event handling:** Uses `addEventListener` throughout. Pointer events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) for drag interactions (covers both mouse and touch). `setPointerCapture` is used to lock pointer tracking during drags.

**DOM manipulation:**
- `document.getElementById` for unique elements
- `querySelectorAll` / `querySelector` for scoped lookups within components
- `Array.from(...)` to convert NodeLists when iteration methods are needed
- `classList.add` / `classList.remove` / `classList.contains` for state toggling
- `style.cssText` for bulk inline style assignment during procedural generation
- `innerHTML` for SVG string construction (evidence board strings)

**Animation frame management:** `requestAnimationFrame` with cancellation (`cancelAnimationFrame(rAF)`) used for resize debouncing on the evidence board.

**Timer:** `setInterval(updateCounter, 1000)` for the live counter. No cleanup needed (page lives for the session).

---

## Accessibility Patterns

**ARIA labels:** Applied to interactive non-text regions:
```html
<nav class="site-nav" aria-label="Blog navigation">
<div class="evidence-board" aria-label="Interactive evidence board — drag the pins to rearrange">
<div class="brick-wall" aria-label="Interactive brick wall — click bricks to reveal theories">
```

**Focus visible:** Brick buttons have explicit `:focus-visible` styling:
```css
.brick:focus-visible {
  outline: 2px solid var(--neon-yellow);
  outline-offset: 2px;
}
```

**Alt text:** Images carry descriptive alt text, not just filenames:
```html
<img src="1000002351.jpg" alt="Looking down a corridor inside the old Roller Dome...">
```

**Pointer events off:** Decorative elements (stars, snowflakes, stickers, overlay layers) use `pointer-events: none` so they don't interfere with interactive content.

**Semantic buttons:** All clickable non-link elements are `<button type="button">`, never `<div onclick>`.

---

## Comment Conventions

**Section banners:** Used to separate major CSS sections visually (box-drawing characters, all-caps label).

**Inline comments:** Used sparingly in CSS to explain non-obvious values:
```css
scroll-margin-top: 80px; /* offset for sticky nav */
```

**JS comments:** Short, descriptive labels above each logical block:
```js
// GENERATE STARS
// GENERATE SNOWFLAKES
// COUNT UP from April 2, 2026 00:00:00
// which pins are connected (by data-id). red yarn between related scraps.
// Position pins using their data-x / data-y (percent of board).
// Drag logic (mouse + touch via pointer events)
// redraw strings on resize (re-place by % too)
```

**HTML comments:** Used to label each major entry and structural section:
```html
<!-- ══════════════════════════════════════
     ENTRY: THE WALL  (newest)
══════════════════════════════════════ -->
<!-- SPINNING CORNER STICKERS -->
<!-- TOP MARQUEE -->
```

---

## Content Conventions (from `STYLE_GUIDE.md`)

These govern all written content added to the blog. Key rules enforced in `STYLE_GUIDE.md`:

- **No em-dashes in prose.** Use periods, commas, or ellipses. Em-dashes are permitted only in testimonial attributions (`— me, at the gas station`).
- **Exclamation points used sparingly.** Excitement conveyed through word choice, not punctuation.
- **No internet-slang.** ("slaps", "no cap", "hits different", "manifesting" are prohibited.)
- **No marketing language.** No calls-to-action that sound like copy.
- **Testimonial blocks** quote the character speaking out loud. Attribution uses an em-dash: `— me, [location], [time]`.
- **Entries are dated**, newest-first. Dates appear in the `.entry-date` span.
- **Navigation** stays anchor-link based ("lo-fi").
- **All-caps text in UI** (marquees, headings) represents the site's energy, not the prose register.

---

## Formatting Standards

**No formatter config file detected** (no `.prettierrc`, `.editorconfig`, or similar). The file is consistently formatted with:
- 2-space indentation for HTML
- 4-space indentation inside `<style>` (CSS rules)
- 4-space indentation inside `<script>` (JS)
- Opening braces on the same line as selectors/function declarations
- Closing braces on their own line
- One blank line between CSS rule blocks

---

*Convention analysis: 2026-05-01*
