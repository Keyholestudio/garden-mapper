"""
Garden Mapper — Full Sticker Generator
Generates plant stickers via Gemini (open tab in Brave Debug).

Filename format: {sticker-id}_{slug-name}_{size}_{regions}.png
  e.g. flower-daisy_marigold_S_CA-US-FR-GB-AU.png

Folder structure:
  stickers/generated/
    flower-daisy/
      flower-daisy_marigold_S_CA-US-FR-GB-AU.png
      flower-daisy_petunia_S_CA-US-FR-GB-AU.png
    tree-fruit/
      tree-fruit_apple_XL_CA-US-FR-GB-AU.png
    ...

Usage:
  python generate_all_stickers.py              # generate all missing
  python generate_all_stickers.py --dry-run    # show what would be generated
  python generate_all_stickers.py --limit 10   # generate first N missing
"""

import json, base64, time, os, re, sys, urllib.request
import websocket

STATE_FILE = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers\generator_state.json"
RATE_LIMIT_DELAY = 600  # 10 minutes in seconds

RATE_LIMIT_PHRASES = [
    "ask me again later",
    "being asked to create more images than usual",
    "can't do that for you right now",
    "too many image requests",
]


def read_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def write_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def is_rate_limited():
    state = read_state()
    until = state.get("rate_limit_until", 0)
    if time.time() < until:
        remaining = int(until - time.time())
        p(f"  RATE LIMITED: Gemini asked to wait. {remaining}s remaining (~{remaining//60}m).")
        return True
    return False


def set_rate_limit():
    state = read_state()
    until = time.time() + RATE_LIMIT_DELAY
    state["rate_limit_until"] = until
    write_state(state)
    p(f"  RATE LIMIT SET: will retry after {RATE_LIMIT_DELAY//60} minutes.")

OUT_BASE = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers\generated"

