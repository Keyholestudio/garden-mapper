# WebP Sticker Compression — Project Notes

## Status
Paused — pending Rob review/approval. Visual quality confirmed acceptable at Q85.

## Goal
Convert all 748 plant sticker PNGs to WebP format.
Projected savings: 237 MB → ~35-40 MB (83% reduction). First-load time cut proportionally.

## Test Results (2026-10-28)
| File | Original | WebP Q85 | Savings |
|---|---|---|---|
| Gazebo (XL decor) | 653 KB | 89 KB | 86% |
| Magnolia (XXL tree) | 524 KB | 100 KB | 81% |
| Basil (S herb) | 308 KB | 48 KB | 84% |

PNG compression level 9 made files *larger* — originals are already well-compressed internally. WebP is the only viable path.

## Settings
- Format: WebP
- Quality: 85
- Tool: `sharp` npm package (node script)
- Script: `compress-test.cjs` in this folder (adapt for full batch run)

## Plan (Option A — recommended)
1. Audit all `.png` src references across pack files + useSaveLoad + cdnUtils + toolMenuData
2. Run batch conversion: all 748 PNGs → WebP Q85
3. Update all `src` fields in pack JS files: `.png` → `.webp`  
4. Update any hardcoded paths in cdnUtils.js, useSaveLoad.js, toolMenuData.jsx
5. Delete old PNGs from public/stickers/
6. Rebuild Android APK (WebP baked in automatically)
7. Push to Vercel

## Safe because:
- Gardens store plant `key`, not `src` — existing saves unaffected
- Keys don't change, only file extensions
- Android rebuild picks up WebP automatically on next deploy-android.bat

## Risk areas to audit before starting:
- `app/src/utils/cdnUtils.js` — stickerSrc() may hardcode .png
- `app/src/data/packs/*.js` — all 41 pack files have src paths
- `app/src/hooks/usePlantCatalog.js` — PLANT_CATALOG entries have src paths
- `app/src/hooks/useSaveLoad.js` — any src reconstruction logic
- `app/src/components/toolMenuData.jsx` — decor/tool icon paths

## Resume phrase
`resume WebP sticker compression`
