"""
Garden Mapper — Root Vegetables + Tomato Retry Batch
Generates all root vegetable stickers + retries any failed plants.
Uses CDP into Brave/Gemini tab + Rob's new prompt format (chroma-key green background).
Skips already-generated files. Runs sticker-pipeline.py on each output.

Usage:
  python sticker-batch-rootveg.py

Output:
  stickers/generated/rootveg/            <- raw grabbed PNGs
  stickers/generated/rootveg/processed/  <- pipeline-cleaned transparent PNGs
"""

import json, base64, time, os, sys, subprocess
import urllib.request
import websocket

# ── Config ─────────────────────────────────────────────────────────────────────
WORKSPACE            = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
OUT_RAW              = os.path.join(WORKSPACE, "stickers", "generated", "rootveg")
OUT_CLEAN            = os.path.join(WORKSPACE, "stickers", "generated", "rootveg", "processed")
PIPELINE             = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON               = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
INTER_PROMPT_DELAY   = 45
IMAGE_WAIT_TIMEOUT   = 240

os.makedirs(OUT_RAW, exist_ok=True)
os.makedirs(OUT_CLEAN, exist_ok=True)

# ── Prompt template — ROOT VEGETABLES (Rob's wording, do not modify) ───────────
ROOT_VEG_PREFIX = (
    "Side aerial view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
    "Line texturing. No shadows. No background showing in the center of the plant. "
    "Centered, 75% canvas fill. Vibrant and iconic."
)

def build_rootveg_prompt(name, plant_type, size_px, colours, shape):
    return (
        f"{ROOT_VEG_PREFIX}\n\n"
        f"Subject: {name}, {plant_type}.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: {shape} Natural proportions."
    )

# ── Root veg catalog ───────────────────────────────────────────────────────────
ROOTVEG = [
    {
        "id": "vegetable-root_carrot_S_CA-US-FR-GB-AU",
        "name": "Carrot", "type": "root vegetable", "size": 160,
        "colours": "bright orange #FF6B1A, deep orange #CC4A00, bright green tops #4AAF2F, mid-green #2A7010, pale green stem #8FBF6A",
        "shape": "Carrots and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Bold orange carrot shoulders visible above the soil, root at bottom and leafy tops.",
    },
    {
        "id": "vegetable-root_beet_S_CA-US-FR-GB-AU",
        "name": "Beet", "type": "root vegetable", "size": 160,
        "colours": "deep burgundy-red #8B1A2A, dark magenta #6B0A1A, bright green tops #4AAF2F, red-veined leaves #A83A2A, dark soil line #5A3A1A",
        "shape": "Beet and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Round dark red beet shoulders visible above the soil, root at bottom and leafy red-veined tops.",
    },
    {
        "id": "vegetable-root_radish_S_CA-US-FR-GB-AU",
        "name": "Radish", "type": "root vegetable", "size": 160,
        "colours": "vivid red #D42B2B, pale white shoulder #F5F0E8, bright green tops #4AAF2F, mid-green #2A7010, dark outline #1A0A0A",
        "shape": "Radish and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Round vivid red radish shoulders visible above the soil, root at bottom and leafy tops.",
    },
    {
        "id": "vegetable-root_turnip_S_CA-US-FR-GB-AU",
        "name": "Turnip", "type": "root vegetable", "size": 160,
        "colours": "pale purple-white #C8A8C8, white #F5F0E8, bright green tops #4AAF2F, mid-green #2A7010, dark outline #1A0A0A",
        "shape": "Turnip and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Round pale purple-white turnip shoulders visible above the soil, root at bottom and leafy tops.",
    },
    {
        "id": "vegetable-root_garlic_S_CA-US-FR-GB-AU",
        "name": "Garlic", "type": "root bulb", "size": 160,
        "colours": "papery white #F5F0E8, pale purple tinge #C8B8D8, bright green strap #4AAF2F, mid-green #2A7010, warm tan #C8A870",
        "shape": "Garlic bulb and strap tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Papery white garlic bulb shoulders visible above the soil, root at bottom and strap-leaf tops.",
    },
]

# ── Tomato retry (goes into plants processed folder) ──────────────────────────
PLANTS_RAW   = os.path.join(WORKSPACE, "stickers", "generated", "plants")
PLANTS_CLEAN = os.path.join(WORKSPACE, "stickers", "generated", "plants", "processed")

PLANT_PREFIX = (
    "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
    "No shadows. No background showing in the center of the plant. Centered, 75% "
    "canvas fill. Vibrant and iconic."
)

