# Garden Mapper - Project Status

_Last updated: 2026-06-10_
_Change history archived at: `memory/deep/garden-planner/project-history.md`_

---

## What It Is
A web-based garden planner — React + Vite + Konva canvas, 144 plant stickers + 20 decor + 3 fountains, freeform/rect/circle draw tools, save/load, season theming, textures. Ported from vanilla JS prototype (index-v8.html). Live at https://app.gardenmapper.ca.

---

## Current Phase: 7 — Mobile & App Readiness (in progress)

### Resume Phrase
`resume Garden Mapper React scaffold`

---

## Dev Setup
```
cd projects/garden-planner/app && npm run dev
```
- **Dev:** http://localhost:5200 (pinned — never floats)
- **Live:** https://app.gardenmapper.ca (Vercel, auto-deploys from GitHub main ~15s)
- **GitHub:** https://github.com/Keyholestudio/garden-mapper
- **Reference prototype:** `prototype/index-v8.html`
- **Garden Organizer doc:** `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q`

---

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 1–6 | ✅ Complete (canvas, plants, draw tools, select/edit, save/load, seasons) |
| Phase 7 — Mobile & App Readiness | 🟡 In Progress |
| Phase 8 — Textures & Visual Polish | 🔲 Planned |

---

## Architecture — Key Components

| Component | Role |
|-----------|------|
| `GardenEditor.jsx` | Top-level shell, owns all state |
| `RightPanel.jsx` | Desktop/tablet: properties + tool menu |
| `MobileSheet.jsx` | Mobile: bottom sheet with plant grid + tools |
| `toolMenuData.jsx` | Shared tool menu data + ToolMenu component |
| `LogoBar.jsx` | Top bar; mobile: season cycle (left) + profile (right) |
| `BottomBar.jsx` | Season slider (desktop/tablet floating pill) |
| `GardenCanvas.jsx` | Konva stage, grid, pan/zoom, touch, drag-drop target |
| `useSaveLoad.js` | Versioned save/load, backup slot, migration |
| `useDreamGarden.js` | Baked-in seed + silent background fetch from GitHub |

## Layout by Breakpoint

| Breakpoint | Layout |
|---|---|
| Mobile (< 600px) | Full canvas + MobileSheet bottom sheet |
| Tablet / Desktop (≥ 600px) | Left plant tray + canvas + right panel + floating season slider |

## Save System (v2)
- Schema v2, backup slot (`gardenData_backup`), migration on load
- Dream Garden always at index 0, protected from deletion, `_isDreamGarden: true`
- Free tier = 1 user garden (Dream Garden excluded from count)

---

## Open Items
- **#9 Dream Garden** — `useDreamGarden.js` live; trigger: "update the Dream Garden to the website" (see L028)
- **#11 Sunny/shady areas** — deferred
- **#12 Multi-device sync** — deferred; needs backend + user accounts
- **#32 Zoom-in clips right panel** — known limitation (L027); workaround: refresh after zooming in
- **L026 fixes** — copy button disabled for groups; copied rects need dragend/merge wiring
- **Sticker review** — Rob to flag any needing regeneration
- **Phase 8 Textures** — Rob designing; send images when ready
- **Items 16–19** — SM campaign, robs-lab.ca, gamification, pricing
- **Plant submission cron** — form → Gemini sticker → approval → CDN
- **Capacitor.js** — deferred (needs Android Studio or Mac)
- **TS build error** — pre-existing in main.tsx; fix before Capacitor

---

## Key Files
| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Component tree, hooks, refs, layers — read before touching code |
| `LESSONS.md` | Project-specific bugs and patterns |
| `REVISION-LOG.md` | Version history |
| `GAP-ANALYSIS.md` | Feature status |
| `prototype/index-v8.html` | Working reference — read before any canvas/Konva work |
| `research/DECOR-PROMPT-GUIDE.md` | Decor sticker prompts + specs |

---

## Standing Rules
1. Read `ARCHITECTURE.md` at session start
2. Read v8 before solving any canvas/visual/coordinate problem
3. One fix at a time — verify compile + behaviour before moving on
4. Commit after every confirmed working change
5. No session ends with uncommitted changes or stale docs
6. Port = 5200 always (never float)
7. Garden Organizer doc = `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q`
