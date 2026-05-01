# Codebase Structure

**Analysis Date:** 2026-05-01

## Directory Layout

```
powderrhythm/               # Repo root — also the Netlify publish root
├── index.html              # Entire site: styles, content, scripts
├── original_index.html     # Archived prior version (not served as default)
├── STYLE_GUIDE.md          # Voice, tone, and character guide for blog content
├── netlify.toml            # Netlify build config and security headers
├── CNAME                   # Custom domain record: www.powderrhythm.com
├── 1000002317.jpg          # Image: circus/poster photo (used in circus entry)
├── 1000002351.jpg          # Image: Roller Dome wall construction (used in wall entry)
└── .planning/
    └── codebase/           # GSD codebase map documents (this directory)
```

## Directory Purposes

**Root (`/`):**
- Purpose: The entire deployable site lives here; Netlify serves this directory directly
- Contains: The single production HTML file, archived HTML, docs, config, images
- Key files: `index.html` (production site), `netlify.toml` (deployment config)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents for planning and execution agents
- Contains: ARCHITECTURE.md, STRUCTURE.md (this file)
- Generated: Yes, by GSD map-codebase agent
- Committed: Yes

## Key File Locations

**Entry Point:**
- `index.html`: The entire site — all CSS, HTML content, and JavaScript in one file. This is what Netlify serves at the domain root.

**Archived Version:**
- `original_index.html`: Prior iteration of the site, preserved for reference. Not linked from `index.html`. Not served at any active URL.

**Configuration:**
- `netlify.toml`: Declares `publish = "."`, `NODE_VERSION = "20"`, and three security response headers applied globally (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`)
- `CNAME`: Single line — `www.powderrhythm.com` — used by Netlify/DNS for custom domain routing

**Content Guidelines:**
- `STYLE_GUIDE.md`: Defines the fictional narrator character, voice rules, punctuation conventions, tone traps to avoid, and formatting conventions for blog entries. Must be consulted before writing any new blog content.

**Images:**
- `1000002317.jpg`: Referenced in the circus poster entry (450 KB)
- `1000002351.jpg`: Referenced in "The Wall" entry — shows Roller Dome corridor with construction and a stuffed tiger (636 KB)

## Naming Conventions

**Files:**
- Production HTML: `index.html` (lowercase, conventional web root)
- Archive HTML: `original_index.html` (descriptive prefix + underscore)
- Images: Device-generated numeric filenames (`1000002317.jpg`) — these are phone camera roll names with no semantic meaning; new images should use descriptive kebab-case names (e.g., `poster-tigers-pink.jpg`)
- Config/docs: UPPERCASE for project-level documents (`STYLE_GUIDE.md`, `CNAME`), lowercase for tooling config (`netlify.toml`)

**CSS Classes (inside `index.html`):**
- BEM-influenced but informal: `entry-header`, `entry-date`, `entry-rule`, `entry-tag`
- Component prefix pattern: `.site-nav`, `.blog-feed`, `.marquee-wrap`, `.marquee-inner`
- State classes: `.fallen` (brick), `.dragging` (pin), `.open` (tweaks panel), `.shown` (wall finale), `.active` (vibe button), `.new-tag` (nav link)
- Modifier pattern: `.pin-teal`, `.pin-yellow` (pin color variants); `.pin-card.paper`, `.pin-card.napkin`, `.pin-card.sticky`, `.pin-card.clipping`, `.pin-card.receipt`, `.pin-card.photo`, `.pin-card.setlist` (pin card type variants)

**HTML IDs:**
- Entry anchors: `#wall`, `#evidence`, `#circus`, `#the-thing`, `#why-good`, `#letter`, `#facts`
- Interactive widget roots: `#the-wall` (brick wall), `#board` (evidence board), `#strings` (SVG layer)
- Counter digits: `#cd-days`, `#cd-hours`, `#cd-mins`, `#cd-secs`
- Dynamic targets: `#bricks-left`, `#bricks-progress`, `#wall-finale`
- Ambient layers: `#stars`, `#snowflakes`
- UI panel: `#tweaks-panel`

## Blog Entry Structure

Each blog entry in `index.html` follows this pattern:

```html
<article class="entry" id="{anchor-id}">
  <div class="entry-header">
    <span class="entry-date">{Month DD, YYYY}</span>
    <div class="entry-rule"></div>
    <span class="entry-tag">{tag label}</span>
  </div>

  <div class="section">
    <div class="panel">
      <div class="panel-title">{title}</div>
      <p>...</p>
    </div>
  </div>

  <!-- optional: interactive widget -->
  <!-- optional: .testimonial block -->
</article>
```

Entries are ordered newest-first in the HTML. Navigation links in `<nav class="site-nav">` point to entry anchor IDs.

## Current Blog Entries (newest to oldest)

| Entry ID | Date | Nav Label | Key Feature |
|----------|------|-----------|-------------|
| `#wall` | April 28, 2026 | "The Wall" | Photo of Roller Dome construction + 12-brick interactive teardown |
| `#evidence` | April 22, 2026 | "The Evidence Board" | Draggable cork board with 9 pin types + SVG red yarn connections |
| `#circus` | (between evidence and the-thing) | "The Circus Poster" | Framed poster image (`1000002317.jpg`) |
| `#the-thing` | April 2, 2026 | "The Thing" | Origin post; also contains `#why-good`, `#letter`, `#facts` sub-sections |

## Where to Add New Code

**New Blog Entry:**
- Add a new `<article class="entry" id="{new-id}">` block inside `<div class="blog-feed">` in `index.html`
- Insert at the top of the feed (before `#wall`) so newest entries appear first
- Add a corresponding `<a href="#{new-id}">` link in `<nav class="site-nav">` with a `class="new-tag"` attribute
- Follow the entry structure pattern above and consult `STYLE_GUIDE.md` for voice

**New Interactive Widget:**
- Add widget HTML inside the entry's `<article>` where it appears in reading order
- Add widget CSS to the `<style>` block (append at bottom, grouped with a `/* WIDGET NAME */` comment header)
- Add widget JavaScript as a new IIFE inside the `<script>` block, guarded with an existence check (e.g., `const el = document.getElementById('my-widget'); if (!el) return;`)

**New Image:**
- Place the file in the repo root alongside existing images
- Use a descriptive kebab-case filename (e.g., `poster-roller-dome-exterior.jpg`)
- Reference via relative path: `src="poster-roller-dome-exterior.jpg"`

**New CSS Component:**
- Add to the `<style>` block in `index.html`
- Group under a comment banner using the existing pattern: `/* ═══════ COMPONENT NAME ═══════ */`
- Define CSS custom property tokens in `:root` if introducing new colors

**Updating Security Headers:**
- Edit `netlify.toml` — the `[[headers]]` block applies to `"/*"`

## Special Directories

**`.planning/`:**
- Purpose: GSD planning and codebase analysis artifacts
- Generated: Partially (codebase docs by agents, phase plans by humans/agents)
- Committed: Yes

**`.git/`:**
- Purpose: Git repository metadata
- Generated: Yes
- Committed: No (standard git ignore)

## Assets

All assets are flat in the repo root — no `assets/`, `images/`, or `static/` subdirectory exists. If the project grows, consider organizing under:
- `images/` for photos and illustrations
- `assets/` or `static/` for any future CSS/JS files extracted from `index.html`

---

*Structure analysis: 2026-05-01*
