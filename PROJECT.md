# Garden Mapper - Project Status

_Last updated: 2026-06-15_
_Change history archived at: `memory/deep/garden-planner/project-history.md`_

---

## What It Is
A web-based garden planner — React + Vite + Konva canvas, 144 plant stickers + 20 decor + 3 fountains, freeform/rect/circle draw tools, save/load, season theming, textures. Ported from vanilla JS prototype (index-v8.html). Live at https://app.gardenmapper.ca.

---

## Current Phase: Capacitor.js — Android/iOS App Wrapper (IN PROGRESS)

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

### 🔴 Immediate (next session)
- **Fix Google Sign-In** — Supabase returning `unexpected_failure` on token exchange. Steps to try:
  1. Try sign-in again (Google propagation delay — may just work now)
  2. If still failing: Supabase dashboard → **Logs → Auth** → check error after sign-in attempt
  3. If logs show `invalid_client`: verify Web Client ID + Secret in Supabase Auth → Providers → Google
  4. If logs show `redirect_uri_mismatch`: add `https://oxecjcdxkmtdgmdxlxyt.supabase.co/auth/v1/callback` to Google Web client
  5. Remove debug banner from `GardenEditor.jsx` + `useAuth.js` once sign-in confirmed working
- **App icons + splash screen** — deferred (Rob designing)

### 🟡 Soon
- **Test on Apple device (iPad/iPhone)** — add iOS Capacitor platform, build via Xcode, sideload for smoke test
- **Supabase + auth** — Sign in with Google (Android) + Sign in with Apple (iOS mandatory)
- **Google Play Developer account** — Rob to set up ($25 one-time)
- **Apple Developer account** — Rob to set up when iOS ready ($99 USD/year)
- **L026 fixes** — copy button disabled for groups; copied rects need dragend/merge wiring
- **Remaining stickers** — Feverfew, Astilbe, 7 cacti, Sandstone Large

### 🔲 Deferred
- **Natural edges for beds/hedges** — flat dark border reads as unnatural. Three options (pick one or combine): A) variable-width/feathered stroke (~1h), B) softer border colour match (~10min, try first), C) perimeter-tiled foliage PNG (~4–6h). Phase 8 visual polish.
- **#9 Dream Garden** — design at localhost:5200, say "update the Dream Garden to the website" (L028)
- **#11 Sunny/shady areas** — sun sticker + radial gradient overlay
- **#12 Multi-device sync** — covered by Supabase backend plan
- **#32 Zoom-in clips right panel** — known limitation (L027); workaround: refresh
- **Phase 8 Textures** — Rob designing; send images when ready
- **SM campaign, robs-lab.ca, gamification, pricing** — parallel track, non-blocking
- **Plant submission cron** — form → Gemini sticker → approval → CDN (V3)

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

## Standing Rules
1. Read `ARCHITECTURE.md` at session start
2. Read v8 before solving any canvas/visual/coordinate problem
3. One fix at a time — verify compile + behaviour before moving on
4. Commit after every confirmed working change
5. No session ends with uncommitted changes or stale docs
6. Port = 5200 always (never float)
7. Garden Organizer doc = `1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q`
