"""
Garden Mapper — Tier 2 Full Batch (~47 stickers)
Categories: vegetable-leafy, vegetable-tall, vine-leaf, ground-cover,
            flower-daisy extras, grass-clump extras, shrub-flowering extras
All use PLANTS prompt template (Rob's wording — do not modify).

Output: stickers/generated/plants/processed/
        stickers/generated/rootveg/processed/  (for leafy veg)
"""

import json, base64, time, os, sys, subprocess
import urllib.request
import websocket

WORKSPACE          = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
OUT_RAW            = os.path.join(WORKSPACE, "stickers", "generated", "plants")
OUT_CLEAN          = os.path.join(WORKSPACE, "stickers", "generated", "plants", "processed")
PIPELINE           = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON             = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
INTER_PROMPT_DELAY = 45
IMAGE_WAIT_TIMEOUT = 240

os.makedirs(OUT_RAW, exist_ok=True)
os.makedirs(OUT_CLEAN, exist_ok=True)

PLANT_PREFIX = (
    "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
    "No shadows. No background showing in the center of the plant. Centered, 75% "
    "canvas fill. Vibrant and iconic."
)

def build_prompt(name, plant_type, size_px, colours, shape):
    return (
        f"{PLANT_PREFIX}\n\n"
        f"Subject: {name}, {plant_type}.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: {shape} Only a few leaves and flowers, small plant. Correct proportions."
    )

