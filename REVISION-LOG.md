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
| — | iPad touch confirmation — run start.bat, open tunnel URL, verify pinch/pan | ⏳ Untested |
| 7.2 | Tablet layout — confirm current layout works touch-enabled (minimal changes) | 🔲 |
| 7.3 | Mobile layout — bottom-sheet redesign per `design/mockup-mobile.jpg` | 🔲 |
| 7.4b | App icons — 192px + 512px PNGs in `app/public/icons/` | 🔲 |
| 7.5 | Capacitor.js wrapper for App Store | 🔲 |
| 7.6 | Garden switcher — more slots / JSON export | 🔲 |
| 7.7 | PDF/PNG export | 🔲 |
| 7.8 | Onboarding flow | 🔲 |

---

_Add new entries above this line. Archive completed phases when this file exceeds ~4KB._
