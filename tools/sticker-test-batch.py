"""
Garden Mapper — Sticker Test Batch (Plants category, 5 stickers)
Uses CDP into Brave/Gemini tab + Rob's new prompt format (chroma-key green background).
After generation, runs sticker-pipeline.py (chroma key removal) on each output.

Usage:
  python sticker-test-batch.py

Requirements:
  - Brave running with remote debugging: brave.exe --remote-debugging-port=9222
  - gemini.google.com open in Brave
  - websocket-client installed: pip install websocket-client

Output:
  stickers/generated/plants/    ← raw grabbed PNGs (green background)
  stickers/generated/plants/processed/  ← pipeline-cleaned transparent PNGs

After cron completes, notify Rob with output folder path.
"""

import json, base64, time, os, sys, re, subprocess
import urllib.request
import websocket

# ── Config ─────────────────────────────────────────────────────────────────────
WORKSPACE   = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
OUT_RAW     = os.path.join(WORKSPACE, "stickers", "generated", "plants")
OUT_CLEAN   = os.path.join(WORKSPACE, "stickers", "generated", "plants", "processed")
PIPELINE    = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON      = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
STATE_FILE  = os.path.join(WORKSPACE, "stickers", "generator_state.json")

INTER_PROMPT_DELAY = 45   # seconds between prompts (avoids rate limiting)
IMAGE_WAIT_TIMEOUT = 120  # max seconds to wait for image to appear

os.makedirs(OUT_RAW, exist_ok=True)
os.makedirs(OUT_CLEAN, exist_ok=True)

# ── Prompt template — PLANTS (Rob's wording, do not modify) ────────────────────
PLANT_PREFIX = (
    "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. "
    "No shadows. No background showing in the center of the plant. Centered, 75% "
    "canvas fill. Vibrant and iconic."
)

def build_plant_prompt(name, plant_type, size_px, colours, shape):
    return (
        f"{PLANT_PREFIX}\n\n"
        f"Subject: {name}, {plant_type}.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: {shape} Only a few leaves and flowers, small plant. Correct proportions."
    )

