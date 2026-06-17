"""
Garden Mapper — Colour Variant Sticker Generator
Generates 10 variant stickers: 5 Maple + 5 Lettuce
Saves to stickers/generated/pending/ for Rob's approval.
NO auto-commit. NO catalog changes.
"""
import json, base64, time, os, subprocess, shutil
import urllib.request
import websocket

WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PIPELINE   = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
OUT_DIR    = os.path.join(WORKSPACE, "stickers", "generated", "pending")
os.makedirs(OUT_DIR, exist_ok=True)

DECIDUOUS_STYLE = (
    "Side aerial view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, leafy, Dark outline 2-3px. No shadows. "
    "Centered, 75% canvas fill. Vibrant and iconic. No text, no labels, no letters anywhere in the image."
)
PLANT_STYLE = (
    "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
    "No shadows. No background showing in the center of the plant. Centered, 75% "
    "canvas fill. Vibrant and iconic. No text, no labels, no letters anywhere in the image."
)

VARIANTS = [
    {
        "filename": "tree-deciduous_maple_XXL_green.png",
        "prompt": (
            f"{DECIDUOUS_STYLE}\n\n"
            "Subject: Maple Tree, large broad deciduous tree, No trunk.\n"
            "Canvas: 512px square.\n"
            "Colours: Spring/summer green foliage — mid-green #4CAF50, deep green #388E3C, "
            "bright highlight #66BB6A, flat chroma-key green background (#00FF00)\n"
            "Shape: Natural leafy canopy with distinctive lobed maple leaf shape. "
            "Full fresh spring/summer green. No fall colours."
        )
    },
    {
        "filename": "tree-deciduous_maple_XXL_dark-green.png",
        "prompt": (
            f"{DECIDUOUS_STYLE}\n\n"
            "Subject: Maple Tree, large broad deciduous tree, No trunk.\n"
            "Canvas: 512px square.\n"
            "Colours: Deep dark green foliage (like Norway Maple or Crimson King spring flush) — "
            "dark green #2E7D32, very dark #1B5E20, mid-green #388E3C, "
            "flat chroma-key green background (#00FF00)\n"
            "Shape: Natural leafy canopy with distinctive lobed maple leaf shape. "
            "Very dark rich green. No fall colours."
        )
    },
    {
        "filename": "tree-deciduous_maple_XXL_silver-green.png",
        "prompt": (
            f"{DECIDUOUS_STYLE}\n\n"
            "Subject: Silver Maple Tree, large broad deciduous tree, No trunk.\n"
            "Canvas: 512px square.\n"
            "Colours: Silver Maple — green-grey top with silvery-white underside visible on leaves, "
            "grey-green #78909C, silver-white highlights #ECEFF1, medium green #607D8B, "
            "flat chroma-key green background (#00FF00)\n"
            "Shape: Natural leafy canopy with lobed maple leaf shape, silvery sheen, more and smaller leaves than standard maple. "
            "Spring/summer only. No fall colours."
        )
    },
    {
        "filename": "tree-deciduous_maple_XXL_red-leaf.png",
        "prompt": (
            f"{DECIDUOUS_STYLE}\n\n"
            "Subject: Red Leaf Maple Tree (Red Maple / Summer Red cultivar), large broad deciduous tree, No trunk.\n"
            "Canvas: 512px square.\n"
            "Colours: Spring/summer red foliage cultivar — deep red #C62828, crimson #B71C1C, "
            "red-green mix #D32F2F, flat chroma-key green background (#00FF00)\n"
            "Shape: Natural leafy canopy with lobed maple leaf shape. "
            "Rich red spring/summer foliage, NOT fall orange. This is a red-leaf cultivar."
        )
    },
    {
        "filename": "tree-deciduous_maple_XXL_purple-leaf.png",
        "prompt": (
            f"{DECIDUOUS_STYLE}\n\n"
            "Subject: Purple Leaf Maple Tree (Royal Red / Schwedleri cultivar), large broad deciduous tree, No trunk.\n"
            "Canvas: 512px square.\n"
            "Colours: Dark BURGUNDY foliage — deep burgundy-purple #4A0026, dark wine #6D1B3B, "
            "very dark burgundy #3B0019, rich dark red-purple. NOT bright purple, NOT violet. "
            "Dark, moody, wine-dark foliage. Flat chroma-key green background (#00FF00)\n"
            "Shape: Natural leafy canopy with lobed maple leaf shape. "
            "Dark burgundy spring/summer foliage. NOT fall colours."
        )
    },
    {
        "filename": "vegetable-leafy_lettuce_M_light-green.png",
        "prompt": (
            f"{PLANT_STYLE}\n\n"
            "Subject: Loose-leaf Lettuce plant, vibrant free round leaf variety (Green Leaf / Buttercrunch).\n"
            "Canvas: 512px square.\n"
            "Colours: Vibrant bright light green — #76C442, #8BC34A, #C5E1A5, fresh spring green, yellow-green highlights, "
            "flat chroma-key green background (#00FF00)\n"
            "Shape: Side top view. Loose rosette of round leaves fanning outward. Vibrant, fresh. Not a tight head. "
            "Stems at base, round leafy fronds spreading at top. Correct proportions."
        )
    },
    {
        "filename": "vegetable-leafy_lettuce_M_dark-green.png",
        "prompt": (
            f"{PLANT_STYLE}\n\n"
            "Subject: Romaine Lettuce plant, upright leafy vegetable.\n"
            "Canvas: 512px square.\n"
            "Colours: Deep rich dark green — #2E7D32, #1B5E20, #388E3C, pale green inner rib, "
            "flat chroma-key green background (#00FF00)\n"
            "Shape: Upright tall compact head, stems at bottom, tall broad dark green leaves at top. Correct proportions."
        )
    },
    {
        "filename": "vegetable-leafy_lettuce_M_red-green.png",
        "prompt": (
            f"{PLANT_STYLE}\n\n"
            "Subject: Lollo Rossa Lettuce plant, frilly leafy vegetable with red tips.\n"
            "Canvas: 512px square.\n"
            "Colours: Green base with red-pink frilly tips — green #4CAF50, red tips #E57373, pink-red edges #EF9A9A, "
            "flat chroma-key green background (#00FF00)\n"
            "Shape: Loose rosette of frilly leaves, green at base fading to red/pink at tips. Stems at bottom, frilly leafy crown at top. Correct proportions."
        )
    },
    {
        "filename": "vegetable-leafy_lettuce_M_burgundy.png",
        "prompt": (
            f"{PLANT_STYLE}\n\n"
            "Subject: Rouge d'Hiver Lettuce plant, deep burgundy leafy vegetable.\n"
            "Canvas: 512px square.\n"
            "Colours: Deep burgundy-red — #880E4F, #AD1457, #6A1B4D, dark wine red-purple, "
            "flat chroma-key green background (#00FF00)\n"
            "Shape: Upright compact head, stems at bottom, dark burgundy-red leaves fanning at top. Correct proportions."
        )
    },
    {
        "filename": "vegetable-leafy_lettuce_M_bronze.png",
        "prompt": (
            f"{PLANT_STYLE}\n\n"
            "Subject: Bronze Mignonette Lettuce plant, warm bronze-toned leafy vegetable.\n"
            "Canvas: 512px square.\n"
            "Colours: Warm bronze-brown — #A1887F, #8D6E63, #BCAAA4, warm brown-gold highlights, "
            "flat chroma-key green background (#00FF00)\n"
            "Shape: Loose leaf rosette, stems at bottom, warm bronze round leaves spreading at top. Correct proportions."
        )
    },
]

