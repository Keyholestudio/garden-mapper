"""
process-rob-images.py — Pipeline for Rob-provided Gemini images (magenta background)
Use this whenever Rob sends images directly (email, Telegram, Downloads folder)
instead of generating via sticker-generate-one.py prompt.

CORRECT ORDER OF OPERATIONS (do not change):
1. Magenta chroma key removal
2. Watermark erase AFTER keying (not before — pre-keying has no alpha channel yet)
3. Crop using alpha > 128 threshold (NOT > 10 — feathered edge pixels skew the bounding box)
4. Scale to fill canvas minus equal padding on all sides
5. Verify output margins programmatically before sending to Rob

Usage: python process-rob-images.py <input.jpg|png> <output.png>
"""
from PIL import Image
import numpy as np
import sys, os
from collections import deque

OUT_SIZE   = 512
PADDING    = 20       # equal px margin on all sides in output
FILL_PCT   = 0.85     # kept for reference; actual fill = (OUT_SIZE - 2*PADDING) / OUT_SIZE
CHROMA     = np.array([255, 0, 255], dtype=np.float32)  # magenta
TOLERANCE  = 80   # Standard. Do NOT blindly increase — high tolerance removes brown/terracotta art pixels too.
SOFT_RANGE = 40   # If artifacts remain: use a SPATIALLY RESTRICTED hue pass (target only far background zones, e.g. cols > 88%).
                  # Only increase TOLERANCE if you measure: min(building dist) > max(artifact dist). Sample with:
                  # np.sqrt((r-255)**2+g**2+(b-255)**2) in art region vs artifact region before changing this value.

def process(input_path, output_path):
    print(f"Input:  {os.path.basename(input_path)}")
    img = Image.open(input_path).convert("RGBA")
    data = np.array(img, dtype=np.float32)
    h, w = data.shape[:2]

    # Step 1: Magenta chroma key removal
    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
    dist = np.sqrt((r - CHROMA[0])**2 + (g - CHROMA[1])**2 + (b - CHROMA[2])**2)
    hard_transparent = dist < TOLERANCE
    soft_zone = (dist >= TOLERANCE) & (dist < TOLERANCE + SOFT_RANGE)
    soft_alpha = ((dist - TOLERANCE) / SOFT_RANGE * 255).clip(0, 255)
    data[:,:,3] = np.where(hard_transparent, 0,
                  np.where(soft_zone, soft_alpha, 255)).astype(np.uint8)

    # Magenta spill suppression on edge pixels
    edge_mask = (data[:,:,3] > 0) & (data[:,:,3] < 255)
    spill = edge_mask & ((r - g) > 4) & ((b - g) > 4)
    data[:,:,0] = np.where(spill, g, r)
    data[:,:,2] = np.where(spill, g, b)

    # Step 1b: Strip outer 15px border (white border from Gemini output)
    BORDER = 15
    data[:BORDER, :, 3] = 0          # top strip
    data[h-BORDER:, :, 3] = 0       # bottom strip
    data[:, :BORDER, 3] = 0          # left strip
    data[:, w-BORDER:, 3] = 0       # right strip

    # Step 2: Erase Gemini watermark (bottom strip only — no corner zones)
    # Corner zones were too aggressive and destroyed art pixels near edges.
    data[h-30:h, :, 3] = 0          # bottom 30px full strip (watermark zone)

    # Step 1c: Flood-fill shadow removal
    # Removes dark semi-transparent drop shadow residue that chroma key misses.
    # Floods from all 4 edges inward, clearing pixels that are:
    #   - semi-transparent (alpha < 250), AND dark (luminance < 120)
    # Stops at fully opaque art pixels, so art is never touched.
    tmp = data.clip(0, 255).astype(np.uint8)
    flood_h, flood_w = tmp.shape[:2]
    visited = np.zeros((flood_h, flood_w), dtype=bool)
    to_clear = np.zeros((flood_h, flood_w), dtype=bool)

    def is_shadow(r, c):
        a = tmp[r, c, 3]
        if a >= 250:
            return False
        lum = 0.299 * tmp[r,c,0] + 0.587 * tmp[r,c,1] + 0.114 * tmp[r,c,2]
        return lum < 120

    q = deque()
    for row in range(flood_h):
        for col in [0, flood_w-1]:
            if not visited[row, col] and is_shadow(row, col):
                visited[row, col] = True
                to_clear[row, col] = True
                q.append((row, col))
    for col in range(flood_w):
        for row in [0, flood_h-1]:
            if not visited[row, col] and is_shadow(row, col):
                visited[row, col] = True
                to_clear[row, col] = True
                q.append((row, col))
    while q:
        row, col = q.popleft()
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = row+dr, col+dc
            if 0 <= nr < flood_h and 0 <= nc < flood_w and not visited[nr, nc]:
                if is_shadow(nr, nc):
                    visited[nr, nc] = True
                    to_clear[nr, nc] = True
                    q.append((nr, nc))
    tmp[to_clear, 3] = 0
    print(f"  Shadow flood-fill: cleared {int(to_clear.sum())} pixels")
    data = tmp.astype(np.float32)

    result = Image.fromarray(data.clip(0, 255).astype(np.uint8), "RGBA")

    # Step 3: Crop using alpha > 128 (solid pixels only)
    # CRITICAL: alpha > 10 includes feathered edge pixels that skew the bounding box
    # causing unequal margins in the output. Always use > 128 here.
    arr2 = np.array(result)
    art_mask = arr2[:,:,3] > 128
    rows = np.any(art_mask, axis=1)
    cols = np.any(art_mask, axis=0)
    if not rows.any():
        print("ERROR: no art found after background removal")
        return
    rmin, rmax = np.where(rows)[0][[0,-1]]
    cmin, cmax = np.where(cols)[0][[0,-1]]
    art = result.crop((cmin, rmin, cmax+1, rmax+1))
    art_w, art_h = art.size

    # Step 4: Scale and center with equal padding
    usable = OUT_SIZE - 2 * PADDING
    scale = usable / max(art_w, art_h)
    new_w = int(art_w * scale)
    new_h = int(art_h * scale)
    art_scaled = art.resize((new_w, new_h), Image.LANCZOS)
    pad_x = (OUT_SIZE - new_w) // 2
    pad_y = (OUT_SIZE - new_h) // 2
    canvas = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    canvas.paste(art_scaled, (pad_x, pad_y), art_scaled)
    canvas.save(output_path, "PNG")

    # Step 5: Verify margins
    out_arr = np.array(canvas)
    out_mask = out_arr[:,:,3] > 10
    out_rows = np.any(out_mask, axis=1)
    out_cols = np.any(out_mask, axis=0)
    ormin, ormax = np.where(out_rows)[0][[0,-1]]
    ocmin, ocmax = np.where(out_cols)[0][[0,-1]]
    print(f"Output: {os.path.basename(output_path)}")
    print(f"  Art {art_w}x{art_h} -> {new_w}x{new_h}")
    print(f"  Margins: top={ormin} bot={OUT_SIZE-ormax-1} left={ocmin} right={OUT_SIZE-ocmax-1}")
    if abs(ormin - (OUT_SIZE-ormax-1)) > 10:
        print(f"  [WARN] top/bottom margins differ by more than 10px -- check output visually")
    else:
        print(f"  [OK] Margins balanced")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python process-rob-images.py <input.jpg|png> <output.png>")
        sys.exit(1)
    process(sys.argv[1], sys.argv[2])
