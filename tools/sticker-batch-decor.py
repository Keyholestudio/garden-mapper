"""
Garden Mapper — Decor Sticker Batch Generator
Generates decor stickers using the prompts defined in research/DECOR-PROMPT-GUIDE.md.
Uses the same CDP pipeline as other batch scripts.
Run with: python sticker-batch-decor.py [--start N]  (resume from index N)
"""

import json, base64, time, os, sys, subprocess, shutil
import urllib.request
import websocket

WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PIPELINE   = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
OUT_DIR    = os.path.join(WORKSPACE, "stickers", "generated", "pending")
DEST       = os.path.join(WORKSPACE, "app", "public", "stickers")
CATALOG    = os.path.join(WORKSPACE, "app", "src", "hooks", "usePlantCatalog.js")
GEMINI_URL = "https://gemini.google.com/app"
ROB_ACCOUNT = "contactsunsetpoetvintage"
IMAGE_WAIT  = 240
INTER_PAUSE = 45
os.makedirs(OUT_DIR, exist_ok=True)

# Prompt template — see research/DECOR-PROMPT-GUIDE.md for full prompts per item.
# view_prefix: 'Aerial side view' for most items; 'Aerial side-front view' for stairs.
# Stairs also append 'NO border. NO frame.' to their shape description.
BASE_PROMPT = (
    "{view_prefix}. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified {name} with crisp edges, bold flat icon. Dark outline 2–3px. "
    "No shadows. Centered, 75% canvas fill. Vibrant and iconic.\n"
    "Subject: {name}\n"
    "Canvas: {size}px square.\n"
    "Colours: {colours}, flat chroma-key green background (#00FF00)\n"
    "Shape: {shape}"
)

