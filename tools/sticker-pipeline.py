"""
Chroma-key background remover v10
- Removes #FF00FF magenta background (same logic as v4 green, ported to magenta)
- Edge-only spill suppression (semi-transparent border pixels only)
- Erases Gemini watermark in bottom-right 20% corner
- Crops to content bounding box
- Resizes to 512x512
- Outputs transparent PNG ready for Garden Mapper sticker folder
"""
from PIL import Image
import numpy as np
import os, sys

CHROMA     = np.array([255, 0, 255], dtype=np.float32)  # Magenta
TOLERANCE  = 100
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

    # ── Edge-only magenta spill suppression ────────────────────────────────────
    # Only apply to semi-transparent edge pixels (same as v4 green approach).
    # Magenta spill = R and B both elevated above G on edge pixels.
    edge_mask = (new_alpha > 0) & (new_alpha < 255)
    avg_g_of_rb = g  # G channel is the neutral reference for magenta
    rb_excess_r = r - g  # how much R is above G
    rb_excess_b = b - g  # how much B is above G
    spill = edge_mask & (rb_excess_r > 15) & (rb_excess_b > 15)
    # Reduce R and B toward G on spill pixels
    data[:,:,0] = np.where(spill, g, r)
    data[:,:,2] = np.where(spill, g, b)

    data[:,:,3] = new_alpha

    # ── Erase Gemini watermark (bottom-right 20% of image) ─────────────────────
    data[int(h * 0.80):, int(w * 0.80):, 3] = 0

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
