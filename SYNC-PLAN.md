# Garden Mapper — Sync & Billing Build Plan
_Created: 2026-07-14. This is the master action plan for multi-device sync + payments._
_Status: Planning complete. Ready to build Phase 1._

---

## Context & Goal

Users need seamless cross-device sync without ever losing a garden. The system must:
- Never silently overwrite a garden
- Work for free-tier users (1 active garden) and subscribers (unlimited)
- Keep billing simple: Google Play + Stripe first, Apple later
- Be maintainable by a solo developer

---

## Core Rules (locked)

1. **Per-garden records** — each garden is its own DB row with a unique ID. No single-blob-per-user.
2. **Pull on sign-in, push on save** — never auto-push before the restore prompt resolves on a new device.
3. **Backups on Save button only** — last 3 snapshots per garden, local only. Pre-overwrite snapshot auto-created before any cloud pull.
4. **Conflict prompt with timestamps** — show device + time for both versions. User decides.
5. **Ghost entries** — cloud gardens always visible in list. Never deleted. CTA is dynamic:
   - Free tier + user has 1 active garden → "Subscribe to load"
   - Free tier + user has 0 active gardens → "Load" (no subscription needed)
   - Subscribed → "Load" always
   - CTA rechecks garden count dynamically on every render (not set at sign-in time)
6. **Pause cloud push on sign-in** — hold auto-save cloud push until restore prompt resolves.

---

## Phase 1 — DB Schema Redesign
_Prerequisite for everything else. Do this first._

### What changes
Current: one row per user, single `garden_json` blob.
New: one row per garden.

### New Supabase table: `gardens`

| Column | Type | Notes |
|--------|------|-------|
| `garden_id` | UUID (PK) | Generated client-side (crypto.randomUUID()) — stable across devices |
| `user_id` | UUID (FK → auth.users) | Owner |
| `garden_name` | text | Display name ("My Garden", "Backyard", etc.) |
| `device_id` | text | Device identifier — set once per install, stored in localStorage |
| `device_label` | text | Human-readable ("iPhone", "Chrome on PC") — shown in conflict prompt |
| `garden_json` | jsonb | Full garden state (same schema as localStorage v2) |
| `updated_at` | timestamptz | Set on every push. Used for conflict detection. |
| `subscription_required` | boolean | true if this garden exceeds free tier limit |
| `is_deleted` | boolean | Soft delete — never hard delete a garden row |

### RLS policy
- Users can only read/write their own rows (`user_id = auth.uid()`)
- No user can read another user's gardens

### Migration
- Drop old `gardens` table
- Create new schema above
- No data migration needed (beta, no real users yet)

### Files to update
- `supabase.js` — rewrite `fetchCloudGarden` + `pushCloudGarden` helpers for per-garden schema
- Supabase dashboard — run migration SQL

---

## Phase 2 — Sync Logic Rewrite
_Depends on Phase 1 DB._

### What changes in `useAuth.js`

**On sign-in (new device flow):**
1. Generate `device_id` if not in localStorage (one-time, permanent)
2. Fetch all cloud gardens for this user
3. Compare cloud gardens to local gardens by `garden_id`
4. For each cloud garden not in local → add to ghost list
5. If any ghosts exist → show restore prompt (see Phase 3 UI)
6. **Hold cloud push** until user resolves the prompt
7. After resolution → resume auto-save cloud push normally

**On sign-in (returning device — same device_id):**
1. Fetch cloud gardens
2. For each garden: compare `updated_at` cloud vs local `_lastSynced`
3. If cloud is newer → show conflict prompt with timestamps + device label
4. User chooses: Load cloud version OR Keep local
5. Pre-overwrite snapshot created automatically before any cloud pull

**Auto-save push (after sign-in resolution):**
- Push fires per-garden on every local save (existing 1.5s debounce)
- Payload: `{ garden_id, user_id, garden_name, device_id, device_label, garden_json, updated_at: now }`
- Never pushes Dream Garden

### What changes in `useSaveLoad.js`