# ══════════════════════════════════════════════════════════
# FULL PLANT CATALOG (from PLANT-DATABASE.md)
# Fields: sticker_id, name, size, regions, type, shape_hint, colours
# type: plant | tree | root_veg
# ══════════════════════════════════════════════════════════
PLANTS = [
    # ── Vegetables & Herbs ──
    {"sticker_id": "vegetable-tall",  "name": "Tomato",           "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "bright red, deep green, light green, warm yellow, dark stem brown",
     "shape": "Upright leafy plant with round red tomatoes hanging in clusters, stems at bottom and leafy canopy at top."},
    {"sticker_id": "vegetable-tall",  "name": "Cherry Tomato",    "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "cherry red, orange-red, mid-green, pale green, dark stem",
     "shape": "Compact bushy plant with clusters of small round cherry tomatoes, stems at bottom and leafy canopy at top."},
    {"sticker_id": "vegetable-leafy", "name": "Zucchini",         "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep green zucchini, mid-green, pale green, yellow flower, dark stem",
     "shape": "Large spreading rosette of broad lobed leaves with green elongated fruit at base, stems at bottom and leafy florals at top."},
    {"sticker_id": "herb-small",      "name": "Basil",            "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "bright mid-green, deep green, pale lime, warm brown stems",
     "shape": "Bushy compact herb with large glossy rounded leaves, stems at bottom and leafy florals at top."},
    {"sticker_id": "herb-small",      "name": "Parsley",          "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "bright green, mid-green, deep green, pale yellow-green, warm brown stems",
     "shape": "Dense rosette of curly or flat ruffled bright green leaves, stems at bottom and leafy florals at top."},
    {"sticker_id": "herb-small",      "name": "Chives",           "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "mid-green, deep green, pale purple flower, mauve, warm brown base",
     "shape": "Upright clump of fine tubular green blades with small purple globe flowers at tips, stems at bottom and florals at top."},
    {"sticker_id": "herb-small",      "name": "Mint",             "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "bright green, mid-green, pale lilac, dark outline, warm brown stems",
     "shape": "Spreading mat of oval serrated bright green leaves with tiny pale flower clusters at tips, stems at bottom and leafy florals at top."},
    {"sticker_id": "herb-small",      "name": "Rosemary",         "size": "M",  "regions": "US-FR-GB-AU",    "type": "plant",
     "colours": "silver-grey green, dark olive, pale blue flower, warm grey, brown stems",
     "shape": "Upright woody sub-shrub with dense narrow needle-like silver-green leaves and tiny blue flowers, stems at bottom and leafy florals at top."},
    {"sticker_id": "herb-small",      "name": "Sage",             "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "silver-grey green, sage green, pale purple flower, warm grey, brown stems",
     "shape": "Low spreading shrub with soft velvety grey-green oval leaves and purple flower spikes, stems at bottom and leafy florals at top."},
    {"sticker_id": "vegetable-root",  "name": "Beet",             "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "root_veg",
     "colours": "deep burgundy-red, dark magenta, bright green tops, red-veined leaves, dark soil line",
     "shape": "Beet shoulders peeking above a wide soil line. Only show the top of the root above the minimal soil line. Round dark red beet visible, leafy red-veined greens at top, root at bottom."},
    # ── Annual Flowers ──
    {"sticker_id": "flower-daisy",    "name": "Petunia",          "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "vivid purple, pale lilac, hot pink, mid-green, dark outline",
     "shape": "Low spreading mound with large funnel-shaped petunias in purple and pink, stems at bottom and leafy florals at top."},
    {"sticker_id": "flower-daisy",    "name": "Zinnia",           "size": "S",  "regions": "CA-US-FR-AU",    "type": "plant",
     "colours": "vivid orange, hot pink, golden yellow, mid-green, dark centre",
     "shape": "Upright stems topped with bold round flat-petalled blooms in bright mixed colours, stems at bottom and leafy florals at top."},
    {"sticker_id": "vegetable-tall",  "name": "Sunflower",        "size": "XL", "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "golden yellow, deep brown centre, mid-green, pale yellow, dark stem",
     "shape": "Tall upright stem with large round brown seed disc surrounded by bold golden-yellow ray petals, broad leaves, stem at bottom and flower at top."},
    {"sticker_id": "flower-daisy",    "name": "Cosmos",           "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "pale pink, deep pink, white, mid-green, golden yellow centre",
     "shape": "Airy feathery foliage topped with delicate single-petalled pink and white blooms, stems at bottom and florals at top."},
    {"sticker_id": "flower-spike",    "name": "Snapdragon",       "size": "M",  "regions": "CA-US-FR-GB",    "type": "plant",
     "colours": "coral red, cream, golden yellow, mid-green, dark outline",
     "shape": "Upright spike densely packed with tubular snap-mouth blooms in red and yellow, stems at bottom and flower spike at top."},
    # ── Perennial Flowers ──
    {"sticker_id": "flower-rose",     "name": "Rose",             "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep red, pale pink, mid-green, dark outline, warm brown thorny stems",
     "shape": "Upright thorny stems with large full multi-petalled rose blooms and glossy green leaves, stems at bottom and blooms at top."},
    {"sticker_id": "flower-daisy",    "name": "Echinacea",        "size": "M",  "regions": "CA-US-FR-GB",    "type": "plant",
     "colours": "deep pink-purple, orange-brown centre cone, mid-green, warm yellow, dark outline",
     "shape": "Upright stems with bold daisy-like flowers with reflexed pink petals and prominent raised orange-brown cone centre, stems at bottom and florals at top."},
    {"sticker_id": "flower-daisy",    "name": "Black-eyed Susan",  "size": "M", "regions": "CA-US",          "type": "plant",
     "colours": "golden yellow, dark brown-black centre, mid-green, warm yellow, dark stem",
     "shape": "Upright stems with bright golden-yellow daisy blooms with bold dark brown-black centre discs, stems at bottom and florals at top."},
    {"sticker_id": "flower-rose",     "name": "Peony",            "size": "M",  "regions": "CA-US-FR-GB",    "type": "plant",
     "colours": "deep pink, pale blush, rich magenta, mid-green, dark outline",
     "shape": "Lush mounded shrub with enormous full globe-shaped blooms of layered pink petals and glossy leaves, stems at bottom and florals at top."},
    {"sticker_id": "flower-cluster",  "name": "Hydrangea",        "size": "L",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "cornflower blue, pale lavender, soft pink, mid-green, dark outline",
     "shape": "Rounded shrub with massive domed flower heads of densely packed small florets in blue and pink, stems at bottom and florals at top."},
    {"sticker_id": "flower-spike",    "name": "Delphinium",       "size": "L",  "regions": "CA-US-FR-GB",    "type": "plant",
     "colours": "deep cobalt blue, sky blue, white centre, mid-green, dark outline",
     "shape": "Very tall upright spike densely packed with cup-shaped deep blue blooms, broad palmate green leaves, stem at bottom and flower spike at top."},
    {"sticker_id": "flower-spike",    "name": "Lupin",            "size": "L",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep purple, sky blue, pale cream, mid-green, dark outline",
     "shape": "Tall upright spike of densely packed pea-like blooms in purple and blue, distinctive palmate fan leaves, stem at bottom and spike at top."},
    {"sticker_id": "flower-spike",    "name": "Salvia",           "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep violet-purple, mid-purple, silver-grey foliage, mid-green, dark outline",
     "shape": "Upright branching plant with whorled spikes of tubular deep purple blooms, grey-green aromatic leaves, stems at bottom and spikes at top."},
    {"sticker_id": "flower-cluster",  "name": "Allium",           "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep violet-purple, mid-purple, pale lilac, grey-green strap, dark outline",
     "shape": "Tall slender stem topped with a perfect globe of densely packed small star-shaped purple florets, strap leaves at base, stem at bottom and globe at top."},
    # ── Shrubs & Hedges ──
    {"sticker_id": "shrub-round",     "name": "Boxwood",          "size": "L",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep green, mid-green, dark outline, warm brown trunk",
     "shape": "Dense perfectly rounded evergreen shrub with tiny oval dark-green leaves clipped to smooth dome shape, stem at bottom and dome at top."},
    {"sticker_id": "shrub-flowering", "name": "Lilac",            "size": "L",  "regions": "CA-US-FR-GB",    "type": "plant",
     "colours": "pale purple, deep lavender, creamy white, mid-green, dark outline",
     "shape": "Upright deciduous shrub with large heart-shaped leaves and massive conical flower clusters of fragrant pale purple florets, stems at bottom and florals at top."},
    {"sticker_id": "shrub-flowering", "name": "Azalea",           "size": "L",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "hot pink, deep coral, pale pink, deep green, dark outline",
     "shape": "Dense mounded shrub completely covered in large funnel-shaped blooms in vivid pink and coral, small glossy leaves, stems at bottom and florals at top."},
    {"sticker_id": "shrub-flowering", "name": "Spiraea",          "size": "L",  "regions": "CA-US-FR-GB",    "type": "plant",
     "colours": "pure white, pale pink, mid-green, warm brown arching stems",
     "shape": "Graceful arching stems cascading with dense clusters of tiny white flowers along their length, small oval leaves, stems at bottom and florals arching at top."},
    # ── Fruit Trees ──
    {"sticker_id": "tree-fruit",      "name": "Pear Tree",        "size": "XL", "regions": "CA-US-FR-GB-AU", "type": "tree",
     "colours": "mid-green, deep green, golden-yellow pear fruit, warm brown limbs, pale green accents",
     "shape": "Spacious leafy canopy, sweeping central limbs. Minimal pear-shaped golden fruit, only as accent."},
    {"sticker_id": "tree-fruit",      "name": "Cherry Tree",      "size": "XL", "regions": "CA-US-FR-GB-AU", "type": "tree",
     "colours": "mid-green, deep green, bright red cherry clusters, warm brown limbs, pale pink accents",
     "shape": "Spacious leafy canopy, sweeping central limbs. Minimal bright red cherry clusters, only as accent."},
    {"sticker_id": "tree-fruit",      "name": "Plum Tree",        "size": "XL", "regions": "CA-US-FR-GB-AU", "type": "tree",
     "colours": "mid-green, deep green, deep purple plums, warm brown limbs, pale green accents",
     "shape": "Spacious leafy canopy, sweeping central limbs. Minimal deep purple round plums, only as accent."},
    {"sticker_id": "tree-fruit",      "name": "Lemon Tree",       "size": "XL", "regions": "US-FR-AU",       "type": "tree",
     "colours": "deep green, bright green, vivid yellow lemon, warm brown limbs, pale yellow accents",
     "shape": "Spacious glossy evergreen canopy, sweeping central limbs. Minimal bright yellow oval lemons, only as accent."},
    # ── Ornamental / Shade Trees ──
    {"sticker_id": "tree-deciduous",  "name": "Japanese Maple",   "size": "XL", "regions": "CA-US-FR-GB-AU", "type": "tree",
     "colours": "deep crimson red, burgundy, orange-red, warm brown limbs, dark outline",
     "shape": "Graceful layered canopy of deeply cut star-shaped leaves in rich red and crimson, sweeping central limbs, no trunk."},
    {"sticker_id": "tree-deciduous",  "name": "Silver Birch",     "size": "XL", "regions": "CA-US-FR-GB",    "type": "tree",
     "colours": "fresh lime-green, mid-green, white-silver bark limbs, pale yellow-green, dark outline",
     "shape": "Airy open canopy of small diamond-shaped leaves on fine white-silver branches, sweeping central limbs, no trunk."},
    {"sticker_id": "tree-deciduous",  "name": "Magnolia",         "size": "XL", "regions": "CA-US-FR-GB-AU", "type": "tree",
     "colours": "deep pink, pale blush, cream white, mid-green, warm brown limbs",
     "shape": "Spacious canopy with large cup-shaped pink and white blooms among broad glossy leaves, sweeping central limbs, no trunk."},
    {"sticker_id": "tree-conifer",    "name": "Blue Spruce",      "size": "XL", "regions": "CA-US-FR-GB",    "type": "tree",
     "colours": "steel blue-green, mid blue-grey, silver-green, dark outline, pale silver accents",
     "shape": "Symmetrical star-shaped needle canopy, sweeping central limbs radiating in layered spoke pattern, distinctive blue-grey colouring."},
    # ── Bulbs ──
    {"sticker_id": "bulb-spring",     "name": "Tulip",            "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "vivid red, bright yellow, deep pink, mid-green strap, dark outline",
     "shape": "Upright smooth strap leaves with single elegant cup-shaped bloom at top in bold red or yellow, stem at bottom and bloom at top."},
    {"sticker_id": "bulb-spring",     "name": "Daffodil",         "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "golden yellow, pale cream, deep orange trumpet, mid-green strap, dark outline",
     "shape": "Upright strap leaves with single nodding bloom of cream petals surrounding a golden trumpet, stem at bottom and bloom at top."},
    {"sticker_id": "bulb-spring",     "name": "Hyacinth",         "size": "S",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep purple-blue, pale lilac, pink, mid-green strap, dark outline",
     "shape": "Upright thick strap leaves with dense cylindrical spike of small star-shaped fragrant purple florets, stem at bottom and spike at top."},
    {"sticker_id": "flower-daisy",    "name": "Dahlia",           "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep magenta, coral orange, vivid yellow, mid-green, dark outline",
     "shape": "Upright stems with large dramatic multi-layered pompom or cactus blooms in rich colours, stems at bottom and blooms at top."},
    {"sticker_id": "flower-spike",    "name": "Gladiolus",        "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep magenta, coral, pale pink, mid-green strap, dark outline",
     "shape": "Tall upright spike of stacked funnel-shaped blooms in pink and coral opening from base to tip, strap leaves at base, stem at bottom and spike at top."},
    {"sticker_id": "flower-spike",    "name": "Iris",             "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep violet-purple, pale yellow falls, blue, mid-green strap, dark outline",
     "shape": "Upright strap leaves with elegant bearded iris blooms of drooping violet falls and upright standards, stem at bottom and bloom at top."},
    # ── Grasses & Ground Cover ──
    {"sticker_id": "grass-clump",     "name": "Ornamental Grass", "size": "L",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "warm golden-green, pale straw, mid-green, bronze, dark outline",
     "shape": "Arching fountain clump of long strap-like leaves with feathery plume seed heads, stems at bottom and arching leaves and plumes at top."},
    {"sticker_id": "grass-clump",     "name": "Pampas Grass",     "size": "XL", "regions": "US-FR-GB-AU",    "type": "plant",
     "colours": "pale cream-white, warm straw, mid-green, silver-white plumes, dark outline",
     "shape": "Very large fountain clump of arching sharp strap leaves with tall elegant silvery-white feathery plumes above, stems at bottom and plumes at top."},
    {"sticker_id": "ground-cover",    "name": "Ajuga",            "size": "XS", "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep bronze-green, purple-bronze, bright blue flower, mid-green, dark outline",
     "shape": "Low spreading mat of bronze-purple rounded leaves with upright spikes of tiny bright blue flowers, stems at bottom and florals at top."},
    # ── Climbing Plants ──
    {"sticker_id": "vine-leaf",       "name": "Clematis",         "size": "L",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep violet-purple, pale lavender, golden centre, mid-green, dark outline",
     "shape": "Climbing twining stems with large star-shaped deep purple flowers and glossy trifoliate leaves, stems at bottom and blooms climbing upward."},
    {"sticker_id": "vine-leaf",       "name": "Wisteria",         "size": "XL", "regions": "US-FR-GB-AU",    "type": "plant",
     "colours": "pale lilac, mid-purple, deep violet, mid-green, warm brown stems",
     "shape": "Cascading climbing stems draped with long hanging clusters of fragrant lilac-purple blooms among pinnate leaves, stems at bottom and cascading florals at top."},
    {"sticker_id": "flower-rose",     "name": "Climbing Rose",    "size": "XL", "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep pink, pale blush, cream white, mid-green, warm brown thorny stems",
     "shape": "Vigorous climbing canes with large full multi-petalled pale pink rose blooms and glossy dark leaves, stems at bottom and blooms climbing upward."},
    # ── Aquatic ──
    {"sticker_id": "aquatic",         "name": "Water Lily",       "size": "M",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "pure white, pale pink, golden centre, deep green round pad, mid-green",
     "shape": "Flat round lily pads floating on water with elegant white multi-petalled blooms open above them, flat pads at bottom and blooms at top."},
    {"sticker_id": "grass-clump",     "name": "Cattail",          "size": "L",  "regions": "CA-US-FR-GB-AU", "type": "plant",
     "colours": "deep brown cattail, mid-green strap, warm tan, pale green, dark outline",
     "shape": "Upright clump of long strap leaves with distinctive brown sausage-shaped cattail seedheads on tall stalks, stems at bottom and cattails at top."},
]

