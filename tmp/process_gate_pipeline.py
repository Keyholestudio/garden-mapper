"""
Garden Mapper — Decor Sticker Processing Pipeline
Approved method (gates, 2026-09-10). Use for all future chroma-key sticker images.

Usage:
    Edit the FILES list at the bottom, then run:
    C:\Users\RG\AppData\Local\Python\bin\python3.exe tmp/process_gate_pipeline.py
"""

from PIL import Image, ImageFilter
import numpy as np
from collections import deque
import os

OUT_DIR = 'app/public/stickers'
STICKERS_DIR = 'stickers'
CONTENT_SIZE = 460   # longer dimension of gate content in px
CANVAS = 512         # output canvas size


def process_sticker(src_path, out_name, pre_crop=None):
    """
    Process a single chroma-key sticker image.

    src_path  : path to raw source JPEG
    out_name  : output filename (e.g. 'decor_gate-wood-red_XL_CA-US-FR-GB-AU.png')
    pre_crop  : optional (left, top, right, bottom) crop of source before processing
                Use when source has unusual aspect ratio vs other variants
    """
    img = Image.open(src_path).convert('RGBA')
    if pre_crop:
        img = img.crop(pre_crop)

    data = np.array(img, dtype=np.float32)
    h, w = data.shape[:2]
    r, g, b, a = data[...,0], data[...,1], data[...,2], data[...,3]

    # Step 1: Hard erase pure chroma green (R<100, G>200, B<100)
    bg_hard = (r < 100) & (g > 200) & (b < 100)
    data[bg_hard, 3] = 0

    # Step 2: Flood-fill from all 4 borders to catch gradient/JPEG-compressed BG
    visited = np.zeros((h, w), bool)
    alpha_keep = np.ones((h, w), bool)

    def is_bg(y, x):
        if data[y, x, 3] == 0:
            return True  # already transparent — spread through
        rv, gv, bv = data[y,x,0], data[y,x,1], data[y,x,2]
        warm = rv > (bv + 35)   # warm wood/brown pixel — keep
        if warm:
            return False
        green_ish = gv > rv * 1.08 and gv > bv * 1.08 and gv > 90
        near_white_green = rv > 180 and gv > 200 and bv > 150 and gv > rv + 10
        return green_ish or near_white_green

    q = deque()
    for x in range(w):
        for y in [0, h-1]:
            if not visited[y, x]: q.append((y, x)); visited[y, x] = True
    for y in range(1, h-1):
        for x in [0, w-1]:
            if not visited[y, x]: q.append((y, x)); visited[y, x] = True
    while q:
        y, x = q.popleft()
        if not is_bg(y, x):
            continue
        alpha_keep[y, x] = False
        for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    data[~alpha_keep, 3] = 0

    # Step 3: Despill anti-aliased edge pixels with green excess
    r2, g2, b2, a2 = data[...,0], data[...,1], data[...,2], data[...,3]
    edge = (a2 > 0) & (g2 > r2 + 20) & (g2 > b2 + 20) & (g2 > 100)
    green_excess = g2[edge] - np.maximum(r2[edge], b2[edge])
    data[edge, 1] -= green_excess * 0.8
    data[edge, 3] = np.clip(255 * (1 - green_excess / 150), 0, 255)

    result = Image.fromarray(data.astype(np.uint8), 'RGBA')

    # Step 4: Smooth alpha edges (Gaussian blur on transition zone only)
    r_ch, g_ch, b_ch, a_ch = result.split()
    a_smooth = a_ch.filter(ImageFilter.GaussianBlur(radius=1.2))
    a_arr = np.array(a_ch, dtype=np.float32)
    a_sm  = np.array(a_smooth, dtype=np.float32)
    edge_zone = (a_arr > 10) & (a_arr < 245)
    a_arr[edge_zone] = a_sm[edge_zone]
    result = Image.merge('RGBA', (r_ch, g_ch, b_ch, Image.fromarray(a_arr.astype(np.uint8))))

    # Step 5: Tight crop with 12px padding
    bbox = result.getbbox()
    if bbox:
        pad = 12
        w2, h2 = result.size
        result = result.crop((max(0, bbox[0]-pad), max(0, bbox[1]-pad),
                              min(w2, bbox[2]+pad), min(h2, bbox[3]+pad)))

    # Step 6: Scale to CONTENT_SIZE on longer dimension, center on CANVAS x CANVAS
    cw, ch = result.size
    scale = CONTENT_SIZE / max(cw, ch)
    result = result.resize((int(cw*scale), int(ch*scale)), Image.LANCZOS)
    sq = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    sq.paste(result, ((CANVAS - result.width) // 2, (CANVAS - result.height) // 2))

    # Save to both output directories
    for d in [OUT_DIR, STICKERS_DIR]:
        os.makedirs(d, exist_ok=True)
        sq.save(os.path.join(d, out_name), 'PNG')

    print(f'{out_name}: content {result.width}x{result.height} on {CANVAS}x{CANVAS}')


# ── Files to process ──────────────────────────────────────────────────────────
# Edit this list for each batch. pre_crop=(left,top,right,bottom) or None.

FILES = [
    # ('path/to/source.jpg', 'decor_item-name_XL_CA-US-FR-GB-AU.png', None),
    # ('path/to/cedar.jpg',  'decor_gate-wood-cedar_XL_CA-US-FR-GB-AU.png', (260,200,1020,1080)),
]

if __name__ == '__main__':
    for src, name, crop in FILES:
        process_sticker(src, name, crop)
    print('All done.')
