"""Regen Oak Tree — background wasn't fully removed last time"""
import json, base64, time, os, subprocess, shutil
import urllib.request
import websocket

WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
PIPELINE   = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
RAW_DIR    = os.path.join(WORKSPACE, "stickers", "generated", "trees")
CLEAN_DIR  = os.path.join(WORKSPACE, "stickers", "generated", "trees", "processed")
DEST       = os.path.join(WORKSPACE, "app", "public", "stickers")

PLANT_ID   = "tree-deciduous_oak_XL_CA-US-FR-GB-AU"
raw_path   = os.path.join(RAW_DIR,   PLANT_ID + "_raw.png")
clean_path = os.path.join(CLEAN_DIR, PLANT_ID + ".png")

# Delete existing
for p in [raw_path, clean_path]:
    if os.path.exists(p):
        os.remove(p)
        print(f"Deleted: {os.path.basename(p)}")

# Prompt — emphasise pure flat green background, no border, no frame
PROMPT = (
    "Side aerial view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, leafy, Dark outline 2-3px. No shadows. "
    "Centered, 75% canvas fill. Vibrant and iconic.\n\n"
    "Subject: Oak Tree, large broad deciduous tree, No trunk.\n"
    "Canvas: 512px square.\n"
    "Colours: deep green #2A5C1A, mid-green #4A8C3A, olive green #6B7A3A, "
    "warm brown limbs #6B3A2A, dark outline #0A1A0A, "
    "flat chroma-key green background (#00FF00)\n"
    "Shape: Natural broad leafy canopy with lobed oak leaf silhouette. "
    "NO border. NO frame. NO white or grey edges. "
    "Pure flat #00FF00 green fills every pixel outside the tree. "
    "The tree floats directly on the solid green background."
)

def get_tab():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    for t in tabs:
        if "gemini.google.com" in t.get("url","") and t.get("type")=="page":
            return t
    raise RuntimeError("No Gemini tab")

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

print("Navigating to fresh Gemini chat...")
tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
cdp(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
time.sleep(10)
tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
deadline = time.time()+30
while time.time()<deadline:
    if cdp(ws_url, 'document.querySelector("[contenteditable=true]")!==null', timeout=5):
        break
    time.sleep(2)
    try: tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
    except: pass
time.sleep(1)

img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
src_before = cdp(ws_url, img_js) or ""
print(f"Baseline: {src_before[:60] if src_before else 'none'}")

cdp(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return "OK";})()', timeout=8)
time.sleep(0.5)
ws2 = websocket.create_connection(ws_url, timeout=10)
ws2.send(json.dumps({"id":1,"method":"Input.insertText","params":{"text":PROMPT}}))
try: ws2.recv()
except: pass
ws2.close()
time.sleep(0.5)
sent = cdp(ws_url, "(function(){var b=document.querySelector(\"button[aria-label='Send message']\");if(b){b.click();return 'SENT';}return 'NO_BTN';})()", timeout=8)
print(f"Sent: {sent} | Waiting up to 240s...")

deadline = time.time()+240
found = False
while time.time()<deadline:
    time.sleep(5)
    try:
        tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
        src_now = cdp(ws_url, img_js) or ""
        if src_now and src_now != src_before:
            found = True; time.sleep(2); break
    except: pass

if not found:
    print("FAIL: no image"); exit(1)

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
    print("FAIL: no data"); exit(1)

if data_url.startswith("data:image"):
    img_bytes = base64.b64decode(data_url.split(",",1)[1])
    with open(raw_path,"wb") as f: f.write(img_bytes)
    print(f"RAW saved: {len(img_bytes)//1024}KB")
elif data_url.startswith("URL:"):
    req = urllib.request.Request(data_url[4:], headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r: img_bytes = r.read()
    with open(raw_path,"wb") as f: f.write(img_bytes)
    print(f"RAW saved (download): {len(img_bytes)//1024}KB")

# ── Run pipeline with higher tolerance to catch border remnants ──
# Patch: temporarily increase TOLERANCE in pipeline for this run
import tempfile, re

with open(PIPELINE, "r") as f:
    pipeline_src = f.read()

# Create a patched version with tolerance=120 (was 80) for this run
patched = pipeline_src.replace("TOLERANCE  = 80", "TOLERANCE  = 120").replace("SOFT_RANGE = 40", "SOFT_RANGE = 60")
patched_path = os.path.join(tempfile.gettempdir(), "pipeline_high_tol.py")
with open(patched_path, "w") as f:
    f.write(patched)

print("Running pipeline (high tolerance for border removal)...")
result = subprocess.run([PYTHON, patched_path, raw_path], capture_output=True, text=True)
if result.returncode != 0:
    print(f"Pipeline error: {result.stderr}")
    # Fall back to standard pipeline
    result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)

tmp_nobg = raw_path.replace("_raw.png", "_raw_nobg.png")
if os.path.exists(tmp_nobg):
    if os.path.exists(clean_path): os.remove(clean_path)
    os.rename(tmp_nobg, clean_path)
    print(f"CLEAN saved: {os.path.basename(clean_path)}")

shutil.copy2(clean_path, os.path.join(DEST, PLANT_ID + ".png"))
print("Copied to public/stickers/")
print("DONE")