PLANT_PREFIX = "Generate an image: Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, focusing on a primary characteristic of the plant, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."
TREE_PREFIX = "Generate an image: Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."
ROOT_VEG_PREFIX = "Generate an image: Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."


def p(*args):
    print(*args, flush=True)


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def filename_for(plant):
    slug = slugify(plant["name"])
    return f"{plant['sticker_id']}_{slug}_{plant['size']}_{plant['regions']}.png"


def out_path_for(plant):
    folder = os.path.join(OUT_BASE, plant["sticker_id"])
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, filename_for(plant))


def build_prompt(plant):
    prefix = TREE_PREFIX if plant["type"] == "tree" else (ROOT_VEG_PREFIX if plant["type"] == "root_veg" else PLANT_PREFIX)
    return f"{prefix} Subject: {plant['name']}, {plant.get('family', plant['sticker_id'])}. Colours: {plant['colours']}. Shape: {plant['shape']}"


def get_gemini_tab():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
    for t in tabs:
        if "gemini.google.com" in t.get("url", "") and t.get("type") == "page":
            return t
    raise RuntimeError("Gemini tab not found — is Brave Debug running?")


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
    js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")); i.length?i[i.length-1].src:""'
    return cdp_eval(ws_url, js, timeout=10) or ""


def check_rate_limit_message(ws_url):
    """Placeholder — text detection removed (too broad, false positives on chat history)."""
    return False


