# Lawn Textures — Enable / Disable Guide

_Last updated: 2026-07-08_

The seasonal lawn texture (repeating grass image inside the property boundary rect) is currently **disabled**.
To re-enable or swap textures, update all locations listed below. Missing even one will result in partial/inconsistent behaviour (some seasons showing texture, others not).

---

## Current State

| Setting | Value |
|---|---|
| Textures enabled | ❌ No — all disabled |
| Last disabled | 2026-07-08 (commit `9b059ec`) |
| Reason | Distracting, obscures grid visibility |

---

## To Re-Enable Textures (3 files, 3 locations)

### 1. `app/src/components/GardenCanvas.jsx`

**What it controls:** Initial texture on stage init + texture swap on season change (both desktop and mobile).

**Line ~36:**
```js
const LAWN_TEXTURES_ENABLED = false  // ← change to true
```

That single flag controls two code blocks in this file:
- The init block (~line 121) — applied once when Konva stage is created
- The season-change `useEffect` (~line 446) — fires whenever the user changes season

---

### 2. `app/src/hooks/useSaveLoad.js`

**What it controls:** Texture applied when a saved garden is **loaded** from localStorage (i.e. on page refresh or garden switch).

**Line ~10:**
```js
const LAWN_TEXTURES_ENABLED = false  // ← change to true
```

This flag gates `applyLawnTexture()` which is called at garden load time. Without this, loading a saved garden always shows no texture even if GardenCanvas has textures enabled.

---

### 3. `app/src/components/GardenEditor.jsx`

**What it controls:** Texture applied when a **new garden** is created via the Setup Overlay (first-run or "New Garden" flow).

**Location:** Inside the `onStart` callback of `<SetupOverlay>` (~line 1205).

This block is commented out (not flag-gated like the others). To re-enable, uncomment these lines:
```js
// const sName = SEASON_NAMES[state.currentSeason] || 'spring'
// const texImg = new window.Image()
// texImg.onload = () => { boundsRect.fillPriority('pattern'); boundsRect.fillPatternImage(texImg); boundsRect.fillPatternRepeat('repeat'); boundsRect.opacity(LAWN_OPACITY[sName] ?? 1.0); structLayer.batchDraw() }
// texImg.src = LAWN_TEXTURES[sName]
```

Note: `LAWN_TEXTURES` and `LAWN_OPACITY` dicts are still defined inline above this block — no need to add them back.

---

## To Swap Texture Images

Texture files live in: `app/public/textures/`

| Season | File |
|---|---|
| Spring | `lawn-spring.jpg` |
| Summer | `lawn-summer.jpg` |
| Fall | `lawn-fall-early.jpg` |
| Winter | `lawn-winter.jpg` |

The filenames are referenced in all three files above. To swap a texture:
1. Drop the new file into `app/public/textures/` (keep the same filename, or update all 3 files)
2. No code change needed if filename is unchanged
3. Hard refresh browser / rebuild Android to pick up new assets

Opacity per season is also defined in all 3 files (`LAWN_OPACITY` const). Current values:
- Spring: 1.0, Summer: 1.0, Fall: 0.7, Winter: 1.0

---

## Checklist — Full Enable

- [ ] `GardenCanvas.jsx` — `LAWN_TEXTURES_ENABLED = true`
- [ ] `useSaveLoad.js` — `LAWN_TEXTURES_ENABLED = true`
- [ ] `GardenEditor.jsx` — uncomment the 4 texture lines in `onStart`
- [ ] Build + push: `npx vite build && git add -A && git commit -m "..." && git push`
- [ ] Hard refresh browser (`Ctrl+Shift+R`)
- [ ] Rebuild Android if needed (`deploy-android.bat`)

## Checklist — Full Disable

- [ ] `GardenCanvas.jsx` — `LAWN_TEXTURES_ENABLED = false`
- [ ] `useSaveLoad.js` — `LAWN_TEXTURES_ENABLED = false`
- [ ] `GardenEditor.jsx` — comment out the 4 texture lines in `onStart`
- [ ] Build + push
