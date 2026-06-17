"""Maple Purple Leaf v2 — new watercolor style, no trunk, small leaves"""
import json, base64, time, os, subprocess
import urllib.request
import websocket

WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PIPELINE   = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
OUT_DIR    = os.path.join(WORKSPACE, "stickers", "generated", "pending")
os.makedirs(OUT_DIR, exist_ok=True)

FILENAME = "tree-deciduous_maple_XXL_purple-leaf.png"
RAW_PATH = os.path.join(OUT_DIR, FILENAME.replace(".png", "_raw.png"))
OUT_PATH = os.path.join(OUT_DIR, FILENAME)

PROMPT = (
    "Side aerial view. Art style: Watercolor painting — tasteful simplified representation of this plant with crisp edges, "
    "focusing on primary characteristics of the plant, leafy canopy only, NO TRUNK, NO STEM, NO BARK VISIBLE. "
    "Dark outline 2-3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.\n\n"
    "Subject: Purple Leaf Maple Tree (Royal Red / Schwedleri cultivar), large broad deciduous tree. NO TRUNK. Canopy only. Small leaves.\n"
    "Canvas: 512px square.\n"
    "Colours: Spring/summer purple-leaf cultivar — deep purple #6A1B9A, purple #7B1FA2, dark purple #4A148C. "
    "flat chroma-key green background (#00FF00)\n"
    "Shape: Natural full leafy canopy, lobed maple leaf shapes. No trunk. No branches. Canopy fills the frame. "
    "Rich purple spring/summer foliage. No fall colours."
)

def p(*a): print(*a, flush=True)

def get_tab():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    for t in tabs:
        if "gemini.google.com" in t.get("url","") and t.get("type")=="page":
            return t
    raise RuntimeError("No Gemini tab found")

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

for f in [RAW_PATH, OUT_PATH]:
    if os.path.exists(f): os.remove(f)

p("Generating: " + FILENAME)
tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
cdp(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
time.sleep(10)
tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
deadline = time.time()+30
while time.time()<deadline:
    if cdp(ws_url, 'document.querySelector("[contenteditable=true]")!==null', timeout=5): break
    time.sleep(2)
    try: tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
    except: pass
time.sleep(1)

img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
src_before = cdp(ws_url, img_js) or ""
cdp(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return "OK";})()', timeout=8)
time.sleep(0.5)
ws2 = websocket.create_connection(ws_url, timeout=10)
ws2.send(json.dumps({"id":1,"method":"Input.insertText","params":{"text":PROMPT}}))
try: ws2.recv()
except: pass
ws2.close()
time.sleep(0.5)
sent = cdp(ws_url, "(function(){var b=document.querySelector(\"button[aria-label='Send message']\");if(b){b.click();return 'SENT';}return 'NO_BTN';})()", timeout=8)
p(f"Sent: {sent} | Waiting up to 240s...")

deadline = time.time()+240
found = False
while time.time()<deadline:
    time.sleep(5)
    try:
        tab = get_tab(); ws_url = tab["webSocketDebuggerUrl"]
        src_now = cdp(ws_url, img_js) or ""
        if src_now and src_now != src_before: found = True; time.sleep(2); break
    except: pass

if not found: p("FAIL: no image"); exit(1)

blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
blob_src = cdp(ws_url, blob_js) or ""
data_url = None
if blob_src:
    grab_js = f'(function(){{var img=document.querySelector(\'img[src="{blob_src}"]\');if(!img)return "NONE";var c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);return c.toDataURL("image/png");}})() '
    data_url = cdp(ws_url, grab_js, timeout=20)
else:
    lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    lh3 = cdp(ws_url, lh3_js) or ""
    data_url = ("URL:" + lh3) if lh3 else None

if not data_url: p("FAIL: no image data"); exit(1)

if data_url.startswith("data:image"):
    img_bytes = base64.b64decode(data_url.split(",",1)[1])
    with open(RAW_PATH,"wb") as f: f.write(img_bytes)
    p(f"RAW saved ({len(img_bytes)//1024}KB)")
elif data_url.startswith("URL:"):
    req = urllib.request.Request(data_url[4:], headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r: img_bytes = r.read()
    with open(RAW_PATH,"wb") as f: f.write(img_bytes)
    p(f"RAW saved via URL ({len(img_bytes)//1024}KB)")

p("Running pipeline...")
result = subprocess.run([PYTHON, PIPELINE, RAW_PATH], capture_output=True, text=True)
if result.returncode != 0: p(f"Pipeline error: {result.stderr}"); exit(1)

tmp_nobg = RAW_PATH.replace("_raw.png", "_raw_nobg.png")
if os.path.exists(tmp_nobg):
    if os.path.exists(OUT_PATH): os.remove(OUT_PATH)
    os.rename(tmp_nobg, OUT_PATH)
    p(f"DONE -> {FILENAME}")
else:
    p("FAIL: no pipeline output")