def type_and_send(ws_url, prompt):
    # Clear input
    cdp_eval(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return b?"OK":"NO";})()', timeout=8)
    time.sleep(0.3)
    # Type
    ws = websocket.create_connection(ws_url, timeout=10)
    ws.settimeout(8)
    ws.send(json.dumps({"id": 1, "method": "Input.insertText", "params": {"text": prompt}}))
    try: ws.recv()
    except: pass
    ws.close()
    time.sleep(0.5)
    # Click send
    result = cdp_eval(ws_url, '(function(){var b=document.querySelector("button[aria-label=\'Send message\']");if(b){b.click();return "SENT";}return "NO_BTN";})()', timeout=8)
    return result


def grab_image(ws_url):
    js = """
(function(){
    var imgs=Array.from(document.querySelectorAll('img')).filter(i=>i.src.startsWith('blob:'));
    var img=imgs[imgs.length-1];
    if(!img||img.naturalWidth<100)return 'NONE';
    var c=document.createElement('canvas');
    c.width=img.naturalWidth;c.height=img.naturalHeight;
    c.getContext('2d').drawImage(img,0,0);
    return c.toDataURL('image/png');
})()
"""
    return cdp_eval(ws_url, js, timeout=20)


def generate_plant(plant, dry_run=False):
    path = out_path_for(plant)
    if os.path.exists(path):
        p(f"  SKIP (exists): {filename_for(plant)}")
        return "skip"

    if dry_run:
        p(f"  DRY-RUN: would generate {filename_for(plant)}")
        return "dry"

    # Check if we're in a rate-limit cooldown from a previous run
    if is_rate_limited():
        return "rate_limited"

    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except RuntimeError as e:
        p(f"  ABORT: {e}")
        return "abort"

    src_before = get_blob_src(ws_url)
    send_result = type_and_send(ws_url, build_prompt(plant))
    p(f"  send: {send_result} | waiting...")

    deadline = time.time() + 120
    found = False
    while time.time() < deadline:
        time.sleep(4)
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
            # Check for Gemini rate limit message
            if check_rate_limit_message(ws_url):
                p(f"  RATE LIMIT detected — Gemini asked to wait.")
                set_rate_limit()
                return "rate_limited"
            src_now = get_blob_src(ws_url)
            if src_now and src_now != src_before:
                found = True
                time.sleep(2)
                break
        except Exception:
            pass

    if not found:
        # One final rate limit check before declaring failure
        try:
            if check_rate_limit_message(ws_url):
                p(f"  RATE LIMIT detected — Gemini asked to wait.")
                set_rate_limit()
                return "rate_limited"
        except Exception:
            pass
        p(f"  FAIL: no image after 120s")
        return "fail"

    data_url = grab_image(ws_url)
    if data_url and data_url.startswith("data:image"):
        img_bytes = base64.b64decode(data_url.split(",", 1)[1])
        with open(path, "wb") as f:
            f.write(img_bytes)
        p(f"  SAVED: {filename_for(plant)} ({len(img_bytes)//1024}KB)")
        return "ok"
    else:
        p(f"  FAIL: bad data_url")
        return "fail"