PLANTS = [
    # ── Vegetable Leafy ──
    {"id": "vegetable-leafy_lettuce_M_CA-US-FR-GB-AU",      "name": "Lettuce",           "type": "compact leafy annual",             "size": 256, "colours": "bright green #5AB83A, pale lime #C8E878, mid-green #4A7C2F, cream-white heart #FFF5E0, dark outline #1A2A0A",       "shape": "Open rosette of ruffled bright green leaves fanning outward, stems at bottom and leafy florals at top."},
    {"id": "vegetable-leafy_kale_M_CA-US-FR-GB-AU",         "name": "Kale",              "type": "upright leafy biennial",           "size": 256, "colours": "deep blue-green #2A5A4A, mid-green #4A7C2F, purple-tinged #5A2A5A, pale blue-green #8ABAA8, dark outline #0A1A10", "shape": "Upright rosette of deeply curled and ruffled blue-green leaves, stems at bottom and leafy florals at top."},
    {"id": "vegetable-leafy_spinach_S_CA-US-FR-GB-AU",      "name": "Spinach",           "type": "compact leafy annual",             "size": 160, "colours": "deep green #2A5C1A, mid-green #4A7C2F, bright green #5AB83A, pale green #8FBF6A, dark outline #0A1A0A",             "shape": "Low flat rosette of smooth oval dark green leaves, stems at bottom and leafy florals at top."},
    {"id": "vegetable-leafy_cabbage_M_CA-US-FR-GB-AU",      "name": "Cabbage",           "type": "round-headed leafy biennial",      "size": 256, "colours": "blue-green #3A6A5A, pale blue-white #C8D8D0, mid-green #4A7C2F, grey-green #7A9A8A, dark outline #0A1A10",          "shape": "Tight round compact head of overlapping smooth blue-green leaves, stems at bottom and round leafy head at top."},
    {"id": "vegetable-leafy_rhubarb_L_CA-US-FR-GB-AU",      "name": "Rhubarb",           "type": "large spreading perennial",        "size": 384, "colours": "vivid red-pink stems #D42B4A, deep green #2A5C1A, mid-green #4A7C2F, pale green #8FBF6A, dark outline #1A0A0A",     "shape": "Bold large dramatic spreading rosette of enormous heart-shaped green leaves on vivid red-pink thick stalks, stems at bottom and leafy florals at top."},
    {"id": "vegetable-leafy_potato_M_CA-US-FR-GB-AU",       "name": "Potato",            "type": "mounding leafy annual",            "size": 256, "colours": "mid-green #4A7C2F, deep green #2A5C1A, pale lavender flower #C8A8E8, warm brown stems #7A5C3A, pale green #8FBF6A", "shape": "Mounding leafy plant with pinnate compound leaves and small pale lavender flowers at tips, stems at bottom and leafy florals at top."},
    # ── Vegetable Tall ──
    {"id": "vegetable-tall_corn_XL_CA-US-FR-GB-AU",         "name": "Corn",              "type": "tall annual cereal",               "size": 512, "colours": "mid-green #4A7C2F, deep green #2A5C1A, golden silk tassel #FFD700, pale green husk #A8C870, dark stem #3A2010",     "shape": "Very tall upright single stalk with broad strap leaves alternating and golden tassels at top, stem at bottom and tassel at top."},
    {"id": "vegetable-tall_broccoli_M_CA-US-FR-GB-AU",      "name": "Broccoli",          "type": "upright brassica annual",          "size": 256, "colours": "deep blue-green florets #2A5A3A, mid-green #4A7C2F, pale green stem #8FBF6A, grey-green leaves #7A9A8A, dark outline #0A1A0A", "shape": "Upright plant with a large dense domed blue-green floret head above broad wavy leaves, stems at bottom and head at top."},
    {"id": "vegetable-tall_sweet-pepper_M_CA-US-FR-GB-AU",  "name": "Sweet Pepper",      "type": "upright fruiting annual",          "size": 256, "colours": "vivid red #D42B2B, bright green #5AB83A, mid-green #4A7C2F, golden yellow #FFD700, dark stem #3A2010",               "shape": "Upright bushy plant with glossy blocky bell peppers in red and yellow hanging below leafy canopy, stems at bottom and canopy at top."},
    {"id": "vegetable-tall_chilli_M_CA-US-FR-GB-AU",        "name": "Chilli Pepper",     "type": "upright fruiting annual",          "size": 256, "colours": "vivid red #D42B2B, deep red #8B1A1A, bright green #5AB83A, mid-green #4A7C2F, dark stem #3A2010",                   "shape": "Upright bushy plant with slender pointed red chilli peppers hanging below leafy canopy, stems at bottom and canopy at top."},
    {"id": "vegetable-tall_leek_M_CA-US-FR-GB-AU",          "name": "Leek",              "type": "upright allium biennial",          "size": 256, "colours": "blue-green strap #3A6A5A, pale white shaft #F5F0E8, mid-green #4A7C2F, grey-green #7A9A8A, dark outline #0A1A10",    "shape": "Upright thick cylindrical shaft of tightly wrapped blue-green and white leaves, stems at bottom and strap leaves at top."},
    {"id": "vegetable-tall_eggplant_M_CA-US-FR-GB-AU",      "name": "Eggplant",          "type": "upright fruiting annual",          "size": 256, "colours": "deep purple #5B1AA7, pale purple #C4A8E0, mid-green #4A7C2F, deep green #2A5C1A, dark stem #3A2010",                "shape": "Upright bushy plant with large glossy deep purple oval eggplant fruit hanging below broad green leaves, stems at bottom and canopy at top."},
    {"id": "vegetable-tall_french-bean_S_CA-US-FR-GB-AU",   "name": "French Bean",       "type": "upright climbing annual",          "size": 160, "colours": "bright green pods #5AB83A, mid-green #4A7C2F, pale green #8FBF6A, white flower #F5F0E8, dark stem #3A2010",         "shape": "Upright twining stems with trifoliate leaves and slender bright green bean pods hanging in clusters, stems at bottom and leafy canopy at top."},
    # ── Vine / Climbing ──
    {"id": "vine-leaf_honeysuckle_L_CA-US-FR-GB-AU",        "name": "Honeysuckle",       "type": "twining climbing shrub",           "size": 384, "colours": "golden yellow #FFD700, creamy white #FFF5E0, mid-green #4A7C2F, deep green #2A5C1A, warm brown stems #7A5C3A",     "shape": "Twining climbing stems with tubular golden-yellow and cream trumpet flowers and oval paired leaves, stems at bottom and blooms climbing at top."},
    {"id": "vine-leaf_virginia-creeper_L_CA-US-FR-GB-AU",   "name": "Virginia Creeper",  "type": "vigorous climbing deciduous vine", "size": 384, "colours": "vivid scarlet #D42B2B, deep red #8B1A1A, mid-green #4A7C2F, orange-red #C84A1A, warm brown stems #7A5C3A",          "shape": "Vigorous climbing stems with bold five-leaflet palmate leaves in vivid autumn scarlet and red, stems at bottom and leaves spreading at top."},
    {"id": "vine-leaf_jasmine_M_CA-US-FR-GB-AU",            "name": "Jasmine",           "type": "twining climbing shrub",           "size": 256, "colours": "pure white #FFFFFF, pale blush #F5E8F0, mid-green #4A7C2F, deep green #2A5C1A, warm brown stems #7A5C3A",           "shape": "Twining stems covered in clusters of small star-shaped pure white fragrant flowers among glossy oval leaves, stems at bottom and blooms at top."},
    {"id": "vine-leaf_passion-flower_L_CA-US-FR-GB-AU",     "name": "Passion Flower",    "type": "exotic climbing perennial vine",   "size": 384, "colours": "deep purple #5B1AA7, pale white #F5F0E8, vivid blue #3E7AB8, mid-green #4A7C2F, dark outline #1A0A2E",              "shape": "Exotic climbing stems with dramatic intricate star-shaped flowers of white petals and vivid purple-blue corona filaments, lobed leaves, stems at bottom and blooms at top."},
    {"id": "vine-leaf_sweet-pea_S_CA-US-FR-GB-AU",          "name": "Sweet Pea",         "type": "climbing annual",                  "size": 160, "colours": "pale pink #F5AACB, deep pink #E8407A, pale lavender #C4A8E0, mid-green #4A7C2F, dark outline #1A0A1A",               "shape": "Delicate climbing tendrils with dainty ruffled pea-shaped flowers in pink and lavender, mid-green leaflets, stems at bottom and blooms at top."},
    {"id": "vine-leaf_runner-bean_M_CA-US-FR-GB-AU",        "name": "Runner Bean",       "type": "vigorous climbing annual",         "size": 256, "colours": "vivid scarlet #D42B2B, mid-green #4A7C2F, deep green #2A5C1A, pale green pods #8FBF6A, dark stem #3A2010",           "shape": "Vigorous twining stems with broad trifoliate leaves and vivid scarlet flowers above long slender bean pods, stems at bottom and blooms at top."},
    {"id": "vine-leaf_cucumber_M_CA-US-FR-GB-AU",           "name": "Cucumber",          "type": "trailing climbing annual",         "size": 256, "colours": "deep green #2A5C1A, mid-green #4A7C2F, pale green #8FBF6A, golden yellow flower #FFD700, dark outline #0A1A0A",    "shape": "Climbing tendrils with broad lobed leaves and long glossy dark green cucumber fruit hanging below golden star flowers, stems at bottom and canopy at top."},
    # ── Ground Cover ──
    {"id": "ground-cover_vinca_XS_CA-US-FR-GB-AU",          "name": "Vinca",             "type": "trailing evergreen perennial",     "size": 96,  "colours": "violet-blue #5B3EA7, pale blue #8A7AC8, deep green #2A5C1A, mid-green #4A7C2F, dark outline #1A0A2E",               "shape": "Low spreading mat of glossy oval dark green leaves with flat five-petalled violet-blue periwinkle flowers dotted throughout, stems at bottom and florals at top."},
    {"id": "ground-cover_ivy_S_CA-US-FR-GB-AU",             "name": "English Ivy",       "type": "trailing climbing evergreen",      "size": 160, "colours": "deep green #2A5C1A, mid-green #4A7C2F, pale green veins #8FBF6A, grey-green #7A9A8A, dark outline #0A1A0A",          "shape": "Spreading mat of bold three-lobed glossy ivy leaves with pale veining, trailing stems spreading outward, stems at bottom and leaves at top."},
    {"id": "ground-cover_sedum_XS_CA-US-FR-GB-AU",          "name": "Sedum",             "type": "low succulent perennial",          "size": 96,  "colours": "blue-green #5A8A7A, pale jade #8ABAA8, dusty pink flower #E8A0B8, grey-green #7A9A8A, dark outline #0A1A10",         "shape": "Low dense spreading mat of thick fleshy succulent rosette leaves with tiny star-shaped pink flower clusters, stems at bottom and florals at top."},
    {"id": "ground-cover_creeping-jenny_XS_CA-US-FR-GB-AU", "name": "Creeping Jenny",    "type": "low spreading perennial",          "size": 96,  "colours": "bright lime-green #A8D848, golden-green #C8E070, mid-green #4A7C2F, bright yellow flower #FFD700, dark outline #1A2A0A", "shape": "Spreading mat of round bright lime-green coin-shaped leaves on trailing stems with tiny yellow flowers, stems at bottom and leafy mat at top."},
    {"id": "ground-cover_pachysandra_XS_CA-US-FR-GB-AU",    "name": "Pachysandra",       "type": "low evergreen ground cover",       "size": 96,  "colours": "deep green #2A5C1A, mid-green #4A7C2F, white flower spike #F5F0E8, pale green #8FBF6A, dark outline #0A1A0A",        "shape": "Low dense spreading mat of whorled dark green toothed leaves with small white upright flower spikes, stems at bottom and florals at top."},
    # ── Flower Daisy Extras ──
    {"id": "flower-daisy_pansy_S_CA-US-FR-GB-AU",           "name": "Pansy",             "type": "compact cool-season annual",       "size": 160, "colours": "deep violet #5B1AA7, golden yellow #FFD700, pale cream #FFF5E0, mid-green #4A7C2F, dark outline #1A0A2E",            "shape": "Low compact plant with large velvety face-like five-petalled pansy blooms in purple and yellow, stems at bottom and florals at top."},
    {"id": "flower-daisy_geranium_S_CA-US-FR-GB-AU",        "name": "Geranium",          "type": "tender perennial annual",          "size": 160, "colours": "vivid red #D42B2B, salmon pink #E8703A, mid-green #4A7C2F, deep green #2A5C1A, dark outline #1A0A0A",               "shape": "Mounded plant with round clusters of vivid red and salmon five-petalled blooms above rounded scalloped leaves, stems at bottom and florals at top."},
    {"id": "flower-daisy_nasturtium_S_CA-US-FR-GB-AU",      "name": "Nasturtium",        "type": "trailing annual",                  "size": 160, "colours": "vivid orange #FF6B1A, golden yellow #FFD700, warm red #D42B2B, bright green round leaves #5AB83A, dark outline #1A0A0A", "shape": "Trailing stems with round shield-shaped bright green leaves and vivid trumpet-shaped orange and yellow flowers, stems at bottom and florals at top."},
    {"id": "flower-daisy_lobelia_XS_CA-US-FR-GB-AU",        "name": "Lobelia",           "type": "trailing annual",                  "size": 96,  "colours": "vivid blue #3E7AB8, pale blue #8AAAD8, white eye #FFFFFF, mid-green #4A7C2F, dark outline #0A1A2E",                   "shape": "Low spreading cascade of tiny vivid blue five-petalled flowers with white centres densely packed among small oval leaves, stems at bottom and florals at top."},
    {"id": "flower-daisy_portulaca_XS_CA-US-FR-GB-AU",      "name": "Portulaca",         "type": "low succulent annual",             "size": 96,  "colours": "vivid magenta #D42B8A, bright yellow #FFD700, coral orange #E8703A, pale green succulent #8FBF6A, dark outline #1A0A0A", "shape": "Low spreading succulent mat with needle-like fleshy leaves and vivid silky rose-shaped blooms in magenta, yellow and orange, stems at bottom and florals at top."},
    # ── Grass Clump Extras ──
    {"id": "grass-clump_feather-grass_L_CA-US-FR-GB-AU",    "name": "Feather Grass",     "type": "upright clumping perennial grass", "size": 384, "colours": "pale silver-straw #E8D890, warm golden #C8A870, mid-green #4A7C2F, pale cream #FFF5E0, dark outline #1A0A0A",         "shape": "Upright clump of fine arching leaves with long elegant feathery silver awns trailing like hair in the breeze, stems at bottom and feathery plumes at top."},
    {"id": "grass-clump_blue-oat-grass_M_CA-US-FR-GB-AU",   "name": "Blue Oat Grass",    "type": "clumping evergreen ornamental grass","size": 256, "colours": "steel blue-grey #7A9AB8, silver-blue #A0B8D0, mid-blue-green #5A7A9A, pale straw #E8D890, dark outline #0A1A2A",    "shape": "Compact upright clump of stiff steel-blue strap leaves with oat-like seed heads arching outward, stems at bottom and seed heads at top."},
    # ── Shrub Flowering Extras ──
    {"id": "shrub-flowering_forsythia_L_CA-US-FR-GB",       "name": "Forsythia",         "type": "arching deciduous shrub",          "size": 384, "colours": "vivid golden yellow #FFD700, deep yellow #E8C840, warm brown arching stems #7A5C3A, mid-green #4A7C2F, dark outline #1A2A0A", "shape": "Graceful arching stems absolutely smothered in vivid golden-yellow four-petalled flowers before leaves appear, stems at bottom and blooms arching at top."},
    {"id": "shrub-flowering_rhododendron_L_CA-US-FR-GB-AU", "name": "Rhododendron",      "type": "large evergreen shrub",            "size": 384, "colours": "deep pink #E8407A, pale pink #F5AACB, deep green #2A5C1A, mid-green #4A7C2F, dark outline #1A0A0A",                  "shape": "Large dense mounded evergreen shrub with bold trusses of large funnel-shaped deep pink blooms above broad glossy dark leaves, stems at bottom and florals at top."},
    {"id": "shrub-flowering_weigela_L_CA-US-FR-GB",         "name": "Weigela",           "type": "arching deciduous shrub",          "size": 384, "colours": "deep rose pink #D4407A, pale pink #F5AACB, mid-green #4A7C2F, deep green #2A5C1A, warm brown stems #7A5C3A",          "shape": "Arching graceful stems covered in clusters of tubular deep rose-pink trumpet flowers among oval leaves, stems at bottom and blooms arching at top."},
    {"id": "shrub-flowering_buddleia_L_CA-US-FR-GB-AU",     "name": "Buddleia",          "type": "large arching deciduous shrub",    "size": 384, "colours": "deep purple #5B1AA7, pale lavender #C4A8E0, silver-grey foliage #8FAF82, mid-green #4A7C2F, dark outline #1A0A2E",     "shape": "Large arching shrub with long conical spikes of densely packed deep purple fragrant florets above silver-grey lance-shaped leaves, stems at bottom and spikes at top."},
]

