# Testing Patterns

**Analysis Date:** 2026-05-01

## Test Infrastructure

**No automated test suite exists.**

There are no test files, no test runner configuration, and no testing dependencies. The project has no `package.json`, no `node_modules`, and no build tool. It is a single static HTML file deployed directly.

Files confirmed absent:
- `jest.config.*`
- `vitest.config.*`
- `*.test.*` / `*.spec.*`
- `cypress.json` / `playwright.config.*`
- Any `__tests__/` directory

---

## CI/CD

**Deployment:** Netlify, configured in `netlify.toml`.

```toml
[build]
  publish = "."

[build.environment]
  NODE_VERSION = "20"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

**What the Netlify pipeline does:**
- Publishes the repository root directory (`.`) directly — no build step.
- Sets `NODE_VERSION = "20"` in the environment (present for compatibility; no Node.js tools are actually invoked during the build).
- Applies security headers to all routes on deploy.

**What it does not do:**
- Run any linter or HTML validator.
- Run any tests.
- Block deployment on any code quality check.
- Enforce formatting.

A push to `main` deploys immediately with no automated quality gate.

---

## Manual Testing Approach

Because there is no automated testing, the implicit testing process is visual/manual browser verification. Based on the codebase, the following functional areas require manual verification after any change:

### Interactive Features

| Feature | Location | What to verify |
|---------|----------|----------------|
| Star field generation | `index.html` `<script>` — star loop | 120 stars render, twinkle animation runs |
| Snowflake animation | `index.html` `<script>` — snowflake loop | Flakes fall, vary in size/speed/opacity |
| Live counter | `index.html` `<script>` — `updateCounter` | Days/hours/minutes/seconds increment each second from April 2, 2026 |
| Evidence board drag | `index.html` `<script>` — evidence board IIFE | Pins drag on both mouse and touch; red yarn redraws on drag and on window resize |
| Brick wall tear-down | `index.html` `<script>` — brick wall IIFE | Each brick falls with random rotation on click; counter decrements; finale reveals when all 12 are knocked out |
| Sticky nav | `index.html` CSS `.site-nav` | Nav sticks at top on scroll; anchor links jump to correct sections with correct offset |
| Marquee scroll | `index.html` CSS `.marquee-inner` | Top and bottom marquees scroll continuously, no gap/jump |
| CTA button alert | `index.html` `onclick` on `.cta-button` | Alert fires with correct message text |

### Responsive Layout

The site has two breakpoints: `max-width: 640px` and `max-width: 600px`. Manual resize verification should check:
- Evidence board switches to `3:4` aspect ratio at ≤640px
- Pin card widths reduce correctly at ≤640px
- Door wrap goes full-width at ≤600px
- Brick wall labels shrink at ≤600px
- Wall finale font size reduces at ≤600px

### Accessibility Checks (Manual)

- Tab through interactive elements: brick buttons must receive focus with visible yellow outline
- Screen reader spot-check: `aria-label` on `<nav>`, `.evidence-board`, and `.brick-wall` should be announced
- Image alt text is present on both `<img>` elements (`1000002351.jpg`, `1000002317.jpg`)

---

## Browser Compatibility Targets

No explicit browser support matrix is documented. Based on the APIs used, the site requires a browser with:

| API / Feature | Minimum support notes |
|---------------|----------------------|
| CSS custom properties | All modern browsers; IE11 not supported |
| CSS `clamp()` | Chrome 79+, Firefox 75+, Safari 13.1+ |
| `@keyframes` animations | Universal in modern browsers |
| `aspect-ratio` CSS property | Chrome 88+, Firefox 89+, Safari 15+ |
| Pointer Events API (`pointerdown`, `setPointerCapture`) | Chrome 55+, Firefox 59+, Safari 13+ |
| `requestAnimationFrame` | Universal in modern browsers |
| `classList`, `querySelector`, `querySelectorAll` | Universal in modern browsers |
| CSS `backdrop-filter` | Chrome 76+, Firefox 103+, Safari 9+ (prefixed) |
| CSS `mix-blend-mode` | Chrome 41+, Firefox 32+, Safari 8+ |
| `clip-path: polygon()` | Chrome 55+, Firefox 54+, Safari 9.1+ |

**Effective target:** Any evergreen browser (Chrome, Firefox, Safari, Edge) within the last 2–3 years. No IE or legacy mobile browser support.

---

## Validation Approach

**No validator is configured to run automatically.** Manual validation options if needed:

- **HTML:** [https://validator.w3.org/](https://validator.w3.org/) — paste `index.html` or provide the deployed URL
- **CSS:** CSS is embedded in `<style>`; can be extracted and run through [https://jigsaw.w3.org/css-validator/](https://jigsaw.w3.org/css-validator/)
- **Accessibility:** [https://wave.webaim.org/](https://wave.webaim.org/) against the deployed URL

**Known HTML pattern that may generate warnings:**
- Inline `style` attributes on several content elements (one-off overrides in the blog body)
- A `<pre>` element containing a text-art map (acceptable but non-semantic)

---

## Adding Tests in the Future

If automated testing is introduced, the recommended minimal setup given the project's static nature would be:

1. **HTML validation** — a pre-deploy script using `html-validate` or `vnu` (Nu Html Checker)
2. **Link checking** — confirm anchor targets (`#wall`, `#evidence`, etc.) exist
3. **Visual regression** — a screenshot tool (e.g., Playwright) against the deployed preview URL to catch layout regressions in the animated/interactive components

No JavaScript unit tests are warranted at current complexity; all JS logic is tightly coupled to the DOM and is best exercised through browser-based checks.

---

*Testing analysis: 2026-05-01*