# (sticker_id, label, family, size_tier, size_px, colours, shape_desc)
DECOR_ITEMS = [
    ("decor_rock-small_M_CA-US-FR-GB-AU",    "Small Garden Stone",   "Decor", "M",  256,
     "warm tan #C8A878, grey #9A9A8A, pale cream #E8DCC8, dark outline #3A3020",
     "Single small rounded decorative garden stone, smooth surface with subtle texture variation. Correct proportions."),

    ("decor_rock-medium_L_CA-US-FR-GB-AU",   "Medium Garden Stone",  "Decor", "L",  384,
     "warm grey #8A8A7A, mossy green patches #6A8A5A, tan #B0987A, dark outline #2A2A1A",
     "Single medium rounded garden stone with subtle moss patches on top. Correct proportions."),

    ("decor_rock-large_XL_CA-US-FR-GB-AU",   "Large Garden Stone",   "Decor", "XL", 512,
     "cool grey #7A8A8A, deep grey #4A5A5A, moss green #5A7A4A, pale lichens #C8C8A8, dark outline #1A2A1A",
     "Single large decorative boulder with moss and lichen patches. Natural irregular shape. Correct proportions."),

    ("decor_gazebo-square_XL_CA-US-FR-GB-AU","Square Gazebo",        "Decor", "XL", 512,
     "warm cedar brown #8B5E3C, dark cedar #5C3A1E, cedar shingle roof #A0714A, cream trim #F5ECD8, dark outline #2A1A08",
     "Aerial top-down view of square open gazebo with cedar shingle roof, 4 wooden posts at corners, open sides. Correct proportions."),

    ("decor_gazebo-oct_XL_CA-US-FR-GB-AU",   "Octagonal Gazebo",     "Decor", "XL", 512,
     "warm cedar brown #8B5E3C, dark cedar #5C3A1E, cedar shingle roof #A0714A, cream trim #F5ECD8, dark outline #2A1A08",
     "Aerial top-down view of octagonal open gazebo with cedar shingle pointed roof, 8 wooden posts, open sides. Correct proportions."),

    ("decor_lounge-modern_L_CA-US-FR-GB-AU", "Modern Lounge Chairs", "Decor", "L",  384,
     "bright white #F8F8F8, light grey frame #C8C8C8, pale shadow #E0E0E0, dark outline #2A2A2A",
     "Aerial top-down view of two modern white cushioned outdoor lounge chairs side by side with clean lines and minimal frame. Correct proportions."),

    ("decor_lounge-wood_L_CA-US-FR-GB-AU",   "Wood Lounge Chairs",   "Decor", "L",  384,
     "warm teak brown #9B6A3A, light wood grain #C8955A, pale cushion cream #F0E8D8, dark outline #3A2010",
     "Aerial top-down view of two wooden slatted outdoor lounge chairs side by side with visible wood slats and grain. Correct proportions."),

    ("decor_patio-table_L_CA-US-FR-GB-AU",   "Patio Table & Chairs", "Decor", "L",  384,
     "warm teak brown #9B6A3A, light wood grain #C8955A, pale seat #E8DCC8, dark outline #3A2010",
     "Aerial top-down view of round wooden outdoor patio table with 4 chairs arranged around it. Correct proportions."),

    ("decor_umbrella_L_CA-US-FR-GB-AU",      "Beach Umbrella",       "Decor", "L",  384,
     "sky blue #5BA8D8, white trim #F8F8F8, pale blue #A8D0F0, warm cream tassels #F0E8C8, dark outline #1A3A5A",
     "Aerial top-down view of open octagonal beach umbrella with decorative tassels around edge, light blue with white trim panels alternating, central pole visible. Correct proportions."),

    ("decor_pot-s_S_CA-US-FR-GB-AU",         "Small Terracotta Pot", "Decor", "S",  160,
     "terracotta orange #C8623A, burnt orange #A04A28, warm cream rim #E8C8A8, dark outline #3A1A0A",
     "Aerial side view of small empty terracotta clay flower pot with rim and drainage hole. Correct proportions."),

    ("decor_pot-m_M_CA-US-FR-GB-AU",         "Medium Terracotta Pot","Decor", "M",  256,
     "terracotta orange #C8623A, burnt orange #A04A28, warm cream rim #E8C8A8, dark outline #3A1A0A",
     "Aerial side view of medium empty terracotta clay flower pot with rim and drainage hole. Correct proportions."),

    ("decor_pot-l_L_CA-US-FR-GB-AU",         "Large Terracotta Pot", "Decor", "L",  384,
     "terracotta orange #C8623A, burnt orange #A04A28, warm cream rim #E8C8A8, dark outline #3A1A0A",
     "Aerial side view of large empty terracotta clay flower pot with rim and drainage hole. Correct proportions."),

    ("decor_stairs-wood_M_CA-US-FR-GB-AU",   "Wood Stairs",          "Decor", "M",  256,
     "warm teak brown #9B6A3A, light wood grain #C8955A, dark wood shadow #5C3A1E, dark outline #2A1008",
     "4-step wooden outdoor stairs with visible treads and risers, natural wood grain. NO border. NO frame. Correct proportions."),

    ("decor_stairs-stone_M_CA-US-FR-GB-AU",  "Stone Stairs",         "Decor", "M",  256,
     "cool grey stone #8A9A9A, light grey #B8C8C8, dark shadow #4A5A5A, warm mortar #C8B89A, dark outline #1A2A2A",
     "4-step natural stone outdoor stairs with irregular stone surfaces and mortar lines. NO border. NO frame. Correct proportions."),

    ("decor_stairs-brick_M_CA-US-FR-GB-AU",  "Brick Stairs",         "Decor", "M",  256,
     "warm red brick #B84A28, dark brick #8A3018, pale mortar #D8C8A8, terracotta highlight #D06040, dark outline #2A1008",
     "4-step brick outdoor stairs with visible brick pattern and mortar joints. NO border. NO frame. Correct proportions."),

    ("decor_stairs-cement_M_CA-US-FR-GB-AU", "Cement Stairs",        "Decor", "M",  256,
     "cool cement grey #9A9A9A, light grey #C8C8C8, dark shadow #5A5A5A, pale highlight #E0E0E0, dark outline #2A2A2A",
     "4-step smooth concrete/cement outdoor stairs with clean edges. NO border. NO frame. Correct proportions."),

    ("decor_arch-wood_XL_CA-US-FR-GB-AU",    "Wood Garden Arch",     "Decor", "XL", 512,
     "warm teak brown #9B6A3A, light wood grain #C8955A, dark wood shadow #5C3A1E, dark outline #2A1008",
     "Standalone wooden garden arch/pergola frame with lattice sides, no plants, natural wood. Correct proportions."),

    ("decor_arch-metal_XL_CA-US-FR-GB-AU",   "Metal Garden Arch",    "Decor", "XL", 512,
     "dark iron grey #4A4A5A, mid steel #6A6A7A, pale highlight #A8A8B8, rust accent #8A5A3A, dark outline #1A1A2A",
     "Standalone ornate metal/wrought iron garden arch frame with decorative scrollwork, no plants. Correct proportions."),
]

