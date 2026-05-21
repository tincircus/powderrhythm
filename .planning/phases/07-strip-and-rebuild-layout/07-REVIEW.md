---
phase: 07-strip-and-rebuild-layout
reviewed: 2026-05-21T04:58:02Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - index.html
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-21T04:58:02Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Phase 7 stripped the blog-era content and rebuilt `index.html` as a clean venue site scaffold. The CSS purge and HTML removals are executed correctly — all blog articles, widget JS, stars/snowflakes, stickers, scroll-text, tweaks panel, and blog-tagline have been removed without any orphaned selectors or dead HTML. The remaining structure matches the UI spec.

Three findings require attention: a phantom CSS class applied in HTML with no corresponding rule, a `gap: 0` value on the nav flexbox that suppresses spacing between all nav items (including separators), and a global `p` rule that will override section-content prose color when Phase 8 adds paragraph content. Two informational items round out the report.

---

## Warnings

### WR-01: `marquee-bottom` class applied to HTML element with no CSS rule defined

**File:** `index.html:288`
**Issue:** The bottom marquee div carries `class="marquee-wrap marquee-bottom"`, but `.marquee-bottom` is never defined anywhere in the `<style>` block. The class does nothing — it is a ghost hook. The UI spec (line 237 of `07-UI-SPEC.md`) includes `marquee-bottom` in the body structure diagram, implying it is intentional scaffolding for Phase 8. However, no comment or empty rule communicates that intent. If Phase 8 does not add this rule and the class is forgotten, the bottom marquee will be visually identical to the top marquee with no way to differentiate them in CSS. The only behavioral differentiation is the inline `animation-duration` and `animation-direction` on the inner `<span>`, which is also a concern (see IN-01).
**Fix:** Either define an empty placeholder rule with a comment, or remove the class until Phase 8 uses it:
```css
/* Phase 8 may add position/margin overrides for the bottom marquee */
.marquee-bottom {
}
```

### WR-02: `gap: 0` on `.site-nav` flexbox suppresses all inter-item spacing, including nav separators

**File:** `index.html:52`
**Issue:** `.site-nav` sets `gap: 0`, which collapses the space between every flex child — including the `.nav-sep` pipe characters. The `.nav-sep` rule applies `margin: 0 0.4rem` to restore spacing around the separators (lines 68-70), so the separators themselves have breathing room. But the `gap: 0` means there is zero space between the nav-title span and the first separator, and zero space between nav links and their adjacent separators except what the link's own `padding: 0.2rem 0.4rem` (lines 79-80) provides. On narrow viewports when the nav wraps (`flex-wrap: wrap`), wrapped rows will have no row gap. This is likely intentional given the previous codebase had the same pattern, but the combination of `gap: 0` with `flex-wrap: wrap` means a wrapped second row will be flush with the first row.
**Fix:** Set `row-gap: 0.25rem` (or equivalent) to prevent wrapped rows from colliding, while keeping `column-gap: 0` if the per-item padding/margin handles horizontal spacing:
```css
.site-nav {
  gap: 0;
  row-gap: 0.25rem; /* prevent row collision on narrow viewports */
}
```

### WR-03: Global `p` rule will override `.section-content` prose styling when Phase 8 adds paragraphs

**File:** `index.html:195-199`
**Issue:** The global `p` rule sets `font-size: 1.05rem` and `color: rgba(240, 248, 255, 0.9)` on every paragraph element in the document. The `.section-content` class has no rules (by design for Phase 8). When Phase 8 adds `<p>` elements inside `.section-content`, they will automatically inherit the global `p` color — `rgba(240, 248, 255, 0.9)`, which is near-white and appropriate. However, the `font-size: 1.05rem` is set on `p` directly rather than scoped to a container, meaning any future attempt by Phase 8 to set a different paragraph size inside sections will require explicit overrides. This is a low-level coupling risk.

More concretely: the `footer p` rule at line 213 already demonstrates the override pattern, repeating both `font-size` and `color` to counteract the global rule. Phase 8 will likely need to do the same for show listings and contact copy. The global `p` rule survived from the blog era but no longer has blog content to justify its breadth.

**Fix:** Scope the `p` rule to the content areas that need it, or accept the override burden and document it. Since Phase 8 needs to define section internals anyway, the minimum safe fix is a comment:
```css
p {
  line-height: 1.75;
  font-size: 1.05rem;
  color: rgba(240, 248, 255, 0.9);
  /* NOTE: footer p and any .section-content p rules must
     explicitly override font-size and color if they differ */
}
```

---

## Info

### IN-01: Bottom marquee animation overrides are applied via inline `style` attribute

**File:** `index.html:289`
**Issue:** The bottom marquee `<span class="marquee-inner">` carries `style="animation-duration:25s; animation-direction:reverse;"` as inline style. The project's JavaScript conventions file (`CONVENTIONS.md`) lists `style.cssText` for programmatic bulk inline style assignment, but for static authored HTML the project convention is to drive styling through CSS classes. The inline style makes the bottom marquee's animation values invisible to CSS tooling and harder to adjust in one place.
**Fix:** Move these values to the `.marquee-bottom .marquee-inner` selector in the `<style>` block, which also resolves WR-01 by giving `.marquee-bottom` a concrete definition:
```css
.marquee-bottom .marquee-inner {
  animation-duration: 25s;
  animation-direction: reverse;
}
```
Then remove the `style` attribute from the HTML element.

### IN-02: No responsive breakpoints defined; existing breakpoints were removed entirely

**File:** `index.html` (CSS block)
**Issue:** The UI spec (Responsive Behaviour section, line 300) states "Existing `@media (max-width: 640px)` and `@media (max-width: 600px)` breakpoints are PRESERVED in the file — the widget-specific rules inside those breakpoints are removed with their parent components." However, no `@media` rules exist anywhere in the final file (confirmed by grep). The breakpoint wrapper blocks were removed along with their widget content, rather than kept empty as the spec prescribed. For Phase 7 this is functionally harmless since `.site-section`'s `padding: 3rem 1.5rem` is adequate at 320px. But the spec explicitly said to keep the outer `@media` wrappers as scaffolding for Phase 8. Their absence means Phase 8 must add them from scratch rather than populating existing blocks.
**Fix:** This is a spec-compliance gap, not a visual defect. Add empty breakpoint stubs to preserve the scaffold:
```css
@media (max-width: 640px) {
  /* Phase 8 breakpoint overrides */
}

@media (max-width: 600px) {
  /* Phase 8 breakpoint overrides */
}
```

---

_Reviewed: 2026-05-21T04:58:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
