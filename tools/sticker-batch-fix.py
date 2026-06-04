"""
Garden Mapper — Fix + Missing Veg Batch
Covers:
  - #32: Regenerate deciduous/fruit trees (misnaming issue — same image used for most)
  - #35: Regenerate Gladiolus (solid background — needs chroma key treatment)
  - Missing veg: Brussels Sprouts, Beans, Celery, Edamame, Kohlrabi, Okra, Parsnips, Rutabaga

IMPORTANT: For #32 trees, delete the existing processed files first so the script
regenerates them fresh (overwrite protection is based on clean file existence).
"""

import json, base64, time, os, sys, subprocess
import urllib.request
import websocket

WORKSPACE          = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
OUT_RAW            = os.path.join(WORKSPACE, "stickers", "generated", "plants")
OUT_CLEAN          = os.path.join(WORKSPACE, "stickers", "generated", "plants", "processed")
TREE_RAW           = os.path.join(WORKSPACE, "stickers", "generated", "trees")
TREE_CLEAN         = os.path.join(WORKSPACE, "stickers", "generated", "trees", "processed")
RV_RAW             = os.path.join(WORKSPACE, "stickers", "generated", "rootveg")
RV_CLEAN           = os.path.join(WORKSPACE, "stickers", "generated", "rootveg", "processed")
PIPELINE           = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON             = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
INTER_PROMPT_DELAY = 45
IMAGE_WAIT_TIMEOUT = 240

for d in [OUT_RAW, OUT_CLEAN, TREE_RAW, TREE_CLEAN, RV_RAW, RV_CLEAN]:
    os.makedirs(d, exist_ok=True)

# ── Prompt templates (Rob's wording — do not modify) ───────────────────────────
PLANT_PREFIX = (
    "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
    "No shadows. No background showing in the center of the plant. Centered, 75% "
    "canvas fill. Vibrant and iconic."
)

PINE_PREFIX = (
    "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, no trunk, bold flat icon. Dark outline 2-3px. "
    "No shadows. No background showing in the center of the plant. Centered, 75% "
    "canvas fill. Vibrant and iconic."
)

DECIDUOUS_PREFIX = (
    "Side aerial view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, leafy, Dark outline 2-3px. No shadows. "
    "Centered, 75% canvas fill. Vibrant and iconic."
)

ROOT_VEG_PREFIX = (
    "Side aerial view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
    "Line texturing. No shadows. No background showing in the center of the plant. "
    "Centered, 75% canvas fill. Vibrant and iconic."
)

def build_plant_prompt(name, plant_type, size_px, colours, shape):
    return (
        f"{PLANT_PREFIX}\n\n"
        f"Subject: {name}, {plant_type}.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: {shape} Only a few leaves and flowers, small plant. Correct proportions."
    )

def build_deciduous_prompt(name, description, size_px, colours, shape_note=""):
    fruit_note = f" {shape_note}" if shape_note else ""
    return (
        f"{DECIDUOUS_PREFIX}\n\n"
        f"Subject: {name}, {description}, No trunk.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: Natural leafy canopy.{fruit_note}"
    )

def build_rootveg_prompt(name, plant_type, size_px, colours, shape):
    return (
        f"{ROOT_VEG_PREFIX}\n\n"
        f"Subject: {name}, {plant_type}.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: {shape} Natural proportions."
    )

