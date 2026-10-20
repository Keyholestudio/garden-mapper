"""
Re-grab icon images from open Gemini conversations, verify magenta BG, run pipeline.
Usage: python regrab-icons.py
"""
import json, base64, time, os, subprocess
import websocket, urllib.request
from PIL import Image
import numpy as np

PYTHON   = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
PIPELINE = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\tools\process-rob-images.py"
OUT_DIR  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\icon-previews"
CDP_PORT = 9222

# Conversation titles to match in sidebar links
ICONS = [
    ("wheelbarrow", "Watercolor Garden Wheelbarrow Icon"),
    ("sundial",     "Watercolor Garden Sundial Icon"),
    ("gazebo",      "Watercolor Gazebo Icon Redesign"),
    ("gnome",       "Watercolor Garden Gnome Icon Design"),
    ("arch",        "Watercolor Garden Arch Icon Redesign"),
]

def get_ws():
    tabs = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json").read())
    for t in tabs:
        if "gemini.google.com/u/1" in t.get("url","") and t.get("type") == "page":
            return t["webSocketDebuggerUrl"]
    return None

def cdp(ws_url, expression, timeout=25):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(timeout)
    ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":expression,"returnByValue":True,"awaitPromise":True}}))
    deadline = time.time() + timeout
    val = ""
    while time.time() < deadline:
        try:
            d = json.loads(ws.recv())
            if d.get("id") == 1:
                val = d.get("result",{}).get("result",{}).get("value","")
                break
        except: break
    ws.close()
    return val

def grab_largest_blob(ws_url):
    # Sort blobs by area, take largest
    grab_js = """(function(){
        var imgs = Array.from(document.querySelectorAll('img'))
            .filter(i => i.src.startsWith('blob:') && i.naturalWidth > 100);
        if (!imgs.length) return 'NONE';
        imgs.sort((a,b) => (b.naturalWidth*b.naturalHeight) - (a.naturalWidth*a.naturalHeight));
        var img = imgs[0];
        var c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/png');
    })()"""
    return cdp(ws_url, grab_js, timeout=30)

def check_bg(raw_path):
    img = Image.open(raw_path).convert("RGBA")
    data = np.array(img, dtype=np.float32)
    bg = data[5, 5]
    mag = ((bg[0]-255)**2 + bg[1]**2 + (bg[2]-255)**2)**0.5
    blk = (bg[0]**2 + bg[1]**2 + bg[2]**2)**0.5
    kind = "MAGENTA" if mag < blk else "BLACK"
    return kind, round(mag, 1), round(blk, 1)

for name, title in ICONS:
    print(f"\n--- {name} ---")
    ws_url = get_ws()

    # Click matching sidebar link by text content
    click_js = f"""(function(){{
        var links = Array.from(document.querySelectorAll('a'));
        var match = links.find(a => a.textContent.trim().startsWith({json.dumps(title[:30])}));
        if (match) {{ match.click(); return 'clicked: ' + match.textContent.trim(); }}
        return 'NOT FOUND';
    }})()"""
    result = cdp(ws_url, click_js, timeout=8)
    print(f"  Nav: {result}")
    time.sleep(6)
    ws_url = get_ws()

    data_url = grab_largest_blob(ws_url)
    if not data_url or data_url == "NONE":
        print("  FAIL: no image found"); continue

    raw_path = os.path.join(OUT_DIR, f"icon-raw-{name}-v2.png")
    hdr, b64 = data_url.split(",", 1)
    with open(raw_path, "wb") as f:
        f.write(base64.b64decode(b64))

    bg_type, mag_d, blk_d = check_bg(raw_path)
    img_check = Image.open(raw_path)
    print(f"  Size: {img_check.size}  BG: {bg_type} (mag={mag_d} blk={blk_d})")

    if bg_type != "MAGENTA":
        print(f"  WARN: black background — skipping pipeline, needs re-grab"); continue

    out_path = os.path.join(OUT_DIR, f"icon-{name}-v2.png")
    r = subprocess.run([PYTHON, PIPELINE, raw_path, out_path], capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(f"  Pipeline error: {r.stderr}")
    else:
        print(f"  [DONE]: {out_path}")

print("\nAll done.")