def p(*a): print(*a, flush=True)

def get_brave_tab(url_fragment):
    try:
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
        for t in tabs:
            if url_fragment in t.get("url","") and t.get("type")=="page":
                return t
    except: pass
    return None

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

def verify_account(ws_url):
    r = cdp(ws_url, '(function(){var a=document.body.innerText+document.body.innerHTML;return a.includes("contactsunsetpoetvintage")?"ROB":"OTHER";})()', timeout=10)
    return r == "ROB"

def add_to_catalog(sticker_id, label, family, size_tier):
    with open(CATALOG, "r", encoding="utf-8") as f:
        content = f.read()
    filename = f"{sticker_id}.png"
    entry = f"  {{ key:'{sticker_id}', label:'{label}', family:'{family}', src:'/stickers/{filename}', size:'{size_tier}' }},\n"
    if sticker_id in content:
        p(f"  Already in catalog: {sticker_id}")
        return False
    content = content.replace("\n]", f"\n{entry}\n]")
    with open(CATALOG, "w", encoding="utf-8") as f:
        f.write(content)
    p(f"  Added to catalog: {sticker_id}")
    return True

def main():
    start_idx = 0
    for arg in sys.argv[1:]:
        if arg.startswith("--start"):
            try: start_idx = int(arg.split("=")[1] if "=" in arg else sys.argv[sys.argv.index(arg)+1])
            except: pass

    p(f"Decor batch — {len(DECOR_ITEMS)} items (starting at {start_idx})")
    tab = get_brave_tab("gemini.google.com")
    if not tab:
        p("ERROR: Gemini not open in Brave. Please open gemini.google.com first.")
        sys.exit(1)
    ws_url = tab["webSocketDebuggerUrl"]

    if not verify_account(ws_url):
        p("ERROR: Rob's account not detected. Please switch to contactsunsetpoetvintage@gmail.com")
        sys.exit(1)
    p("[OK] Account confirmed.")

    img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'

    for idx, (sticker_id, label, family, size_tier, size_px, colours, shape) in enumerate(DECOR_ITEMS):
        if idx < start_idx:
            continue

        raw_path   = os.path.join(OUT_DIR, sticker_id + "_raw.png")
        clean_path = os.path.join(OUT_DIR, sticker_id + ".png")
        dest_path  = os.path.join(DEST, sticker_id + ".png")

        p(f"\n[{idx+1}/{len(DECOR_ITEMS)}] {label} ({sticker_id})")

        if os.path.exists(dest_path):
            p("  Already exists — skipping.")
            continue

        # Re-fetch ws_url fresh every prompt (L017)
        tab = get_brave_tab("gemini.google.com")
        if not tab:
            p("ERROR: Lost Gemini tab. Aborting."); sys.exit(1)
        ws_url = tab["webSocketDebuggerUrl"]

        # Verify account still correct
        if not verify_account(ws_url):
            p("ERROR: Account switched. Please switch back to contactsunsetpoetvintage@gmail.com and re-run with --start " + str(idx))
            sys.exit(1)

        # Baseline
        src_before = cdp(ws_url, img_js) or ""

        # Build prompt — see research/DECOR-PROMPT-GUIDE.md for canonical prompt per item
        is_stairs = "stairs" in sticker_id
        view_prefix = "Aerial side-front view" if is_stairs else "Aerial side view"
        prompt = BASE_PROMPT.format(view_prefix=view_prefix, name=label, size=size_px, colours=colours, shape=shape)

        # Send prompt
        cdp(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return "OK";})()', timeout=8)
        time.sleep(0.5)
        ws2 = websocket.create_connection(ws_url, timeout=10)
        ws2.send(json.dumps({"id":1,"method":"Input.insertText","params":{"text":prompt}}))
        try: ws2.recv()
        except: pass
        ws2.close()
        time.sleep(0.5)
        sent = cdp(ws_url, '(function(){var b=document.querySelector("button[aria-label=\'Send message\']");if(b){b.click();return "SENT";}return "NO_BTN";})()', timeout=8)
        p(f"  Sent: {sent} | Waiting up to {IMAGE_WAIT}s...")

        # Wait for image
        deadline = time.time() + IMAGE_WAIT
        found = False
        while time.time() < deadline:
            time.sleep(5)
            try:
                tab = get_brave_tab("gemini.google.com")
                ws_url = tab["webSocketDebuggerUrl"]
                src_now = cdp(ws_url, img_js) or ""
                if src_now and src_now != src_before:
                    found = True; time.sleep(2); break
            except: pass

        if not found:
            p(f"  TIMEOUT — skipping {label}"); continue

        # Grab image
        blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
        blob_src = cdp(ws_url, blob_js) or ""
        if blob_src:
            grab_js = f'(function(){{var img=document.querySelector(\'img[src="{blob_src}"]\');if(!img)return "NONE";var c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);return c.toDataURL("image/png");}})() '
            data_url = cdp(ws_url, grab_js, timeout=20)
        else:
            lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
            lh3 = cdp(ws_url, lh3_js) or ""
            data_url = ("URL:" + lh3) if lh3 else None

        if not data_url:
            p(f"  Could not grab image — skipping."); continue

        if data_url.startswith("data:image"):
            img_bytes = base64.b64decode(data_url.split(",",1)[1])
            with open(raw_path,"wb") as f: f.write(img_bytes)
        elif data_url.startswith("URL:"):
            req = urllib.request.Request(data_url[4:], headers={"User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r: img_bytes = r.read()
            with open(raw_path,"wb") as f: f.write(img_bytes)
        p(f"  RAW saved: {len(img_bytes)//1024}KB")

        # Pipeline
        result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)
        if result.returncode != 0:
            p(f"  Pipeline error: {result.stderr[:200]}"); continue
        tmp_nobg = raw_path.replace("_raw.png","_raw_nobg.png")
        if not os.path.exists(tmp_nobg):
            p("  No pipeline output — skipping."); continue
        if os.path.exists(clean_path): os.remove(clean_path)
        os.rename(tmp_nobg, clean_path)
        p(f"  CLEAN: {os.path.basename(clean_path)}")

        # Copy to app + catalog
        shutil.copy2(clean_path, dest_path)
        add_to_catalog(sticker_id, label, family, size_tier)
        p(f"  [OK] Added to app")

        # Pause between items
        if idx < len(DECOR_ITEMS) - 1:
            p(f"  Pausing {INTER_PAUSE}s...")
            time.sleep(INTER_PAUSE)

    # Final commit
    p("\nCommitting all decor stickers...")
    subprocess.run(["git","add","-A"], cwd=WORKSPACE, capture_output=True)
    result = subprocess.run(["git","commit","-m","Add decor stickers: rocks, gazebos, seating, umbrella, pots, stairs, arches"], cwd=WORKSPACE, capture_output=True, text=True)
    p(result.stdout.strip() or result.stderr.strip())
    p("\n[OK] Decor batch complete.")

if __name__ == "__main__":
    main()