# ── CDP helpers ────────────────────────────────────────────────────────────────
def p(*args):
    print(*args, flush=True)

def get_gemini_tab():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    for t in tabs:
        if "gemini.google.com" in t.get("url", "") and t.get("type") == "page":
            return t
    raise RuntimeError("Gemini tab not found — is Brave open at gemini.google.com?")

def cdp_eval(ws_url, expr, timeout=15):
    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(timeout)
    ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                        "params": {"expression": expr, "returnByValue": True}}))
    result = None
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            data = json.loads(ws.recv())
            if data.get("id") == 1:
                result = data.get("result", {}).get("result", {}).get("value")
                break
        except websocket.WebSocketTimeoutException:
            break
    ws.close()
    return result

def get_generated_img_src(ws_url):
    js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    return cdp_eval(ws_url, js, timeout=10) or ""

def navigate_fresh():
    """Navigate Gemini to a fresh chat and return a fresh ws_url each time."""
    # Get current tab ws_url
    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except RuntimeError as e:
        raise e

    # Navigate to fresh app URL
    cdp_eval(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
    time.sleep(10)  # wait for full page reload

    # Re-fetch tab after navigation — ws_url changes after reload
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            tab = get_gemini_tab()
            new_ws = tab.get("webSocketDebuggerUrl")
            if new_ws and new_ws != ws_url:
                ws_url = new_ws
                break
            elif new_ws:  # same URL but page may have reloaded
                ws_url = new_ws
                break
        except Exception:
            pass
        time.sleep(2)

    # Wait for input to be ready
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            ready = cdp_eval(ws_url, 'document.querySelector("[contenteditable=true]")!==null', timeout=5)
            if ready:
                break
        except Exception:
            pass
        time.sleep(2)
        # Re-fetch ws_url in case it changed again
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
        except Exception:
            pass

    time.sleep(1)
    return ws_url

def type_and_send(ws_url, prompt):
    cdp_eval(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return b?"OK":"NO";})()', timeout=8)
    time.sleep(0.5)
    ws = websocket.create_connection(ws_url, timeout=10)
    ws.settimeout(8)
    ws.send(json.dumps({"id": 1, "method": "Input.insertText", "params": {"text": prompt}}))
    try: ws.recv()
    except: pass
    ws.close()
    time.sleep(0.5)
    result = cdp_eval(ws_url, '(function(){var b=document.querySelector("button[aria-label=\'Send message\']");if(b){b.click();return "SENT";}return "NO_BTN";})()', timeout=8)
    return result

