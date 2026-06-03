"""
Chroma-key background remover v4
- Removes #00FF00 green screen background
- Erases green diamond watermark in bottom-right corner
- Crops to content bounding box
- Resizes to 512x512 (matching existing sticker resolution)
- Outputs transparent PNG ready for Garden Mapper sticker folder
"""
from PIL import Image
import numpy as np
import os, sys

CHROMA     = np.array([0, 255, 0], dtype=np.float32)
TOLERANCE  = 80
SOFT_RANGE = 40
OUT_SIZE   = 512   # matches existing sticker resolution

def remove_chroma(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.float32)
    h, w = data.shape[:2]

    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]

    # ── Chroma key removal ──────────────────────────────────
    dist = np.sqrt(
        (r - CHROMA[0])**2 +
        (g - CHROMA[1])**2 +
        (b - CHROMA[2])**2
    )
    hard_transparent = dist < TOLERANCE
    soft_zone = (dist >= TOLERANCE) & (dist < TOLERANCE + SOFT_RANGE)
    soft_alpha = ((dist - TOLERANCE) / SOFT_RANGE * 255).clip(0, 255)
    new_alpha = np.where(hard_transparent, 0,
                np.where(soft_zone, soft_alpha, 255)).astype(np.uint8)

    # ── Edge-only spill suppression ─────────────────────────
    edge_mask = (new_alpha > 0) & (new_alpha < 255)
    avg_rb = (r + b) / 2.0
    green_excess = g - avg_rb
    spill = edge_mask & (green_excess > 15)
    data[:,:,1] = np.where(spill, avg_rb, g)

    data[:,:,3] = new_alpha

    # ── Erase green diamond watermark (bottom-right ~12% of image) ──
    # The Gemini logo sits in the bottom-right corner — blank that region
    wm_h = int(h * 0.13)
    wm_w = int(w * 0.13)
    region = data[h - wm_h:, w - wm_w:, :]
    # Within the watermark region, find any non-transparent pixels
    # and erase them (set alpha=0)
    region_r = region[:,:,0]
    region_g = region[:,:,1]
    region_b = region[:,:,2]
    region_a = region[:,:,3]
    # Watermark is a green diamond shape — target any pixel that survived chroma key
    # but is still visibly green-tinted or dark (the diamond outline)
    wm_dist = np.sqrt(
        (region_r - CHROMA[0])**2 +
        (region_g - CHROMA[1])**2 +
        (region_b - CHROMA[2])**2
    )
    # Erase the full watermark region (safest — it's a corner, no plant lives there)
    region[:,:,3] = 0
    data[h - wm_h:, w - wm_w:, :] = region

    result = Image.fromarray(np.clip(data, 0, 255).astype(np.uint8), 'RGBA')

    # ── Crop to content bounding box ────────────────────────
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)

    # ── Resize to OUT_SIZE x OUT_SIZE (preserve aspect, pad to square) ──
    result.thumbnail((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    square = Image.new('RGBA', (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    offset = ((OUT_SIZE - result.width) // 2, (OUT_SIZE - result.height) // 2)
    square.paste(result, offset)

    square.save(output_path, 'PNG', optimize=True)
    print(f"  Saved: {os.path.basename(output_path)}  ({square.width}x{square.height}px)")

if __name__ == "__main__":
    files = sys.argv[1:]
    for f in files:
        out = os.path.splitext(f)[0] + "_nobg.png"
        print(f"Processing: {os.path.basename(f)}")
        remove_chroma(f, out)
    print("Done.")
