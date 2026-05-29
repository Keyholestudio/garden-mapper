"""
Grab generated image from Gemini tab via CDP + canvas, save to stickers folder.
Usage: python grab_gemini_image.py <plant_id>
"""
import sys, base64, json
import websocket
import urllib.request

PLANT_ID = sys.argv[1] if len(sys.argv) > 1 else "herb-small_thyme"
OUT = f"C:\\Users\\RG\\.openclaw\\workspace\\projects\\garden-planner\\stickers\\gemini-chat\\{PLANT_ID}.png"

# Find the Gemini tab
resp = urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read()
tabs = json.loads(resp)
gemini_tab = next((t for t in tabs if "gemini.google.com" in t.get("url","") and t.get("type") == "page"), None)
if not gemini_tab:
    print("ERROR: Gemini tab not found")
    sys.exit(1)

ws_url = gemini_tab.get("webSocketDebuggerUrl") or gemini_tab.get("wsUrl")
print(f"Using tab: {gemini_tab['title'][:60]}")

# Connect via websocket and run JS
ws = websocket.create_connection(ws_url, timeout=30)

# Get full data URL from canvas
js = """
(function() {
    const img = document.querySelector('img[src^="blob:"]');
    if (!img) return 'NO_IMG';
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/png');
})()
"""

msg = json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": js, "returnByValue": True, "awaitPromise": False}})
ws.send(msg)

result = None
while True:
    raw = ws.recv()
    data = json.loads(raw)
    if data.get("id") == 1:
        result = data.get("result", {}).get("result", {}).get("value")
        break

ws.close()

if not result or result == "NO_IMG":
    print(f"ERROR: {result}")
    sys.exit(1)

if result.startswith("data:image/png;base64,"):
    b64 = result.split(",", 1)[1]
    img_bytes = base64.b64decode(b64)
    with open(OUT, "wb") as f:
        f.write(img_bytes)
    print(f"SAVED: {OUT} ({len(img_bytes):,} bytes)")
else:
    print(f"ERROR: unexpected result: {result[:100]}")
    sys.exit(1)
