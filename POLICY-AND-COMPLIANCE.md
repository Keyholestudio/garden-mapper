# POLICY-AND-COMPLIANCE.md — Garden Mapper

_Internal reference doc. Not for public distribution._
_Owner: Rob's Lab | Review: Quarterly | Last updated: September 2026_

---

## Purpose

This document is the single internal reference for everything related to Garden Mapper's privacy policy, data practices, and compliance obligations. It explains what we collect, why, where it lives, what the rules are, and what to do when things change.

**At each quarterly review:** read this doc, update it if anything has changed, then update the live privacy policy on Wix to match.

---

## Quick Reference — Key Files & Links

| What | Where |
|------|-------|
| **Live privacy policy (Wix)** | gardenmapper.ca/privacy-policy _(deploy from draft below)_ |
| **Privacy policy draft** | `tmp/privacy_policy_draft.md` _(canonical source — copy to Wix)_ |
| **Website & Marketing Copy doc** | [Google Doc](https://docs.google.com/document/d/1EzufYIC1cRrNuxcQLSS9jS0-5j0Lc3LNNn8wcwmyX2Q/edit) — Page 9 has policy text (keep in sync with draft) |
| **Garden Organizer doc** | [Google Doc](https://docs.google.com/document/d/1F3mA5UZw1qo2wxd3pqMuSvyph3L4biChiJ18kbhRf5Q/edit) — security checklist + status page subscriptions appended |
| **Quarterly calendar event** | Google Calendar — "Garden Mapper — Quarterly Privacy & Security Review" every 3 months from Sep 9, 2026 |
| **Supabase dashboard** | https://supabase.com/dashboard/project/oxecjcdxkmtdgmdxlxyt |
| **Contact email (public)** | garden.mapper.app@gmail.com |

---

## What Data We Actually Collect

### Anonymous users (no account)
| Data | Where stored | We can access it? |
|------|-------------|-------------------|
| Garden layouts | Browser localStorage / Android device storage | ❌ No |
| Device UUID (random, generated once) | localStorage | ❌ No |

### Signed-in users
| Data | Where stored | We can access it? |
|------|-------------|-------------------|
| Email address | Supabase auth.users | ✅ Yes |
| Garden name | Supabase `gardens.garden_name` | ✅ Yes — stored as-is |
| Full garden layout JSON | Supabase `gardens.garden_json` | ✅ Yes |
| Device UUID + label (e.g. "Android · Chrome") | Supabase `gardens.device_id / device_label` | ✅ Yes |
| Subscription status | Supabase `user_subscriptions` | ✅ Yes |

### Important notes
- **Garden names are free text** — a user could type their home address. The policy warns them not to, but we can't prevent it. If a user requests deletion, their garden_name is included.
- **Email comes from Google/Apple Sign-In** — we receive it via Supabase auth, we don't ask for it directly.
- **Device UUID purpose** — used for multi-device sync conflict resolution only. Not a customer identity tool. Signed-in users are identified by `user_id` (Supabase UUID tied to email).
- **IP addresses** — we do not collect them in our code. Supabase, Stripe, Vercel etc. may log them server-side as part of normal infrastructure. They are processors; we are the data controller.
- **Competition submissions** — if a user submits to the competition, their garden name and design become public. Covered in policy with explicit consent language.

---

## Third-Party Services — What They Do & Why

| Service | Role | Data they receive | Their privacy policy |
|---------|------|-------------------|---------------------|
| Supabase | Cloud DB + auth | Garden data, email, device info | supabase.com/privacy |
| Google Sign-In | Authentication | Email, name (we only store email) | policies.google.com/privacy |
| Apple Sign-In | Authentication _(iOS, coming)_ | Email | apple.com/legal/privacy |
| Stripe | Web billing | Payment details _(we never see card)_ | stripe.com/privacy |
| Google Play Billing | Android billing | Purchase receipt | policies.google.com/privacy |
| Apple StoreKit | iOS billing _(coming)_ | Purchase receipt | apple.com/legal/privacy |
| RevenueCat | Subscription mgmt (Android/iOS) | Purchase receipt, user ID | revenuecat.com/privacy |
| Wix Analytics | Anonymous web traffic | Page views, no personal IDs | wix.com/about/privacy |
| Vercel | Web hosting | Server access logs (incl. IP) | vercel.com/legal/privacy-policy |

**Rule:** If a new service is added to this list, update the privacy policy BEFORE the integration goes live.

---

## Data Deletion — How It Works

- **Who controls it:** We are the data controller. Supabase is our processor. We can delete any user's data at any time via the Supabase dashboard or API — no dependency on Supabase's timeline.
- **How to delete a user:** In Supabase → Authentication → Users → delete user. Also delete their rows in `gardens` and `user_subscriptions`.
- **Commitment in policy:** "As soon as reasonably possible, within 30 days." We can realistically do it in minutes.
- **Local data:** We cannot delete localStorage or on-device data — user must clear browser data or uninstall.

---

## Breach Notification Plan

### How we find out
Subscribe to status/security email alerts for every service (see checklist in Garden Organizer doc):
- status.supabase.com
- status.stripe.com
- status.revenuecat.com
- www.vercel-status.com
- workspace.google.com/status
- status.wix.com
- GitHub → Settings → Security alerts

All alerts go to: **garden.mapper.app@gmail.com**

### PIPEDA (Canada) — our primary obligation
- Clock starts when **we** become aware of a breach — not when it occurred
- If breach poses "real risk of significant harm": notify affected users + Office of the Privacy Commissioner of Canada
- No fixed deadline in hours, but "as soon as feasible" — treat as 72 hours from awareness
- Log the breach: date discovered, what data, how many users, what we did

### GDPR (if EU users)
- 72-hour window from awareness to notify supervisory authority
- Notify affected users "without undue delay"
- As user base grows, assess whether formal GDPR compliance steps are needed

### How we notify users
| User type | Method |
|-----------|--------|
| Signed-in (have email) | Direct email — legal obligation overrides communication preferences |
| Anonymous (no email) | Persistent in-app banner on next open + notice on gardenmapper.ca |

---

## Advertising & Marketing Integrations

**Current status (September 2026):** No advertising networks, tracking pixels, or social media tags active on Wix or in the app.

**Rule:** Before enabling any Wix marketing integration (Facebook Pixel, Google Ads, TikTok, etc.) — update the privacy policy first.

**How to check:** Wix dashboard → Marketing & SEO → Marketing Integrations.

---

## Compliance Laws That Apply to Us

| Law | Who it covers | Key obligation |
|-----|--------------|---------------|
| **PIPEDA** | Canadian users (our primary) | Breach notification, data deletion on request, collect only what's needed |
| **GDPR** | EU/UK users | 72hr breach notice, right to erasure, data portability |
| **CalOPPA / CCPA** | California users | Privacy policy must be posted; don't sell data |
| **COPPA** | US children under 13 | We disclaim collecting from under-13s; don't market to children |

We are a small Canadian indie developer. We are not currently required to appoint a formal GDPR Data Protection Officer (threshold: >250 employees or high-risk processing). Reassess if EU user base grows significantly.

---

## Quarterly Review Checklist

_(Also in Google Calendar event description)_

**Privacy policy**
- [ ] Any new features added that collect new data?
- [ ] Any new third-party services added?
- [ ] Any new Wix marketing integrations enabled?
- [ ] Effective date current?
- [ ] Policy live on Wix and matching this doc?

**Security**
- [ ] 2FA confirmed on all 9 services (Supabase, Play Console, Google, Stripe, RevenueCat, Wix, GitHub, Rob's Lab email, Vercel)
- [ ] Passwords strong and unique?
- [ ] No unexpected API keys or active sessions?

**Data**
- [ ] Supabase gardens table — any unexpected data?
- [ ] Any outstanding user deletion requests? (check garden.mapper.app@gmail.com)
- [ ] Play Store data safety declaration still accurate?

**Legal**
- [ ] Any new privacy laws relevant to Canada, US, or EU?
- [ ] PIPEDA breach plan still documented?

---

## Change Log

| Date | What changed |
|------|-------------|
| September 2026 | Initial policy audit. Added Stripe, RevenueCat, Wix Analytics. Updated contact email to garden.mapper.app@gmail.com. Added garden name warning, email/device disclosures, competition clause, breach plan, deletion timeline, advertising rule. |

_Add a row here every time the policy or this doc is updated._
