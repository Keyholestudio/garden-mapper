# Garden Mapper — Data Persistence & Save System Roadmap
_Last updated: 2026-06-09_

---

## The Problem

Gardens are currently saved in browser localStorage, scoped to a single origin (domain + port).
This means:
- Different Cloudflare tunnel URLs = different localStorage = data appears lost
- Clearing browser cache = data gone permanently
- No cross-device access
- No protection against our own updates breaking saved data

**Rule: localhost:5200 is for building. Tunnel URLs are for demos only.**

---

## Save Tier System

Garden Mapper will offer two save tiers. The user chooses at first launch (or from Settings):

### Tier 1 — Guest Mode ("I don't need an account")
- Saves to localStorage on the current device/browser
- Auto-backup: 3 rolling slots (every 10 min, rotates oldest)
- User can restore from backup via Gardens > Backup Slots
- Works on any browser, zero signup
- **Limitation:** data is device+browser bound. Clearing cache = data loss. No cross-device.
- Shown clearly: "Your garden is saved on this device only."

### Tier 2 — Account Mode ("Create an account")
- Google / email sign-in
- Gardens saved to server DB tied to account
- Auto-syncs on every save (debounced)
- 2 versioned backups per garden (restore previous version)
- Works on any device — phone, tablet, web
- **This is the robs-lab.ca/gardenmapper experience**

The choice is non-destructive: a Guest user can upgrade to an account and their localStorage gardens migrate to the server. They never lose data by upgrading.

---

## Build Phases

### Phase 1 — Sticker Continuity (In Progress)
**Goal:** Updates to stickers never break saved gardens.
**Rule:** Never delete a sticker key. Replace in-place or alias forward. Retired stickers get `hidden: true`.
**Status:** L025 written. Needs enforcement on every sticker session.
**Code:** `usePlantCatalog.js` — add `hidden` filter to `PLANT_CATALOG_TRAY`.

---

### Phase 2 — Auto-Backup (Tier 1 hardening) — Pre-Launch
**Goal:** Guest users have 3 rolling backup slots. Restoring a backup is one tap.

**What changes:**
- `useSaveLoad.js`: on every save, rotate `gardenData_backup_1/2/3` with timestamps
- Gardens switcher UI: "Backups" tab shows last 3 auto-saves with timestamps
- Restore: loads backup slot into active garden (with confirm dialog)

**Estimated effort:** 1–2 sessions
**Protects against:** accidental Clear All, our own update bugs, user error

---

### Phase 2b — Notes Field Migration Entry — Pre-Launch
**Goal:** Ensure `notes` field added to beds/electrical/plumbing today is explicitly covered in schema migration.

**What to add in `useSaveLoad.js` migration block:**
- On load, if a struct of type `bed`, `bed-square`, `underground-electrical`, or `underground-plumbing` has no `notes` field, default it to `''`
- Currently defaults gracefully via `d.notes || ''` in the panel — but should be explicit in migration for Phase 3 consistency

Estimated effort: 15 minutes. Fold into Phase 3 work.

---

### Phase 3 — Schema Migration Hardening — Pre-Launch
**Goal:** Loading an old saved garden never crashes or silently loses shapes.

**What it fixes:**
- New fields added to shapes (e.g. `notes`) default gracefully on old saves — already mostly working
- Unknown shape types (e.g. old `water-fountain` type after a rename) render as a visible placeholder instead of disappearing
- Unknown sticker keys show a "missing sticker" placeholder image instead of a blank space
- Schema version gate: if a save is from a version too old to migrate, warn the user instead of loading corrupt data
- Dry-run validator: I can run this before shipping any structural change to catch what would break

**Estimated effort:** 1 session
**Protects against:** our updates silently corrupting user gardens

---

### Phase 4 — Save Tier Choice UI — Pre-Launch
**Goal:** User chooses Guest or Account mode at first launch or from Settings.

**What changes:**
- `SetupOverlay.jsx` (or a new `WelcomeOverlay`): first-launch screen asks "Save locally" vs "Create account"
- `useGardenState.js`: add `saveMode: 'local' | 'account'` to app state, persisted in localStorage
- Settings menu: allow switching save mode + "Sign in / Sign out"
- Guest → Account migration: on sign-in, push all localStorage gardens to server, then switch to account mode

**Estimated effort:** 2–3 sessions (UI + auth plumbing)

---

### Phase 5 — Server Backend + Accounts (Launch = robs-lab.ca) — #12
**Goal:** Full cloud save, cross-device, multi-garden per user.

**Stack recommendation:**
- **Auth:** Supabase Auth (Google + email, free tier, no infra to manage)
- **DB:** Supabase Postgres — `gardens` table: `(id, user_id, name, data JSON, updated_at, version)`
- **API:** Supabase client SDK — no custom backend needed for MVP
- **Hosting:** Vercel (frontend) + Supabase (data) — both free tier at launch scale

**Garden save flow:**
1. User places a shape → debounced 1.5s autosave (already exists)
2. Autosave calls `supabase.from('gardens').upsert(...)` with full JSON blob
3. On load, fetch from Supabase first, fall back to localStorage if offline
4. Keep 2 versioned snapshots per garden in a `garden_versions` table (last 2 saves before current)

**Versioned backup (2 slots):**
- On every save, copy current `data` to `garden_versions` before overwriting
- UI: Gardens > "Restore previous version" shows last 2 snapshots with timestamps
- User never sees raw JSON — it's just "Version from 2 hours ago"

**Estimated effort:** 3–4 sessions to full launch-ready

---

### Phase 6 — Mobile App (Post-Launch)
**Goal:** Capacitor.js wrapper for iOS/Android, on-device storage, offline-first sync.

**How save works on mobile:**
- Capacitor `@capacitor/preferences` replaces localStorage
- Offline: saves to device storage, queues sync
- Online: pushes to Supabase on reconnect
- Same JSON schema as web — one codebase

**Dependency:** Requires Phase 5 (accounts) first.
**Estimated effort:** 2–3 sessions once Phase 5 is stable.

---

## Dream Garden — Status & Build Plan

**Current state:** Infrastructure fully built (`useDreamGarden.js`, `dreamGarden.json` placeholder, `DREAM_GARDEN_URL` pointing to GitHub). The Gardens tab shows "🌸 Dream Garden" as slot 0 but it's empty — waiting for Rob to design it.

**Build process:**
1. Build your Dream Garden at `localhost:5200` (slot 0 or any garden)
2. When ready: export via `exportGardensJSON()` → extract that garden's JSON
3. Save to `app/src/data/dreamGarden.json` (bump `_dreamVersion`)
4. Commit → push to GitHub
5. Update `DREAM_GARDEN_URL` in `useDreamGarden.js` to point to raw GitHub URL
6. All new users see your Dream Garden as their default starting point

**Note:** The Dream Garden is seeded once per device. Existing users who already have gardens are not affected — `seedDreamGarden()` is a no-op if gardens already exist in localStorage.

---

## Tunnel vs Local — Standing Rule

| Use case | URL to use |
|---|---|
| Building / designing | `localhost:5200` |
| Showing someone else | Cloudflare tunnel URL |
| Testing cross-device | Cloudflare tunnel (demo only — no saved data) |

**Every new tunnel URL is a fresh localStorage bucket. Never build in a tunnel.**
Gardens built at `localhost:5200` will be the source of truth until Phase 5 (server accounts) ships.

---

_This doc is the source of truth for the save system architecture. Update when phases complete._
