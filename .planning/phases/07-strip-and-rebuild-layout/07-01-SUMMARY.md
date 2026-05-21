---
phase: 07-strip-and-rebuild-layout
plan: "01"
subsystem: main-site
tags:
  - html-cleanup
  - css-purge
  - business-site
  - static
dependency_graph:
  requires: []
  provides:
    - index.html as clean business-site shell
    - "#shows section skeleton"
    - "#contact section skeleton"
  affects:
    - Phase 8 content population
tech_stack:
  added: []
  patterns:
    - Vanilla HTML/CSS with no build step
    - CSS-only animations (marquee, sway, pulse-glow, blink)
key_files:
  created: []
  modified:
    - index.html
decisions:
  - Rewrote index.html in a single pass rather than incremental edits — scope of removal (2400+ lines) made a clean rewrite safer and less error-prone than patching
metrics:
  duration: "~8 minutes"
  completed: "2026-05-21"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 7 Plan 1: Strip Blog Content and Rebuild Shell Summary

Strip all blog content, interactive widgets, particle systems, and the entire JS block from index.html. Replace with a clean neon-branded business-site shell: updated nav, header, marquees, footer, and two empty section skeletons for Phase 8.

## What Was Built

index.html is now a clean, minimal static page. It contains:

- Sticky nav with POWDER RHYTHM brand and two links: Shows (#shows) and Find Us (#contact)
- Top and bottom marquee banners with venue-identity copy
- Header with RECORD STORE & MUSIC VENUE eyebrow, POWDER RHYTHM h1, BAKER CITY, OREGON subtitle
- Mountain emoji scene (kept, on-brand, aria-hidden)
- `<main>` containing two section skeletons: #shows (UPCOMING SHOWS) and #contact (FIND US)
- Footer: POWDER RHYTHM / BAKER CITY, OREGON / RECORD STORE & MUSIC VENUE
- No script block, no particles, no blog entries, no widgets

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove all blog/widget HTML and update head | d5e7b32 | index.html |

## Verification Results

All automated checks passed:

- `grep -c 'class="entry"' index.html` → 0
- `grep -c 'id="stars"' index.html` → 0
- `grep -c 'id="snowflakes"' index.html` → 0
- `grep -c 'class="blog-feed"' index.html` → 0
- `grep -c 'id="shows"' index.html` → 1
- `grep -c 'id="contact"' index.html` → 1
- `grep -c 'href="#shows"' index.html` → 1
- `grep -c 'href="#contact"' index.html` → 1
- `grep -c '<script>' index.html` → 0
- `grep -c 'POWDER RHYTHM :: Record Store' index.html` → 1
- `grep -c 'blog-tagline' index.html` → 0
- `grep -c 'aria-label="Site navigation"' index.html` → 1
- `grep -c 'aria-hidden="true"' index.html` → 1
- `grep -c 'class="section-title"' index.html` → 2
- `grep -c 'href="#wall"' index.html` → 0
- `grep -c 'href="#evidence"' index.html` → 0

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Implementation note:** Given the scale of removals (2400+ lines of HTML, JS, and CSS being removed from a 2788-line file), a clean rewrite was used instead of incremental edits. This is more reliable than patching a file where nearly every section is changing. The output matches the exact HTML structure spec in 07-UI-SPEC.md and all copy strings from the Copywriting Contract.

## Known Stubs

The two section skeletons contain `<!-- Phase 8 -->` placeholder comments and no visible content. This is intentional — Phase 8 (Business Content) will populate both sections. The stubs do not prevent the goal of this plan (producing a clean shell) from being achieved.

## Threat Flags

No new security-relevant surface was introduced. The only external dependency (Google Fonts CDN) was preserved unchanged.

## Self-Check: PASSED

- index.html exists at correct path: FOUND
- Commit d5e7b32 exists: FOUND
- All grep verification checks return expected values (documented above)
