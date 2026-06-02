# Garden Mapper — Project Status

_Last updated: 2026-06-02_

---

## What It Is
A web-based garden planner with a Konva canvas, 36 plant stickers, freeform + rect draw tools, save/load, and season theming. Built as a React + Vite + Konva scaffold ported from a working vanilla JS prototype (index-v8.html).

---

## Current Phase: 7 — Mobile & App Readiness (in progress)

### Resume Phrase
`resume Garden Mapper React scaffold`

---

## Dev Setup
```
cd projects/garden-planner/app && npm run dev
```
- Frontend: **http://localhost:5200** (pinned — never floats)
- Git: initialized in `projects/garden-planner/`
- Reference prototype: `prototype/index-v8.html` — always open for comparison
- Garden Organizer doc: `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q` (use `gog docs cat` — see L014)

---

## Status

| Phase | Status |
|-------|--------|
| Phase 1 — Canvas, grid, pan, zoom | ✅ Complete |
| Phase 2 — Plant catalog, tray, click-to-place | ✅ Complete |
| Phase 3 — Draw tools (freeform + rect + circle) | ✅ Complete |
| Phase 4 — Select + edit (transformer, handles, right panel) | ✅ Complete |
| Phase 5 — Save/load localStorage + garden switcher | ✅ Complete |
| Phase 6 — Season themes, promo banner, logo bar | ✅ Complete |
| Phase 7 — Mobile & App Readiness | 🟡 In Progress |
| Phase 8 — Textures & Visual Polish | 🔲 Planned |

---

## June 1 Changes (Rob's doc notes — all committed)

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
| 9 | Dream garden — deferred until #10 confirmed + Rob creates it | — | 🔲 |
| 10 | Super saves — versioned schema + backup slot + migration | `ea2f577` | ✅ |
| 11 | Sunny/shady garden areas — deferred | — | ⏳ |
| 12 | Multi-device sync — needs server architecture discussion | — | 🔲 |
| 13 | Mobile season cycle button (top-left tap-to-advance) | `9dc9365` | ✅ |
| 14 | “Need a plant? Submit it!” — no-results link to Google Form | `0d5b5b0` | ✅ |
| 20 | Mobile edit panel (tap object → name/colour/dims/layers/delete) | `6a2efe9` | ✅ |
| 21 | Mobile undo button (handle bar, both panels) | `52d3d91` | ✅ |
| 22 | Mobile plant panel: Copy button | `c06ef28` | ✅ |
| 23 | Desktop/tablet ← Back button on plant + struct panels | `69b5fe1` | ✅ |
| 24 | Mobile: Edit Points button for line-based structs (bed, path, fence, etc.) | `cdd92d7` | ✅ |
| 25 | Mobile: Save button (💾) in top-right of mobile logo bar | `cdd92d7` | ✅ |
| 26 | Fix: square tap-place now opens shape panel (not main menu) | `cdd92d7` | ✅ |

### Additional polish (June 1)
- Season slider → frosted floating pill over canvas (`95583df`)
- Transparent backing + larger text on slider (`c598c5e`, `6e3066a`)
- Drag ghost shrunk to 48×48px (`2bb420b`)
- Mobile bottom sheet: plant grid + tool menu + toggle (`8f39d0c`)
- Plant grid expands on search focus, tools hide when keyboard open (`8096fa1`)
- Season button moved to top-left, user icon top-right (`a2c254a`)
- Port pinned to 5200, vite.config fixed (`a25e3c8`)

---

## Architecture — Key Components

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
| Tablet (600–1024px) | Left plant tray + canvas + right panel + floating season slider |
| Desktop (> 1024px) | Same as tablet |

---

## Save System (v2)
- Schema version stamped on every save (`_schemaVersion: 2`)
- Backup slot: `gardenData_backup` — auto-updated before each write
- Migration: old saves upgraded on load (missing fields filled with defaults)
- `exportGardensJSON()` ready to wire to a "Download Backup" button

---

## Open Items
- **#9** Dream garden — Rob creates when ready; needs a finalized garden first
- **#12** Multi-device — deferred; needs backend + user accounts
- **#14** Incomplete in doc — awaiting Rob's additions
- **Phase 8** Textures — planned next major phase
- **Capacitor.js** wrapper — deferred (needs Android Studio or Mac)

---

## Key Files
| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Component tree, hooks, refs, layers — read before touching code |
| `LESSONS.md` | Project-specific bugs and patterns (L010–L014) |
| `REVISION-LOG.md` | Version history per change |
| `GAP-ANALYSIS.md` | Feature status |
| `prototype/index-v8.html` | Working reference — read before canvas/Konva work |
| `garden-organizer-export.txt` | Latest export of Garden Organizer Google Doc |

---

## Standing Rules
1. Read `ARCHITECTURE.md` at session start
2. Read v8 before solving any canvas/visual/coordinate problem
3. One fix at a time — verify compile + behaviour before moving on
4. Commit after every confirmed working change
5. No session ends with uncommitted changes or stale docs
6. Port = 5200 always (never float)
7. Garden Organizer doc = `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q`
