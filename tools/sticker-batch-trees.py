"""
Garden Mapper — Trees Category Batch
Generates all tree-type stickers (deciduous trees, fruit trees, conifers/pines).
Uses CDP into Brave/Gemini tab + Rob's new prompt format (chroma-key green background).
Skips already-generated files. Runs sticker-pipeline.py on each output.

Usage:
  python sticker-batch-trees.py

Output:
  stickers/generated/trees/            <- raw grabbed PNGs (green background)
  stickers/generated/trees/processed/  <- pipeline-cleaned transparent PNGs
"""

import json, base64, time, os, sys, subprocess
import urllib.request
import websocket

# ── Config ─────────────────────────────────────────────────────────────────────
WORKSPACE            = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
OUT_RAW              = os.path.join(WORKSPACE, "stickers", "generated", "trees")
OUT_CLEAN            = os.path.join(WORKSPACE, "stickers", "generated", "trees", "processed")
PIPELINE             = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON               = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
INTER_PROMPT_DELAY   = 45
IMAGE_WAIT_TIMEOUT   = 240   # XL tree images take longer — bumped from 120s

os.makedirs(OUT_RAW, exist_ok=True)
os.makedirs(OUT_CLEAN, exist_ok=True)

# ── Prompt templates (Rob's wording — do not modify) ───────────────────────────
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

