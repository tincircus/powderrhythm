# Codebase Concerns

**Analysis Date:** 2026-05-01

---

## Tech Debt

**All CSS lives in a single `<style>` block inside `index.html`:**
- Issue: The entire stylesheet (~1,550 lines) is inlined in `<head>` with no external `.css` file. Every page load re-parses the full style block; browser cannot cache it independently.
- Files: `index.html` (lines 9–1574)
- Impact: As entries grow, the file will exceed comfortable single-file editing. The CSS already contains multiple ad-hoc `@keyframes` (twinkle, fall, blink, marquee, sway, pulse-glow, wiggle, color-cycle, bob, cta-pulse, entry-separator, spin-slow) defined separately across the file. At least two (`blink`) are defined once and relied upon by multiple selectors; if reorganized, duplication will appear.
- Fix approach: Extract CSS to `styles.css`, link with `<link rel="stylesheet">`. Netlify serves with long-lived cache headers for static assets if configured.

**Inline `style=` attributes throughout HTML content:**
- Issue: Dozens of `style="margin-top:1rem;"`, `style="text-align:center; font-family:..."`, `style="animation-duration:25s; animation-direction:reverse;"` etc. are scattered across the markup. Counted 20+ unique occurrences in the body alone.
- Files: `index.html` (lines 1659, 1704, 1855, 1903, 1954, 1983, 2004, 2018, 2040, 2047, 2048, 2108–2110, 2145, 2178, 2285, 2287, 2290, 2293, 2386, 2399, 2410)
- Impact: Makes restyling by class impossible without touching HTML. Violates the site's own design system (CSS custom properties are defined but bypassed in several places — e.g., hardcoded `#800080`, `#400040`, `#aa00ff`, `#c40026` appear in CSS but are not defined as CSS variables).
- Fix approach: Promote repeated inline patterns to named utility classes (`.mt-1`, `.text-center`, or entry-specific modifiers). Add missing color values to `:root`.

**`original_index.html` committed to the repo root:**
- Issue: An archived version of the site (`original_index.html`, 38 KB) lives in the served directory. Netlify's `publish = "."` will make it publicly accessible at `https://www.powderrhythm.com/original_index.html`.
- Files: `original_index.html`
- Impact: Low security risk but exposes the site's build history publicly. Could confuse search engines if indexed.
- Fix approach: Move to a `.archive/` or `_archive/` directory excluded from the published build, or add a `[[redirects]]` rule in `netlify.toml` returning 404 for that path.

**Image filenames are device-generated identifiers:**
- Issue: `1000002317.jpg` and `1000002351.jpg` are phone camera filenames. They are not descriptive, not versioned, and give no indication of content.
- Files: `index.html` lines 2083, 1696; `1000002317.jpg` (440 KB), `1000002351.jpg` (621 KB)
- Impact: Maintainability — future contributors cannot identify images by name. SEO — filename is a minor ranking signal for image search.
- Fix approach: Rename to `poster-tigers-april-2026.jpg` and `roller-dome-wall-april-28.jpg` (or similar). Update `src` references accordingly.

---

## Performance Issues

**Uncompressed JPEG images, no `srcset`, no modern format:**
- Severity: HIGH
- Issue: `1000002317.jpg` is 440 KB and `1000002351.jpg` is 621 KB. No `srcset`, no `<picture>` element, no WebP or AVIF variant. On a mobile connection the poster entry alone triggers 1 MB of image transfer.
- Files: `index.html` lines 2083, 1696; image files in repo root
- Impact: Largest Contentful Paint will be dominated by these images on first load. Especially painful on mobile.
- Fix approach: Convert to WebP (target ~80–120 KB each at 85% quality). Add `srcset` with 1x/2x variants. Use `loading="lazy"` on the non-above-fold image (`1000002351.jpg`).

