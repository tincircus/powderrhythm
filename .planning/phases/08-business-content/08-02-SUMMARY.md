---
phase: 08-business-content
plan: "02"
subsystem: main-site
tags: [javascript, html, static-site, phase-8, shows, contact]
dependency_graph:
  requires: [08-01]
  provides: [shows-render-function, contact-html, SHOWS-array]
  affects: [index.html]
tech_stack:
  added: []
  patterns: [vanilla-js, iife-guard-pattern, static-html, var-declarations]
key_files:
  created: []
  modified:
    - index.html
decisions:
  - "Used verbatim JS pattern from 08-UI-SPEC.md render function section — no deviations"
  - "SHOWS array seeded with exactly one entry per D-01 through D-04 (May 29 show)"
  - "Contact section has exactly two blocks (Address + Email) per D-09; Hours and Social omitted per D-06 and D-08"
  - "Script block placed immediately before </body> per UI-SPEC insertion point spec"
metrics:
  duration: "5 minutes"
  completed: "2026-05-21"
  tasks: 2
  files_modified: 1
requirements:
  - SHOW-01
  - SHOW-02
  - SHOW-03
  - SHOW-04
  - CONT-01
  - CONT-04
---

# Phase 8 Plan 02: Shows and Contact Content Population Summary

SHOWS array seeded with May 29 Utility show, JS IIFE render function writes show cards to #shows .section-content, and static contact grid (Address + Email) placed in #contact .section-content.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Populate #shows section and add script block | e8c7be4 | index.html |
| 2 | Populate #contact section with address and email HTML | d861989 | index.html |

## What Was Built

**Task 1 — Shows Section and Script Block:**

Added two changes to index.html:

EDIT 1: Replaced the `<!-- Phase 8 -->` placeholder in `#shows .section-content` with a noscript fallback element containing "JavaScript is required to display upcoming shows."

EDIT 2: Inserted a `<script>` block immediately before `</body>` containing:
- `var SHOWS` array with one seeded entry: artist `"Utility (+ Roller Dome, After School Special)"`, date `"Fri, May 29, 2026"`, venue `"Powder Rhythm"`, ticketUrl `"https://tickets.powderrhythm.com/events/1"`
- IIFE render function using `document.querySelector('#shows .section-content')` with guard, produces `<ul class="show-list" role="list">` with `<li class="show-card">` items; each card has `.show-artist`, `.show-meta` (date &bull; venue), and `.show-tickets` anchor with `target="_blank" rel="noopener noreferrer"` and `aria-label="Get tickets for {artist}"`
- Empty state: sets container innerHTML to `<p class="show-empty">No upcoming shows. Check back soon.</p>` when SHOWS.length === 0

**Task 2 — Contact Section HTML:**

Replaced the `<!-- Phase 8 -->` placeholder in `#contact .section-content` with a static contact grid. Two contact-block elements only per D-09:
- Address block: label "Address", value "1832 Main St" + "Baker City, OR 97814" (no cross-street span per D-05)
- Email block: label "Email", value `<a href="mailto:info@powderrhythm.com" class="contact-link">info@powderrhythm.com</a>` per D-07
- No hours block (D-06 deferred) and no social/Follow block (D-08 deferred)

## Deviations from Plan

None. Plan executed exactly as written. All SHOWS array values, render function pattern, and contact HTML match the verbatim spec from 08-UI-SPEC.md and 08-CONTEXT.md decisions D-01 through D-09.

## Intentionally Deferred Requirements

- **CONT-02 (Hours):** Hours block omitted per D-06 -- hours not yet confirmed.
- **CONT-03 (Social links):** Social block omitted per D-08 -- no active social account at launch.

## Known Stubs

None. The SHOWS array is seeded with a real show entry. The ticketUrl `https://tickets.powderrhythm.com/events/1` is a forward-looking placeholder that will resolve when the ticketing backend deploys -- this is intentional per D-04, not a stub.

## Threat Flags

None. All SHOWS values are static literals defined in the same file (no user input path, XSS not applicable per T-08-02). The mailto link is intentionally public-facing contact info (no PII concern per T-08-03).

## Self-Check: PASSED

- [x] `var SHOWS = [` declared once in index.html: FOUND (1 match)
- [x] `artist: 'Utility (+ Roller Dome, After School Special)'`: FOUND
- [x] `date: 'Fri, May 29, 2026'`: FOUND
- [x] `venue: 'Powder Rhythm'`: FOUND
- [x] `ticketUrl: 'https://tickets.powderrhythm.com/events/1'`: FOUND
- [x] `document.querySelector('#shows .section-content')`: FOUND
- [x] `No upcoming shows. Check back soon.`: FOUND
- [x] `class="show-list" role="list"`: FOUND
- [x] `rel="noopener noreferrer"` on show-tickets anchor: FOUND
- [x] `aria-label="Get tickets for`: FOUND
- [x] `<noscript>` inside #shows section-content: FOUND
- [x] `class="contact-grid"` in #contact section: FOUND (2 matches -- CSS rule + HTML element)
- [x] `1832 Main St`: FOUND
- [x] `Baker City, OR 97814`: FOUND
- [x] `mailto:info@powderrhythm.com`: FOUND
- [x] `class="contact-link"` on mailto anchor: FOUND
- [x] No contact-label with text "Hours" or "Follow": CONFIRMED absent
- [x] No `contact-crossstreet` in contact HTML (only in CSS): CONFIRMED
- [x] Exactly 2 contact-block divs: FOUND
- [x] Task 1 commit e8c7be4: FOUND
- [x] Task 2 commit d861989: FOUND
- [x] No file deletions in either commit: CONFIRMED
