"""
Chroma-key background remover v9
- Removes #FF00FF magenta background
- Full magenta spill suppression (semi-transparent AND opaque outline pixels)
- Erases Gemini watermark in bottom-right corner
- Crops to content bounding box
- Resizes to 512x512
- Outputs transparent PNG ready for Garden Mapper sticker folder
"""
from PIL import Image
import numpy as np
import os, sys

CHROMA     = np.array([255, 0, 255], dtype=np.float32)  # Magenta
TOLERANCE  = 40
SOFT_RANGE = 20
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
    data[:,:,3] = new_alpha

    # ── Magenta spill suppression — ALL pixels ──────────────────────────────────
    # Suppresses both semi-transparent edge pixels AND fully-opaque outline pixels
    # that are magenta-tinted (Gemini draws outlines with purple/magenta on magenta bg).
    #
    # Method: magenta_amount = min(R, B) - G  (amount of R+B above G = magenta contamination)
    # Subtract that from R and B on any pixel that is not pure background.
    r2, g2, b2 = data[:,:,0], data[:,:,1], data[:,:,2]
    magenta_amount = np.maximum(np.minimum(r2, b2) - g2, 0)

    # Apply to all non-background pixels (alpha > 0)
    visible = new_alpha > 0
    data[:,:,0] = np.where(visible, np.maximum(r2 - magenta_amount, 0), r2)
    data[:,:,2] = np.where(visible, np.maximum(b2 - magenta_amount, 0), b2)

    # ── Zero out near-transparent magenta fringe ────────────────────────────────
    r3, g3, b3, a3 = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    magenta_fringe = (r3 > 160) & (g3 < 80) & (b3 > 160) & (a3 < 40)
    data[magenta_fringe, 3] = 0

    # ── Erase Gemini watermark (bottom-right ~13% of image) ────────────────────
    data[int(h * 0.80):, int(w * 0.80):, 3] = 0  # 20% corner covers full Gemini logo

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