**Add `_lastSynced` to local garden schema:**
- Written on every Save button press (not auto-save)
- Format: ISO timestamp

**Backup snapshots:**
- Trigger: Save button press only (not auto-save)
- Storage: localStorage key `gardenBackups_<garden_id>` → array of last 3 snapshots
- Each snapshot: `{ garden_json, savedAt, device_label }`
- Auto-snapshot before any cloud pull overwrites local

**Add `garden_id` to new gardens:**
- On garden creation: `garden_id = crypto.randomUUID()`
- On load of existing gardens without `garden_id`: assign one and save

---

## Phase 3 — Restore Prompt UI
_Depends on Phase 2._

### New device prompt (cloud gardens found, not in local)
```
┌─────────────────────────────────────────────┐
│  You have a garden saved from another device │
│                                              │
│  "My Backyard"  ·  iPhone  ·  July 14, 2:30 PM │
│                                              │
│  [Load it]          [Start fresh]            │
└─────────────────────────────────────────────┘
```
- "Load it" → garden added to local, becomes primary. Auto-save push resumes.
- "Start fresh" → cloud garden becomes ghost entry in list. Local stays as-is.

### Conflict prompt (same garden, cloud is newer)
```
┌─────────────────────────────────────────────┐
│  This garden was updated on another device   │
│                                              │
│  Cloud:  iPhone · July 14, 2:30 PM          │
│  Local:  This device · July 14, 9:00 AM     │
│                                              │
│  [Load cloud version]    [Keep local]        │
└─────────────────────────────────────────────┘
```
- Pre-overwrite backup created automatically before "Load cloud version" executes.
- Backup accessible via garden switcher backup slots.

### Garden list — ghost entries
- Cloud-only gardens shown greyed out at bottom of garden list
- CTA (dynamic, rechecks on every render):
  - 0 active local gardens → "Load" (free)
  - 1+ active local gardens, not subscribed → "Subscribe to load"
  - Subscribed → "Load"
- Ghost entries never deleted, even if user has no subscription
- If user deletes their last local garden → all ghost CTAs flip to "Load"

---

## Phase 4 — Billing Integration
_Separate session. Do not start until Phases 1–3 are confirmed working._

### Platforms (in build order)

**4a — Stripe (web)**
- Simplest integration. No app store review. 97% revenue kept.
- User pays at gardenmapper.ca/subscribe → Stripe webhook → set `subscription_flag = true` in Supabase
- What's needed:
  - Stripe account + product ("Garden Mapper Pro", $X/year)
  - Supabase Edge Function to receive Stripe webhook + update subscription flag
  - Simple `/subscribe` page on web (or modal)
  - Client reads `subscription_flag` from Supabase on sign-in to gate features
- Rule: never mention Stripe inside the iOS app (Apple rules)

**RevenueCat credentials (set up 2026-07-14)**
- Project ID: `a8a11c30`
- Dashboard: https://app.revenuecat.com/projects/a8a11c30
- SDK key (sandbox): `test_YCKSQRAwYqZVvgVNVCijNPLzEbS`
- **Secret API key:** `sk_qKzylJIQUiuVAQFdKFmvWCHwtefKL` *(server-side use only — not in client code)*
- SDK: `@revenuecat/purchases-capacitor` v13.2.2 — installed
- Hook: `app/src/hooks/useRevenueCat.js`
- Entitlement: `Garden Mapper Pro` (REST ID: `centl71cfe4f3a4`)
- Offering: `default` (ID: `ofrngcf29b202b5`)
- Package — lifetime: `prod3faa1b12bd` ($14.99 one-time)
- Package — yearly: `prod76de34c176` ($9.99/yr)
- **TODO before production:** Confirm email, replace sandbox key with live key, connect Google Play + App Store in RC dashboard