# ── Sticker list ────────────────────────────────────────────────────────────────
PLANTS = [
    # ── #35 Gladiolus regen (solid background — redo with chroma key) ──
    {
        "id": "flower-spike_gladiolus_M_CA-US-FR-GB-AU",
        "name": "Gladiolus", "prompt_type": "plant",
        "type": "tender corm perennial", "size": 256,
        "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN,
        "colours": "deep magenta #C41270, coral #E8703A, pale pink #F5AACB, mid-green strap #4A7C2F, dark outline #1A0A0A",
        "shape": "Tall upright spike of stacked funnel-shaped blooms in pink and coral opening from base to tip, strap leaves at base, stem at bottom and spike at top.",
        "force_regen": True,
    },
    # ── #32 Deciduous trees regen ──
    {
        "id": "tree-deciduous_japanese-maple_XL_CA-US-FR-GB-AU",
        "name": "Japanese Maple", "prompt_type": "deciduous",
        "description": "graceful ornamental deciduous tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "deep crimson red #8B1A1A, burgundy #5B0A0A, orange-red #C84A1A, warm brown limbs #6B3A2A, dark outline #1A0A0A",
        "shape_note": "",
        "force_regen": True,
    },
    {
        "id": "tree-deciduous_magnolia_XL_CA-US-FR-GB-AU",
        "name": "Magnolia", "prompt_type": "deciduous",
        "description": "flowering ornamental deciduous tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "deep pink #E8407A, pale blush #F5C8D8, cream white #FFF5E0, mid-green #4A8C3A, warm brown limbs #6B3A2A",
        "shape_note": "",
        "force_regen": True,
    },
    {
        "id": "tree-deciduous_oak_XL_CA-US-FR-GB-AU",
        "name": "Oak Tree", "prompt_type": "deciduous",
        "description": "large broad deciduous tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "deep green #2A5C1A, mid-green #4A8C3A, olive green #6B7A3A, warm brown limbs #6B3A2A, dark outline #0A1A0A",
        "shape_note": "",
        "force_regen": True,
    },
    {
        "id": "tree-deciduous_ornamental-cherry_XL_CA-US-FR-GB-AU",
        "name": "Ornamental Cherry", "prompt_type": "deciduous",
        "description": "flowering ornamental deciduous tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "pale pink blossom #F5AACB, deep pink #E8407A, white #FFFFFF, mid-green #4A8C3A, warm brown limbs #6B3A2A",
        "shape_note": "",
        "force_regen": True,
    },
    {
        "id": "tree-deciduous_silver-birch_XL_CA-US-FR-GB",
        "name": "Silver Birch", "prompt_type": "deciduous",
        "description": "airy deciduous ornamental tree with distinctive white bark", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "fresh lime-green #A8D848, mid-green #4A8C3A, white-silver limbs #E8E8E8, pale yellow-green #C8E878, dark outline #1A1A1A",
        "shape_note": "",
        "force_regen": True,
    },
    {
        "id": "tree-deciduous_weeping-willow_XL_CA-US-FR-GB-AU",
        "name": "Weeping Willow", "prompt_type": "deciduous",
        "description": "cascading deciduous ornamental tree with long drooping branches", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "yellow-green #A8C840, mid-green #4A8C3A, pale lime #C8E870, warm brown limbs #7A5C2A, dark outline #1A2A0A",
        "shape_note": "",
        "force_regen": True,
    },
    {
        "id": "tree-fruit_apple_XL_CA-US-FR-GB-AU",
        "name": "Apple Tree", "prompt_type": "deciduous",
        "description": "round deciduous fruit tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "mid-green #4E8C3A, deep green #2A5C1A, bright red apples #D42B2B, warm brown limbs #6B3A2A, pale yellow-green accents #B8D474",
        "shape_note": "Minimal bright red apple fruit, only as accent.",
        "force_regen": True,
    },
    {
        "id": "tree-fruit_cherry_XL_CA-US-FR-GB-AU",
        "name": "Cherry Tree", "prompt_type": "deciduous",
        "description": "round deciduous fruit tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "mid-green #4A8C3A, deep green #2A5C1A, bright red cherry clusters #D42B2B, warm brown limbs #6B3A2A, pale pink accents #F5AACB",
        "shape_note": "Minimal bright red cherry clusters, only as accent.",
        "force_regen": True,
    },
    {
        "id": "tree-fruit_lemon_XL_US-FR-AU",
        "name": "Lemon Tree", "prompt_type": "deciduous",
        "description": "evergreen citrus fruit tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "deep green #2A5C1A, bright green #4A8C3A, vivid yellow lemon #FFD700, warm brown limbs #6B3A2A, pale yellow accents #FFF0A0",
        "shape_note": "Minimal bright yellow oval lemons, only as accent.",
        "force_regen": True,
    },
    {
        "id": "tree-fruit_peach_XL_CA-US-FR-AU",
        "name": "Peach Tree", "prompt_type": "deciduous",
        "description": "round deciduous fruit tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "mid-green #4A8C3A, deep green #2A5C1A, warm peach #F5A070, warm brown limbs #6B3A2A, pale pink accents #F5C8B8",
        "shape_note": "Minimal warm peach-coloured round fruit, only as accent.",
        "force_regen": True,
    },
    {
        "id": "tree-fruit_pear_XL_CA-US-FR-GB-AU",
        "name": "Pear Tree", "prompt_type": "deciduous",
        "description": "round deciduous fruit tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "mid-green #4A8C3A, deep green #2A5C1A, golden-yellow pear #E8C840, warm brown limbs #6B3A2A, pale green accents #B8D474",
        "shape_note": "Minimal pear-shaped golden fruit, only as accent.",
        "force_regen": True,
    },
    {
        "id": "tree-fruit_plum_XL_CA-US-FR-GB-AU",
        "name": "Plum Tree", "prompt_type": "deciduous",
        "description": "round deciduous fruit tree", "size": 512,
        "raw_dir": TREE_RAW, "clean_dir": TREE_CLEAN,
        "colours": "mid-green #4A8C3A, deep green #2A5C1A, deep purple plums #5B1AA7, warm brown limbs #6B3A2A, pale green accents #B8D474",
        "shape_note": "Minimal deep purple round plums, only as accent.",
        "force_regen": True,
    },
    # ── Missing vegetables ──
    {
        "id": "vegetable-tall_beans_S_CA-US-FR-GB-AU",
        "name": "Bush Beans", "prompt_type": "plant",
        "type": "compact annual vegetable", "size": 160,
        "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN,
        "colours": "bright green pods #5AB83A, mid-green #4A7C2F, pale green #8FBF6A, white flower #F5F0E8, dark outline #0A1A0A",
        "shape": "Low compact bushy plant with slender bright green bean pods hanging among compound trifoliate leaves, stems at bottom and leafy canopy at top.",
        "force_regen": False,
    },
    {
        "id": "vegetable-leafy_brussels-sprouts_M_CA-US-FR-GB-AU",
        "name": "Brussels Sprouts", "prompt_type": "plant",
        "type": "upright brassica biennial", "size": 256,
        "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN,
        "colours": "deep blue-green #2A5A3A, mid-green #4A7C2F, pale green #8FBF6A, grey-green #7A9A8A, dark outline #0A1A0A",
        "shape": "Tall upright stalk studded with small round tight sprout buds all the way up, broad leaves fanning from the top, stems at bottom and leaves at top.",
        "force_regen": False,
    },
    {
        "id": "vegetable-tall_celery_M_CA-US-FR-GB-AU",
        "name": "Celery", "prompt_type": "plant",
        "type": "upright biennial vegetable", "size": 256,
        "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN,
        "colours": "pale green #A8D870, bright green #5AB83A, mid-green #4A7C2F, cream-white base #F5F0E8, dark outline #0A1A0A",
        "shape": "Upright tight cluster of long ribbed pale-green stalks fanning out at top with feathery bright green leaves, stems at bottom and leafy tops at top.",
        "force_regen": False,
    },
    {
        "id": "vegetable-tall_edamame_S_CA-US-FR-GB-AU",
        "name": "Edamame", "prompt_type": "plant",
        "type": "compact annual legume", "size": 160,
        "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN,
        "colours": "bright green pods #5AB83A, mid-green #4A7C2F, deep green #2A5C1A, white flower #F5F0E8, dark outline #0A1A0A",
        "shape": "Compact bushy plant with plump fuzzy bright green soybean pods clustered along the stems among trifoliate leaves, stems at bottom and leafy canopy at top.",
        "force_regen": False,
    },
    {
        "id": "vegetable-root_kohlrabi_S_CA-US-FR-GB-AU",
        "name": "Kohlrabi", "prompt_type": "rootveg",
        "type": "brassica root vegetable", "size": 160,
        "raw_dir": RV_RAW, "clean_dir": RV_CLEAN,
        "colours": "pale purple-green #C8B8D8, pale green #A8D870, bright green tops #5AB83A, mid-green #4A7C2F, dark outline #1A0A0A",
        "shape": "Kohlrabi bulb and strap tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Round pale purple-green kohlrabi bulb with protruding leaf stems visible above the soil, root at bottom and leafy tops.",
        "force_regen": False,
    },
    {
        "id": "vegetable-tall_okra_M_US-FR-AU",
        "name": "Okra", "prompt_type": "plant",
        "type": "tall annual vegetable", "size": 256,
        "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN,
        "colours": "deep green #2A5C1A, mid-green #4A7C2F, pale green okra pods #8FBF6A, yellow flower #FFD700, dark outline #0A1A0A",
        "shape": "Tall upright plant with large lobed leaves and slender tapering bright green okra pods standing upright above creamy yellow hibiscus-like flowers, stems at bottom and canopy at top.",
        "force_regen": False,
    },
    {
        "id": "vegetable-root_parsnip_S_CA-US-FR-GB",
        "name": "Parsnip", "prompt_type": "rootveg",
        "type": "root vegetable", "size": 160,
        "raw_dir": RV_RAW, "clean_dir": RV_CLEAN,
        "colours": "pale cream-white #F5F0E0, warm ivory #FFF5E0, bright green tops #5AB83A, mid-green #4A7C2F, dark outline #1A0A0A",
        "shape": "Parsnip and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Pale cream-white tapered parsnip shoulder visible above the soil, root at bottom and leafy ferny tops.",
        "force_regen": False,
    },
    {
        "id": "vegetable-root_rutabaga_S_CA-US-FR-GB",
        "name": "Rutabaga", "prompt_type": "rootveg",
        "type": "root vegetable", "size": 160,
        "raw_dir": RV_RAW, "clean_dir": RV_CLEAN,
        "colours": "purple-yellow #C8A050, pale yellow #FFF0A0, bright green tops #5AB83A, blue-green #3A6A5A, dark outline #1A0A0A",
        "shape": "Rutabaga and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Round purple-yellow rutabaga shoulder visible above the soil, root at bottom and blue-green leafy tops.",
        "force_regen": False,
    },
]

