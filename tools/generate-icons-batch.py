"""
Batch icon generator - uploads sticker to Gemini (R G account), grabs result via CDP, runs through pipeline.
CRITICAL FIX: Always grabs the LARGEST blob (full 1024px image with magenta BG),
NOT the last blob (small preview thumbnail rendered on dark Gemini UI card = black BG).
Usage: python generate-icons-batch.py
"""
import json, base64, time, os, subprocess
import websocket, urllib.request

PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PIPELINE   = os.path.join(WORKSPACE, "tools", "process-rob-images.py")
UPLOAD_DIR = r"C:\tmp\openclaw\uploads"
OUT_DIR    = os.path.join(WORKSPACE, "icon-previews")
CDP_PORT   = 9222
GEMINI_URL = "https://gemini.google.com/u/1/app"
IMAGE_WAIT = 180

os.makedirs(OUT_DIR, exist_ok=True)

ICONS = [
    ("wheelbarrow", "icon-src-wheelbarrow.png", "watercolor garden wheelbarrow side view icon"),
    ("sundial",     "icon-src-sundial.png",      "watercolor garden sundial icon"),
    ("gazebo",      "icon-src-gazebo.png",        "watercolor square garden gazebo icon"),
    ("gnome",       "icon-src-gnome.png",         "watercolor classic garden gnome icon"),
    ("arch",        "icon-src-arch.png",          "watercolor metal garden arch icon"),
    ("greenhouse",  "icon-src-greenhouse.png",    "watercolor open-front greenhouse icon"),
]

PROMPT_TEMPLATE = (
    "Redraw this as a minimal flat icon in the same watercolor style used for my garden stickers. "
    "Bold clean shapes, simplified silhouette. "
    "IMPORTANT: The background must be a completely flat solid magenta colour, exactly #FF00FF (RGB 255,0,255). "
    "No gradients, no dark background, no shadows behind the object. Pure flat magenta only. "
    "200x200px. Keep it recognisable as a {desc} but icon-scale simple. "
    "Add a thin black border/outline around the object."
)

def p(msg): print(msg, flush=True)

def get_ws():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:" + str(CDP_PORT) + "/json").read())
    for t in tabs:
        if "gemini.google.com/u/1" in t.get("url","") and t.get("type") == "page":
            return t["webSocketDebuggerUrl"]
    return None

def cdp_eval(ws_url, expression, timeout=25):
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

