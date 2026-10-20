# Garden Planner — Revision Log

_Tracks changes per version. One fix at a time — verify compile + behaviour before moving on._
_History for v1–v7 and Phases 1–6 archived at: `memory/deep/garden-planner/revision-history.md`_

---

## Current: React Scaffold — Phase 7 (Mobile & App Readiness)
**Base:** Vite + React + Konva. Runs on http://localhost:5175 (or next available port).
**Git:** Initialized in `projects/garden-planner/`. Commit after every confirmed change.
**Reference:** `prototype/index-v8.html` — always open for comparison.
**Last commit:** a30184f (Phase 7.1 touch input + PWA manifest)

---

### Phase 7 — Completed

| # | Change | Commit | Status |
|---|--------|--------|--------|
| 7.1 | Touch input — pinch-to-zoom + 1-finger pan (native DOM touch events in GardenCanvas.jsx) | a30184f | ✅ |
| 7.4 | PWA manifest + viewport meta + iOS apple-mobile-web-app tags | a30184f | ✅ |
| — | `useBreakpoint.js` — mobile/tablet/desktop detection wired into GardenEditor | a30184f | ✅ |
| — | Responsive CSS foundation — mobile hides sidebars, tablet bigger touch targets, `touch-action: none` | a30184f | ✅ |
| — | `vite.config.js` — `allowedHosts: 'all'`, `host: true` | a30184f | ✅ |
| — | `start.bat` — clean tunnel startup script | a30184f | ✅ |

### Phase 7 — Pending

| # | Change | Status |
|---|--------|--------|
| 7.3 | Mobile bottom-sheet — plant grid (2-col), stripped logo bar, tools in sheet | b1fef50 | ✅ |
| 7.6 | Garden switcher unlock upsell row + 2-garden free tier enforced | a9f3039 | ✅ |
| 7.7 | PDF export — 1-page + 4-page tiled, numbered callouts, legend | 49c87d3 | ✅ |
| 7.7 | Export polish — crops to propBounds, legend on own page, number centering | 8bba0b4 | ✅ |
| — | **2026-06-09 — Decor/Sticker/Panel standardization session** | |
| — | DECOR-PROMPT-GUIDE.md created (research/) | eac3280 | ✅ |
| — | sticker-batch-decor.py cleaned up (BOM, prompt template, arch size fix L→XL) | eac3280 | ✅ |
| — | 5 new pot stickers replace 3 old terracotta pots | 14848f6 | ✅ |
| — | L023: complete decor-add checklist added to LESSONS.md | eac3280 | ✅ |
| — | Fountain merge: FOUNTAIN_CATALOG → DECOR_CATALOG; Fountains moved to Decor menu | 221d9c2 | ✅ |
| — | Panel standardization: Copy+Lock → Fwd/Back → Transparent → Delete on all panels | ee5f63b | ✅ |
| — | isDecor branch: Decor/Fountain panels hide seasons+notes, show Delete not Remove Plant | ee5f63b | ✅ |
| — | Notes added to beds ("this bed"), electrical ("this electrical"), plumbing ("this plumbing") | ee5f63b | ✅ |
| — | Struct copy (handleCopyStruct): rect/circle/line, undo-aware, offset 24px | 34fa8a1 | ✅ |
| — | iPad touch confirmation — run start.bat, open tunnel URL, verify pinch/pan | ⏳ Untested |
| 7.2 | Tablet layout — confirm current layout works touch-enabled (minimal changes) | 🔲 |
| 7.3 | Mobile layout — bottom-sheet redesign per `design/mockup-mobile.jpg` | 🔲 |
| 7.4b | App icons — 192px + 512px PNGs in `app/public/icons/` | 🔲 |
| 7.5 | Capacitor.js wrapper for App Store | 🔲 |
| 7.6 | Garden switcher — more slots / JSON export | 🔲 |
| 7.7 | PDF/PNG export | 🔲 |
| 7.8 | Onboarding flow | 🔲 |

---

---

## Phase 8 — Lazy Pack System + New Stickers
**Goal:** Split flat catalog into on-demand packs. Scales to 500+ stickers with no boot penalty.
**Base commit:** 132579b

| # | Change | Commit | Status |
|---|--------|--------|--------|
| 8.1 | `src/data/packs/` — core + new pack files | 9d84a0d | ✅ |
| 8.2 | `usePlantCatalog.js` — async pack loader hook | 0654258 | ✅ |
| 8.3 | `PlantTray.jsx` — pack toggle buttons + CSS | 0654258 | ✅ |
| 8.4 | Add 36 new stickers to lookup table (cacti/succulents/tropicals/feverfew) | — | 🔲 |
| 8.5 | Generate + approve stickers one by one | — | 🔲 |

---

---

## Plant Tray Scroll Memory (2026-09-21)
**Goal:** Remember scroll position in the plant tray across open/close cycles. Scroll-to-plant when Back is pressed from a plant panel.
**Before state:** MobileSheet.jsx — no scroll refs, no scroll restore logic. `expanded` toggle only saves expand state to sessionStorage.
**Files changed:** `MobileSheet.jsx`

| # | Change | Commit | Status |
|---|--------|--------|--------|
| — | Save scrollTop to sessionStorage on full collapse | f9f2717 | ✅ |
| — | Restore scrollTop on expand (query === '' only) | f9f2717 | ✅ |
| — | Track lastSelectedKey ref; on Back (selectedPlant clears), scroll-to-item in allEntries | f9f2717 | ✅ |

---

## Decor Sprint — 2026-10-17

| # | Change | Commit | Status |
|---|--------|--------|--------|
| — | Benches decor — wood (default), stone, iron (3 variants, all 4 files) | c910b05 | ✅ |
| — | Sheds decor — weathered (default), cedar, pine (3 variants, all 4 files) | ac5b1ab | ✅ |
| — | Wheelbarrows decor — side (default), front (2 variants, all 4 files) | 46157ce | ✅ |
| — | DECOR-DATABASE.md updated, PROJECT.md pending decor list added | — | ✅ |

---

## Decor + Pack Sprint — 2026-10-20

| # | Change | Commit | Status |
|---|--------|--------|---------|
| — | Trellis decor category — Wooden Trellis (default), Wooden Lattice, Metal Trellis | `7f2c56d` | ✅ |
| — | DECOR-DATABASE updated for Trellis; L104 logged (always update databases) | `565b78f` / `9cf6af1` | ✅ |
| — | Wheelbarrows → Tools rename (label only, keys/filenames unchanged) | `0fd4ec3` | ✅ |
| — | Shovel sticker added to Tools category (`decor_tool-shovel_M`) | `0fd4ec3` | ✅ |
| — | Tree Trunks pack — 1 tray entry (Oak), 4 colour variants (Dead, Birch, Cherry, Cedar) | `dfafca4` | ✅ |

---

_Add new entries above this line. Archive completed phases when this file exceeds ~4KB._