def p(*a): print(*a, flush=True)

def get_tab():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    for t in tabs:
        if "gemini.google.com" in t.get("url","") and t.get("type")=="page":
            return t
    raise RuntimeError("No Gemini tab found — open Gemini in Brave first")

def cdp(ws_url, expr, timeout=15):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(timeout)
    ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":expr,"returnByValue":True}}))
    result = None
    deadline = time.time()+timeout
    while time.time()<deadline:
        try:
            data = json.loads(ws.recv())
            if data.get("id")==1:
                result = data.get("result",{}).get("result",{}).get("value")
                break
        except: break
    ws.close()
    return result

def generate_one(variant):
    filename = variant["filename"]
    prompt   = variant["prompt"]
    raw_path = os.path.join(OUT_DIR, filename.replace(".png", "_raw.png"))
    out_path = os.path.join(OUT_DIR, filename)

    if os.path.exists(out_path):
        p(f"  SKIP (already exists): {filename}")
        return True

    p(f"\n{'='*60}")
    p(f"Generating: {filename}")

    tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
    p("  Navigating to fresh Gemini chat...")
    cdp(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
    time.sleep(10)
    tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]

    deadline = time.time()+30
    while time.time()<deadline:
        if cdp(ws_url, 'document.querySelector("[contenteditable=true]")!==null', timeout=5):
            break
        time.sleep(2)
        try: tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
        except: pass
    time.sleep(1)

    img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    src_before = cdp(ws_url, img_js) or ""

    cdp(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return "OK";})()', timeout=8)
    time.sleep(0.5)
    ws2 = websocket.create_connection(ws_url, timeout=10)
    ws2.send(json.dumps({"id":1,"method":"Input.insertText","params":{"text":prompt}}))
    try: ws2.recv()
    except: pass
    ws2.close()
    time.sleep(0.5)
    sent = cdp(ws_url, "(function(){var b=document.querySelector(\"button[aria-label='Send message']\");if(b){b.click();return 'SENT';}return 'NO_BTN';})()", timeout=8)
    p(f"  Prompt sent: {sent} | Waiting up to 240s for image...")

    deadline = time.time()+240
    found = False
    while time.time()<deadline:
        time.sleep(5)
        try:
            tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
            src_now = cdp(ws_url, img_js) or ""
            if src_now and src_now != src_before:
                found = True; time.sleep(2); break
        except: pass

    if not found:
        p(f"  FAIL: no image after 240s for {filename}")
        return False

    blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    blob_src = cdp(ws_url, blob_js) or ""
    data_url = None
    if blob_src:
        grab_js = f'(function(){{var img=document.querySelector(\'img[src="{blob_src}"]\');if(!img)return "NONE";var c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);return c.toDataURL("image/png");}})() '
        data_url = cdp(ws_url, grab_js, timeout=20)
    else:
        lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
        lh3 = cdp(ws_url, lh3_js) or ""
        data_url = ("URL:" + lh3) if lh3 else None

    if not data_url:
        p(f"  FAIL: could not get image data for {filename}"); return False

    if data_url.startswith("data:image"):
        img_bytes = base64.b64decode(data_url.split(",",1)[1])
        with open(raw_path,"wb") as f: f.write(img_bytes)
        p(f"  RAW saved ({len(img_bytes)//1024}KB)")
    elif data_url.startswith("URL:"):
        req = urllib.request.Request(data_url[4:], headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r: img_bytes = r.read()
        with open(raw_path,"wb") as f: f.write(img_bytes)
        p(f"  RAW saved via URL ({len(img_bytes)//1024}KB)")
    else:
        p(f"  FAIL: unexpected data_url format"); return False

    p("  Running pipeline (bg removal + resize)...")
    result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)
    if result.returncode != 0:
        p(f"  Pipeline error: {result.stderr}"); return False

    tmp_nobg = raw_path.replace("_raw.png", "_raw_nobg.png")
    if os.path.exists(tmp_nobg):
        if os.path.exists(out_path): os.remove(out_path)
        os.rename(tmp_nobg, out_path)
        p(f"  DONE -> {filename}")
        return True
    else:
        p(f"  FAIL: pipeline produced no output for {filename}"); return False

# ── Main ──────────────────────────────────────────────────────────────────────
p("Garden Mapper — Colour Variant Generator")
p(f"Generating {len(VARIANTS)} stickers -> {OUT_DIR}")
p("Make sure Brave is open with Gemini loaded and Rob's account signed in.\n")

results = []
for v in VARIANTS:
    ok = generate_one(v)
    results.append((v["filename"], ok))
    if ok:
        time.sleep(3)  # brief pause between generations

p("\n" + "="*60)
p("SUMMARY:")
for fname, ok in results:
    p(f"  {'OK' if ok else 'FAIL'} — {fname}")

ok_count = sum(1 for _, ok in results if ok)
p(f"\n{ok_count}/{len(VARIANTS)} succeeded.")
p("Review PNGs in stickers/generated/pending/ before approving.")
