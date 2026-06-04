# Garden Mapper - Project Status

_Last updated: 2026-06-03_

---

## What It Is
A web-based garden planner with a Konva canvas, 104 plant stickers, freeform + rect draw tools, save/load, and season theming. Built as a React + Vite + Konva scaffold ported from a working vanilla JS prototype (index-v8.html).

---

## Current Phase: 7 - Mobile & App Readiness (in progress)

### Resume Phrase
`resume Garden Mapper React scaffold`

---

## Dev Setup
```
cd projects/garden-planner/app && npm run dev
```
- Frontend: **http://localhost:5200** (pinned - never floats)
- Git: initialized in `projects/garden-planner/`
- Reference prototype: `prototype/index-v8.html` - always open for comparison
- Garden Organizer doc: `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q` (use `gog docs cat` - see L014)

---

## Status

| Phase | Status |
|-------|--------|
| Phase 1 - Canvas, grid, pan, zoom | ✅ Complete |
| Phase 2 - Plant catalog, tray, click-to-place | ✅ Complete |
| Phase 3 - Draw tools (freeform + rect + circle) | ✅ Complete |
| Phase 4 - Select + edit (transformer, handles, right panel) | ✅ Complete |
| Phase 5 - Save/load localStorage + garden switcher | ✅ Complete |
| Phase 6 - Season themes, promo banner, logo bar | ✅ Complete |
| Phase 7 - Mobile & App Readiness | 🟡 In Progress |
| Phase 8 - Textures & Visual Polish | 🔲 Planned |

---

## June 1 Changes (Rob's doc notes - all committed)

