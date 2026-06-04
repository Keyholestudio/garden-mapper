"""
Garden Mapper - Texture Batch Generator
Generates repeating 256x256 JPG textures for:
  - Deck planking (3 colours)
  - Building roofs (cedar shingles, asphalt, terracotta tiles)
  - Garden bed soils (5 mulch/soil colours)
  - Path stepping stones (3 styles)

Run: python texture-batch.py [--start N]
"""

import json, base64, time, os, sys, subprocess
import urllib.request
import websocket
from PIL import Image

WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
TEXTURE_DIR = os.path.join(WORKSPACE, "app", "public", "textures")
GEMINI_URL = "https://gemini.google.com/app"
ROB_ACCOUNT = "contactsunsetpoetvintage"
IMAGE_WAIT  = 240
INTER_PAUSE = 40
os.makedirs(TEXTURE_DIR, exist_ok=True)

# Each entry: (filename, category, prompt)
TEXTURES = [
    # ── Deck planking ─────────────────────────────────────────────────────────
    ("deck-medium-brown.jpg", "deck",
     "Seamless tileable top-down deck planking texture, 512x512. Medium brown wood planks (#8B5E3C, #9B6A3A), parallel horizontal boards with visible wood grain and subtle gaps between planks. Flat matte cartoon-style, no shadows, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    ("deck-dark-brown.jpg", "deck",
     "Seamless tileable top-down deck planking texture, 512x512. Dark rich brown wood planks (#5C3A1E, #6B4428), parallel horizontal boards with deep wood grain and subtle gaps between planks. Flat matte cartoon-style, no shadows, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    ("deck-cedar.jpg", "deck",
     "Seamless tileable top-down deck planking texture, 512x512. Warm cedar wood planks (#A0714A, #B8845A), reddish-tan parallel horizontal boards with visible cedar grain and knots, subtle gaps between planks. Flat matte cartoon-style, no shadows, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    # ── Building roofs ────────────────────────────────────────────────────────
    ("roof-cedar-shingles.jpg", "building",
     "Seamless tileable top-down cedar shingle roof texture, 512x512. Warm cedar brown shingles (#9B6A3A, #B8845A), overlapping rows of rectangular wood shingles with grain and shadow lines between rows. Flat matte cartoon-style, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    ("roof-asphalt.jpg", "building",
     "Seamless tileable top-down asphalt shingle roof texture, 512x512. Dark charcoal grey asphalt shingles (#4A4A4A, #5A5A5A), overlapping rows of rectangular shingles with subtle granule texture and shadow lines between rows. Flat matte cartoon-style, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    ("roof-terracotta.jpg", "building",
     "Seamless tileable top-down terracotta roof tile texture, 512x512. Warm terracotta orange tiles (#C8623A, #A04A28), overlapping rows of curved barrel tiles with shadow between ridges and valleys. Flat matte cartoon-style, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    # ── Garden bed soils ──────────────────────────────────────────────────────
    ("soil-brown.jpg", "bed",
     "Seamless tileable top-down garden soil texture, 512x512. Medium brown soil (#7A5A3A, #8B6A4A), loose crumbly earth with small clumps and texture variation. Flat matte cartoon-style, no shadows, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    ("soil-dark-brown.jpg", "bed",
     "Seamless tileable top-down dark garden soil texture, 512x512. Rich dark brown soil (#4A3020, #5A3A28), dense moist earth with small clumps and dark texture variation. Flat matte cartoon-style, no shadows, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    ("soil-red-mulch.jpg", "bed",
     "Seamless tileable top-down red mulch texture, 512x512. Warm red-brown mulch (#9B3A28, #B84A35), shredded wood mulch pieces scattered evenly with colour variation. Flat matte cartoon-style, no shadows, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    ("soil-cedar-mulch.jpg", "bed",
     "Seamless tileable top-down cedar mulch texture, 512x512. Warm cedar tan mulch (#C8955A, #A0714A), fine shredded cedar bark pieces scattered evenly with natural colour variation. Flat matte cartoon-style, no shadows, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    ("soil-hay.jpg", "bed",
     "Seamless tileable top-down straw hay mulch texture, 512x512. Pale golden straw (#D4B870, #C8A850), loose scattered hay strands and straw pieces laid flat. Flat matte cartoon-style, no shadows, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),

    # ── Path stepping stones ──────────────────────────────────────────────────
    ("path-stepping-round.jpg", "path",
     "Seamless tileable top-down stepping stone path texture, 512x512. Round grey stepping stones (#8A9A8A, #9AAAAА) on transparent gaps, stones evenly spaced with visible lawn-green gaps between them, natural stone texture with subtle variation. Flat matte cartoon-style, no seams. Pure flat chroma-key green (#00FF00) fills gaps between stones."),

    ("path-stepping-square.jpg", "path",
     "Seamless tileable top-down square stepping stone path texture, 512x512. Square flat grey pavers (#8A9A8A, #B0C0B0) with gaps between them, clean cut stone edges, subtle texture. Flat matte cartoon-style, no seams. Pure flat chroma-key green (#00FF00) fills every gap between pavers."),

    ("path-flagstone.jpg", "path",
     "Seamless tileable top-down irregular flagstone path texture, 512x512. Warm grey-tan flagstone pieces (#9A9080, #B0A890) in varied irregular shapes with thin mortar lines between them. Flat matte cartoon-style, no focal points, no seams. Pure flat chroma-key green (#00FF00) fills every pixel of background."),
]

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

def verify_account(ws_url):
    r = cdp(ws_url, '(function(){var a=document.body.innerText+document.body.innerHTML;return a.includes("contactsunsetpoetvintage")?"ROB":"OTHER";})()', timeout=10)
    return r == "ROB"

def process_texture(raw_path, out_path, fade=0.0):
    """Resize to 256x256, apply optional white fade, save as JPG."""
    img = Image.open(raw_path).convert("RGB").resize((256, 256), Image.LANCZOS)
    if fade > 0:
        white = Image.new("RGB", img.size, (255, 255, 255))
        img = Image.blend(img.convert("RGBA"), white.convert("RGBA"), alpha=fade).convert("RGB")
    img.save(out_path, "JPEG", quality=85, optimize=True)
    p(f"  Processed -> {os.path.basename(out_path)}")

def main():
    start_idx = 0
    for i, arg in enumerate(sys.argv[1:]):
        if arg.startswith("--start"):
            try: start_idx = int(arg.split("=")[1] if "=" in arg else sys.argv[i+2])
            except: pass

    p(f"Texture batch -- {len(TEXTURES)} textures (starting at {start_idx})")

    tab = get_brave_tab("gemini.google.com")
    if not tab:
        p("ERROR: Gemini not open. Please open gemini.google.com in Brave first.")
        sys.exit(1)
    ws_url = tab["webSocketDebuggerUrl"]

    if not verify_account(ws_url):
        p("ERROR: Rob's account not detected. Switch to contactsunsetpoetvintage@gmail.com")
        sys.exit(1)
    p("[OK] Account confirmed.")

    img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'

    for idx, (filename, category, prompt) in enumerate(TEXTURES):
        if idx < start_idx:
            continue

        out_path = os.path.join(TEXTURE_DIR, filename)
        raw_path = out_path.replace(".jpg", "_raw.jpg")

        p(f"\n[{idx+1}/{len(TEXTURES)}] {filename} ({category})")

        if os.path.exists(out_path):
            p("  Already exists -- skipping.")
            continue

        # Re-fetch ws_url fresh (L017)
        tab = get_brave_tab("gemini.google.com")
        if not tab:
            p("ERROR: Lost Gemini tab. Re-run with --start " + str(idx)); sys.exit(1)
        ws_url = tab["webSocketDebuggerUrl"]

        if not verify_account(ws_url):
            p(f"ERROR: Account switched. Re-run with --start {idx}"); sys.exit(1)

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
        sent = cdp(ws_url, '(function(){var b=document.querySelector("button[aria-label=\'Send message\']");if(b){b.click();return "SENT";}return "NO_BTN";})()', timeout=8)
        p(f"  Sent: {sent} | Waiting up to {IMAGE_WAIT}s...")

        # Wait for image
        deadline = time.time() + IMAGE_WAIT
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
            p(f"  TIMEOUT -- skipping"); continue

        # Grab image
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
            p("  Could not grab image -- skipping."); continue

        if data_url.startswith("data:image"):
            img_bytes = base64.b64decode(data_url.split(",",1)[1])
            with open(raw_path, "wb") as f: f.write(img_bytes)
        elif data_url.startswith("URL:"):
            req = urllib.request.Request(data_url[4:], headers={"User-Agent":"Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r: img_bytes = r.read()
            with open(raw_path, "wb") as f: f.write(img_bytes)
        p(f"  RAW saved: {len(img_bytes)//1024}KB")

        # Process texture (no chroma-key removal needed -- just resize)
        try:
            process_texture(raw_path, out_path, fade=0.0)
        except Exception as e:
            p(f"  Process error: {e}"); continue

        # Clean up raw
        try: os.remove(raw_path)
        except: pass

        p(f"  [OK] {filename} ready in textures/")

        if idx < len(TEXTURES) - 1:
            p(f"  Pausing {INTER_PAUSE}s...")
            time.sleep(INTER_PAUSE)

    # Commit all textures
    p("\nCommitting textures...")
    subprocess.run(["git","add","-A"], cwd=WORKSPACE, capture_output=True)
    result = subprocess.run(
        ["git","commit","-m","Add textures: deck planking, roofs, soils, stepping stones"],
        cwd=WORKSPACE, capture_output=True, text=True
    )
    p(result.stdout.strip() or result.stderr.strip())
    p("[DONE] Texture batch complete.")

if __name__ == "__main__":
    main()