**Four Google Fonts families loaded via a blocking `@import`:**
- Severity: HIGH
- Issue: `@import url('https://fonts.googleapis.com/css2?family=Boogaloo&family=Fredoka+One&family=Permanent+Marker&family=Special+Elite&display=swap')` is the first line of the `<style>` block. CSS `@import` is render-blocking; the browser cannot parse the stylesheet until the font CSS response returns from Google's servers.
- Files: `index.html` line 10
- Impact: Adds a full cross-origin round-trip to the critical path before any styled content can render. No `<link rel="preconnect">` to `fonts.googleapis.com` or `fonts.gstatic.com` is present to mitigate this.
- Fix approach: Replace `@import` with `<link rel="preconnect" href="https://fonts.googleapis.com">` + `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` + `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...&display=swap">` in `<head>`. Consider self-hosting the font files for full control.

**`setInterval` running every second on every page load:**
- Severity: LOW
- Issue: The count-up timer calls `updateCounter()` every 1000 ms indefinitely via `setInterval(updateCounter, 1000)`. There is no cleanup or pause when the tab is backgrounded.
- Files: `index.html` line 2467
- Impact: Negligible CPU impact, but wasteful. The Page Visibility API could pause the interval when the tab is hidden.
- Fix approach: Use `document.addEventListener('visibilitychange', ...)` to pause/resume the interval.

**120 DOM nodes created by JS for stars + 25 for snowflakes at page load:**
- Severity: LOW
- Issue: `for (let i = 0; i < 120; i++)` appends 120 `<div>` nodes for stars, plus 25 more for snowflakes, all via synchronous DOM manipulation in a `<script>` block at the bottom of `<body>`.
- Files: `index.html` lines 2417–2447
- Impact: Minor layout thrash on low-end devices. Stars are `position:fixed` and each runs a CSS animation, adding GPU compositor layers.
- Fix approach: Consider a single `<canvas>` for the background particle effects, or reduce counts for mobile via `matchMedia('(prefers-reduced-motion: reduce)')`.

**Inline SVG strings built via string concatenation:**
- Severity: LOW
- Issue: `drawStrings()` builds an SVG `innerHTML` string using concatenation inside a loop, then assigns it to `svg.innerHTML`. This triggers a full DOM re-parse of the SVG subtree on every drag event (many times per second while dragging).
- Files: `index.html` lines 2526–2559
- Impact: Can cause jank during drag interactions, particularly on mobile.
- Fix approach: Create SVG `<path>` elements once using `document.createElementNS`, store references, and update `d` attribute values directly on each drag frame.

---

## Security Considerations

**Missing Content-Security-Policy (CSP) header:**
- Severity: HIGH
- Issue: `netlify.toml` sets `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` but no `Content-Security-Policy`. The page loads external resources from `fonts.googleapis.com` and `fonts.gstatic.com`. Without a CSP, any injected script (XSS via future dynamic content) would execute without restriction.
- Files: `netlify.toml`
- Fix approach: Add a CSP header in `netlify.toml`:
  ```toml
  Content-Security-Policy = "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self' 'unsafe-inline'; frame-ancestors 'none';"
  ```
  Note: `unsafe-inline` for `style-src` and `script-src` is required because all CSS and JS are currently inline. Long-term, extracting to external files and using nonces or hashes would be more secure.

**Missing `Permissions-Policy` header:**
- Severity: LOW
- Issue: No `Permissions-Policy` header is set to restrict browser feature access (camera, microphone, geolocation).
- Files: `netlify.toml`
- Fix approach: Add `Permissions-Policy = "camera=(), microphone=(), geolocation=()"` to the headers block.

**`onclick` with `alert()` on the CTA button:**
- Severity: LOW
- Issue: `<a ... onclick="alert('...')">` uses an inline event handler with `alert()`. The `alert` text contains a single-quoted string with an escaped apostrophe — fragile pattern. `onclick` attribute handlers execute in the global scope and are harder to audit.
- Files: `index.html` line 2388–2393
- Impact: Not a current vulnerability, but alert()-based interaction is dismissible and not keyboard-accessible. Inline handlers are flagged by CSP `script-src` policies that ban `unsafe-inline`.
- Fix approach: Move the handler to the `<script>` block using `addEventListener`.