def grab_image(ws_url):
    blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    blob_src = cdp_eval(ws_url, blob_js, timeout=10) or ""
    if blob_src:
        js = f"""
(function(){{
    var img=document.querySelector('img[src="{blob_src}"]');
    if(!img||img.naturalWidth<100)return 'NONE';
    var c=document.createElement('canvas');
    c.width=img.naturalWidth;c.height=img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);
    return c.toDataURL('image/png');
}})()
"""
        return cdp_eval(ws_url, js, timeout=20)
    lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    lh3_src = cdp_eval(ws_url, lh3_js, timeout=10) or ""
    if lh3_src:
        return "URL:" + lh3_src
    return None

def generate_one(plant):
    raw_path   = os.path.join(OUT_RAW, f"{plant['id']}_raw.png")
    clean_path = os.path.join(OUT_CLEAN, f"{plant['id']}.png")

    if os.path.exists(clean_path):
        p(f"  SKIP (clean exists): {plant['id']}")
        return True

    prompt = build_prompt(plant["name"], plant["type"], plant["size"], plant["colours"], plant["shape"])

    if not os.path.exists(raw_path):
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
        except RuntimeError as e:
            p(f"  ABORT: {e}")
            return False

        ws_url = navigate_fresh()
        src_before = get_generated_img_src(ws_url)
        p(f"  Baseline: {src_before[:60] if src_before else 'none'}")

        send_result = type_and_send(ws_url, prompt)
        p(f"  Sent: {send_result} | Waiting up to {IMAGE_WAIT_TIMEOUT}s...")

        deadline = time.time() + IMAGE_WAIT_TIMEOUT
        found = False
        while time.time() < deadline:
            time.sleep(5)
            try:
                tab = get_gemini_tab()
                ws_url = tab.get("webSocketDebuggerUrl")
                src_now = get_generated_img_src(ws_url)
                if src_now and src_now != src_before:
                    found = True
                    time.sleep(2)
                    break
            except Exception:
                pass

        if not found:
            p(f"  FAIL: no image after {IMAGE_WAIT_TIMEOUT}s")
            return False

        data_url = grab_image(ws_url)
        if data_url and data_url.startswith("data:image"):
            img_bytes = base64.b64decode(data_url.split(",", 1)[1])
            with open(raw_path, "wb") as f:
                f.write(img_bytes)
            p(f"  RAW saved (canvas): {os.path.basename(raw_path)} ({len(img_bytes)//1024}KB)")
        elif data_url and data_url.startswith("URL:"):
            img_url = data_url[4:]
            p(f"  Downloading from lh3...")
            try:
                req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=30) as resp:
                    img_bytes = resp.read()
                with open(raw_path, "wb") as f:
                    f.write(img_bytes)
                p(f"  RAW saved (download): {os.path.basename(raw_path)} ({len(img_bytes)//1024}KB)")
            except Exception as e:
                p(f"  FAIL: download error: {e}")
                return False
        else:
            p(f"  FAIL: could not grab image")
            return False
    else:
        p(f"  SKIP raw (exists), running pipeline only...")

    tmp_nobg = os.path.splitext(raw_path)[0] + "_nobg.png"
    p(f"  Running pipeline...")
    result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)
    if result.returncode != 0:
        p(f"  Pipeline error: {result.stderr}")
        return False
    if os.path.exists(tmp_nobg):
        if os.path.exists(clean_path):
            os.remove(clean_path)
        os.rename(tmp_nobg, clean_path)
        p(f"  CLEAN saved: {plant['id']}.png")
        return True
    p(f"  Pipeline ran but output not found")
    return False