# ── CDP helpers ────────────────────────────────────────────────────────────────
def p(*args):
    print(*args, flush=True)

def get_gemini_tab():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    for t in tabs:
        if "gemini.google.com" in t.get("url", "") and t.get("type") == "page":
            return t
    raise RuntimeError("Gemini tab not found — is Brave open at gemini.google.com?")

def cdp_eval(ws_url, expr, timeout=15):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(timeout)
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                        "params": {"expression": expr, "returnByValue": True}}))
    result = None
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            data = json.loads(ws.recv())
            if data.get("id") == 1:
                result = data.get("result", {}).get("result", {}).get("value")
                break
        except websocket.WebSocketTimeoutException:
            break
    ws.close()
    return result

def get_generated_img_src(ws_url):
    js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    return cdp_eval(ws_url, js, timeout=10) or ""

def navigate_fresh():
    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except RuntimeError as e:
        raise e
    cdp_eval(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
    time.sleep(10)
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
            break
        except Exception:
            pass
        time.sleep(2)
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            ready = cdp_eval(ws_url, 'document.querySelector("[contenteditable=true]")!==null', timeout=5)
            if ready:
                break
        except Exception:
            pass
        time.sleep(2)
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
        except Exception:
            pass
    time.sleep(1)
    return ws_url

def type_and_send(ws_url, prompt):
    cdp_eval(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return b?"OK":"NO";})()', timeout=8)
    time.sleep(0.5)
    ws = websocket.create_connection(ws_url, timeout=10)
    ws.settimeout(8)
    ws.send(json.dumps({"id": 1, "method": "Input.insertText", "params": {"text": prompt}}))
    try: ws.recv()
    except: pass
    ws.close()
    time.sleep(0.5)
    result = cdp_eval(ws_url, '(function(){var b=document.querySelector("button[aria-label=\'Send message\']");if(b){b.click();return "SENT";}return "NO_BTN";})()', timeout=8)
    return result