---

## Maintainability Concerns

**Single 2,658-line HTML file with no separation of concerns:**
- Severity: HIGH
- Issue: HTML structure, CSS (~1,560 lines), and JavaScript (~240 lines) all live in `index.html`. Adding a new blog entry requires navigating 2,600+ lines. There is no build step, templating, or component system.
- Files: `index.html`
- Impact: Cognitive overhead increases with every entry. Risk of accidentally editing CSS when targeting HTML, or vice versa.
- Fix approach: At minimum, extract to `styles.css` and `scripts.js`. For future scale, consider a static site generator (Eleventy, Astro) that supports a template per entry with front-matter dates.

**New blog entries require manual nav link updates:**
- Issue: Each new entry requires adding a `<a href="#new-id">` to the `<nav class="site-nav">` manually. There is no data-driven nav generation.
- Files: `index.html` lines 1590–1606
- Impact: Easy to forget the nav update, causing entries to exist but not be linked from the top. The nav already wraps at narrow viewports — it will become unwieldy beyond ~8 entries.
- Fix approach: If a build step is introduced, generate nav from entry metadata. Short-term, add a comment in the nav block noting the manual update requirement.

**`new-tag` class hardcoded on a specific nav link:**
- Issue: The blinking "NEW" indicator is applied by manually adding `class="new-tag"` to `<a href="#wall">`. When the next entry is added, this must be moved by hand.
- Files: `index.html` line 1593
- Fix approach: Could be driven by a `data-new="true"` attribute scanned by JS at startup, or added programmatically to the first nav item.

**No `.gitignore` file:**
- Issue: No `.gitignore` is present in the repo. Large binary files (JPEGs) are already committed. Future accidental commits of OS metadata (`.DS_Store`), editor files, or larger assets are unguarded.
- Files: repo root
- Fix approach: Add a `.gitignore` with at minimum: `.DS_Store`, `Thumbs.db`, `*.log`, `.env`.

---

## Accessibility Gaps

**Marquee text not accessible to screen readers:**
- Severity: MEDIUM
- Issue: Both `<div class="marquee-wrap">` elements contain animated scrolling text but have no `aria-hidden`, no `role`, and no static fallback. Screen readers will announce the full duplicated marquee text (the same phrase repeats 3–4 times to fill the scroll).
- Files: `index.html` lines 1609–1615, 2399–2405
- Fix approach: Add `aria-hidden="true"` to both marquee wraps, or provide a visually hidden `<p>` with the single static message.

**Corner sticker `<div>` elements spin without `prefers-reduced-motion` check:**
- Severity: MEDIUM
- Issue: `.sticker-tl` and `.sticker-tr` run `animation: spin-slow 8s linear infinite` continuously. No `@media (prefers-reduced-motion: reduce)` rule disables or reduces any of the site's 10+ animations (twinkle, fall, blink, marquee, sway, pulse-glow, wiggle, color-cycle, bob, cta-pulse, spin-slow).
- Files: `index.html` throughout CSS block
- Impact: Users with vestibular disorders or motion sensitivity receive a fully animated experience with no opt-out.
- Fix approach: Add a single `@media (prefers-reduced-motion: reduce)` block that sets `animation: none !important` for all animated elements, or reduces duration to 0.01s.

**Interactive brick buttons have no accessible name beyond visual text:**
- Severity: MEDIUM
- Issue: The 12 `<button class="brick">` elements contain a `<span class="brick-label">` with text like "AJ'S BRICK" and "THE NAMES", but the revealed content behind each brick (`.brick-text`) is not announced to screen readers before or after clicking. A screen reader user cannot access the theory text without visually seeing the brick fall.
- Files: `index.html` lines 1743–1824
- Fix approach: Add `aria-describedby` on each `<button>` pointing to the corresponding `.brick-text` element's `id`, so the hidden content is discoverable. Or add an `aria-label` that includes the theory summary.

