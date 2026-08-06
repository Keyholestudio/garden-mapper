"""
Send a fully custom prompt to Gemini and run the sticker pipeline.
Usage: python sticker-custom-prompt.py "plant-id" "full prompt text"
"""
import json, base64, time, os, sys, subprocess, shutil
import urllib.request
import websocket

WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PIPELINE        = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PIPELINE_CYAN   = os.path.join(WORKSPACE, "tools", "sticker-pipeline-cyan.py")
PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
OUT_DIR    = os.path.join(WORKSPACE, "stickers", "generated", "pending")
RAW_ARCHIVE = os.path.join(WORKSPACE, "stickers", "raw-archive")  # local-only, never committed to git
IMAGE_WAIT = 240
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(RAW_ARCHIVE, exist_ok=True)

def p(msg): print(msg, flush=True)

def get_brave_tab(url_fragment):
    try:
        with urllib.request.urlopen("http://localhost:9222/json", timeout=5) as r:
            tabs = json.loads(r.read())
        for t in tabs:
            if url_fragment in t.get("url", ""):
                return t
    except Exception:
        pass
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

def main():
    if len(sys.argv) < 3:
        print('Usage: python sticker-custom-prompt.py "plant-id" "full prompt"')
        sys.exit(1)

    plant_id = sys.argv[1]
    prompt   = sys.argv[2]
    regions  = "CA-US-FR-GB-AU"
    full_id  = f"{plant_id}_{regions}" if not plant_id.endswith(regions) else plant_id
    raw_path   = os.path.join(OUT_DIR, full_id + "_raw.png")
    clean_path = os.path.join(OUT_DIR, full_id + ".png")

    p("=" * 60)
    p(f"Custom prompt sticker: {full_id}")
    p("=" * 60)

    tab = get_brave_tab("gemini.google.com")
    if not tab:
        p("ERROR: Gemini tab not found. Open Gemini in Brave first.")
        sys.exit(1)

    ws_url = tab["webSocketDebuggerUrl"]

    # New chat
    cdp(ws_url, """(function(){
        var links = Array.from(document.querySelectorAll('a, button'));
        var nc = links.find(function(l){ return l.textContent.trim() === 'New chat'; });
        if (nc) { nc.click(); return 'CLICKED'; }
        return 'NOT_FOUND';
    })()""", timeout=8)
    time.sleep(2)

    # Send prompt
    escaped = prompt.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
    send_js = f"""(function(){{
        var box = document.querySelector('rich-textarea') || document.querySelector('[contenteditable]');
        if (!box) return 'NO_BOX';
        box.focus();
        document.execCommand('insertText', false, `{escaped}`);
        setTimeout(function(){{
            var btn = document.querySelector('button[aria-label*="Send"]') ||
                      document.querySelector('button[data-test-id="send-button"]');
            if (btn) btn.click();
        }}, 500);
        return 'SENT';
    }})()"""
    result = cdp(ws_url, send_js, timeout=10)
    p(f"Prompt sent: {result} | Waiting up to {IMAGE_WAIT}s...")

    # Wait for image
    deadline = time.time() + IMAGE_WAIT
    img_data = None
    while time.time() < deadline:
        time.sleep(4)
        grab_js = """(function(){
            var imgs = Array.from(document.querySelectorAll('img'));
            var gen = imgs.find(function(i){ return i.src && i.src.startsWith('blob:') && i.naturalWidth > 100; });
            if (!gen) return null;
            var c = document.createElement('canvas');
            c.width = gen.naturalWidth; c.height = gen.naturalHeight;
            c.getContext('2d').drawImage(gen, 0, 0);
            return c.toDataURL('image/png').split(',')[1];
        })()"""
        img_data = cdp(ws_url, grab_js, timeout=15)
        if img_data:
            break

    if not img_data:
        p("FAIL: no image after timeout")
        sys.exit(1)

    raw_bytes = base64.b64decode(img_data)
    with open(raw_path, "wb") as f:
        f.write(raw_bytes)
    p(f"RAW saved: {len(raw_bytes)//1024}KB")

    # Pipeline
    p("Running pipeline...")
    pipe = PIPELINE_CYAN if "--cyan" in sys.argv else PIPELINE
    subprocess.run([PYTHON, pipe, raw_path], check=True)
    nobg = raw_path.replace(".png", "_nobg.png")
    if os.path.exists(nobg):
        if os.path.exists(clean_path):
            os.remove(clean_path)
        os.rename(nobg, clean_path)
    p(f"CLEAN saved: {os.path.basename(clean_path)}")

    # ── Archive raw file (move out of pending, never goes to app/public or git) ──
    raw_archive_path = os.path.join(RAW_ARCHIVE, os.path.basename(raw_path))
    if os.path.exists(raw_path):
        shutil.move(raw_path, raw_archive_path)
        p(f"RAW archived: stickers/raw-archive/{os.path.basename(raw_path)}")

    p(f"\nPending: {clean_path}")

if __name__ == "__main__":
    main()
