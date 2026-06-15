"""Regenerate Fishhook Cactus with enhanced watercolor texture."""
import json, base64, time, os, sys, subprocess
import urllib.request
import websocket

WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PIPELINE   = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
OUT_DIR    = os.path.join(WORKSPACE, "stickers", "generated", "pending")
DEST       = os.path.join(WORKSPACE, "app", "public", "stickers")

plant_id   = "cactus_fishhook_S_CA-US-FR-GB-AU"
raw_path   = os.path.join(OUT_DIR, plant_id + "_raw.png")
clean_path = os.path.join(OUT_DIR, plant_id + ".png")

def p(*a): print(*a, flush=True)

def get_brave_tab(url_fragment):
    try:
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
        for t in tabs:
            if url_fragment in t.get("url","") and t.get("type")=="page":
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

# Clean old files
for path in [raw_path, clean_path]:
    if os.path.exists(path):
        os.remove(path)
        p(f"Deleted: {os.path.basename(path)}")

# Enhanced watercolor prompt
prompt = """Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — tasteful simplified Fishhook Cactus with crisp edges, bold flat icon. Rich watercolor texture with visible brushstrokes, wet-on-wet blending, soft colour gradients. Dark outline 2–3px. No shadows. Centered, 75% canvas fill. Vibrant and iconic.

Subject: Fishhook Cactus.
Canvas: 160px square.
Colours: mid green #5A8A3A, blue-green #4A7A5A, red hooked spines #C84A2A, pale spine tips #F0D0A0, dark outline #0A1A0A, flat chroma-key green background (#00FF00)
Shape: Small barrel-shaped cactus with distinctive hooked red central spines radiating from each areole. Watercolor texture throughout — visible paper grain, soft blends, painterly feel. Only a few leaves and flowers, small plant. Correct proportions."""

tab = get_brave_tab("gemini.google.com")
if not tab:
    p("ERROR: Gemini not open"); sys.exit(1)
ws_url = tab["webSocketDebuggerUrl"]

# Click New Chat
click_js = """(function(){
    var links = Array.from(document.querySelectorAll('a, button'));
    var nc = links.find(function(l){ return l.textContent.trim() === 'New chat'; });
    if (nc) { nc.click(); return 'CLICKED'; }
    return 'NOT_FOUND';
})()"""
r = cdp(ws_url, click_js, timeout=8)
p(f"New chat: {r}")
time.sleep(2)

img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
src_before = cdp(ws_url, img_js) or ""

# Send prompt
cdp(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return "OK";})()', timeout=8)
time.sleep(0.5)
ws2 = websocket.create_connection(ws_url, timeout=10)
ws2.send(json.dumps({"id":1,"method":"Input.insertText","params":{"text":prompt}}))
try: ws2.recv()
except: pass
ws2.close()
time.sleep(0.5)
sent = cdp(ws_url, "(function(){var b=document.querySelector(\"button[aria-label='Send message']\");if(b){b.click();return 'SENT';}return 'NO_BTN';})()", timeout=8)
p(f"Sent: {sent} | Waiting up to 240s...")

deadline = time.time() + 240
found = False
while time.time() < deadline:
    time.sleep(5)
    try:
        tab = get_brave_tab("gemini.google.com")
        ws_url = tab["webSocketDebuggerUrl"]
        src_now = cdp(ws_url, img_js) or ""
        if src_now and src_now != src_before:
            found = True; time.sleep(2); break
    except: pass

if not found:
    p("FAIL: no image after 240s"); sys.exit(1)

# Grab image
grab_js = """(function(){
    var imgs = Array.from(document.querySelectorAll("img")).filter(function(x){
        return (x.src.startsWith("blob:") || x.src.includes("lh3.googleusercontent")) && x.naturalWidth > 100;
    });
    if (!imgs.length) return "NONE";
    var img = imgs[imgs.length-1];
    var c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    try { return c.toDataURL("image/png"); } catch(e) { return "TAINT:" + img.src; }
})()"""
data_url = cdp(ws_url, grab_js, timeout=30) or ""

if data_url.startswith("TAINT:"):
    tainted_url = data_url[6:]
    fetch_js = f"""(async function(){{
        var r = await fetch("{tainted_url}", {{credentials:"include"}});
        var buf = await r.arrayBuffer();
        var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
        return "data:image/png;base64," + b64;
    }})()"""
    ws3 = websocket.create_connection(ws_url, timeout=35)
    ws3.settimeout(35)
    ws3.send(json.dumps({"id":99,"method":"Runtime.evaluate","params":{"expression":fetch_js,"returnByValue":True,"awaitPromise":True}}))
    deadline2 = time.time() + 35
    while time.time() < deadline2:
        try:
            d = json.loads(ws3.recv())
            if d.get("id") == 99:
                data_url = d.get("result",{}).get("result",{}).get("value","")
                break
        except: break
    ws3.close()

if not data_url or data_url == "NONE":
    p("FAIL: could not grab image"); sys.exit(1)

img_bytes = base64.b64decode(data_url.split(",",1)[1])
with open(raw_path,"wb") as f: f.write(img_bytes)
p(f"RAW saved: {len(img_bytes)//1024}KB")

result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)
if result.returncode != 0:
    p(f"Pipeline error: {result.stderr}"); sys.exit(1)

tmp_nobg = raw_path.replace("_raw.png", "_raw_nobg.png")
if os.path.exists(tmp_nobg):
    if os.path.exists(clean_path): os.remove(clean_path)
    os.rename(tmp_nobg, clean_path)
    p(f"CLEAN saved: {os.path.basename(clean_path)}")
else:
    p("Pipeline ran but no output"); sys.exit(1)

p(f"\nDone: {clean_path}")