**Evidence board drag interaction has no keyboard alternative:**
- Severity: MEDIUM
- Issue: The pin cards on the evidence board are draggable via pointer events only. There is no keyboard interface (arrow keys, Tab to focus + Enter/Space to pick up/drop). The board has `aria-label="Interactive evidence board — drag the pins to rearrange"` but keyboard users cannot actually interact with it.
- Files: `index.html` lines 2564–2625
- Fix approach: Implement keyboard drag via `keydown` on focused `.pin-item` elements (arrow keys move position), or provide a note that the content is decorative and the narrative text above describes what the board shows.

**Low color contrast on secondary text elements:**
- Severity: MEDIUM
- Issue: Several text elements use opacity-reduced white on dark purple that may fall below WCAG AA 4.5:1 contrast ratio:
  - `.entry-date`: `rgba(240,248,255,0.35)` — approximately 2.4:1 against `#1a0033`
  - `.blog-tagline`: `rgba(240,248,255,0.35)` — same
  - `.poster-caption`: `rgba(240,248,255,0.25)` — approximately 1.7:1
  - `.drag-hint`: `rgba(255,230,180,0.55)` against the cork board
  - Footer `p`: `rgba(240,248,255,0.3)` — approximately 2.0:1
- Files: `index.html` CSS block
- Fix approach: Increase opacity to at least 0.6 for body-level informational text, or use a higher-contrast absolute color. Decorative/supplementary elements may be exempt under WCAG but should be reviewed.

**`<div class="subtitle">` and `<div class="blog-tagline">` should be `<p>` elements:**
- Severity: LOW
- Issue: Semantic markup uses `<div>` for text content that is descriptive prose, not a layout container.
- Files: `index.html` lines 1621–1622

---

## Browser Compatibility Risks

**`-webkit-background-clip: text` + `-webkit-text-fill-color: transparent`:**
- Severity: LOW
- Issue: The main title gradient text uses `-webkit-`-prefixed properties. These are now widely supported including Firefox 49+, but `-webkit-text-fill-color` is still not in any CSS standard. If a browser ignores it, `color` on the element is the fallback — which is `var(--snow-white)`, an acceptable fallback.
- Files: `index.html` lines 209–212

**`aspect-ratio` CSS property:**
- Severity: LOW
- Issue: `.evidence-board` uses `aspect-ratio: 4 / 3.2`. Supported in all modern browsers since ~2021, but not in IE11 (irrelevant given site audience) or old Safari < 15 (potential concern for older iOS devices).
- Files: `index.html` line 664

**`backdrop-filter: blur()` on the sticky nav:**
- Severity: LOW
- Issue: `backdrop-filter: blur(6px)` on `.site-nav` is unsupported in Firefox without the `layout.css.backdrop-filter.enabled` flag (though Firefox 103+ supports it unprefixed). Without it, the nav still displays with its semi-transparent background, so degradation is graceful.
- Files: `index.html` line 100

