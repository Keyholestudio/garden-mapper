"""
Chroma-key background remover v10 — CYAN variant
- Removes #00FFFF cyan background
- Edge-only spill suppression
- Erases Gemini watermark in bottom-right 20% corner
- Crops to content bounding box
- Resizes to 512x512
- Use for plants with pink/magenta/red flowers where magenta BG causes colour loss
"""
from PIL import Image
import numpy as np
import os, sys

CHROMA     = np.array([0, 255, 255], dtype=np.float32)  # Cyan #00FFFF
TOLERANCE  = 145
SOFT_RANGE = 55
OUT_SIZE   = 512

def remove_chroma(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.float32)
    h, w = data.shape[:2]

    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]

    # ── Chroma key: compute distance from magenta ───────────────────────────────
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

    # ── Edge-only cyan spill suppression ─────────────────────────────────────
    # Cyan spill = G and B both elevated above R on edge pixels.
    edge_mask = (new_alpha > 0) & (new_alpha < 255)
    gb_excess_g = g - r  # how much G is above R
    gb_excess_b = b - r  # how much B is above R
    spill = edge_mask & (gb_excess_g > 4) & (gb_excess_b > 4)
    # Reduce G and B toward R on spill pixels
    data[:,:,1] = np.where(spill, r, g)
    data[:,:,2] = np.where(spill, r, b)

    data[:,:,3] = new_alpha

    # ── Erase Gemini watermark (bottom-right 15% of image) ─────────────────────
    data[int(h * 0.85):, int(w * 0.85):, 3] = 0

    result = Image.fromarray(np.clip(data, 0, 255).astype(np.uint8), 'RGBA')

    # ── Crop to content bounding box ────────────────────────────────────────────
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)

    # ── Resize to OUT_SIZE x OUT_SIZE (preserve aspect, pad to square) ─────────
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
