"""
Garden Mapper — Gemini image generation
Uses CDP for image grabbing, Playwright (via subprocess) for clicking send.
Runs as a loop: type prompt via CDP, click send button via CDP mouse click.
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


def p(*args):
    import sys
    print(*args, flush=True)
    sys.stdout.flush()


def get_gemini_tab():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    for t in tabs:
        if "gemini.google.com" in t.get("url", "") and t.get("type") == "page":
            return t
    raise RuntimeError("Gemini tab not found")


def cdp_eval(ws_url, expr, call_id=1, timeout=15):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(timeout)
    ws.send(json.dumps({"id": call_id, "method": "Runtime.evaluate",
                        "params": {"expression": expr, "returnByValue": True}}))
    deadline = time.time() + timeout
    result = None
    while time.time() < deadline:
        try:
            raw = ws.recv()
            data = json.loads(raw)
            if data.get("id") == call_id:
                result = data.get("result", {}).get("result", {}).get("value")
                break
        except websocket.WebSocketTimeoutException:
            break
    ws.close()
    return result


def get_blob_src(ws_url):
    js = 'var imgs=Array.from(document.querySelectorAll("img")).filter(i=>i.src.startsWith("blob:")); imgs.length ? imgs[imgs.length-1].src : ""'
    return cdp_eval(ws_url, js, timeout=10) or ""


def click_send_button(ws_url):
    """Click the send/arrow button in Gemini chat."""
    js = """
(function(){
    // Find the send button — usually aria-label contains "Send" or has data-testid
    var btn = document.querySelector('button[aria-label="Send message"], button[data-testid="send-button"], button.send-button');
    if (!btn) {
        // Try by looking for the blue arrow button
        var btns = Array.from(document.querySelectorAll('button'));
        btn = btns.find(b => b.querySelector('svg') && (b.offsetWidth < 60) && 
                         window.getComputedStyle(b).backgroundColor.includes('rgb'));
    }
    if (!btn) return 'NOT_FOUND';
    btn.click();
    return 'CLICKED:' + (btn.getAttribute('aria-label') || btn.className.substring(0,30));
})()
"""
    return cdp_eval(ws_url, js, timeout=10)


def type_and_send(ws_url, prompt):
    """Clear input, type prompt, click send."""
    # Clear and focus
    js_clear = """
(function(){
    var box = document.querySelector('[contenteditable="true"]');
    if (!box) return 'NO_BOX';
    box.focus();
    box.innerHTML = '';
    return 'CLEARED';
})()
"""
    r = cdp_eval(ws_url, js_clear, timeout=10)
    p(f"    clear: {r}")
    time.sleep(0.3)

    # Type via insertText
    ws = websocket.create_connection(ws_url, timeout=15)
    ws.settimeout(10)
    ws.send(json.dumps({"id": 1, "method": "Input.insertText", "params": {"text": prompt}}))
    try: ws.recv()
    except: pass
    ws.close()
    time.sleep(0.5)

    # Click send button
    r2 = click_send_button(ws_url)
    p(f"    send: {r2}")
    time.sleep(1)


def grab_last_image(ws_url):
    js = """
(function(){
    var imgs = Array.from(document.querySelectorAll('img')).filter(i=>i.src.startsWith('blob:'));
    var img = imgs[imgs.length - 1];
    if (!img || img.naturalWidth < 100) return 'NONE';
    var c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
})()
"""
    return cdp_eval(ws_url, js, timeout=20)


def build_prompt(plant):
    prefix = TREE_PREFIX if plant["type"] == "tree" else PLANT_PREFIX
    return f"{prefix} Subject: {plant['subject']} Colours: {plant['colours']} Shape: {plant['shape']}"


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
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")

            src_before = get_blob_src(ws_url)
            p(f"    blob before: {src_before[5:45] if src_before else 'none'}")

            type_and_send(ws_url, build_prompt(plant))
            p(f"    waiting for image...")

            # Poll for blob src change (up to 120s)
            deadline = time.time() + 120
            found = False
            while time.time() < deadline:
                time.sleep(4)
                tab = get_gemini_tab()
                ws_url = tab.get("webSocketDebuggerUrl")
                src_now = get_blob_src(ws_url)
                if src_now and src_now != src_before:
                    p(f"    new blob!")
                    time.sleep(2)
                    found = True
                    break

            if not found:
                p(f"    FAIL: no new image")
                continue

            data_url = grab_last_image(ws_url)
            if data_url and data_url.startswith("data:image"):
                b64 = data_url.split(",", 1)[1]
                img_bytes = base64.b64decode(b64)
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                p(f"    SAVED: {len(img_bytes):,} bytes")
                ok += 1
            else:
                p(f"    FAIL: {str(data_url)[:60]}")

        except Exception as e:
            p(f"    ERROR: {e}")

        time.sleep(5)

    p(f"\nDone: {ok}/{len(PLANTS)}")


main()
