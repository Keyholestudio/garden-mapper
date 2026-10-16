"""
Process greenhouse raw JPGs → transparent PNGs for Garden Mapper stickers.
White background removal + crop to content + resize to 512x512.
Usage: python process-greenhouse.py
"""
from PIL import Image
import numpy as np
import os

RAW_DIR = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers\greenhouse-raw"
OUT_DIR = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers\generated\pending"
OUT_SIZE = 512
os.makedirs(OUT_DIR, exist_ok=True)

FILES = {
    "Gemini_Generated_Image_l113hxl113hxl113.jpg": "decor_greenhouse-default_XXL_CA-US-FR-GB-AU.png",
    "Gemini_Generated_Image_esv971esv971esv9.jpg":  "decor_greenhouse-victorian-open_XXL_CA-US-FR-GB-AU.png",
    "Gemini_Generated_Image_d5129hd5129hd512.jpg":  "decor_greenhouse-victorian_XXL_CA-US-FR-GB-AU.png",
    "Gemini_Generated_Image_43e58743e58743e5.jpg":  "decor_greenhouse-white_XXL_CA-US-FR-GB-AU.png",
    "Gemini_Generated_Image_ha3mmeha3mmeha3m.jpg":  "decor_greenhouse-rect_XXL_CA-US-FR-GB-AU.png",
}

TOLERANCE = 30  # how close to white (255,255,255) to treat as background

def remove_white_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.float32)
    h, w = data.shape[:2]

    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]

    # Distance from white
    dist = np.sqrt((r - 255)**2 + (g - 255)**2 + (b - 255)**2)

    hard_transparent = dist < TOLERANCE
    soft_range = 40
    soft_zone = (dist >= TOLERANCE) & (dist < TOLERANCE + soft_range)
    soft_alpha = ((dist - TOLERANCE) / soft_range * 255).clip(0, 255)

    new_alpha = np.where(hard_transparent, 0,
                np.where(soft_zone, soft_alpha, 255)).astype(np.uint8)

    data[:,:,3] = new_alpha
    result = Image.fromarray(data.clip(0, 255).astype(np.uint8), "RGBA")

    # Crop to content bounding box
    bbox = result.getbbox()
    if bbox:
        result = result.crop(bbox)

    # Pad to square and resize to 512x512
    max_side = max(result.width, result.height)
    padded = Image.new("RGBA", (max_side, max_side), (0, 0, 0, 0))
    offset_x = (max_side - result.width) // 2
    offset_y = (max_side - result.height) // 2
    padded.paste(result, (offset_x, offset_y))

    # Scale so art fills ~80% of canvas
    art_size = int(OUT_SIZE * 0.80)
    art = padded.resize((art_size, art_size), Image.LANCZOS)
    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    cx = (OUT_SIZE - art_size) // 2
    cy = (OUT_SIZE - art_size) // 2
    canvas.paste(art, (cx, cy))

    canvas.save(output_path, "PNG")
    print(f"  Saved: {os.path.basename(output_path)}")

for src_name, dst_name in FILES.items():
    src = os.path.join(RAW_DIR, src_name)
    dst = os.path.join(OUT_DIR, dst_name)
    if os.path.exists(src):
        print(f"Processing: {src_name}")
        remove_white_bg(src, dst)
    else:
        print(f"MISSING: {src_name}")

print("\nDone. Check stickers/generated/pending/")
