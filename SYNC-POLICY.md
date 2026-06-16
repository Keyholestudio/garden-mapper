# Garden Mapper — Sync Policy
_Locked: 2026-06-16. Reference this before building any auth, sync, or storage code._

---

## Core Rule
**Cloud wins on empty local. Local wins when local data exists.**

---

## Decision Table

| Scenario | Action |
|---|---|
| Local has gardens, user is signed in | Local is source of truth. Sync local → cloud on save (debounced). |
| Local is empty/missing, user is signed in | Pull from cloud first. Prompt user to restore. Never auto-write empty → cloud. |
| Local has gardens, user is NOT signed in | App works fully offline. No cloud interaction. |
| Local is empty, user is NOT signed in | Fresh start. Empty canvas. No cloud to restore from. |
| Local has gardens, cloud has different/newer gardens | Show merge prompt (V2). For V1: cloud wins on conflict — pull cloud, merge local on top (newest garden timestamp wins per-garden). |
| App uninstall + reinstall | Same as "local is empty, user is signed in" — restore prompt on next open. |
| Supabase is unreachable | App works fully from local. Sync retries silently in background. Never block UI on cloud failure. |

---

## Sync Trigger Rules
- **On save:** debounced 1.5s after any change → write to local first, then push to cloud if signed in
- **On open:** check local → if empty and signed in → fetch cloud → restore prompt
- **On sign-in:** if local gardens exist → push local to cloud (first sync). If cloud has gardens and local is empty → restore prompt.
- **Never:** auto-overwrite cloud with empty/blank local data under any circumstance

---

## Restore Prompt (on empty local + signed in)
> "We found your saved garden in the cloud. Restore it?"
> [Restore] [Start Fresh]

- "Restore" → pull cloud gardens → replace local → sync resumes normally
- "Start Fresh" → user explicitly acknowledges data won't be restored → local stays empty → cloud is NOT overwritten until user creates new content and saves

---

## Data Model (what gets synced)
Each user record in Supabase contains:
- `anon_user_id` — anonymous UUID (no email, no name)
- `garden_json` — full garden state (same schema as localStorage v2)
- `subscription_flag` — boolean
- `updated_at` — timestamp for conflict resolution

No PII. No email. No device info.

---

## V1 vs V2 Scope
| Feature | V1 (build now) | V2 (later) |
|---|---|---|
| Local save | ✅ | ✅ |
| Cloud backup on sign-in | ✅ | ✅ |
| Restore prompt on reinstall | ✅ | ✅ |
| Multi-device sync | ✅ (single garden slot) | ✅ (multi-garden) |
| Manual merge UI | ❌ | ✅ |
| Conflict resolution | Cloud wins (simple) | Per-garden timestamp |
| Offline queue (sync when reconnected) | ❌ | ✅ |

---

## Files This Policy Affects
- `useSaveLoad.js` — add cloud write on save + restore-on-open logic
- `GardenEditor.jsx` — restore prompt UI
- `supabase.js` (new) — Supabase client + garden read/write helpers
- `useAuth.js` (new) — sign-in state, triggers first sync on login