def grab_image(ws_url):
    blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    blob_src = cdp_eval(ws_url, blob_js, timeout=10) or ""
    if blob_src:
        js = f"""
(function(){{
    var img=document.querySelector('img[src="{blob_src}"]');
    if(!img||img.naturalWidth<100)return 'NONE';
    var c=document.createElement('canvas');
    c.width=img.naturalWidth;c.height=img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);
    return c.toDataURL('image/png');
}})()
"""
        return cdp_eval(ws_url, js, timeout=20)
    lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    lh3_src = cdp_eval(ws_url, lh3_js, timeout=10) or ""
    if lh3_src:
        return "URL:" + lh3_src
    return None

def build_prompt(plant):
    pt = plant["prompt_type"]
    if pt == "deciduous":
        return build_deciduous_prompt(plant["name"], plant["description"], plant["size"], plant["colours"], plant.get("shape_note",""))
    elif pt == "rootveg":
        return build_rootveg_prompt(plant["name"], plant["type"], plant["size"], plant["colours"], plant["shape"])
    else:
        return build_plant_prompt(plant["name"], plant["type"], plant["size"], plant["colours"], plant["shape"])

def generate_one(plant):
    raw_path   = os.path.join(plant["raw_dir"], f"{plant['id']}_raw.png")
    clean_path = os.path.join(plant["clean_dir"], f"{plant['id']}.png")

    # Force regen: delete existing raw + clean so we start fresh
    if plant.get("force_regen"):
        for path in [raw_path, clean_path]:
            if os.path.exists(path):
                os.remove(path)
                p(f"  Deleted existing: {os.path.basename(path)}")

    if os.path.exists(clean_path):
        p(f"  SKIP (clean exists)")
        return True

    prompt = build_prompt(plant)

    if not os.path.exists(raw_path):
        try:
            ws_url = navigate_fresh()
        except RuntimeError as e:
            p(f"  ABORT: {e}")
            return False

        src_before = get_generated_img_src(ws_url)
        p(f"  Baseline: {src_before[:60] if src_before else 'none'}")
        send_result = type_and_send(ws_url, prompt)
        p(f"  Sent: {send_result} | Waiting up to {IMAGE_WAIT_TIMEOUT}s...")

        deadline = time.time() + IMAGE_WAIT_TIMEOUT
        found = False
        while time.time() < deadline:
            time.sleep(5)
            try:
                tab = get_gemini_tab()
                ws_url = tab.get("webSocketDebuggerUrl")
                src_now = get_generated_img_src(ws_url)
                if src_now and src_now != src_before:
                    found = True
                    time.sleep(2)
                    break
            except Exception:
                pass

        if not found:
            p(f"  FAIL: no image after {IMAGE_WAIT_TIMEOUT}s")
            return False

        data_url = grab_image(ws_url)
        if data_url and data_url.startswith("data:image"):
            img_bytes = base64.b64decode(data_url.split(",", 1)[1])
            with open(raw_path, "wb") as f:
                f.write(img_bytes)
            p(f"  RAW saved (canvas): {os.path.basename(raw_path)} ({len(img_bytes)//1024}KB)")
        elif data_url and data_url.startswith("URL:"):
            img_url = data_url[4:]
            p(f"  Downloading from lh3...")
            try:
                req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    img_bytes = resp.read()
                with open(raw_path, "wb") as f:
                    f.write(img_bytes)
                p(f"  RAW saved (download): {os.path.basename(raw_path)} ({len(img_bytes)//1024}KB)")
            except Exception as e:
                p(f"  FAIL: download error: {e}")
                return False
        else:
            p(f"  FAIL: could not grab image")
            return False
    else:
        p(f"  SKIP raw (exists), pipeline only...")

    tmp_nobg = os.path.splitext(raw_path)[0] + "_nobg.png"
    p(f"  Running pipeline...")
    result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)
    if result.returncode != 0:
        p(f"  Pipeline error: {result.stderr}")
        return False
    if os.path.exists(tmp_nobg):
        if os.path.exists(clean_path):
            os.remove(clean_path)
        os.rename(tmp_nobg, clean_path)
        p(f"  CLEAN saved: {plant['id']}.png")
        return True
    p(f"  Pipeline ran but output not found")
    return False

