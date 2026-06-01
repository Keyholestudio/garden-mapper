# Garden Mapper — Gap Analysis
_Last updated: 2026-05-31_
_Full confirmed-working feature list archived in `memory/deep/garden-planner/revision-history.md`_

---

## ❌ Not Yet Implemented

| Feature | Priority | Notes |
|---|---|---|
| PDF export | 🔵 Deferred | Long-term to-do |
| Undo for point add/remove/move in edit mode | 🔵 Deferred | Complex — skip for now |

---

## 🚀 Phase 7 — Mobile & App Readiness

| Feature | Priority | Status |
|---|---|---|
| Touch input — pinch-to-zoom + 1-finger pan | 🔴 Must | ✅ Done (a30184f) — iPad test pending |
| Responsive layout — mobile bottom-sheet | 🔴 Must | 🔲 Mockup: `design/mockup-mobile.jpg` |
| Tablet layout — current layout + touch | 🔴 Must | 🔲 Minimal changes needed |
| PWA manifest + viewport meta + iOS tags | 🔴 Must | ✅ Done (a30184f) |
| App icons — 192px + 512px PNGs | 🔴 Must | 🔲 Needed in `app/public/icons/` |
| Capacitor.js wrapper | 🟡 Should | 🔲 App Store path |
| Garden switcher — more slots / JSON export | 🟡 Should | 🔲 2-garden limit is a real constraint |
| PDF / PNG export | 🟡 Should | 🔲 Most-requested feature category |
| Onboarding flow | 🟡 Should | 🔲 Defer until layout is stable (post 7.2/7.5) |
| Persist last-used garden index | ✅ Done | ebf8ede — localStorage key `gardenLastIndex` |
| Hide "Edit Shape" for square objects | ✅ Done | 271cc6f + 45d71e8 — button + dblclick blocked |

---

## 🚀 Phase 8 — Textures & Visual Polish *(planned)*

| Feature | Priority | Notes |
|---|---|---|
| Tiled texture fills | 🟡 Should | Grass, gravel, soil, roof tiles — Konva.Pattern fill, clips to shape boundary |
| Texture library | 🟡 Should | Small set of 64–256px tileable PNGs (royalty-free or generated) |
| Per-shape texture picker | 🟡 Should | Replace/augment colour swatches in RightPanel for texturable types |
| Curved shape clipping | ✅ Built-in | Konva clips pattern to shape boundary automatically — no extra work needed |
