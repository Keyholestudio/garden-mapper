# Garden Mapper — User-Submitted Sticker Request Feature
## Roadmap Document

---

## Feature Overview (User-Facing)

**"Can't find your plant? Request it!"**

Users browsing the sticker catalog who can't find a specific plant will see a **"Request this plant"** button. They enter the plant name, optionally upload a photo reference, and submit. The system handles everything automatically — generating a sticker, getting it reviewed, and notifying the user when it's live.

This turns missing plants from friction into a feature. Every request improves the catalog for everyone.

---

## User Flow

```
1. User searches for a plant → not found in catalog
2. "Request this plant" prompt appears
3. User fills in:
   - Plant common name (required)
   - Scientific name (optional)
   - Photo reference (optional — their garden, a reference image)
   - Regions they grow it in (checkboxes: CA / US / FR / GB / AU)
4. Request submitted → user sees "Thanks! We'll notify you when it's ready."
5. Background: AI generates sticker using master prompt template
6. Rob reviews in admin panel → Approve / Reject / Edit
7. On approval: sticker added to live catalog, tagged with the requesting region(s)
8. User receives in-app notification (and optional email): "Your [Plant Name] sticker is now available!"
```

---

## Technical Components

### Component 1 — Submission Form
**Effort: Small**

| Item | Detail |
|---|---|
| UI | Simple modal or drawer in the plant picker. 3–4 fields max. |
| Validation | Plant name required. Photo optional (max 5 MB, image types only). |
| Deduplication | Check against existing catalog + pending queue before accepting. Show "already requested" if duplicate. |
| Storage | Store in `sticker_requests` DB table with status: `pending / generating / review / approved / rejected`. |
| Rate limiting | Max 3 requests per user per day (prevent spam). |

---

### Component 2 — AI Generation Pipeline
**Effort: Medium**

| Item | Detail |
|---|---|
| Trigger | On new request submission (async, queued — not blocking the UI). |
| Prompt builder | Auto-compose prompt using master style template + plant name + region + optional photo reference. |
| AI provider | OpenAI DALL-E 3 or Recraft.ai API (configurable). |
| Output | Generate 3 variants per request (pick best in review). |
| Photo reference handling | If user uploaded a photo, include it as an `image_url` reference in the DALL-E prompt for style guidance (not as the output). |
| Post-processing | Auto-run through Vectorizer.ai API or SVGO to convert PNG → SVG + optimise. |
| Cost | ~$0.04–0.12 per request (3 variants × DALL-E HD pricing). Acceptable at low request volume. |
| Queue | Use a simple job queue (BullMQ, or a cron-checked DB status field at MVP). |

---

### Component 3 — Admin Review UI
**Effort: Medium**

| Item | Detail |
|---|---|
| Access | Admin-only route (Rob only). Simple auth check. |
| Queue view | List of pending stickers with: plant name, region, requestor username, generated preview (3 variants). |
| Actions | ✅ Approve (select best variant) / ❌ Reject (with optional reason) / ✏️ Edit (re-trigger generation with modified prompt) |
| Metadata | On approve: assign sticker ID, size tier, regions, categories. |
| Throughput goal | Rob should be able to review and approve a sticker in under 60 seconds. |
| Notification trigger | Approval → triggers user notification (see Component 5). |

---

### Component 4 — Catalog Update
**Effort: Small**

| Item | Detail |
|---|---|
| Storage | Approved SVG stored in CDN / static file store (S3-compatible or Supabase Storage). |
| Catalog DB | Add row to `stickers` table: `id`, `sticker_id`, `plant_name`, `regions`, `size`, `category`, `svg_url`, `tier`. |
| Cache invalidation | Invalidate or update the sticker sprite sheet / catalog JSON on approval. |
| Versioning | Catalog versioned (e.g. `catalog-v42.json`) so app knows when to refresh. |
| Rollback | Rejection simply sets status = `rejected`; no live changes made. |

---

### Component 5 — User Notification
**Effort: Small**

| Item | Detail |
|---|---|
| In-app | Push notification or in-app bell notification: "[Plant] sticker is now live!" |
| Email | Optional — simple transactional email via Resend/Postmark. Low priority for V2. |
| Deep link | Notification links directly to the newly added plant sticker in the picker. |

---

## Version Assignment

| Version | Rationale |
|---|---|
| **V2** | Reasonable fit. The catalog and core planner are V1. By V2, the user base is large enough to generate meaningful requests. The admin pipeline is lightweight enough not to need a team. |
| V3 if... | You want a fully automated (zero-Rob-review) pipeline. That requires higher AI confidence + community voting to replace manual approval. Save for V3. |

**Recommendation: Target V2.** Manual review by Rob at V2 volume (tens of requests/month) is sustainable. Automate more in V3.

---

## Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Image generation API key | 🔴 Not yet | OpenAI or Recraft.ai account + billing set up |
| Vectorizer.ai API (optional) | 🔴 Not yet | For PNG → SVG post-processing |
| Admin review UI | 🔴 Not built | New admin route needed |
| Plant catalog DB schema | 🟡 Needed at V1 | Must define `stickers` table and `sticker_requests` table in V1 to make V2 easier |
| CDN / file storage | 🟡 Needed at V1 | Set up S3-compatible storage for SVG assets |
| User accounts / auth | 🟡 Assumed for V2 | Requestor tracking requires user identity |
| Notification system | 🟡 Lightweight | Can start with email only, in-app later |
| Job queue | 🔴 Not yet | BullMQ or DB-polled queue for async generation |

---

## Rough Effort Summary

| Component | Effort | Who |
|---|---|---|
| Submission form (UI + DB) | Small (1–2 days) | Frontend + backend |
| AI generation pipeline | Medium (3–5 days) | Backend |
| Admin review UI | Medium (2–4 days) | Frontend |
| Catalog update + CDN | Small (1 day) | Backend + DevOps |
| User notification | Small (1 day) | Backend |
| **Total** | **~8–13 days** | Full-stack sprint |

---

## Future V3 Extensions

- **Community voting:** Users can upvote existing requests → prioritises Rob's review queue.
- **Auto-approval:** High-confidence AI output (score > threshold) skips review queue entirely.
- **Bulk import:** Rob can paste a CSV of 50 plants and trigger batch generation overnight.
- **Plant database integration:** Auto-fill scientific name, regions, size from a plant API (e.g. Open Farm, Trefle API) when user submits a request.
- **User-contributed stickers:** Power users can submit their own hand-drawn SVGs for review.

---

*Roadmap last updated: 2026-05-26*
