"""
Re-grab gazebo, gnome, arch from Gemini conversations by navigating directly.
"""
import json, base64, time, os, subprocess
import websocket, urllib.request
from PIL import Image
import numpy as np

PYTHON   = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
PIPELINE = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\tools\process-rob-images.py"
OUT_DIR  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\icon-previews"
CDP_PORT = 9222

ICONS = [
    ("gazebo", "Watercolor Gazebo Icon Redesign"),
    ("gnome",  "Watercolor Garden Gnome Icon Design"),
    ("arch",   "Watercolor Garden Arch Icon Redesign"),
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

def grab_largest(ws_url):
    js = (
        "(function(){"
        "var imgs=Array.from(document.querySelectorAll('img'))"
        ".filter(function(i){return i.src.startsWith('blob:')&&i.naturalWidth>100;});"
        "if(!imgs.length)return 'NONE';"
        "imgs.sort(function(a,b){return(b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight);});"
        "var img=imgs[0];"
        "var c=document.createElement('canvas');"
        "c.width=img.naturalWidth;c.height=img.naturalHeight;"
        "c.getContext('2d').drawImage(img,0,0);"
        "return c.toDataURL('image/png');"
        "})()"
    )
    return cdp(ws_url, js, timeout=30)

def check_bg(path):
    img = Image.open(path).convert("RGBA")
    d = np.array(img, dtype=np.float32)
    bg = d[5,5]
    mag = ((bg[0]-255)**2 + bg[1]**2 + (bg[2]-255)**2)**0.5
    blk = (bg[0]**2 + bg[1]**2 + bg[2]**2)**0.5
    return ("MAGENTA" if mag < blk else "BLACK"), round(mag,1), round(blk,1)

# First get all sidebar conversation links
ws_url = get_ws()
links_js = (
    "JSON.stringify(Array.from(document.querySelectorAll('a[href]'))"
    ".filter(function(a){return a.href.includes('/u/1/app/');})"
    ".map(function(a){return {t:a.textContent.trim(),h:a.href};}))"
)
links_raw = cdp(ws_url, links_js, timeout=10)
links = json.loads(links_raw) if links_raw else []
print(f"Found {len(links)} conversation links")

for name, title in ICONS:
    print(f"\n--- {name} ---")
    match = next((l for l in links if l["t"].startswith(title[:20])), None)
    if not match:
        print(f"  No link found for: {title}")
        continue

    print(f"  Navigating to: {match['h']}")
    ws_url = get_ws()
    cdp(ws_url, f"window.location.href = '{match['h']}'", timeout=10)
    time.sleep(7)

    ws_url = get_ws()
    # Scroll to bottom to ensure image is rendered
    cdp(ws_url, "window.scrollTo(0, document.body.scrollHeight)", timeout=5)
    time.sleep(3)

    data_url = grab_largest(ws_url)
    if not data_url or data_url == "NONE":
        print("  FAIL: no image on page"); continue

    raw_path = os.path.join(OUT_DIR, f"icon-raw-{name}-v2.png")
    hdr, b64 = data_url.split(",", 1)
    with open(raw_path, "wb") as f:
        f.write(base64.b64decode(b64))

    bg_type, m, b = check_bg(raw_path)
    sz = Image.open(raw_path).size
    print(f"  Size:{sz}  BG:{bg_type} (mag_dist={m} blk_dist={b})")

    if bg_type != "MAGENTA":
        print("  WARN: black BG detected — skipping pipeline")
        continue

    out_path = os.path.join(OUT_DIR, f"icon-{name}-v2.png")
    r = subprocess.run([PYTHON, PIPELINE, raw_path, out_path], capture_output=True, text=True)
    print(r.stdout.strip())
    print(f"  DONE: {out_path}")

print("\nAll done.")
