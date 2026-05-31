# Garden Mapper — Gap Analysis
_Last updated: 2026-05-31_
_Full confirmed-working feature list archived in `memory/deep/garden-planner/revision-history.md`_

---

## ❌ Not Yet Implemented

| Feature | Priority | Notes |
|---|---|---|
| Last-used garden index persisted | 🟢 Low | Refresh always loads garden[0] |
| PDF export | 🔵 Deferred | Long-term to-do |
| Undo for point add/remove/move in edit mode | 🔵 Deferred | Complex — skip for now |
| Hide "Edit Shape" for square objects | 🔵 Deferred | Cosmetic — bed-sq, building, deck-sq, pool-sq, hedge-sq |

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
| Onboarding flow | 🟡 Should | 🔲 Light guided first-run |
| Persist last-used garden index | 🟢 Low | 🔲 Trivial carry-forward |
| Hide "Edit Shape" for square objects | 🟢 Low | 🔲 Cosmetic polish |
