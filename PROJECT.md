# Garden Mapper — Project Status

_Last updated: 2026-05-31_

---

## What It Is
A web-based garden planner with a Konva canvas, 36 plant stickers, freeform + rect draw tools, save/load, and season theming. Built as a React + Vite + Konva scaffold ported from a working vanilla JS prototype (index-v8.html).

---

## Current Phase: 7 — Mobile & App Readiness

### Resume Phrase
`resume Garden Mapper React scaffold`

---

## Dev Setup
```
cd projects/garden-planner/app && npm run dev
```
- Frontend: http://localhost:5175 (or next available port)
- Git: initialized in `projects/garden-planner/`
- Reference prototype: `prototype/index-v8.html` — always open for comparison

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
| All 10 previously untested features | ✅ Confirmed working (2026-05-31) |
| Phase 7 — Mobile & App Readiness | 🟡 In Progress |
| Phase 8 — Textures & Visual Polish | 🔲 Planned |

---

## App Strategy

**Target:** PWA → Capacitor.js → App Store (Google Play + Apple App Store)
**Path:** One React codebase → three deployment targets (web, iOS, Android)
**Monetization:** App Store listing provides visibility + legitimacy

### Layout Breakpoints (per mockups in `design/`)
| Breakpoint | Layout |
|---|---|
| Mobile (phone) | Canvas top ~60%, bottom sheet with plant tray + 2×4 tool grid + season slider |
| Tablet (iPad) | Current desktop layout — left tray, canvas center, right panel, bottom toolbar |
| Desktop (web) | Current layout unchanged |

Mockups: `design/mockup-mobile.jpg`, `design/mockup-tablet.jpg`

---

## Phase 7 — Next Steps

### Must-have (blocking deployment)
- [x] 7.1 Touch input — Konva pinch-to-zoom + 1-finger pan ✅ (commit a30184f)
- [x] 7.2 Tablet layout — wider tray/panel, bigger buttons ✅ (commit 14d669f)
- [x] 7.3 Mobile layout — bottom-sheet with plant grid ✅ (commit b1fef50)
- [x] 7.4 PWA manifest + viewport meta + iOS tags ✅ (commit a30184f)
- [x] 7.4b App icons — 192px + 512px placeholder PNGs ✅ (commit 749a578)

### Infrastructure
- [x] Breakpoint hook (`useBreakpoint.js`) — mobile/tablet/desktop detection wired into GardenEditor ✅
- [x] Responsive CSS foundation — mobile hides sidebars, tablet gets bigger touch targets ✅

### LAN Testing
- Dev server with `--host`: `npx vite --host` → `http://10.0.0.71:5174`
- iPad: open Safari on same WiFi, go to that URL. Pinch + pan should work immediately.

### Should-have
- [ ] 7.5 Capacitor.js wrapper — deferred (needs Android Studio or Mac)
- [x] 7.6 Garden switcher — unlock upsell row, 2-garden free tier ✅ (commit a9f3039)
- [x] 7.7 PDF export — 1-page + 4-page tiled, numbered callouts, legend ✅ (commit 8bba0b4)
- [x] 7.9 Persist last-used garden index ✅ (commit ebf8ede)
- [x] 7.10 Hide Edit Shape + block dblclick for all rect/circle types ✅ (commit 45d71e8)
- [ ] 7.8 Onboarding flow — defer until layout stable (post 7.2/7.5)

### Low priority / quick wins
- [ ] 7.9 Persist last-used garden index
- [ ] 7.10 Hide "Edit Shape" for square objects

---

## Future Roadmap Topics *(to discuss — not yet scoped)*
- **Monetization** — pricing model, free tier vs paid, App Store pricing
- **Gamification** — badges, streaks, planting milestones
- **User accounts** — auth, cloud save, multi-device sync
- **Sandbox / test environment** — staging vs live, test users
- **Marketing / promotion** — launch strategy, social, App Store ASO

---

## Key Files
| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Component tree, hooks, refs, layers, struct types — read before touching code |
| `GAP-ANALYSIS.md` | Feature status vs v8 prototype, Phase 7 roadmap |
| `REVISION-LOG.md` | Version history, per-change checklist |
| `LESSONS.md` | Project-specific bugs and patterns |
| `prototype/index-v8.html` | Working reference — read before any canvas/Konva work |
| `stickers/` | 36 plant PNG stickers |
| `app/` | React scaffold (Vite + Konva) |

---

## Sticker Catalog
- 36 plants confirmed in catalog
- Art style: PvZ × Stardew Valley — bold, retro game feel
- Junction: `app/public/stickers` → `../stickers/`
- Research: `research/STICKER-ROADMAP.md`, `research/STICKER-STRATEGY.md`

---

## Standing Rules
1. Read `ARCHITECTURE.md` at the start of every coding session
2. Read v8 before solving any canvas/visual/coordinate problem
3. One fix at a time — verify compile + behaviour before moving on
4. Commit after every confirmed working change
5. No session ends with uncommitted changes or stale docs