TOMATO_RETRY = {
    "id": "vegetable-tall_tomato_M_CA-US-FR-GB-AU",
    "name": "Tomato", "type": "compact fruiting annual", "size": 256,
    "colours": "bright red #D42B2B, deep green #2A5C1A, light green #7AB648, warm yellow #F5C518, dark stem brown #5A3010",
    "shape": "Upright leafy plant with round red tomatoes hanging in clusters, stems at bottom and leafy canopy at top. Only a few leaves and flowers, small plant. Correct proportions.",
    "raw_dir": PLANTS_RAW,
    "clean_dir": PLANTS_CLEAN,
    "prompt_prefix": PLANT_PREFIX,
}

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

def navigate_fresh(ws_url):
    cdp_eval(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
    time.sleep(8)
    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except Exception:
        pass
    deadline = time.time() + 30
    while time.time() < deadline:
        ready = cdp_eval(ws_url, 'document.querySelector("[contenteditable=true]")!==null', timeout=5)
        if ready:
            break
        time.sleep(2)
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
    # blob: URL — canvas grab
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

    # lh3.googleusercontent.com — direct download
    lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    lh3_src = cdp_eval(ws_url, lh3_js, timeout=10) or ""
    if lh3_src:
        return "URL:" + lh3_src
    return None

def generate_one(plant_id, prompt, raw_dir, clean_dir):
    raw_path   = os.path.join(raw_dir, f"{plant_id}_raw.png")
    clean_name = f"{plant_id}.png"
    clean_path = os.path.join(clean_dir, clean_name)

    if os.path.exists(clean_path):
        p(f"  SKIP (clean exists): {plant_id}")
        return True

    if os.path.exists(raw_path):
        p(f"  SKIP raw (exists), running pipeline only...")
    else:
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
        except RuntimeError as e:
            p(f"  ABORT: {e}")
            return False

        ws_url = navigate_fresh(ws_url)
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
            p(f"  Downloading from lh3: {img_url[:80]}...")
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
            p(f"  FAIL: could not grab image data")
            return False

    # Run pipeline
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
        p(f"  CLEAN saved: {clean_name}")
        return True
    else:
        p(f"  Pipeline ran but output not found")
        return False

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    total = len(ROOTVEG) + 1  # +1 for tomato retry
    p("=" * 60)
    p(f"Garden Mapper -- Root Veg Batch ({len(ROOTVEG)} stickers) + Tomato retry")
    p(f"Pause between prompts: {INTER_PROMPT_DELAY}s")
    p("=" * 60)

    try:
        get_gemini_tab()
        p("[OK] Gemini tab found in Brave\n")
    except RuntimeError as e:
        p(f"[ABORT] {e}")
        sys.exit(1)

    ok = 0
    failed = []
    items = []

    # Build unified work list
    for rv in ROOTVEG:
        prompt = build_rootveg_prompt(rv["name"], rv["type"], rv["size"], rv["colours"], rv["shape"])
        items.append({"id": rv["id"], "name": rv["name"], "prompt": prompt,
                      "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN})

    # Tomato retry
    t = TOMATO_RETRY
    tomato_prompt = (
        f"{t['prompt_prefix']}\n\n"
        f"Subject: {t['name']}, {t['type']}.\n"
        f"Canvas: {t['size']}px square.\n"
        f"Colours: {t['colours']}, flat chroma-key green background (#00FF00)\n"
        f"Shape: {t['shape']}"
    )
    items.append({"id": t["id"], "name": t["name"], "prompt": tomato_prompt,
                  "raw_dir": t["raw_dir"], "clean_dir": t["clean_dir"]})

    for i, item in enumerate(items):
        p(f"[{i+1}/{len(items)}] {item['name']} ({item['id']})")
        success = generate_one(item["id"], item["prompt"], item["raw_dir"], item["clean_dir"])
        if success:
            ok += 1
        else:
            failed.append(item["id"])

        if i < len(items) - 1:
            p(f"  [PAUSE] {INTER_PROMPT_DELAY}s...\n")
            time.sleep(INTER_PROMPT_DELAY)

    p("\n" + "=" * 60)
    p("BATCH COMPLETE")
    p(f"  Successful: {ok}/{len(items)}")
    if failed:
        p(f"  Failed: {', '.join(failed)}")
    p(f"\n  Root veg folder: {OUT_CLEAN}")
    p(f"  Plants folder:   {PLANTS_CLEAN}")
    p("=" * 60)

if __name__ == "__main__":
    main()
