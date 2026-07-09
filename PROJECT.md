# Garden Mapper - Project Status

_Last updated: 2026-07-08 (session 6)_
_Change history archived at: `memory/deep/garden-planner/project-history.md`_

---

## What It Is
A web-based garden planner — React + Vite + Konva canvas, 171 core + 36 pack plant stickers, colour variant picker, freeform/rect/circle draw tools, save/load, season theming, textures. Live at https://app.gardenmapper.ca.

---

## Current Phase: Plant Catalog Expansion + Colour Variants

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

## Dream Garden Update Workflow
1. Design at localhost:5200
2. Say **"update the Dream Garden to the website"** — I pull JSON, validate, bump version, commit + push
3. Web live at https://app.gardenmapper.ca in ~15s (auto-deploy)
4. Android: connect USB → double-click **Deploy Garden Mapper (Android)** shortcut on desktop

---

## Android Deploy
**One-click:** `app/deploy-android.bat` — builds web, syncs Capacitor, builds APK, installs via adb.
**Requirements:** Phone connected via USB with USB Debugging enabled (Developer Options).
**Manual steps:**
1. Enable Developer Options: Settings → About Phone → tap Build Number 7×
2. Enable USB Debugging in Developer Options
3. Connect USB → tap Allow on phone → run `deploy-android.bat`
**APK location:** `app/android/app/build/outputs/apk/debug/app-debug.apk`
**JAVA_HOME:** `C:\Program Files\Android\Android Studio\jbr`
**Android SDK:** `C:\Users\RG\AppData\Local\Android\Sdk`
**adb:** `C:\Users\RG\AppData\Local\Android\Sdk\platform-tools\adb.exe`
**Note:** USB only needed for install. App runs standalone on device after.

---

## Phase Status

| Phase | Status |
|-------|--------|
| Phase 1–6 | ✅ Complete (canvas, plants, draw tools, select/edit, save/load, seasons) |
| Phase 7 — Mobile & App Readiness | ✅ Complete |
| Capacitor.js — Android/iOS wrapper | 🔴 Next |
| V1 Backend — Supabase + Google/Apple auth | 🔲 After Capacitor |
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

### 🔴 Immediate
- **Maple Green + Red Leaf** — v1 stickers, need regen (watercolor style, no trunk). Resume when sticker limits reset.
- **Remove debug banner** — still in `GardenEditor.jsx` + `useAuth.js`. Remove before release.

### 🟡 In Progress
- **Plant catalog expansion** — full research complete for all 63 packs (~600 plants). See `research/PLANT-PACK-RESEARCH.md` for counts, `research/PLANT-STAGING.md` for schema rows ready to generate.
- **Plant pipeline** — PLANT-STAGING.md (~617 plants, all 63 packs). Workflow 0 + 0a in WORKFLOWS.md. Generate pack-by-pack with Rob's approval.
- **Completed packs:** `pack-fruit-pome.js` (4 stickers) ✅
- **Completed:** `pack-ferns-woodland.js` — 12/12 stickers done, live on web + Android ✅
- **Sticker template fix** — TEMPLATES dict synced to STICKER-PROMPT-GUIDE.md (2026-06-18). Workflow 0a enforces this going forward.
- **Colour variant rollout** — plan in `COLOUR-VARIANTS.md`. Chunk 1 next: Ornamental Cherry + Magnolia.
- **Fern pack files** — `pack-ferns-woodland.js` ✅ done. Still needed: `pack-ferns-tree.js` (5), `pack-ferns-evergreen.js` (8). Plants in PLANT-STAGING.md.
- **Core catalog searchMeta** — add `latinName`, `searchTerms`, `traits` to `usePlantCatalog.js` entries. Tropical pack needs same update.
- **Pack architecture** — 63 pack files defined (WORKFLOWS.md). Create on demand as plants are added. Core migration deferred.

### 🔲 Deferred
- **Google Sign-In** — Supabase `unexpected_failure`, needs device + USB to debug Auth logs.
- **Capacitor.js Android/iOS** — deferred until catalog expansion stable.
- **App icons + splash screen** — Rob designing.
- **Phase 8 Textures** — Rob designing.
- **Dream Garden** — say "update the Dream Garden to the website" when ready.
- **Sunny/shady areas, zoom clip, multi-device sync** — later phases.
- **SM campaign, pricing, gamification** — parallel track, non-blocking.
- **Parabolic Stocks crons** — disabled, re-enable when Rob says go.

### Architecture decisions (June 2026)
- **Auth:** Sign in with Google (Android) + Sign in with Apple (iOS, mandatory)
- **Billing:** Google Play Billing + Apple StoreKit — stores handle all payments, zero card data
- **Backend:** Thin FastAPI + Supabase Postgres — stores only: anon user ID + garden JSON + subscription flag
- **Onboarding:** Anonymous-first — start using immediately, login prompt on natural trigger
- **Migration:** localStorage → Supabase automatic on first sign-in, no data loss
- **Web:** Free/local only — try-it experience, upsells to app install. Web billing deferred.

---

## Key Files
| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Component tree, hooks, refs, layers — read before touching code |
| `LESSONS.md` | Project-specific bugs and patterns |
| `WORKFLOWS.md` | How-to guides for every repeatable task — start here |
| `REVISION-LOG.md` | Version history |
| `GAP-ANALYSIS.md` | Feature status |
| `SYNC-POLICY.md` | Cloud/local sync rules — read before any auth/storage work |
| `prototype/index-v8.html` | Working reference — read before any canvas/Konva work |
| `research/DECOR-PROMPT-GUIDE.md` | Decor sticker prompts + specs |

---

## Supabase
- **Project ID:** oxecjcdxkmtdgmdxlxyt
- **URL:** https://oxecjcdxkmtdgmdxlxyt.supabase.co
- **Anon key:** in `app/src/supabase.js`
- **Table:** `gardens` — `user_id`, `garden_json`, `subscription_flag`, `updated_at`
- **RLS:** on — users can only access their own rows
- **Dashboard:** https://supabase.com/dashboard/project/oxecjcdxkmtdgmdxlxyt
- **Sync policy:** `SYNC-POLICY.md` — read before touching any auth/storage code

## ⚠️ Large File Warnings — Confirm Before Loading
| File | Size | Rule |
|------|------|------|
| `research/PLANT-STAGING.md` | 131 KB | Read only the needed pack section via offset/limit. Consider splitting by category. |
| `app/src/components/GardenEditor.jsx` | 72 KB | Grep or offset/limit first. Consider splitting into smaller modules. |
_Rob flagged these 2026-07-08. Splitting plan TBD — raise with Rob at next relevant session._

## Standing Rules
1. Read `ARCHITECTURE.md` at session start
2. Read v8 before solving any canvas/visual/coordinate problem
3. One fix at a time — verify compile + behaviour before moving on
4. Commit after every confirmed working change
5. No session ends with uncommitted changes or stale docs
6. Port = 5200 always (never float)
7. Garden Organizer doc = `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q`
