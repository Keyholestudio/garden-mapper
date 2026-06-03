"""
Garden Mapper — Full Plants Category Batch
Generates all plant-type stickers (excludes trees and root veg).
Uses CDP into Brave/Gemini tab + Rob's new prompt format (chroma-key green background).
Skips already-generated files. Runs sticker-pipeline.py on each output.

Usage:
  python sticker-batch-plants.py

Output:
  stickers/generated/plants/            <- raw grabbed PNGs (green background)
  stickers/generated/plants/processed/  <- pipeline-cleaned transparent PNGs
"""

import json, base64, time, os, sys, subprocess
import urllib.request
import websocket

# ── Config ─────────────────────────────────────────────────────────────────────
WORKSPACE            = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
OUT_RAW              = os.path.join(WORKSPACE, "stickers", "generated", "plants")
OUT_CLEAN            = os.path.join(WORKSPACE, "stickers", "generated", "plants", "processed")
PIPELINE             = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON               = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
INTER_PROMPT_DELAY   = 45    # seconds between prompts
IMAGE_WAIT_TIMEOUT   = 120   # max seconds to wait for image

os.makedirs(OUT_RAW, exist_ok=True)
os.makedirs(OUT_CLEAN, exist_ok=True)

# ── Prompt template — PLANTS (Rob's wording, do not modify) ────────────────────
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