def build_pine_prompt(name, plant_type, size_px, colours):
    return (
        f"{PINE_PREFIX}\n\n"
        f"Subject: {name}, stubby {plant_type}, no trunk.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: Correct proportions."
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

# ── Full trees catalog ─────────────────────────────────────────────────────────
# type: "pine" | "deciduous" | "fruit"
TREES = [
    # ── Conifers (Pine template) ──
    {
        "id": "tree-conifer_pine_XL_CA-US-FR-GB-AU",
        "name": "Pine Tree", "type": "pine",
        "description": "evergreen conifer",
        "size": 512,
        "colours": "deep forest green #1A5C2A, mid-green #2E7A3A, blue-green #4A8C6A, dark outline #0A2A10, pale silver-green #8AAF8A",
        "shape_note": "",
    },
    {
        "id": "tree-conifer_blue-spruce_XL_CA-US-FR-GB",
        "name": "Blue Spruce", "type": "pine",
        "description": "evergreen conifer",
        "size": 512,
        "colours": "steel blue-green #5A8AA0, mid blue-grey #7A9AAA, silver-green #8AAFA8, dark outline #0A2030, pale silver accents #C0D8D8",
        "shape_note": "",
    },
    {
        "id": "tree-conifer_leylandii_XL_CA-US-FR-GB",
        "name": "Leylandii Cypress", "type": "pine",
        "description": "fast-growing evergreen conifer",
        "size": 512,
        "colours": "deep green #1A4A1A, mid-green #2A6A2A, blue-green #3A7A5A, dark outline #0A1A0A, pale green highlights #7AAF7A",
        "shape_note": "",
    },
    # ── Fruit Trees (Deciduous template + fruit accent) ──
    {
        "id": "tree-fruit_apple_XL_CA-US-FR-GB-AU",
        "name": "Apple Tree", "type": "fruit",
        "description": "round deciduous fruit tree",
        "size": 512,
        "colours": "mid-green #4E8C3A, deep green #2A5C1A, bright red apples #D42B2B, warm brown limbs #6B3A2A, pale yellow-green accents #B8D474",
        "shape_note": "Minimal fruit, only as accent.",
    },
    {
        "id": "tree-fruit_pear_XL_CA-US-FR-GB-AU",
        "name": "Pear Tree", "type": "fruit",
        "description": "round deciduous fruit tree",
        "size": 512,
        "colours": "mid-green #4A8C3A, deep green #2A5C1A, golden-yellow pear #E8C840, warm brown limbs #6B3A2A, pale green accents #B8D474",
        "shape_note": "Minimal pear-shaped golden fruit, only as accent.",
    },
    {
        "id": "tree-fruit_cherry_XL_CA-US-FR-GB-AU",
        "name": "Cherry Tree", "type": "fruit",
        "description": "round deciduous fruit tree",
        "size": 512,
        "colours": "mid-green #4A8C3A, deep green #2A5C1A, bright red cherry clusters #D42B2B, warm brown limbs #6B3A2A, pale pink accents #F5AACB",
        "shape_note": "Minimal bright red cherry clusters, only as accent.",
    },
    {
        "id": "tree-fruit_plum_XL_CA-US-FR-GB-AU",
        "name": "Plum Tree", "type": "fruit",
        "description": "round deciduous fruit tree",
        "size": 512,
        "colours": "mid-green #4A8C3A, deep green #2A5C1A, deep purple plums #5B1AA7, warm brown limbs #6B3A2A, pale green accents #B8D474",
        "shape_note": "Minimal deep purple round plums, only as accent.",
    },
    {
        "id": "tree-fruit_lemon_XL_US-FR-AU",
        "name": "Lemon Tree", "type": "fruit",
        "description": "evergreen citrus fruit tree",
        "size": 512,
        "colours": "deep green #2A5C1A, bright green #4A8C3A, vivid yellow lemon #FFD700, warm brown limbs #6B3A2A, pale yellow accents #FFF0A0",
        "shape_note": "Minimal bright yellow oval lemons, only as accent.",
    },
    {
        "id": "tree-fruit_peach_XL_CA-US-FR-AU",
        "name": "Peach Tree", "type": "fruit",
        "description": "round deciduous fruit tree",
        "size": 512,
        "colours": "mid-green #4A8C3A, deep green #2A5C1A, warm peach #F5A070, warm brown limbs #6B3A2A, pale pink accents #F5C8B8",
        "shape_note": "Minimal warm peach-coloured round fruit, only as accent.",
    },
    # ── Ornamental / Shade Trees (Deciduous template) ──
    {
        "id": "tree-deciduous_japanese-maple_XL_CA-US-FR-GB-AU",
        "name": "Japanese Maple", "type": "deciduous",
        "description": "graceful ornamental deciduous tree",
        "size": 512,
        "colours": "deep crimson red #8B1A1A, burgundy #5B0A0A, orange-red #C84A1A, warm brown limbs #6B3A2A, dark outline #1A0A0A",
        "shape_note": "",
    },
    {
        "id": "tree-deciduous_silver-birch_XL_CA-US-FR-GB",
        "name": "Silver Birch", "type": "deciduous",
        "description": "airy deciduous ornamental tree",
        "size": 512,
        "colours": "fresh lime-green #A8D848, mid-green #4A8C3A, white-silver limbs #E8E8E8, pale yellow-green #C8E878, dark outline #1A1A1A",
        "shape_note": "",
    },
    {
        "id": "tree-deciduous_magnolia_XL_CA-US-FR-GB-AU",
        "name": "Magnolia", "type": "deciduous",
        "description": "flowering ornamental deciduous tree",
        "size": 512,
        "colours": "deep pink #E8407A, pale blush #F5C8D8, cream white #FFF5E0, mid-green #4A8C3A, warm brown limbs #6B3A2A",
        "shape_note": "",
    },
    {
        "id": "tree-deciduous_weeping-willow_XL_CA-US-FR-GB-AU",
        "name": "Weeping Willow", "type": "deciduous",
        "description": "cascading deciduous ornamental tree",
        "size": 512,
        "colours": "yellow-green #A8C840, mid-green #4A8C3A, pale lime #C8E870, warm brown limbs #7A5C2A, dark outline #1A2A0A",
        "shape_note": "",
    },
    {
        "id": "tree-deciduous_oak_XL_CA-US-FR-GB-AU",
        "name": "Oak Tree", "type": "deciduous",
        "description": "large broad deciduous tree",
        "size": 512,
        "colours": "deep green #2A5C1A, mid-green #4A8C3A, olive green #6B7A3A, warm brown limbs #6B3A2A, dark outline #0A1A0A",
        "shape_note": "",
    },
    {
        "id": "tree-deciduous_ornamental-cherry_XL_CA-US-FR-GB-AU",
        "name": "Ornamental Cherry", "type": "deciduous",
        "description": "flowering ornamental deciduous tree",
        "size": 512,
        "colours": "pale pink blossom #F5AACB, deep pink #E8407A, white #FFFFFF, mid-green #4A8C3A, warm brown limbs #6B3A2A",
        "shape_note": "",
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
    """Get the src of the most recent generated image — works for both blob: and lh3.googleusercontent.com URLs."""
    js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent")).filter(x=>x.naturalWidth>100); i.length?i[i.length-1].src:""'
    return cdp_eval(ws_url, js, timeout=10) or ""

def get_blob_src(ws_url):
    return get_generated_img_src(ws_url)

def new_chat(ws_url):
    """Click the New Chat button or navigate to fresh gemini.google.com to reset blob state."""
    # Try clicking the new chat / pencil icon first
    result = cdp_eval(ws_url, '(function(){var btns=[...document.querySelectorAll("button,a")].filter(b=>b.getAttribute("aria-label")&&b.getAttribute("aria-label").toLowerCase().includes("new"));if(btns.length){btns[0].click();return "CLICKED";}return "NOT_FOUND";})()', timeout=8)
    if result != "CLICKED":
        # Fallback: hard navigate to fresh chat
        cdp_eval(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
    time.sleep(4)  # wait for UI to settle
    return result

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
    """Get the generated image — uses canvas for blob: URLs, direct URL download for lh3.googleusercontent.com."""
    # First check if it's a blob URL (canvas method works)
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

    # For lh3.googleusercontent.com — get the URL and download directly via Python
    lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>200); i.length?i[i.length-1].src:""'
    lh3_src = cdp_eval(ws_url, lh3_js, timeout=10) or ""
    if lh3_src and lh3_src != "":
        return "URL:" + lh3_src

    return None
    return cdp_eval(ws_url, js, timeout=20)

def generate_one(tree):
    raw_path = os.path.join(OUT_RAW, f"{tree['id']}_raw.png")
    if os.path.exists(raw_path):
        p(f"  SKIP raw (exists): {tree['id']}")
        return raw_path

    if tree["type"] == "pine":
        prompt = build_pine_prompt(tree["name"], tree["description"], tree["size"], tree["colours"])
    else:
        prompt = build_deciduous_prompt(tree["name"], tree["description"], tree["size"], tree["colours"], tree.get("shape_note", ""))

    p(f"  Prompt: {len(prompt)} chars")

    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except RuntimeError as e:
        p(f"  ABORT: {e}")
        return None

    # Navigate to fresh Gemini chat URL
    cdp_eval(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
    # Wait for page to load and input to be ready
    time.sleep(8)
    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except Exception:
        pass

    # Wait until the contenteditable input is present and ready
    deadline_load = time.time() + 30
    while time.time() < deadline_load:
        input_ready = cdp_eval(ws_url, 'document.querySelector("[contenteditable=true]")!==null', timeout=5)
        if input_ready:
            break
        time.sleep(2)
    time.sleep(1)  # extra settle

    # Snapshot current image src so we can detect when a NEW image appears
    src_before = get_generated_img_src(ws_url)
    p(f"  Baseline img: {src_before[:60] if src_before else 'none'}")

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
                time.sleep(2)  # let image fully render
                break
        except Exception:
            pass

    if not found:
        p(f"  FAIL: no image after {IMAGE_WAIT_TIMEOUT}s")
        return None

    data_url = grab_image(ws_url)
    if data_url and data_url.startswith("data:image"):
        img_bytes = base64.b64decode(data_url.split(",", 1)[1])
        with open(raw_path, "wb") as f:
            f.write(img_bytes)
        p(f"  RAW saved (canvas): {os.path.basename(raw_path)} ({len(img_bytes)//1024}KB)")
        return raw_path
    elif data_url and data_url.startswith("URL:"):
        img_url = data_url[4:]
        p(f"  Downloading from: {img_url[:80]}...")
        try:
            req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                img_bytes = resp.read()
            with open(raw_path, "wb") as f:
                f.write(img_bytes)
            p(f"  RAW saved (download): {os.path.basename(raw_path)} ({len(img_bytes)//1024}KB)")
            return raw_path
        except Exception as e:
            p(f"  FAIL: download error: {e}")
            return None
    else:
        p(f"  FAIL: could not grab image data")
        return None

def run_pipeline(raw_path):
    clean_name = os.path.basename(raw_path).replace("_raw.png", ".png")
    clean_path = os.path.join(OUT_CLEAN, clean_name)
    tmp_nobg   = os.path.splitext(raw_path)[0] + "_nobg.png"

    p(f"  Running pipeline...")
    result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)
    if result.returncode != 0:
        p(f"  Pipeline error: {result.stderr}")
        return None

    if os.path.exists(tmp_nobg):
        if os.path.exists(clean_path):
            os.remove(clean_path)
        os.rename(tmp_nobg, clean_path)
        p(f"  CLEAN saved: {clean_name}")
        return clean_path
    else:
        p(f"  Pipeline ran but output not found")
        return None

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    p("=" * 60)
    p(f"Garden Mapper -- Trees Batch ({len(TREES)} stickers)")
    p(f"Raw:   {OUT_RAW}")
    p(f"Clean: {OUT_CLEAN}")
    p(f"Pause between prompts: {INTER_PROMPT_DELAY}s")
    p("=" * 60)

    try:
        get_gemini_tab()
        p("[OK] Gemini tab found in Brave\n")
    except RuntimeError as e:
        p(f"[ABORT] {e}")
        sys.exit(1)

    already_clean = set(f.replace(".png", "") for f in os.listdir(OUT_CLEAN) if f.endswith(".png"))
    remaining = [t for t in TREES if t["id"] not in already_clean]
    p(f"Already complete: {len(TREES) - len(remaining)}/{len(TREES)}")
    p(f"To generate: {len(remaining)}\n")

    clean_files = []
    failed = []

    for i, tree in enumerate(remaining):
        p(f"[{i+1}/{len(remaining)}] {tree['name']} ({tree['id']})")

        raw = generate_one(tree)
        if raw:
            clean = run_pipeline(raw)
            if clean:
                clean_files.append(clean)
            else:
                failed.append(tree["id"] + " (pipeline failed)")
        else:
            failed.append(tree["id"] + " (generation failed)")

        if i < len(remaining) - 1:
            p(f"  [PAUSE] {INTER_PROMPT_DELAY}s...\n")
            time.sleep(INTER_PROMPT_DELAY)

    p("\n" + "=" * 60)
    p("BATCH COMPLETE")
    p(f"  Generated this run: {len(clean_files)}")
    p(f"  Total in processed: {len(os.listdir(OUT_CLEAN))}/{len(TREES)}")
    if failed:
        p(f"  Failed: {', '.join(failed)}")
    p(f"\n  Review folder: {OUT_CLEAN}")
    p("=" * 60)

if __name__ == "__main__":
    main()