def main():
    p("=" * 60)
    p(f"Garden Mapper -- Fix + Missing Veg Batch ({len(PLANTS)} items)")
    p(f"  #35: Gladiolus regen")
    p(f"  #32: 11 trees regen")
    p(f"  New veg: 8 items")
    p(f"Pause between prompts: {INTER_PROMPT_DELAY}s")
    p(f"Est. time: ~{len(PLANTS) * (INTER_PROMPT_DELAY + 60) // 60} minutes")
    p("=" * 60)

    try:
        get_gemini_tab()
        p("[OK] Gemini tab found in Brave\n")
    except RuntimeError as e:
        p(f"[ABORT] {e}")
        sys.exit(1)

    ok, failed = 0, []

    for i, plant in enumerate(PLANTS):
        tag = "[REGEN]" if plant.get("force_regen") else "[NEW]"
        p(f"[{i+1}/{len(PLANTS)}] {tag} {plant['name']} ({plant['id']})")
        if generate_one(plant):
            ok += 1
        else:
            failed.append(plant["name"])
        if i < len(PLANTS) - 1:
            p(f"  [PAUSE] {INTER_PROMPT_DELAY}s...\n")
            time.sleep(INTER_PROMPT_DELAY)

    p("\n" + "=" * 60)
    p("BATCH COMPLETE")
    p(f"  Successful: {ok}/{len(PLANTS)}")
    if failed:
        p(f"  Failed: {', '.join(failed)}")
    p(f"\n  Plants:  {OUT_CLEAN}")
    p(f"  Trees:   {TREE_CLEAN}")
    p(f"  Root veg: {RV_CLEAN}")
    p("=" * 60)

if __name__ == "__main__":
    main()
