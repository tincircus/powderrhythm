---
phase: 08-business-content
plan: "01"
subsystem: main-site
tags: [css, marquee, static-site, phase-8]
dependency_graph:
  requires: [07-strip-and-rebuild-layout]
  provides: [show-contact-css-classes, updated-top-marquee]
  affects: [index.html]
tech_stack:
  added: []
  patterns: [vanilla-css, responsive-media-query, css-custom-properties]
key_files:
  created: []
  modified:
    - index.html
decisions:
  - "Used verbatim CSS from 08-UI-SPEC.md — no deviations from design contract"
  - "Created new @media (max-width: 600px) block since none existed in file after Phase 7 cleanup"
  - "CONT-02 (hours) and CONT-03 (social) intentionally omitted per D-06 and D-08"
metrics:
  duration: "2 minutes"
  completed: "2026-05-21"
  tasks: 2
  files_modified: 1
requirements:
  - CONT-02
  - CONT-03
---

# Phase 8 Plan 01: CSS Classes and Marquee Update Summary

17 new CSS class rules for shows and contact sections added to the style block, responsive collapse rule added, and top marquee updated with May 29 event-announcement copy.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add show and contact CSS classes to style block | 2fa8574 | index.html |
| 2 | Update top marquee with event-announcement copy | 0d1321c | index.html |

## What Was Built

**Task 1 — CSS Classes:**

Added 17 CSS class rules inside the `/* SITE SECTIONS */` comment block immediately after `.section-content {}`:

Shows section classes: `.show-list`, `.show-card`, `.show-card:last-child`, `.show-card:hover`, `.show-artist`, `.show-meta`, `.show-tickets`, `.show-tickets:hover`, `.show-empty`

Contact section classes: `.contact-grid`, `.contact-block`, `.contact-label`, `.contact-value`, `.contact-crossstreet`, `.contact-link`, `.contact-link:hover`

Created a new `@media (max-width: 600px)` block (none existed after Phase 7 cleanup) containing `.contact-grid { grid-template-columns: 1fr; }` for responsive collapse.

**Task 2 — Top Marquee:**

Replaced Phase 7 placeholder text in the top marquee with event-announcement copy: `🎵 MAY 29 🎵 UTILITY 🎵 ROLLER DOME 🎵 AFTER SCHOOL SPECIAL 🎵 LIVE AT POWDER RHYTHM 🎵` (repeated twice for seamless scroll loop). No CTAs, no exclamation points per STYLE_GUIDE. Bottom marquee left unchanged per D-11.

## Deviations from Plan

None. Plan executed exactly as written. All 17 CSS classes match the verbatim spec from 08-UI-SPEC.md. The `@media (max-width: 600px)` block was created new (not added to an existing one) because Phase 7 removed the old blog widget media queries -- this was anticipated by the plan's conditional instruction.

## Intentionally Deferred Requirements

- **CONT-02 (Hours):** Hours block omitted per D-06 -- hours not yet confirmed. Add a Hours `.contact-block` when real hours are known.
- **CONT-03 (Social links):** Social block omitted per D-08 -- no active social account at launch. Add a Follow `.contact-block` when an account is active.

Both requirements are intentionally unmet at launch. The CSS classes (`.contact-label`, `.contact-value`, `.contact-block`) are in place and ready for those blocks to be added.

## Known Stubs

None. This plan adds only CSS classes and marquee copy. No HTML content with placeholder values was introduced.

## Threat Flags

None. This plan modifies only CSS rules and static marquee text inside a static HTML file. No user input, no dynamic content, no network endpoints, no auth paths.

## Self-Check: PASSED

- [x] index.html modified with 17 new CSS rules: FOUND
- [x] @media (max-width: 600px) block with contact-grid responsive rule: FOUND
- [x] Top marquee contains UTILITY, ROLLER DOME, AFTER SCHOOL SPECIAL, MAY 29, LIVE AT POWDER RHYTHM: FOUND
- [x] Bottom marquee unchanged: CONFIRMED
- [x] Task 1 commit 2fa8574: FOUND
- [x] Task 2 commit 0d1321c: FOUND
- [x] No file deletions in either commit: CONFIRMED
