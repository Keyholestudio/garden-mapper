"""
One-off: re-process a raw PNG with white background (not magenta).
Uses flood-fill style white removal + tiny watermark erase (8% corner only).
Usage: python reprocess-white-bg.py <input_raw.png> <output.png>
"""
from PIL import Image
import numpy as np
import sys

WHITE     = np.array([255, 255, 255], dtype=np.float32)
TOLERANCE  = 30   # how close to white counts as background
SOFT_RANGE = 20

input_path  = sys.argv[1]
output_path = sys.argv[2]

img  = Image.open(input_path).convert("RGBA")
data = np.array(img, dtype=np.float32)
h, w = data.shape[:2]

r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]

dist = np.sqrt(
    (r - WHITE[0])**2 +
    (g - WHITE[1])**2 +
    (b - WHITE[2])**2
)

hard_transparent = dist < TOLERANCE
soft_zone        = (dist >= TOLERANCE) & (dist < TOLERANCE + SOFT_RANGE)
soft_alpha       = ((dist - TOLERANCE) / SOFT_RANGE * 255).clip(0, 255)

new_alpha = np.where(hard_transparent, 0,
            np.where(soft_zone, soft_alpha, 255)).astype(np.uint8)

data[:,:,3] = new_alpha

# Erase Gemini watermark — bottom-right 8% only (much smaller than before)
data[int(h * 0.87):, int(w * 0.87):, 3] = 0

result = Image.fromarray(np.clip(data, 0, 255).astype(np.uint8), 'RGBA')

# Crop to content
bbox = result.getbbox()
if bbox:
    result = result.crop(bbox)

# Resize to 512x512
canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
result.thumbnail((512, 512), Image.LANCZOS)
offset = ((512 - result.width) // 2, (512 - result.height) // 2)
canvas.paste(result, offset)
canvas.save(output_path, 'PNG')
print(f"Saved: {output_path}")