def print_status():
    """Show what's generated vs missing."""
    p("\n=== STICKER STATUS ===")
    by_id = {}
    for pl in PLANTS:
        sid = pl["sticker_id"]
        if sid not in by_id:
            by_id[sid] = {"total": 0, "done": 0}
        by_id[sid]["total"] += 1
        if os.path.exists(out_path_for(pl)):
            by_id[sid]["done"] += 1
    total = sum(v["total"] for v in by_id.values())
    done = sum(v["done"] for v in by_id.values())
    for sid, counts in sorted(by_id.items()):
        bar = "█" * counts["done"] + "░" * (counts["total"] - counts["done"])
        p(f"  {sid:<22} {bar} {counts['done']}/{counts['total']}")
    p(f"\n  Total: {done}/{total} generated\n")


def main():
    dry_run = "--dry-run" in sys.argv
    limit = None
    for arg in sys.argv[1:]:
        if arg.startswith("--limit="):
            limit = int(arg.split("=")[1])

    p(f"Garden Mapper Sticker Generator")
    p(f"Output: {OUT_BASE}")
    if dry_run: p("Mode: DRY RUN")
    if limit: p(f"Limit: {limit} plants")

    print_status()

    results = {"ok": 0, "skip": 0, "fail": 0, "abort": 0, "dry": 0, "rate_limited": 0}
    generated = 0

    for i, plant in enumerate(PLANTS):
        if limit and generated >= limit:
            break

        p(f"[{i+1}/{len(PLANTS)}] {plant['name']} ({plant['sticker_id']})")
        result = generate_plant(plant, dry_run=dry_run)
        results[result] = results.get(result, 0) + 1

        if result == "ok":
            generated += 1
        if result == "abort":
            p("  Brave Debug not available — stopping.")
            break
        if result == "rate_limited":
            p("  Rate limited — stopping this run. Will retry next cron cycle.")
            break

        if result == "ok":
            time.sleep(5)  # breathing room between generations

    p("\n=== RESULTS ===")
    for k, v in results.items():
        if v: p(f"  {k}: {v}")

    print_status()


if __name__ == "__main__":
    main()
