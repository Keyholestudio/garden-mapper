# Garden Mapper — Music & Audio Plan

_Created: 2026-08-18 | Updated: 2026-09-08_

---

## Goal

Create a short, loopable theme song for Garden Mapper. Vibe: lighthearted, plucky, playful — Roller Coaster Tycoon-style charm with real garden ambience layered on top. No licensing fees — fully generated or self-recorded.

---

## Concept

- **Style:** Whimsical, plucky acoustic instruments, light xylophone
- **Mood:** Cheerful, warm, indie-garden energy
- **Reference:** Roller Coaster Tycoon OST — upbeat, loopable, slightly nostalgic
- **Background texture:** Children chatting softly, real nature sounds (bugs, frogs, birds)
- **Rob's plan:** Record nature ambience locally (already has good source material) and layer over AI-generated base track
- **No vocals** — purely instrumental
- **Format:** Loopable (seamless loop for in-app use)

---

## AI Music Tools — Research (2026-08-18)

| Tool | Best For | Free Tier | Commercial Rights | Notes |
|------|----------|-----------|-------------------|-------|
| **[Suno](https://suno.com)** | Full song generation, vocals/lyrics | Yes (limited) | Paid plan required | Most impressive outputs. Text prompt → full song in seconds. 50M+ users. Had RIAA lawsuit, settled with Warner. Paid = commercial use. |
| **[Udio](https://udio.com)** | Detailed style control, instrumentals | Yes (limited) | Paid plan required | More granular control than Suno. Better for pure instrumental/ambient. Same post-lawsuit legal situation. |
| **[SOUNDRAW](https://soundraw.io)** | Royalty-free, legally airtight | Yes (limited generations) | ✅ All plans | Trained on in-house music only — zero grey area. Bar-level editing, genre blending, STEM exports. **Best legal position for a shipped app.** |
| **[Beatoven.ai](https://beatoven.ai)** | Mood + scene-based generation | Yes | ✅ Perpetual license on download | Prompt → track. Good for background/ambient. Simple workflow. |
| **[AIMusicGen.ai](https://aimusicgen.ai)** | Quick no-signup experimentation | Yes (generous) | ✅ Copyright-free output | No account needed. Great for fast prototyping. |

### Recommendation

**Prototype on Suno** (free tier, fastest results, most expressive). Once the vibe is confirmed, **generate the final track on SOUNDRAW** — cleanest commercial license, STEM export means Rob can layer his own nature recordings on top in Audacity (free).

---

## Workflow

1. **Prototype** — use Suno free tier to explore vibe/mood
2. **Confirm** — Rob approves the general feel
3. **Final generation** — regenerate on SOUNDRAW (commercial license)
4. **Layer** — import SOUNDRAW STEM into Audacity, add Rob's nature recordings (bugs, frogs)
5. **Export** — final MP3/OGG for in-app use
6. **Implement** — add to Dream Garden / app splash or ambient layer

---

## Suno Prompt (starting point)

```
Whimsical garden theme, plucky acoustic instruments, light xylophone, playful and cheerful,
children laughing softly in background, Roller Coaster Tycoon style, no lyrics, loopable,
60–90 seconds
```

Variants to try:
- Add `"acoustic guitar, recorder flute"` for a more folk feel
- Add `"pizzicato strings"` for a storybook feel
- Add `"ukulele"` for a lighter/cuter tone

---

## Animated Stickers (related)

Plan: AI-generated animated characters for the Dream Garden (promotional material).

Characters planned:
- 🐿️ Squirrel
- 🐦 Robin
- 👩‍🌾 Farmer / Gardener

**Workflow idea:** Generate animations in Gemini → remove background (same pipeline as current stickers) → export as animated PNG/WebP. Needs investigation — Gemini can generate animation frames but not native PNG sequences directly. To explore next session.

Pricing (from website copy doc, Rob to confirm which 2 are free):
- Cat — free candidate
- Chipmunk — free candidate
- Squirrel — $0.99 IAP
- Robin — $0.99 IAP (implied)
- Gardener — $1.99 IAP
- Bundle (Cat + Squirrel + Gardener) — $3.99 IAP

---

## Status

- [ ] Prototype tracks on Suno
- [ ] Rob approves vibe
- [ ] Final track on SOUNDRAW
- [ ] Rob records nature ambience
- [ ] Mix in Audacity
- [ ] Implement in app
- [ ] Animated stickers — workflow to be investigated

---

## Notes

- Music and animated stickers are both promo/Dream Garden material — coordinate timing
- Rob wants to record real bugs/frogs locally — high quality, evocative of a real garden
- Apple App Store coming soon — animated creature stickers can also be teased as IAP in promo material