# ── Full plants catalog (type=plant only) ──────────────────────────────────────
PLANTS = [
    # ── Vegetables & Herbs ──
    {"id": "vegetable-tall_tomato_M_CA-US-FR-GB-AU",        "name": "Tomato",            "type": "compact fruiting annual",          "size": 256, "colours": "bright red #D42B2B, deep green #2A5C1A, light green #7AB648, warm yellow #F5C518, dark stem brown #5A3010", "shape": "Upright leafy plant with round red tomatoes hanging in clusters, stems at bottom and leafy canopy at top."},
    {"id": "vegetable-tall_cherry-tomato_M_CA-US-FR-GB-AU", "name": "Cherry Tomato",     "type": "compact fruiting annual",          "size": 256, "colours": "cherry red #E8341A, orange-red #D45A1A, mid-green #4A7C2F, pale green #8FBF6A, dark stem #3A2010",          "shape": "Compact bushy plant with clusters of small round cherry tomatoes, stems at bottom and leafy canopy at top."},
    {"id": "vegetable-leafy_zucchini_M_CA-US-FR-GB-AU",     "name": "Zucchini",          "type": "spreading annual vegetable",       "size": 256, "colours": "deep green #2A5C1A, mid-green #4A7C2F, pale green #8FBF6A, yellow flower #F5C518, dark stem #3A2010",       "shape": "Large spreading rosette of broad lobed leaves with green elongated fruit at base, stems at bottom and leafy florals at top."},
    {"id": "herb-small_basil_S_CA-US-FR-GB-AU",             "name": "Basil",             "type": "compact annual herb",              "size": 160, "colours": "bright mid-green #5A9E3A, deep green #2A5A1A, pale lime #A8D878, warm brown stems #7A5C3A, soft yellow-green #C8E898", "shape": "Bushy compact herb with large glossy rounded leaves, stems at bottom and leafy florals at top."},
    {"id": "herb-small_parsley_S_CA-US-FR-GB-AU",           "name": "Parsley",           "type": "compact biennial herb",            "size": 160, "colours": "bright green #5AB83A, mid-green #4A7C2F, deep green #2A5010, pale yellow-green #C8E898, warm brown stems #7A5C3A", "shape": "Dense rosette of curly ruffled bright green leaves, stems at bottom and leafy florals at top."},
    {"id": "herb-small_chives_S_CA-US-FR-GB-AU",            "name": "Chives",            "type": "perennial herb",                   "size": 160, "colours": "mid-green #4A7C2F, deep green #2A5010, pale purple flower #C8A8E8, mauve #A880C8, warm brown base #7A5C3A", "shape": "Upright clump of fine tubular green blades with small purple globe flowers at tips, stems at bottom and florals at top."},
    {"id": "herb-small_mint_S_CA-US-FR-GB-AU",              "name": "Mint",              "type": "spreading perennial herb",         "size": 160, "colours": "bright green #5AB83A, mid-green #4A7C2F, pale lilac #C8A8E8, dark outline #1A2E1A, warm brown stems #7A5C3A", "shape": "Spreading mat of oval serrated bright green leaves with tiny pale flower clusters at tips, stems at bottom and leafy florals at top."},
    {"id": "herb-small_rosemary_M_US-FR-GB-AU",             "name": "Rosemary",          "type": "woody perennial herb",             "size": 256, "colours": "silver-grey green #8FAF82, dark olive #3D5A1A, pale blue flower #A8C8E8, warm grey #A09070, brown stems #7A5C3A", "shape": "Upright woody sub-shrub with dense narrow needle-like silver-green leaves and tiny blue flowers, stems at bottom and leafy florals at top."},
    {"id": "herb-small_sage_S_CA-US-FR-GB-AU",              "name": "Sage",              "type": "woody perennial herb",             "size": 160, "colours": "silver-grey green #8FAF82, sage green #7B9E4E, pale purple flower #C8A8E8, warm grey #A09070, brown stems #7A5C3A", "shape": "Low spreading shrub with soft velvety grey-green oval leaves and purple flower spikes, stems at bottom and leafy florals at top."},
    # ── Annual Flowers ──
    {"id": "flower-daisy_marigold_S_CA-US-FR-GB-AU",        "name": "French Marigold",   "type": "compact annual",                  "size": 160, "colours": "bright orange #FF8C00, golden yellow #FFD700, dark brown centre #8B3A00, mid-green #4A7C2F, deep green stems #2A5010", "shape": "Bold layered bloom of orange-yellow petals around a dark warm centre disk, stems at bottom and leafy florals at top."},
    {"id": "flower-daisy_petunia_S_CA-US-FR-GB-AU",         "name": "Petunia",           "type": "trailing annual",                 "size": 160, "colours": "vivid purple #7B3EA7, pale lilac #C4A8E0, hot pink #E8407A, mid-green #4A7C2F, dark outline #1A0A2E",             "shape": "Low spreading mound with large funnel-shaped petunias in purple and pink, stems at bottom and leafy florals at top."},
    {"id": "flower-daisy_zinnia_S_CA-US-FR-AU",             "name": "Zinnia",            "type": "upright annual",                  "size": 160, "colours": "vivid orange #FF6B1A, hot pink #E8407A, golden yellow #FFD700, mid-green #4A7C2F, dark centre #3A1A0A",           "shape": "Upright stems topped with bold round flat-petalled blooms in bright mixed colours, stems at bottom and leafy florals at top."},
    {"id": "vegetable-tall_sunflower_XL_CA-US-FR-GB-AU",    "name": "Sunflower",         "type": "tall annual",                     "size": 512, "colours": "golden yellow #FFD700, deep brown centre #5A2A0A, mid-green #4A7C2F, pale yellow #FFF0A0, dark stem #3A2010",    "shape": "Tall upright stem with large round brown seed disc surrounded by bold golden-yellow ray petals, broad leaves, stem at bottom and flower at top."},
    {"id": "flower-daisy_cosmos_M_CA-US-FR-GB-AU",          "name": "Cosmos",            "type": "airy annual",                     "size": 256, "colours": "pale pink #F5AACB, deep pink #E8407A, white #FFFFFF, mid-green #4A7C2F, golden yellow centre #FFD700",           "shape": "Airy feathery foliage topped with delicate single-petalled pink and white blooms, stems at bottom and florals at top."},
    {"id": "flower-spike_snapdragon_M_CA-US-FR-GB",         "name": "Snapdragon",        "type": "upright annual",                  "size": 256, "colours": "coral red #E8503A, cream #FFF5E0, golden yellow #FFD700, mid-green #4A7C2F, dark outline #1A2E1A",               "shape": "Upright spike densely packed with tubular snap-mouth blooms in red and yellow, stems at bottom and flower spike at top."},
    # ── Perennial Flowers ──
    {"id": "flower-rose_rose_M_CA-US-FR-GB-AU",             "name": "Rose",              "type": "flowering shrub",                 "size": 256, "colours": "deep red #C41230, pale pink #F5B8C8, mid-green #4A7C2F, dark outline #1A0A0A, warm brown thorny stems #7A4A2A", "shape": "Upright thorny stems with large full multi-petalled rose blooms and glossy green leaves, stems at bottom and blooms at top."},
    {"id": "flower-daisy_echinacea_M_CA-US-FR-GB",          "name": "Echinacea",         "type": "upright perennial",               "size": 256, "colours": "deep pink-purple #C84A8A, orange-brown cone #8B4A1A, mid-green #4A7C2F, warm yellow #FFD700, dark outline #1A0A0A", "shape": "Upright stems with bold daisy-like flowers with reflexed pink petals and prominent raised orange-brown cone centre, stems at bottom and florals at top."},
    {"id": "flower-daisy_black-eyed-susan_M_CA-US",         "name": "Black-eyed Susan",  "type": "upright perennial",               "size": 256, "colours": "golden yellow #FFD700, dark brown-black centre #1A0A0A, mid-green #4A7C2F, warm yellow #FFF0A0, dark stem #3A2010", "shape": "Upright stems with bright golden-yellow daisy blooms with bold dark brown-black centre discs, stems at bottom and florals at top."},
    {"id": "flower-rose_peony_M_CA-US-FR-GB",               "name": "Peony",             "type": "lush perennial",                  "size": 256, "colours": "deep pink #E8407A, pale blush #F5C8D8, rich magenta #C41270, mid-green #4A7C2F, dark outline #1A0A1A",            "shape": "Lush mounded shrub with enormous full globe-shaped blooms of layered pink petals and glossy leaves, stems at bottom and florals at top."},
    {"id": "flower-cluster_hydrangea_L_CA-US-FR-GB-AU",     "name": "Hydrangea",         "type": "flowering deciduous shrub",       "size": 384, "colours": "cornflower blue #5B8DD9, pale lavender #C4B8E8, soft pink #F0B8C8, mid-green #4A7C2F, dark outline #1A1A2E",     "shape": "Rounded shrub with massive domed flower heads of densely packed small florets in blue and pink, stems at bottom and florals at top."},
    {"id": "flower-spike_delphinium_L_CA-US-FR-GB",         "name": "Delphinium",        "type": "tall upright perennial",          "size": 384, "colours": "deep cobalt blue #1A3EA7, sky blue #5B8DD9, white centre #FFFFFF, mid-green #4A7C2F, dark outline #0A1A2E",        "shape": "Very tall upright spike densely packed with cup-shaped deep blue blooms, broad palmate green leaves, stem at bottom and flower spike at top."},
    {"id": "flower-spike_lupin_L_CA-US-FR-GB-AU",           "name": "Lupin",             "type": "tall upright perennial",          "size": 384, "colours": "deep purple #5B1AA7, sky blue #5B8DD9, pale cream #FFF5E0, mid-green #4A7C2F, dark outline #1A0A2E",              "shape": "Tall upright spike of densely packed pea-like blooms in purple and blue, distinctive palmate fan leaves, stem at bottom and spike at top."},
    {"id": "flower-spike_salvia_M_CA-US-FR-GB-AU",          "name": "Salvia",            "type": "upright perennial",               "size": 256, "colours": "deep violet-purple #5B1AA7, mid-purple #7B3EA7, silver-grey foliage #8FAF82, mid-green #4A7C2F, dark outline #1A0A2E", "shape": "Upright branching plant with whorled spikes of tubular deep purple blooms, grey-green aromatic leaves, stems at bottom and spikes at top."},
    {"id": "flower-cluster_allium_M_CA-US-FR-GB-AU",        "name": "Allium",            "type": "ornamental bulb perennial",       "size": 256, "colours": "deep violet-purple #5B1AA7, mid-purple #7B3EA7, pale lilac #C4A8E0, grey-green strap #8FAF82, dark outline #1A0A2E", "shape": "Tall slender stem topped with a perfect globe of densely packed small star-shaped purple florets, strap leaves at base, stem at bottom and globe at top."},
    # ── Shrubs ──
    {"id": "shrub-round_boxwood_L_CA-US-FR-GB-AU",          "name": "Boxwood",           "type": "dense evergreen shrub",           "size": 384, "colours": "deep green #2A5C1A, mid-green #4A7C2F, dark outline #0A1A0A, warm brown trunk #7A5C3A, pale green highlights #8FBF6A", "shape": "Dense perfectly rounded evergreen shrub with tiny oval dark-green leaves clipped to smooth dome shape, stem at bottom and dome at top."},
    {"id": "shrub-flowering_lilac_L_CA-US-FR-GB",           "name": "Lilac",             "type": "fragrant deciduous shrub",        "size": 384, "colours": "pale purple #C4A8E0, deep lavender #7B5EA7, creamy white #FFF5E0, mid-green #4A7C2F, dark outline #1A0A2E",         "shape": "Upright deciduous shrub with large heart-shaped leaves and massive conical flower clusters of fragrant pale purple florets, stems at bottom and florals at top."},
    {"id": "shrub-flowering_azalea_L_CA-US-FR-GB-AU",       "name": "Azalea",            "type": "flowering evergreen shrub",       "size": 384, "colours": "hot pink #E8407A, deep coral #D45A1A, pale pink #F5AACB, deep green #2A5C1A, dark outline #1A0A0A",                "shape": "Dense mounded shrub completely covered in large funnel-shaped blooms in vivid pink and coral, small glossy leaves, stems at bottom and florals at top."},
    {"id": "shrub-flowering_spiraea_L_CA-US-FR-GB",         "name": "Spiraea",           "type": "arching deciduous shrub",         "size": 384, "colours": "pure white #FFFFFF, pale pink #F5AACB, mid-green #4A7C2F, warm brown arching stems #7A5C3A, dark outline #1A0A0A", "shape": "Graceful arching stems cascading with dense clusters of tiny white flowers along their length, small oval leaves, stems at bottom and florals arching at top."},
    # ── Bulbs ──
    {"id": "bulb-spring_tulip_S_CA-US-FR-GB-AU",            "name": "Tulip",             "type": "spring bulb",                     "size": 160, "colours": "vivid red #D42B2B, bright yellow #FFD700, deep pink #E8407A, mid-green strap #4A7C2F, dark outline #1A0A0A",       "shape": "Upright smooth strap leaves with single elegant cup-shaped bloom at top in bold red or yellow, stem at bottom and bloom at top."},
    {"id": "bulb-spring_daffodil_S_CA-US-FR-GB-AU",         "name": "Daffodil",          "type": "spring bulb",                     "size": 160, "colours": "golden yellow #FFD700, pale cream #FFF5E0, deep orange trumpet #FF8C00, mid-green strap #4A7C2F, dark outline #1A0A0A", "shape": "Upright strap leaves with single nodding bloom of cream petals surrounding a golden trumpet, stem at bottom and bloom at top."},
    {"id": "bulb-spring_hyacinth_S_CA-US-FR-GB-AU",         "name": "Hyacinth",          "type": "spring bulb",                     "size": 160, "colours": "deep purple-blue #3E1AA7, pale lilac #C4A8E0, pink #E8407A, mid-green strap #4A7C2F, dark outline #1A0A2E",         "shape": "Upright thick strap leaves with dense cylindrical spike of small star-shaped fragrant purple florets, stem at bottom and spike at top."},
    {"id": "flower-daisy_dahlia_M_CA-US-FR-GB-AU",          "name": "Dahlia",            "type": "tender tuberous perennial",       "size": 256, "colours": "deep magenta #C41270, coral orange #E8703A, vivid yellow #FFD700, mid-green #4A7C2F, dark outline #1A0A0A",        "shape": "Upright stems with large dramatic multi-layered pompom blooms in rich colours, stems at bottom and blooms at top."},
    {"id": "flower-spike_gladiolus_M_CA-US-FR-GB-AU",       "name": "Gladiolus",         "type": "tender corm perennial",           "size": 256, "colours": "deep magenta #C41270, coral #E8703A, pale pink #F5AACB, mid-green strap #4A7C2F, dark outline #1A0A0A",            "shape": "Tall upright spike of stacked funnel-shaped blooms in pink and coral opening from base to tip, strap leaves at base, stem at bottom and spike at top."},
    {"id": "flower-spike_iris_M_CA-US-FR-GB-AU",            "name": "Iris",              "type": "rhizomatous perennial",           "size": 256, "colours": "deep violet-purple #5B1AA7, pale yellow falls #FFF0A0, blue #3E7AB8, mid-green strap #4A7C2F, dark outline #1A0A2E", "shape": "Upright strap leaves with elegant bearded iris blooms of drooping violet falls and upright standards, stem at bottom and bloom at top."},
    # ── Grasses & Ground Cover ──
    {"id": "grass-clump_ornamental-grass_L_CA-US-FR-GB-AU", "name": "Ornamental Grass",  "type": "clumping perennial grass",        "size": 384, "colours": "warm golden-green #A8C870, pale straw #E8D890, mid-green #4A7C2F, bronze #A87030, dark outline #1A0A0A",            "shape": "Arching fountain clump of long strap-like leaves with feathery plume seed heads, stems at bottom and arching leaves and plumes at top."},
    {"id": "grass-clump_pampas-grass_XL_US-FR-GB-AU",       "name": "Pampas Grass",      "type": "large clumping perennial grass",  "size": 512, "colours": "pale cream-white #FFF5E0, warm straw #E8D890, mid-green #4A7C2F, silver-white plumes #F5F5F5, dark outline #1A0A0A", "shape": "Very large fountain clump of arching sharp strap leaves with tall elegant silvery-white feathery plumes above, stems at bottom and plumes at top."},
    {"id": "ground-cover_ajuga_XS_CA-US-FR-GB-AU",          "name": "Ajuga",             "type": "low spreading perennial",         "size": 96,  "colours": "deep bronze-green #3A5A2A, purple-bronze #5A2A3A, bright blue flower #3E7AB8, mid-green #4A7C2F, dark outline #1A0A0A", "shape": "Low spreading mat of bronze-purple rounded leaves with upright spikes of tiny bright blue flowers, stems at bottom and florals at top."},
    # ── Climbing Plants ──
    {"id": "vine-leaf_clematis_L_CA-US-FR-GB-AU",           "name": "Clematis",          "type": "climbing perennial vine",         "size": 384, "colours": "deep violet-purple #5B1AA7, pale lavender #C4A8E0, golden centre #FFD700, mid-green #4A7C2F, dark outline #1A0A2E", "shape": "Climbing twining stems with large star-shaped deep purple flowers and glossy trifoliate leaves, stems at bottom and blooms climbing upward."},
    {"id": "vine-leaf_wisteria_XL_US-FR-GB-AU",             "name": "Wisteria",          "type": "vigorous climbing deciduous vine", "size": 512, "colours": "pale lilac #C4A8E0, mid-purple #7B3EA7, deep violet #5B1AA7, mid-green #4A7C2F, warm brown stems #7A5C3A",          "shape": "Cascading climbing stems draped with long hanging clusters of fragrant lilac-purple blooms among pinnate leaves, stems at bottom and cascading florals at top."},
    {"id": "flower-rose_climbing-rose_XL_CA-US-FR-GB-AU",   "name": "Climbing Rose",     "type": "vigorous climbing shrub rose",    "size": 512, "colours": "deep pink #E8407A, pale blush #F5C8D8, cream white #FFF5E0, mid-green #4A7C2F, warm brown thorny stems #7A4A2A",     "shape": "Vigorous climbing canes with large full multi-petalled pale pink rose blooms and glossy dark leaves, stems at bottom and blooms climbing upward."},
    # ── Aquatic ──
    {"id": "aquatic_water-lily_M_CA-US-FR-GB-AU",           "name": "Water Lily",        "type": "aquatic perennial",               "size": 256, "colours": "pure white #FFFFFF, pale pink #F5AACB, golden centre #FFD700, deep green round pad #2A5C1A, mid-green #4A7C2F",     "shape": "Flat round lily pads floating on water with elegant white multi-petalled blooms open above them, flat pads at bottom and blooms at top."},
    {"id": "grass-clump_cattail_L_CA-US-FR-GB-AU",          "name": "Cattail",           "type": "aquatic marginal perennial",      "size": 384, "colours": "deep brown cattail #5A2A0A, mid-green strap #4A7C2F, warm tan #C8A070, pale green #8FBF6A, dark outline #1A0A0A",   "shape": "Upright clump of long strap leaves with distinctive brown sausage-shaped cattail seedheads on tall stalks, stems at bottom and cattails at top."},
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

def get_blob_src(ws_url):
    js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    return cdp_eval(ws_url, js, timeout=10) or ""

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
    js = """
(function(){
    var imgs=Array.from(document.querySelectorAll('img')).filter(i=>(i.src.startsWith('blob:')||i.src.includes('lh3.googleusercontent'))&&i.naturalWidth>100);
    var img=imgs[imgs.length-1];
    if(!img||img.naturalWidth<100)return 'NONE';
    var c=document.createElement('canvas');
    c.width=img.naturalWidth;c.height=img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);
    return c.toDataURL('image/png');
})()
"""
    return cdp_eval(ws_url, js, timeout=20)

def generate_one(plant):
    raw_path = os.path.join(OUT_RAW, f"{plant['id']}_raw.png")
    if os.path.exists(raw_path):
        p(f"  SKIP raw (exists): {plant['id']}")
        return raw_path

    prompt = build_prompt(plant["name"], plant["type"], plant["size"], plant["colours"], plant["shape"])
    p(f"  Prompt: {len(prompt)} chars")

    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except RuntimeError as e:
        p(f"  ABORT: {e}")
        return None

    src_before = get_blob_src(ws_url)
    send_result = type_and_send(ws_url, prompt)
    p(f"  Sent: {send_result} | Waiting up to {IMAGE_WAIT_TIMEOUT}s...")

    deadline = time.time() + IMAGE_WAIT_TIMEOUT
    found = False
    while time.time() < deadline:
        time.sleep(5)
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
            src_now = get_blob_src(ws_url)
            if src_now and src_now != src_before:
                found = True
                time.sleep(2)
                break
        except Exception:
            pass

    if not found:
        p(f"  FAIL: no image after {IMAGE_WAIT_TIMEOUT}s")
        return None

    data_url = grab_image(ws_url)
    if data_url and data_url.startswith("data:image"):
        img_bytes = base64.b64decode(data_url.split(",", 1)[1])
        with open(raw_path, "wb") as f:
            f.write(img_bytes)
        p(f"  RAW saved: {os.path.basename(raw_path)} ({len(img_bytes)//1024}KB)")
        return raw_path
    else:
        p(f"  FAIL: could not grab image data")
        return None

def run_pipeline(raw_path):
    clean_name = os.path.basename(raw_path).replace("_raw.png", ".png")
    clean_path = os.path.join(OUT_CLEAN, clean_name)
    tmp_nobg   = os.path.splitext(raw_path)[0] + "_nobg.png"

    p(f"  Running pipeline...")
    result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)
    if result.returncode != 0:
        p(f"  Pipeline error: {result.stderr}")
        return None

    if os.path.exists(tmp_nobg):
        if os.path.exists(clean_path):
            os.remove(clean_path)
        os.rename(tmp_nobg, clean_path)
        p(f"  CLEAN saved: {clean_name}")
        return clean_path
    else:
        p(f"  Pipeline ran but output not found")
        return None

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    p("=" * 60)
    p(f"Garden Mapper -- Full Plants Batch ({len(PLANTS)} stickers)")
    p(f"Raw:   {OUT_RAW}")
    p(f"Clean: {OUT_CLEAN}")
    p(f"Pause between prompts: {INTER_PROMPT_DELAY}s")
    p("=" * 60)

    try:
        get_gemini_tab()
        p("[OK] Gemini tab found in Brave\n")
    except RuntimeError as e:
        p(f"[ABORT] {e}")
        sys.exit(1)

    # Check which are already done
    already_clean = set(f.replace(".png","") for f in os.listdir(OUT_CLEAN) if f.endswith(".png"))
    remaining = [pl for pl in PLANTS if pl["id"] not in already_clean]
    p(f"Already complete: {len(PLANTS) - len(remaining)}/{len(PLANTS)}")
    p(f"To generate: {len(remaining)}\n")

    clean_files = []
    failed = []

    for i, plant in enumerate(remaining):
        p(f"[{i+1}/{len(remaining)}] {plant['name']} ({plant['id']})")

        raw = generate_one(plant)
        if raw:
            clean = run_pipeline(raw)
            if clean:
                clean_files.append(clean)
            else:
                failed.append(plant["id"] + " (pipeline failed)")
        else:
            failed.append(plant["id"] + " (generation failed)")

        if i < len(remaining) - 1:
            p(f"  [PAUSE] {INTER_PROMPT_DELAY}s...\n")
            time.sleep(INTER_PROMPT_DELAY)

    p("\n" + "=" * 60)
    p("BATCH COMPLETE")
    p(f"  Generated this run: {len(clean_files)}")
    p(f"  Total in processed: {len(os.listdir(OUT_CLEAN))}/{len(PLANTS)}")
    if failed:
        p(f"  Failed: {', '.join(failed)}")
    p(f"\n  Review folder: {OUT_CLEAN}")
    p("=" * 60)

if __name__ == "__main__":
    main()
