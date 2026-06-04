import json, base64, time, os, urllib.request, websocket
from PIL import Image

WORKSPACE = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
out = os.path.join(WORKSPACE, "app", "public", "textures", "roof-terracotta.jpg")
raw = out.replace(".jpg", "_raw.jpg")

prompt = "Seamless tileable top-down terracotta roof tile texture, 512x512. Warm terracotta orange tiles (#C8623A, #A04A28), overlapping rows of curved barrel tiles with shadow between ridges and valleys. Flat matte cartoon-style, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
tab = next((t for t in tabs if "gemini.google.com" in t.get("url","") and t.get("type")=="page"), None)
ws_url = tab["webSocketDebuggerUrl"]

def cdp(expr, timeout=15):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(timeout)
    ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":expr,"returnByValue":True}}))
    deadline = time.time()+timeout
    while time.time()<deadline:
        try:
            data = json.loads(ws.recv())
            if data.get("id")==1:
                ws.close(); return data.get("result",{}).get("result",{}).get("value")
        except: break
    ws.close()

img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
src_before = cdp(img_js) or ""
cdp('(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return "OK";})()', timeout=8)
time.sleep(0.5)
ws2 = websocket.create_connection(ws_url, timeout=10)
ws2.send(json.dumps({"id":1,"method":"Input.insertText","params":{"text":prompt}}))
try: ws2.recv()
except: pass
ws2.close()
time.sleep(0.5)
cdp('(function(){var b=document.querySelector("button[aria-label=\'Send message\']");if(b){b.click();}return "SENT";})()')
print("Sent. Waiting...")

deadline = time.time()+240
found = False
while time.time()<deadline:
    time.sleep(5)
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    tab = next((t for t in tabs if "gemini.google.com" in t.get("url","") and t.get("type")=="page"), None)
    ws_url = tab["webSocketDebuggerUrl"]
    src = cdp(img_js) or ""
    if src and src != src_before: found=True; time.sleep(2); break

if not found: print("TIMEOUT"); exit(1)

blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
blob = cdp(blob_js) or ""
if blob:
    grab_js = f'(function(){{var img=document.querySelector(\'img[src="{blob}"]\');if(!img)return "NONE";var c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);return c.toDataURL("image/png");}})() '
    data_url = cdp(grab_js, timeout=20)
else:
    lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    lh3 = cdp(lh3_js) or ""
    data_url = ("URL:"+lh3) if lh3 else None

if data_url and data_url.startswith("data:image"):
    img_bytes = base64.b64decode(data_url.split(",",1)[1])
    with open(raw,"wb") as f: f.write(img_bytes)
elif data_url and data_url.startswith("URL:"):
    req = urllib.request.Request(data_url[4:], headers={"User-Agent":"Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r: img_bytes = r.read()
    with open(raw,"wb") as f: f.write(img_bytes)
else:
    print("No image"); exit(1)

print(f"RAW: {len(img_bytes)//1024}KB")
img = Image.open(raw).convert("RGB").resize((256,256), Image.LANCZOS)
img.save(out, "JPEG", quality=85, optimize=True)
os.remove(raw)
print(f"Done: {out}")