def main():
    p("=" * 60)
    p(f"Garden Mapper -- Tier 2 Batch ({len(PLANTS)} stickers)")
    p(f"Output: {OUT_CLEAN}")
    p(f"Pause between prompts: {INTER_PROMPT_DELAY}s")
    p(f"Est. time: ~{len(PLANTS) * (INTER_PROMPT_DELAY + 60) // 60} minutes")
    p("=" * 60)

    try:
        get_gemini_tab()
        p("[OK] Gemini tab found in Brave\n")
    except RuntimeError as e:
        p(f"[ABORT] {e}")
        sys.exit(1)

    already_clean = set(f.replace(".png", "") for f in os.listdir(OUT_CLEAN) if f.endswith(".png"))
    remaining = [pl for pl in PLANTS if pl["id"] not in already_clean]
    p(f"Already complete: {len(PLANTS) - len(remaining)}/{len(PLANTS)}")
    p(f"To generate: {len(remaining)}\n")

    ok, failed = 0, []

    for i, plant in enumerate(remaining):
        p(f"[{i+1}/{len(remaining)}] {plant['name']} ({plant['id']})")
        if generate_one(plant):
            ok += 1
        else:
            failed.append(plant["name"])
        if i < len(remaining) - 1:
            p(f"  [PAUSE] {INTER_PROMPT_DELAY}s...\n")
            time.sleep(INTER_PROMPT_DELAY)

    p("\n" + "=" * 60)
    p("BATCH COMPLETE")
    p(f"  Successful: {ok}/{len(remaining)}")
    p(f"  Total in processed: {len(os.listdir(OUT_CLEAN))}")
    if failed:
        p(f"  Failed: {', '.join(failed)}")
    p(f"\n  Review folder: {OUT_CLEAN}")
    p("=" * 60)

if __name__ == "__main__":
    main()