def wait_for_image(ws_url, timeout=IMAGE_WAIT):
    p("  Waiting up to " + str(timeout) + "s for image...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(4)
        blob_js = ("var i=Array.from(document.querySelectorAll('img'))"
                   ".filter(function(x){return x.src.startsWith('blob:')&&x.naturalWidth>100;});"
                   "i.length?'found':''")
        found = cdp_eval(ws_url, blob_js, timeout=10)
        if found == "found":
            p("  Image found")
            return True
    return False

def grab_image(ws_url):
    # CRITICAL: Always grab the LARGEST blob (full image = magenta BG)
    # NOT the last blob (small preview thumbnail = dark/black UI background)
    grab_js = ("(function(){"
               "var imgs=Array.from(document.querySelectorAll('img'))"
               ".filter(function(i){return i.src.startsWith('blob:')&&i.naturalWidth>100;});"
               "if(!imgs.length)return 'NONE';"
               "imgs.sort(function(a,b){return(b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight);});"
               "var img=imgs[0];"
               "var c=document.createElement('canvas');"
               "c.width=img.naturalWidth;c.height=img.naturalHeight;"
               "c.getContext('2d').drawImage(img,0,0);"
               "return c.toDataURL('image/png');"
               "})()")
    return cdp_eval(ws_url, grab_js, timeout=30)

def check_bg(raw_path):
    from PIL import Image
    import numpy as np
    img = Image.open(raw_path).convert("RGBA")
    data = np.array(img, dtype=np.float32)
    bg = data[5,5]
    mag = ((bg[0]-255)**2 + bg[1]**2 + (bg[2]-255)**2)**0.5
    blk = (bg[0]**2 + bg[1]**2 + bg[2]**2)**0.5
    return ("MAGENTA" if mag < blk else "BLACK"), round(mag,1), round(blk,1)

for name, src_file, desc in ICONS:
    p("\n" + "="*50)
    p("Generating: " + name)
    upload_path = os.path.join(UPLOAD_DIR, src_file)

    ws_url = get_ws()
    if not ws_url:
        p("ERROR: No Gemini tab found"); continue

    # Navigate to new chat
    p("  Navigating to new chat...")
    cdp_eval(ws_url, "window.location.href = '" + GEMINI_URL + "'", timeout=10)
    time.sleep(4)
    ws_url = get_ws()

    # Open upload menu
    p("  Opening upload menu...")
    cdp_eval(ws_url, "document.querySelector('button[aria-label=\"Upload & tools\"]')?.click()", timeout=8)
    time.sleep(1.5)

    # Click Upload files
    cdp_eval(ws_url, ("Array.from(document.querySelectorAll('[role=menuitem]'))"
                      ".find(function(e){return e.textContent.includes('Upload files');})?.click()"), timeout=8)
    time.sleep(1.5)

    # Set file via CDP DOM.setFileInputFiles
    p("  Injecting file: " + src_file)
    ws = websocket.create_connection(ws_url, timeout=15)
    ws.send(json.dumps({"id":10,"method":"Runtime.evaluate","params":{"expression":"document.querySelector('input[type=file]')","returnByValue":False}}))
    node_obj_id = None
    deadline = time.time() + 8
    while time.time() < deadline:
        d = json.loads(ws.recv())
        if d.get("id") == 10:
            node_obj_id = d.get("result",{}).get("result",{}).get("objectId","")
            break
    backend_id = None
    if node_obj_id:
        ws.send(json.dumps({"id":11,"method":"DOM.describeNode","params":{"objectId":node_obj_id}}))
        deadline2 = time.time() + 8
        while time.time() < deadline2:
            d = json.loads(ws.recv())
            if d.get("id") == 11:
                backend_id = d.get("result",{}).get("node",{}).get("backendNodeId")
                break
    if backend_id:
        ws.send(json.dumps({"id":12,"method":"DOM.setFileInputFiles","params":{"files":[upload_path],"backendNodeId":backend_id}}))
        time.sleep(2)
        p("  File injected OK")
    else:
        p("  WARN: Could not inject file")
    ws.close()

    # Dismiss any agree dialog
    time.sleep(1)
    ws_url = get_ws()
    cdp_eval(ws_url, ("Array.from(document.querySelectorAll('button'))"
                      ".find(function(b){return b.textContent.trim()==='Agree';})?.click()"), timeout=5)
    time.sleep(1)

    # Type prompt and send
    prompt = PROMPT_TEMPLATE.format(desc=desc)
    p("  Typing prompt...")
    type_js = ("(function(){"
               "var tb=document.querySelector('rich-textarea div[contenteditable]')||"
               "document.querySelector('[aria-label=\"Enter a prompt for Gemini\"]');"
               "if(!tb)return 'NO_TB';"
               "tb.focus();"
               "document.execCommand('insertText',false," + json.dumps(prompt) + ");"
               "return 'OK';"
               "})()")
    cdp_eval(ws_url, type_js, timeout=8)
    time.sleep(1)

    # Send via Enter key
    ws2 = websocket.create_connection(ws_url, timeout=10)
    ws2.send(json.dumps({"id":20,"method":"Input.dispatchKeyEvent","params":{"type":"keyDown","key":"Return","code":"Enter","windowsVirtualKeyCode":13}}))
    ws2.send(json.dumps({"id":21,"method":"Input.dispatchKeyEvent","params":{"type":"keyUp","key":"Return","code":"Enter","windowsVirtualKeyCode":13}}))
    ws2.close()
    p("  Prompt sent - waiting for image...")

    # Wait for image
    ws_url = get_ws()
    found = wait_for_image(ws_url)
    if not found:
        p("  FAIL: no image generated for " + name); continue

    # Grab LARGEST blob (full image with magenta BG)
    p("  Grabbing LARGEST blob (full image)...")
    ws_url = get_ws()
    data_url = grab_image(ws_url)
    if not data_url or data_url == "NONE":
        p("  FAIL: canvas grab failed for " + name); continue

    # Save raw
    raw_path = os.path.join(OUT_DIR, "icon-raw-" + name + ".png")
    hdr, b64 = data_url.split(",", 1)
    with open(raw_path, "wb") as f:
        f.write(base64.b64decode(b64))

    # Verify background colour
    from PIL import Image
    import numpy as np
    bg_type, mag_d, blk_d = check_bg(raw_path)
    img_size = Image.open(raw_path).size
    p("  Size: " + str(img_size) + "  BG: " + bg_type + " (mag=" + str(mag_d) + " blk=" + str(blk_d) + ")")

    if bg_type != "MAGENTA":
        p("  WARN: black BG - blob grabbed was NOT the full image. Skipping pipeline."); continue

    # Run pipeline
    out_path = os.path.join(OUT_DIR, "icon-" + name + ".png")
    r = subprocess.run([PYTHON, PIPELINE, raw_path, out_path], capture_output=True, text=True)
    p(r.stdout.strip())
    if r.returncode != 0:
        p("  Pipeline error: " + r.stderr)
    else:
        p("[DONE]: " + out_path)

p("\n\nAll done! Check icon-previews/ folder.")
