"""
Grab the current Gemini-generated image from an open browser tab via raw CDP WebSocket.
Saves as PNG to the specified output path.
Usage: python grab-gemini-image.py <ws_url> <output_path>
"""
import sys, json, base64, time
import websocket

ws_url = sys.argv[1]
out_path = sys.argv[2]

def cdp(ws_url, expression, timeout=20):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(timeout)
    ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":expression,"returnByValue":True,"awaitPromise":True}}))
    deadline = time.time() + timeout
    result = ""
    while time.time() < deadline:
        try:
            d = json.loads(ws.recv())
            if d.get("id") == 1:
                result = d.get("result",{}).get("result",{}).get("value","")
                break
        except: break
    ws.close()
    return result

# Find the blob image
blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
blob_src = cdp(ws_url, blob_js)
print(f"Blob src: {blob_src[:80] if blob_src else 'NOT FOUND'}")

if not blob_src:
    print("FAIL: no blob image found on page"); sys.exit(1)

# Canvas grab
grab_js = f'(function(){{var img=document.querySelector(\'img[src="{blob_src}"]\');if(!img)return "NONE";var c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);return c.toDataURL("image/png");}})() '
data_url = cdp(ws_url, grab_js, timeout=30)

if not data_url or data_url == "NONE":
    print("FAIL: canvas grab failed"); sys.exit(1)

# Save
header, b64 = data_url.split(",", 1)
with open(out_path, "wb") as f:
    f.write(base64.b64decode(b64))
print(f"Saved: {out_path} ({len(b64)//1024}KB base64)")