| # | Feature | Commit | Status |
|---|---------|--------|--------|
| 1 | Toolbar → right panel (two-level menu, ← Back) | `0137157` | ✅ |
| 1B | Decks/Hedges/Pools as nested expandable groups | `1b6d523` | ✅ |
| 2 | Gate moved to Fences; order: Fence→Gate→Hedges | `963d0ec` | ✅ |
| 3 | Plumbing moved to Water; order: Fountain/Plumbing/Pools/Pond | `963d0ec` | ✅ |
| 4 | Touch press-drag + tap-to-place for all square objects | `76e674c` | ✅ |
| 5 | Tool menu scales to fit panel (no scroll) | `26fdd8f` | ✅ |
| 5B | Reverted flex-stretch on desktop/tablet; mobile-only scaling | `afdb18d` | ✅ |
| 6 | Plant tray text bumped to 12px to match panel | `04ea2c7` | ✅ |
| 7 | Dark green logo bar separator (2px #11502A) | `ea2f577` | ✅ |
| 8 | Drag-to-place plants from tray (HTML5 drag+drop) | `65280aa` | ✅ |
| 9 | Dream garden - deferred until #10 confirmed + Rob creates it | - | 🔲 |
| 10 | Super saves - versioned schema + backup slot + migration | `ea2f577` | ✅ |
| 11 | Sunny/shady garden areas - deferred | - | ⏳ |
| 12 | Multi-device sync - needs server architecture discussion | - | 🔲 |
| 13 | Mobile season cycle button (top-left tap-to-advance) | `9dc9365` | ✅ |
| 14 | "Need a plant? Submit it!" - no-results link to Google Form | `0d5b5b0` | ✅ |
| 20 | Mobile edit panel (tap object → name/colour/dims/layers/delete) | `6a2efe9` | ✅ |
| 21 | Mobile undo button (handle bar, both panels) | `52d3d91` | ✅ |
| 22 | Mobile plant panel: Copy button | `c06ef28` | ✅ |
| 23 | Desktop/tablet ← Back button on plant + struct panels | `69b5fe1` | ✅ |
| 24 | Mobile: Edit Points button for line-based structs (bed, path, fence, etc.) | `cdd92d7` | ✅ |
| 25 | Mobile: Save button (💾) in top-right of mobile logo bar | `cdd92d7` | ✅ |
| 26 | Fix: square tap-place now opens shape panel (not main menu) | `cdd92d7` | ✅ |
| 27 | Recently Used plants - persistent, all 3 surfaces, hide/clear/remove | `6c495f1` | ✅ |
| 28 | Mobile profile 👤 menu - Gardens, Export, Submit Plant, Settings (soon), Subscription (soon), Website | `928b573` | ✅ |
| 29 | Disconnect available on mobile struct panel | `e27e8ba` | ✅ |
| 30 | Plant corners-only transformer; structs keep full 8 anchors | `e27e8ba` | ✅ |
| 31 | Double-tap debounce 350ms on freeform point placement | `ae2e775` | ✅ |
| 32 | No default sub-tool - user picks explicitly each time | `ae2e775` | ✅ |
| 33 | Min point guards before shape closes; red corners fix | `ae2e775` | ✅ |
| 34 | No-flip on plant resize (boundBoxFunc) | `ae2e775` | ✅ |
| 35 | Undo/delete return to main menu (handleUndo + clearSelection) | `040aa58` | ✅ |
| 36 | Mobile sheet spacing tightened | `bc6d417` | ✅ |
| Lock | 🔓/🔒 Lock button on plants + structs - all surfaces, persists save/load | `0a0ef83` | ✅ |
| Tool hint | Removed alternate hint text from active tool buttons | `880a07a` | ✅ |
| Mobile sub-menu widths | Group buttons (Decks/Hedges/Pools + children) fixed - 3-col grid, display:contents, no full-width stretch | `50bd5ce` | ✅ |
| Sub-menu colours | Group-header lavender, children lighter lavender/purple trim | `4340340` | ✅ |
| Dream Garden hybrid | `useDreamGarden.js` - baked-in seed + silent remote fetch. `src/data/dreamGarden.json` placeholder. | `25fd4ea` | ✅ |
| **Sticker catalog** | 104 transparent PNGs generated via Gemini CDP batch scripts. All wired into `usePlantCatalog.js`. Old checkerboard PNGs removed. | `405a3a8` | ✅ |

### Additional polish (June 1)
- Season slider → frosted floating pill over canvas (`95583df`)
- Transparent backing + larger text on slider (`c598c5e`, `6e3066a`)
- Drag ghost shrunk to 48×48px (`2bb420b`)
- Mobile bottom sheet: plant grid + tool menu + toggle (`8f39d0c`)
- Plant grid expands on search focus, tools hide when keyboard open (`8096fa1`)
- Season button moved to top-left, user icon top-right (`a2c254a`)
- Port pinned to 5200, vite.config fixed (`a25e3c8`)

---

## Architecture - Key Components

| Component | Role |
|-----------|------|
| `GardenEditor.jsx` | Top-level shell, owns all state |
| `RightPanel.jsx` | Desktop/tablet: properties + tool menu |
| `MobileSheet.jsx` | Mobile: bottom sheet with plant grid + tools |
| `toolMenuData.jsx` | Shared tool menu data + ToolMenu component (used by both) |
| `LogoBar.jsx` | Top bar; mobile has season cycle button (left) + profile (right) |
| `BottomBar.jsx` | Season slider (desktop/tablet floating pill only) |
| `GardenCanvas.jsx` | Konva stage, grid, pan/zoom, touch, drag-drop target |
| `useSaveLoad.js` | Versioned save/load with backup slot + migration |

---

## Layout by Breakpoint

| Breakpoint | Layout |
|---|---|
| Mobile (< 600px) | Full canvas + MobileSheet bottom sheet; season = tap-to-cycle button top-left |
| Tablet (600-1024px) | Left plant tray + canvas + right panel + floating season slider |
| Desktop (> 1024px) | Same as tablet |

---

## Save System (v2)
- Schema version stamped on every save (`_schemaVersion: 2`)
- Backup slot: `gardenData_backup` - auto-updated before each write
- Migration: old saves upgraded on load (missing fields filled with defaults)
- `exportGardensJSON()` ready to wire to a "Download Backup" button

---

## Open Items
- **Sticker review** — Rob to review 104 stickers live in app; flag any needing regeneration
- **Structural stickers** — Raised bed outline, Cold frame, Trellis/arch, Greenhouse — PNG format, same pipeline. Review tomorrow.
- **Tier 3 stickers** — regional/specialty (~20), deferred indefinitely
- **#9** Dream garden — system built; Rob designs garden when ready, exports JSON, sends to Computer
  - `DREAM_GARDEN_URL` in `useDreamGarden.js` = placeholder until GitHub repo is public
- **Deploy** — leaf-courag URL deploy method unknown (Netlify? Vercel?). Ask Rob.
- **GitHub remote** — not yet set up. Need this before updating dream garden remote URL.
- **#12** Multi-device — deferred; needs backend + user accounts
- **Phase 8** Textures — planned next major phase
- **Items 16–19** SM campaign, robs-lab.ca, gamification, pricing
- **Plant submission cron** — form → Gemini sticker → Rob approval → CDN → sticker-manifest.json fetch. Apple-compliant.
- **Capacitor.js** wrapper — deferred (needs Android Studio or Mac)
- **TS build error** — pre-existing in main.tsx (doesn't affect dev server; fix before Capacitor)

---

## Key Files
| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Component tree, hooks, refs, layers - read before touching code |
| `LESSONS.md` | Project-specific bugs and patterns (L010-L014) |
| `REVISION-LOG.md` | Version history per change |
| `GAP-ANALYSIS.md` | Feature status |
| `prototype/index-v8.html` | Working reference - read before canvas/Konva work |
| `garden-organizer-export.txt` | Latest export of Garden Organizer Google Doc |

---

## Standing Rules
1. Read `ARCHITECTURE.md` at session start
2. Read v8 before solving any canvas/visual/coordinate problem
3. One fix at a time - verify compile + behaviour before moving on
4. Commit after every confirmed working change
5. No session ends with uncommitted changes or stale docs
6. Port = 5200 always (never float)
7. Garden Organizer doc = `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q`