# ── Test batch — 5 plants, one per type variant ────────────────────────────────
TEST_PLANTS = [
    {
        "id": "flower-daisy_marigold_S_CA-US-FR-GB-AU",
        "name": "French Marigold",
        "type": "compact annual",
        "size": 160,
        "colours": "bright orange #FF8C00, golden yellow #FFD700, dark brown centre #8B3A00, mid-green #4A7C2F, deep green stems #2A5010",
        "shape": "Bold layered bloom of orange-yellow petals around a dark warm centre disk, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "herb-small_basil_S_CA-US-FR-GB-AU",
        "name": "Basil",
        "type": "compact annual herb",
        "size": 160,
        "colours": "bright mid-green #5A9E3A, deep green #2A5A1A, pale lime #A8D878, warm brown stems #7A5C3A, soft yellow-green #C8E898",
        "shape": "Bushy compact herb with large glossy rounded leaves, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "flower-rose_rose_M_CA-US-FR-GB-AU",
        "name": "Rose",
        "type": "flowering shrub",
        "size": 256,
        "colours": "deep red #C41230, pale pink #F5B8C8, mid-green #4A7C2F, dark outline #1A0A0A, warm brown thorny stems #7A4A2A",
        "shape": "Upright thorny stems with large full multi-petalled rose blooms and glossy green leaves, stems at bottom and blooms at the top.",
    },
    {
        "id": "flower-spike_foxglove_L_CA-US-FR-GB",
        "name": "Foxglove",
        "type": "tall biennial",
        "size": 384,
        "colours": "deep magenta #D63F6C, cream #FFF5E0, forest green #2D6A2A, dark outline #1A2E1A, mid-green stems #4A7A3A",
        "shape": "Tall central spike of stacked magenta bell-shaped blooms with cream-spotted interiors, broad lance-shaped green leaves, stems at bottom and florals at the top.",
    },
    {
        "id": "flower-cluster_hydrangea_L_CA-US-FR-GB-AU",
        "name": "Hydrangea",
        "type": "flowering deciduous shrub",
        "size": 384,
        "colours": "cornflower blue #5B8DD9, pale lavender #C4B8E8, soft pink #F0B8C8, mid-green #4A7C2F, dark outline #1A1A2E",
        "shape": "Rounded shrub with massive domed flower heads of densely packed small florets in blue and pink, stems at bottom and florals at the top.",
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

def get_blob_src(ws_url):
    js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")); i.length?i[i.length-1].src:""'
    return cdp_eval(ws_url, js, timeout=10) or ""

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
    js = """
(function(){
    var imgs=Array.from(document.querySelectorAll('img')).filter(i=>i.src.startsWith('blob:'));
    var img=imgs[imgs.length-1];
    if(!img||img.naturalWidth<100)return 'NONE';
    var c=document.createElement('canvas');
    c.width=img.naturalWidth;c.height=img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);
    return c.toDataURL('image/png');
})()
"""
    return cdp_eval(ws_url, js, timeout=20)

def generate_one(plant):
    raw_path = os.path.join(OUT_RAW, f"{plant['id']}_raw.png")
    if os.path.exists(raw_path):
        p(f"  SKIP (already generated): {plant['id']}")
        return raw_path

    prompt = build_plant_prompt(
        plant["name"], plant["type"], plant["size"],
        plant["colours"], plant["shape"]
    )

    p(f"\n  Prompt ({len(prompt)} chars):\n  {prompt[:120]}...")

    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except RuntimeError as e:
        p(f"  ABORT: {e}")
        return None

    src_before = get_blob_src(ws_url)
    send_result = type_and_send(ws_url, prompt)
    p(f"  Sent to Gemini: {send_result} | Waiting for image (up to {IMAGE_WAIT_TIMEOUT}s)...")

    deadline = time.time() + IMAGE_WAIT_TIMEOUT
    found = False
    while time.time() < deadline:
        time.sleep(5)
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
            src_now = get_blob_src(ws_url)
            if src_now and src_now != src_before:
                found = True
                time.sleep(2)
                break
        except Exception:
            pass

    if not found:
        p(f"  FAIL: no image appeared after {IMAGE_WAIT_TIMEOUT}s")
        return None

    data_url = grab_image(ws_url)
    if data_url and data_url.startswith("data:image"):
        img_bytes = base64.b64decode(data_url.split(",", 1)[1])
        with open(raw_path, "wb") as f:
            f.write(img_bytes)
        p(f"  RAW saved: {os.path.basename(raw_path)} ({len(img_bytes)//1024}KB)")
        return raw_path
    else:
        p(f"  FAIL: could not grab image data")
        return None

def run_pipeline(raw_path):
    """Run chroma key removal pipeline on raw image."""
    clean_name = os.path.basename(raw_path).replace("_raw.png", ".png")
    clean_path = os.path.join(OUT_CLEAN, clean_name)
    tmp_nobg   = os.path.splitext(raw_path)[0] + "_nobg.png"

    p(f"  Running pipeline on {os.path.basename(raw_path)}...")
    result = subprocess.run(
        [PYTHON, PIPELINE, raw_path],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        p(f"  Pipeline error: {result.stderr}")
        return None

    # Pipeline saves as <name>_raw_nobg.png — move to processed folder with clean name
    if os.path.exists(tmp_nobg):
        if os.path.exists(clean_path):
            os.remove(clean_path)
        os.rename(tmp_nobg, clean_path)
        p(f"  CLEAN saved: {clean_name}")
        return clean_path
    else:
        p(f"  Pipeline ran but output not found: {tmp_nobg}")
        return None

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    p("=" * 60)
    p("Garden Mapper — Sticker Test Batch (Plants, 5 stickers)")
    p(f"Output raw:   {OUT_RAW}")
    p(f"Output clean: {OUT_CLEAN}")
    p(f"Pause between prompts: {INTER_PROMPT_DELAY}s")
    p("=" * 60)

    # Verify Brave/Gemini tab reachable before starting
    try:
        get_gemini_tab()
        p("[OK] Gemini tab found in Brave\n")
    except RuntimeError as e:
        p(f"✗ {e}")
        p("Start Brave with: brave.exe --remote-debugging-port=9222")
        p("Then open gemini.google.com and run this script again.")
        sys.exit(1)

    raw_files   = []
    clean_files = []
    failed      = []

    for i, plant in enumerate(TEST_PLANTS):
        p(f"\n[{i+1}/{len(TEST_PLANTS)}] {plant['name']} ({plant['id']})")

        raw = generate_one(plant)
        if raw:
            raw_files.append(raw)
            clean = run_pipeline(raw)
            if clean:
                clean_files.append(clean)
            else:
                failed.append(plant["id"] + " (pipeline failed)")
        else:
            failed.append(plant["id"] + " (generation failed)")

        # Pause between prompts (skip after last one)
        if i < len(TEST_PLANTS) - 1:
            p(f"\n  [PAUSE] Waiting {INTER_PROMPT_DELAY}s before next prompt...")
            time.sleep(INTER_PROMPT_DELAY)

    p("\n" + "=" * 60)
    p("BATCH COMPLETE")
    p(f"  Generated: {len(raw_files)}/{len(TEST_PLANTS)}")
    p(f"  Cleaned:   {len(clean_files)}/{len(TEST_PLANTS)}")
    if failed:
        p(f"  Failed:    {', '.join(failed)}")
    p(f"\n  Processed stickers ready for review:")
    p(f"  {OUT_CLEAN}")
    for f in clean_files:
        p(f"    • {os.path.basename(f)}")
    p("=" * 60)

if __name__ == "__main__":
    main()