**4b — Google Play Billing**
- Required for Android in-app purchases (can't use Stripe inside Play Store app)
- What's needed:
  - Google Play Developer account ($25 one-time)
  - Capacitor plugin: `@capacitor-community/in-app-purchases` or RevenueCat SDK
  - Signed release build (not debug APK)
  - Server-side receipt validation → set subscription flag in Supabase
  - RevenueCat recommended — abstracts Play + Apple into one SDK
- Timeline: after Stripe is live and working

**4c — Apple StoreKit** *(deferred)*
- Requires: Mac, Xcode, Apple Developer Program ($99/yr), app review
- RevenueCat SDK handles most complexity if already added for Play
- Timeline: after Google Play is live

### Subscription flag flow
```
User subscribes (any platform)
  → payment provider confirms
  → webhook / receipt validation
  → Supabase: subscription_flag = true for user_id
  → client reads flag on next sign-in or refresh
  → ghost entry CTAs flip to "Load"
  → multi-garden limit lifted
```

### Free vs paid feature table
| Feature | Free | Subscribed |
|---------|------|-----------|
| 1 active garden | ✅ | ✅ |
| Dream Garden (read-only) | ✅ | ✅ |
| Cloud backup (1 garden) | ✅ | ✅ |
| Multiple active gardens | ❌ | ✅ |
| Load cloud gardens on new device | ❌ (ghost only) | ✅ |
| Cross-device sync | ❌ | ✅ |

---

## Build Order (sequential — do not skip ahead)

| Step | Phase | Session | Status |
|------|-------|---------|--------|
| 1 | DB schema redesign (new `gardens` table) | Session A | ✅ 2026-07-14 |
| 2 | Update `supabase.js` helpers for new schema | Session A | ✅ 2026-07-14 |
| 3 | `device_id` generation + `garden_id` on all gardens | Session A | ✅ 2026-07-14 |
| 4 | Sync logic rewrite (`useAuth.js`, `useSaveLoad.js`) | Session B | ✅ 2026-07-14 |
| 5 | Restore prompt + conflict prompt UI | Session B | ✅ 2026-07-14 |
| 6 | Ghost entry list + dynamic CTA | Session B | ✅ 2026-07-14 |
| 7 | Test: new device, conflict, ghost, backup | Session B | ✅ 2026-07-14 |
| 8 | Stripe integration (web) | Session C | 🔲 |
| 9 | Subscription flag enforcement in UI | Session C | 🔲 |
| 10 | Google Play Billing + RevenueCat | Session D | 🔲 |
| 11 | Apple StoreKit via RevenueCat | Session E (future) | 🔲 |

---

## Files Affected

| File | Change |
|------|--------|
| `supabase.js` | Rewrite cloud helpers for per-garden schema |
| `useAuth.js` | Sign-in flow, device_id, restore/conflict prompts |
| `useSaveLoad.js` | garden_id assignment, _lastSynced, backup snapshots |
| `GardenEditor.jsx` | Restore/conflict prompt UI, ghost garden list |
| Supabase dashboard | New table schema, RLS policy |
| New: `/subscribe` page or modal | Stripe checkout (Phase 4a) |

---

## Open Questions (resolve before Session A)

- [ ] Subscription price point — monthly or annual? How much?
- [ ] RevenueCat vs raw Play/Apple SDK — decision needed before Phase 4b
- [ ] `device_label` — auto-detect ("Chrome on Windows") or user-editable ("My Laptop")?

---

## Pricing (locked 2026-07-14)

| Tier | Price | What it gets |
|---|---|---|
| Free | $0 | 1 garden, Dream Garden, basic plants |
| One-time | **$14.99** | Lifetime — unlimited gardens, full sync, full plant DB |
| Annual | **$9.99/yr** | Same as one-time, billed yearly |
| Garden packs (future IAP) | **$0.99–$2.99** | Seasonal themes, rare plant packs, decor sets |

**Notes:**
- $9.99/yr is a launch price — plan to raise to $14.99/yr at ~6 months, grandfather existing subscribers
- Cosmetic IAP packs are non-paywalled upsells — free users can buy packs too
- Billing platforms: Stripe (web), Google Play Billing (Android), Apple StoreKit (iOS, future) — all via RevenueCat SDK

---

_Next: Start Session A — DB schema + supabase.js rewrite._
_Billing discussion: Session C (after sync is confirmed working)._