**Pointer Events API for drag:**
- Severity: LOW
- Issue: The evidence board drag implementation uses `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, and `setPointerCapture`. This is well-supported in all modern browsers, including iOS Safari 13+.
- Files: `index.html` lines 2567–2615

---

## SEO Issues

**`<title>` tag is generic and does not vary per entry:**
- Severity: MEDIUM
- Issue: Title is `POWDER RHYTHM :: A Blog :: Baker City` for the entire page regardless of scroll position or anchor. Since all content is on one page, there is no per-entry URL for search engines to index individual entries.
- Files: `index.html` line 6
- Fix approach: This is an inherent limitation of the single-page architecture. If entries should be individually discoverable, consider moving to separate HTML files per entry or a static site generator. Short-term, the `<meta name="description">` could be more specific.

**No Open Graph or Twitter Card meta tags:**
- Severity: MEDIUM
- Issue: No `<meta property="og:title">`, `og:description`, `og:image`, `og:url`, `twitter:card`, etc. When the URL is shared on social platforms, the preview will fall back to page title + raw description text with no image thumbnail.
- Files: `index.html` `<head>` section
- Fix approach: Add OG tags referencing `1000002317.jpg` (the poster) as the social share image. This is high-impact given the site's likely discovery path (word-of-mouth social shares).

**No `<link rel="canonical">` tag:**
- Severity: LOW
- Issue: If the site is accessible at both `powderrhythm.com` and `www.powderrhythm.com`, Google may index both as separate URLs. CNAME points to `www.powderrhythm.com` but there is no canonical declaration.
- Files: `index.html` `<head>` section
- Fix approach: Add `<link rel="canonical" href="https://www.powderrhythm.com/">` and optionally add a Netlify redirect for the apex domain.

**No structured data (schema.org):**
- Severity: LOW
- Issue: No `BlogPosting`, `Event`, or `Organization` structured data. May miss rich result eligibility.
- Files: `index.html`

---

## Missing Features / Capabilities

**No RSS or Atom feed:**
- Issue: The site is explicitly a blog with dated entries. There is no feed for readers to subscribe via an RSS reader. As entries accumulate, discoverability for returning visitors decreases.
- Impact: Returning readers must remember to check the URL manually.
- Fix approach: A static `feed.xml` file, updated manually with each entry, is sufficient given the low-volume update cadence. A static site generator would automate this.

**No social sharing mechanism:**
- Issue: The CTA button (`I FEEL IT TOO`) triggers an `alert()` with no shareable action. There is no way for a reader to share the site or a specific entry to social platforms directly from the page.
- Fix approach: Replace the alert with a Web Share API call (`navigator.share()`) with a fallback copy-to-clipboard for unsupported browsers.

**No `robots.txt`:**
- Issue: No `robots.txt` file is present. Search engine crawlers will crawl everything, including `original_index.html`.
- Fix approach: Add a minimal `robots.txt`. If `original_index.html` is not moved, disallow it there.

**Brick wall state is not persisted:**
- Issue: If a visitor knocks down bricks and then refreshes, all bricks reset. This is intentional per the site's tone but worth noting as a potential feature request (persist via `localStorage` so the finale stays visible on return).
- Files: `index.html` lines 2631–2655

---

## Scalability Constraints

**Single-file architecture does not scale past ~6–8 entries:**
- Severity: HIGH (future)
- Issue: `index.html` is already 2,658 lines with 4 entries. Each new entry adds ~100–300 lines of HTML + CSS for new components. The "evidence board" entry added ~600 lines of CSS + JS alone. At 10 entries the file will exceed 5,000 lines; at 15 entries it becomes unmanageable.
- Files: `index.html`
- Impact: Editing risk increases (accidental deletion, wrong section), load time increases, build-less deployment becomes fragile.
- Fix approach: Introduce a static site generator (Eleventy is zero-config friendly and requires no build toolchain setup) with a single layout template and per-entry Markdown or HTML files. This preserves the hand-crafted aesthetic while separating content from chrome.

**Nav bar overflow on mobile with many entries:**
- Issue: `.site-nav` uses `flex-wrap: wrap` which wraps nav links to a second line on narrow viewports. With 7 entries already in the nav, on 320px screens the nav occupies 3+ lines, pushing content far below the fold.
- Files: `index.html` lines 1589–1606
- Fix approach: Consider a collapsed mobile nav (hamburger or a `<select>` jump list) once entries exceed 6.

**No image CDN or optimization pipeline:**
- Issue: Images are committed as raw JPEG files directly in the repo root. Netlify does not apply image optimization by default (Netlify Image CDN is a paid feature). Each new photo entry will add hundreds of KB to the repo.
- Files: repo root (`1000002317.jpg`, `1000002351.jpg`)
- Fix approach: Run images through a lossless/lossy compressor (Squoosh, ImageOptim) before committing, and generate WebP variants. Long-term, use Netlify Large Media or an external image CDN (Cloudinary free tier).

---

*Concerns audit: 2026-05-01*
