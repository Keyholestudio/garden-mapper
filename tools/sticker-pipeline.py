"""
Chroma-key background remover v11
- Default chroma: #FF00FF magenta
- Supports --chroma RRGGBB flag: e.g. --chroma 00FFFF (cyan), --chroma FFFF00 (neon yellow)
- Colour-aware edge spill suppression for magenta, cyan, and neon yellow
- Erases Gemini watermark in bottom-right 15% corner
- Crops to content bounding box
- Resizes to 512x512
- Outputs transparent PNG ready for Garden Mapper sticker folder
"""
from PIL import Image
import numpy as np
import os, sys

CHROMA     = np.array([255, 0, 255], dtype=np.float32)  # Magenta
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

    # ── Edge-only spill suppression (colour-aware) ────────────────────────────
    # Suppress chroma bleed on semi-transparent edge pixels only.
    edge_mask = (new_alpha > 0) & (new_alpha < 255)
    chroma_r, chroma_g, chroma_b = CHROMA[0], CHROMA[1], CHROMA[2]
    if chroma_r > 200 and chroma_b > 200 and chroma_g < 50:
        # Magenta spill: R and B both elevated above G
        spill = edge_mask & ((r - g) > 4) & ((b - g) > 4)
        data[:,:,0] = np.where(spill, g, r)
        data[:,:,2] = np.where(spill, g, b)
    elif chroma_r > 200 and chroma_g > 200 and chroma_b < 50:
        # Neon yellow spill: R and G both elevated above B
        spill = edge_mask & ((r - b) > 4) & ((g - b) > 4)
        data[:,:,0] = np.where(spill, b, r)
        data[:,:,1] = np.where(spill, b, g)
    elif chroma_g > 200 and chroma_r < 50 and chroma_b > 200:
        # Cyan spill: G and B both elevated above R
        spill = edge_mask & ((g - r) > 4) & ((b - r) > 4)
        data[:,:,1] = np.where(spill, r, g)
        data[:,:,2] = np.where(spill, r, b)
    else:
        # Generic: suppress all chroma channels toward the lowest channel
        min_ch = np.minimum(np.minimum(r, g), b)
        spill = edge_mask
        data[:,:,0] = np.where(spill & (r > min_ch + 4), min_ch, r)
        data[:,:,1] = np.where(spill & (g > min_ch + 4), min_ch, g)
        data[:,:,2] = np.where(spill & (b > min_ch + 4), min_ch, b)

    data[:,:,3] = new_alpha

    # ── Erase Gemini watermark (bottom-right 15% of image) ─────────────────────
    data[int(h * 0.92):, int(w * 0.92):, 3] = 0  # reduced from 15% to 8% to avoid clipping plant fronds

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
    args = sys.argv[1:]
    # Optional --chroma RRGGBB flag (e.g. --chroma 00FFFF for cyan)
    if "--chroma" in args:
        idx = args.index("--chroma")
        hex_colour = args[idx + 1].lstrip("#")
        r, g, b = int(hex_colour[0:2], 16), int(hex_colour[2:4], 16), int(hex_colour[4:6], 16)
        CHROMA[:] = np.array([r, g, b], dtype=np.float32)
        args = [a for i, a in enumerate(args) if i != idx and i != idx + 1]
    files = args
    for f in files:
        out = os.path.splitext(f)[0] + "_nobg.png"
        print(f"Processing: {os.path.basename(f)}")
        remove_chroma(f, out)
    print("Done.")
