"""
Garden Mapper — Gemini image generation via CDP
Sends prompts to open Gemini tab, waits for new blob image, saves via canvas.
"""
import json, base64, time, os, urllib.request
import websocket

OUT_DIR = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers\gemini-chat"
os.makedirs(OUT_DIR, exist_ok=True)

PLANT_PREFIX = "Generate an image: Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."
TREE_PREFIX = "Generate an image: Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."

PLANTS = [
    {"id": "herb-small_thyme", "type": "plant",
     "subject": "Common Thyme herb, small woody herb.",
     "colours": "sage green, dark olive, pale lavender, warm brown stems.",
     "shape": "Tiny dense mat of small oval grey-green leaves, scattered with pale lavender-pink flower clusters, stems at bottom and leafy florals at the top."},
    {"id": "flower-daisy_marigold", "type": "plant",
     "subject": "French Marigold flower, compact annual.",
     "colours": "bright orange, golden yellow, dark brown centre, mid-green, deep green stems.",
     "shape": "Bold layered bloom of orange-yellow petals around a dark warm centre disk, stems at bottom and leafy florals at the top."},
    {"id": "shrub-lavender_lavender", "type": "plant",
     "subject": "English Lavender shrub, perennial herb.",
     "colours": "purple, silver-grey foliage, pale lavender, dark outline, warm grey stems.",
     "shape": "Upright silver-grey stems topped with dense purple flower spikes, stems at bottom and leafy florals at the top."},
    {"id": "flower-spike_foxglove", "type": "plant",
     "subject": "Foxglove in full bloom, tall biennial.",
     "colours": "deep magenta, cream, forest green, dark outline, mid-green stems.",
     "shape": "Tall central spike of stacked magenta bell-shaped blooms with cream-spotted interiors, broad lance-shaped green leaves, stems at bottom and leafy florals at the top."},
    {"id": "tree-fruit_apple", "type": "tree",
     "subject": "Apple tree in fruit, round deciduous tree, aerial top-down, no trunk.",
     "colours": "mid-green, deep green, bright red apples, warm brown limbs, pale yellow-green accents.",
     "shape": "Spacious leafy canopy, sweeping central limbs. Minimal fruit, only as accent."},
    {"id": "shrub-flowering_saskatoon", "type": "plant",
     "subject": "Saskatoon Berry bush, fruiting deciduous shrub.",
     "colours": "deep purple-blue berries, mid-green leaves, grey-green foliage, warm brown stems, pale white blossom.",
     "shape": "Rounded shrub with clusters of deep purple-blue berries nestled among oval green leaves, stems at bottom and leafy florals at the top."},
    {"id": "shrub-flowering_blueberry", "type": "plant",
     "subject": "Blueberry bush, compact fruiting shrub.",
     "colours": "bright blue berries, dusty blue-grey, mid-green leaves, deep green, warm brown stems.",
     "shape": "Low compact shrub covered in round bright blue berry clusters among small oval leaves, stems at bottom and leafy florals at the top."},
    {"id": "vegetable-root_carrot", "type": "plant",
     "subject": "Carrot, root vegetable.",
     "colours": "bright orange, deep orange, bright green tops, mid-green, pale green stem.",
     "shape": "Carrots and tops peeking from a plant wide soil line. Only show the top of the root above the minimal soil line. Bold orange carrot shoulders above soil, feathery bright green ferny foliage, root at bottom and leafy florals at the top."},
    {"id": "tree-conifer_pine", "type": "tree",
     "subject": "Pine tree, tall evergreen conifer, aerial top-down, no trunk.",
     "colours": "deep forest green, mid-green, blue-green, dark outline, pale silver-green.",
     "shape": "Spacious star-shaped needle canopy, sweeping central limbs radiating outward in layered spoke pattern."},
    {"id": "flower-cluster_phlox", "type": "plant",
     "subject": "Phlox, low spreading perennial flower.",
     "colours": "hot pink, pale pink, bright white, mid-green, deep green stems.",
     "shape": "Dense flat mat of small five-petalled pink and white flowers packed tightly together, stems at bottom and leafy florals at the top."},
    {"id": "ground-cover_hostas", "type": "plant",
     "subject": "Hostas, shade perennial with large leaves.",
     "colours": "blue-green, pale green-white variegation, deep green, olive green, warm brown stems.",
     "shape": "Bold overlapping large heart-shaped ribbed leaves fanning outward, variegated pale centres with deep green edges, stems at bottom and leafy florals at the top."},
]


def get_ws_url():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    for t in tabs:
        if "gemini.google.com" in t.get("url", "") and t.get("type") == "page":
            return t.get("webSocketDebuggerUrl") or t.get("wsUrl")
    raise RuntimeError("Gemini tab not found")


