"""Run two fountain variants back-to-back and send previews."""
import json, base64, time, os, sys, subprocess
import urllib.request, websocket
from PIL import Image

WORKSPACE = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PIPELINE  = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON    = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
OUT_DIR   = os.path.join(WORKSPACE, "stickers", "generated", "pending")
IMAGE_WAIT = 240
os.makedirs(OUT_DIR, exist_ok=True)

VARIANTS = [
    ("fountain_varA", "Variant A (Rob's prompt v1)",
     """Aerial side view. Art style: Plants vs. Zombies meets watercolor painting \u2014 tasteful simplified Fountain with crisp edges, bold flat icon. Dark outline 2\u20133px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Fountain
Canvas: 384px square.
Colours: cool grey stone #8A9A9A, pale marble white #F0EEE8, water blue #5A9AC8, dark outline #1A2A3A, flat chroma-key green background (#00FF00)
Shape: Aerial top-down view of circular garden water fountain, no tier, decorative cement edging around the basin rim, central spout, water ripples radiating outward. No birds. No plants. No aquatic plants. Correct proportions."""),

    ("fountain_varB", "Variant B (architectural prompt)",
     """Top-down aerial view. Art style: bold flat icon, cartoon illustration with crisp edges and 2\u20133px dark outline. No shadows. Centered, 75% canvas fill.
Subject: Decorative garden water fountain \u2014 circular basin, no tiers, no plants, no animals, no birds. Decorative cement edging around rim. Central spout with water ripples radiating outward from center.
Canvas: 384px square.
Colours: cool grey stone #8A9A9A, pale marble white #F0EEE8, water blue #5A9AC8, pale aqua foam #A8D8F0, dark outline #1A2A3A, flat chroma-key green background (#00FF00)
Shape: Purely architectural. Stone basin only. Water only. Nothing living. Correct proportions."""),
]

def p(*a): print(*a, flush=True)

def get_tab():
    try:
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
        for t in tabs:
            if "gemini.google.com" in t.get("url","") and t.get("type")=="page":
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

img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'

tab = get_tab()
if not tab: p("ERROR: no Gemini tab"); sys.exit(1)

results = []
for name, label, prompt in VARIANTS:
    raw  = os.path.join(OUT_DIR, name + "_raw.png")
    clean = os.path.join(OUT_DIR, name + ".png")
    p(f"\n--- {label} ---")

    tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
    src_before = cdp(ws_url, img_js) or ""

    cdp(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return "OK";})()', timeout=8)
    time.sleep(0.5)
    ws2 = websocket.create_connection(ws_url, timeout=10)
    ws2.send(json.dumps({"id":1,"method":"Input.insertText","params":{"text":prompt}}))
    try: ws2.recv()
    except: pass
    ws2.close()
    time.sleep(0.5)
    cdp(ws_url, '(function(){var b=document.querySelector("button[aria-label=\'Send message\']");if(b){b.click();}return "SENT";})()', timeout=8)
    p("Sent. Waiting...")

    deadline = time.time()+IMAGE_WAIT
    found = False
    while time.time()<deadline:
        time.sleep(5)
        try:
            tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
            src_now = cdp(ws_url, img_js) or ""
            if src_now and src_now != src_before: found=True; time.sleep(2); break
        except: pass

    if not found: p("TIMEOUT"); continue

    blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    blob_src = cdp(ws_url, blob_js) or ""
    if blob_src:
        grab_js = f'(function(){{var img=document.querySelector(\'img[src="{blob_src}"]\');if(!img)return "NONE";var c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);return c.toDataURL("image/png");}})() '
        data_url = cdp(ws_url, grab_js, timeout=20)
    else:
        lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
        lh3 = cdp(ws_url, lh3_js) or ""
        data_url = ("URL:"+lh3) if lh3 else None

    if not data_url: p("No image"); continue

    if data_url.startswith("data:image"):
        img_bytes = base64.b64decode(data_url.split(",",1)[1])
    else:
        req = urllib.request.Request(data_url[4:], headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r: img_bytes = r.read()
    with open(raw,"wb") as f: f.write(img_bytes)
    p(f"RAW: {len(img_bytes)//1024}KB")

    result = subprocess.run([PYTHON, PIPELINE, raw], capture_output=True, text=True)
    tmp = raw.replace("_raw.png","_raw_nobg.png")
    if os.path.exists(tmp):
        if os.path.exists(clean): os.remove(clean)
        os.rename(tmp, clean)
        p(f"CLEAN: {clean}")
        results.append((label, clean))
    else:
        p("Pipeline failed")

    if name != VARIANTS[-1][0]:
        p("Pausing 40s...")
        time.sleep(40)

p(f"\n[DONE] {len(results)} variants ready:")
for label, path in results:
    p(f"  {label}: {path}")