def cdp_call(ws_url, expr, timeout=10):
    """One-shot CDP eval — fresh connection, fire and forget, return value."""
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(timeout)
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                        "params": {"expression": expr, "returnByValue": True}}))
    deadline = time.time() + timeout
    result = None
    while time.time() < deadline:
        try:
            raw = ws.recv()
            data = json.loads(raw)
            if data.get("id") == 1:
                result = data.get("result", {}).get("result", {}).get("value")
                break
        except websocket.WebSocketTimeoutException:
            break
    ws.close()
    return result


def get_blob_src(ws_url):
    """Get the src of the last blob image (empty string if none)."""
    js = 'var imgs=Array.from(document.querySelectorAll("img")).filter(i=>i.src.startsWith("blob:")); imgs.length ? imgs[imgs.length-1].src : ""'
    return cdp_call(ws_url, js) or ""


def send_prompt(ws_url, prompt):
    """Focus Gemini input, clear it, type prompt, send."""
    # Step 1: focus and clear via JS
    js_focus = """
(function(){
    var sel = 'p[data-placeholder], [contenteditable=true] p, [aria-label*="prompt"], [aria-label*="Gemini"]';
    var box = document.querySelector('[data-testid="user-input"], .ql-editor, p[class*="textinput"]');
    if (!box) box = document.querySelector('[contenteditable="true"]');
    if (!box) return 'NOT_FOUND';
    box.focus();
    return 'OK:' + box.tagName;
})()
"""
    result = cdp_call(ws_url, js_focus, timeout=10)
    p(f"    focus: {result}")
    time.sleep(0.3)

    ws = websocket.create_connection(ws_url, timeout=15)
    ws.settimeout(5)

    def send_key(key_name, vk, mods=0):
        for evt in ["keyDown", "keyUp"]:
            ws.send(json.dumps({"id": 99, "method": "Input.dispatchKeyEvent",
                                "params": {"type": evt, "key": key_name,
                                           "windowsVirtualKeyCode": vk,
                                           "modifiers": mods}}))
            time.sleep(0.05)
            try: ws.recv()
            except: pass

    # Ctrl+A to select all
    send_key("a", 65, mods=2)
    time.sleep(0.1)
    # Delete
    send_key("Delete", 46)
    time.sleep(0.1)

    # Type the prompt via insertText
    ws.send(json.dumps({"id": 100, "method": "Input.insertText",
                        "params": {"text": prompt}}))
    time.sleep(0.3)
    try: ws.recv()
    except: pass

    # Enter to send
    send_key("Return", 13)
    ws.close()
    time.sleep(1)


def grab_last_image(ws_url):
    """Canvas-capture the last blob image on the page."""
    js = """
(function(){
    var imgs = Array.from(document.querySelectorAll('img[src^="blob:"]'));
    var img = imgs[imgs.length - 1];
    if (!img || img.naturalWidth < 100) return 'NONE';
    var c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
})()
"""
    return cdp_call(ws_url, js, timeout=15)


def build_prompt(plant):
    prefix = TREE_PREFIX if plant["type"] == "tree" else PLANT_PREFIX
    return f"{prefix} Subject: {plant['subject']} Colours: {plant['colours']} Shape: {plant['shape']}"


import sys

def p(*args):
    print(*args, flush=True)
    sys.stdout.flush()

def main():
    p(f"Output: {OUT_DIR}")
    ok = 0

    for i, plant in enumerate(PLANTS):
        out_path = os.path.join(OUT_DIR, f"{plant['id']}.png")
        if os.path.exists(out_path):
            p(f"[{i+1}/11] SKIP: {plant['id']}")
            ok += 1
            continue

        p(f"[{i+1}/11] {plant['id']}")
        try:
            ws_url = get_ws_url()

            # Track current blob src before sending
            src_before = get_blob_src(ws_url)
            p(f"    blob before: {src_before[:40] if src_before else 'none'}")

            # Send prompt
            send_prompt(ws_url, build_prompt(plant))
            p(f"    sent, waiting...")

            # Poll until blob src changes (new image generated)
            deadline = time.time() + 120
            found = False
            while time.time() < deadline:
                time.sleep(4)
                src_now = get_blob_src(ws_url)
                if src_now and src_now != src_before:
                    p(f"    new blob: {src_now[:40]}")
                    time.sleep(2)  # let it finish rendering
                    found = True
                    break

            if not found:
                p(f"    FAIL: no new image after 90s")
                continue

            # Grab last image
            data_url = grab_last_image(ws_url)
            if data_url and data_url.startswith("data:image"):
                b64 = data_url.split(",", 1)[1]
                img_bytes = base64.b64decode(b64)
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                p(f"    SAVED: {len(img_bytes):,} bytes")
                ok += 1
            else:
                p(f"    FAIL: bad result: {str(data_url)[:60]}")

        except Exception as e:
            p(f"    ERROR: {e}")

        time.sleep(4)

    print(f"\n{'='*50}")
    print(f"Done: {ok}/{len(PLANTS)}")


main()
