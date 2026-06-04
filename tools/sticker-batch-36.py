"""
Garden Mapper — Item #36 Batch
20 new flowers + 8 new vegetables from FLOWER-ANALYSIS-36.md
Rob's specific: Catnip, Raspberry, Poppy
Missing bulbs: Crocus, Lily, Grape Hyacinth
Top 14 filtered flowers + 8 veg

All use PLANTS or ROOT_VEG prompt templates (Rob's wording — do not modify).
Output: stickers/generated/plants/processed/
        stickers/generated/rootveg/processed/  (root veg)
"""

import json, base64, time, os, sys, subprocess
import urllib.request
import websocket

WORKSPACE          = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
OUT_RAW            = os.path.join(WORKSPACE, "stickers", "generated", "plants")
OUT_CLEAN          = os.path.join(WORKSPACE, "stickers", "generated", "plants", "processed")
RV_RAW             = os.path.join(WORKSPACE, "stickers", "generated", "rootveg")
RV_CLEAN           = os.path.join(WORKSPACE, "stickers", "generated", "rootveg", "processed")
PIPELINE           = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON             = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
INTER_PROMPT_DELAY = 45
IMAGE_WAIT_TIMEOUT = 240

for d in [OUT_RAW, OUT_CLEAN, RV_RAW, RV_CLEAN]:
    os.makedirs(d, exist_ok=True)

# ── Prompt templates (Rob's wording — do not modify) ───────────────────────────
PLANT_PREFIX = (
    "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
    "No shadows. No background showing in the center of the plant. Centered, 75% "
    "canvas fill. Vibrant and iconic."
)

ROOT_VEG_PREFIX = (
    "Side aerial view. Art style: Plants vs. Zombies meets watercolor painting — "
    "tasteful simplified representation of this plant with crisp edges, focusing on "
    "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
    "Line texturing. No shadows. No background showing in the center of the plant. "
    "Centered, 75% canvas fill. Vibrant and iconic."
)

def build_plant_prompt(name, plant_type, size_px, colours, shape):
    return (
        f"{PLANT_PREFIX}\n\n"
        f"Subject: {name}, {plant_type}.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: {shape} Only a few leaves and flowers, small plant. Correct proportions."
    )

def build_rootveg_prompt(name, plant_type, size_px, colours, shape):
    return (
        f"{ROOT_VEG_PREFIX}\n\n"
        f"Subject: {name}, {plant_type}.\n"
        f"Canvas: {size_px}px square.\n"
        f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
        f"Shape: {shape} Natural proportions."
    )

# ── Plant catalog ──────────────────────────────────────────────────────────────
PLANTS = [
    # ── Rob's specific picks ──
    {"id": "herb-small_catnip_S_CA-US-FR-GB-AU",             "name": "Catnip",            "type": "low mounding perennial herb",       "size": 160, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "soft lavender-blue #A8B8E8, pale silver-green #C8D8C0, mid-green #4A7C2F, warm grey #A09080, dark outline #1A1A2E",
     "shape": "Low mounding bushy herb with small oval grey-green leaves and upright spikes of tiny lavender-blue flowers, stems at bottom and florals at top."},
    {"id": "shrub-flowering_raspberry_M_CA-US-FR-GB-AU",      "name": "Raspberry",         "type": "fruiting cane shrub",               "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid red #D42B2B, deep red #8B1A1A, bright green leaves #5AB83A, mid-green #4A7C2F, warm brown canes #8B5A2A",
     "shape": "Upright arching cane shrub with clusters of bright red raspberry fruit nestled among serrated compound leaves, stems at bottom and fruiting canes at top."},
    {"id": "flower-daisy_poppy_M_CA-US-FR-GB-AU",             "name": "Poppy",             "type": "annual and perennial flower",       "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid orange-red #E84A1A, deep scarlet #C41A0A, black centre #0A0A0A, mid-green #4A7C2F, pale green stem #8FBF6A",
     "shape": "Upright slender stem with large crinkled crepe-paper thin petals in vivid red-orange surrounding a dark seed capsule centre, stems at bottom and bloom at top."},
    # ── Missing bulbs ──
    {"id": "bulb-spring_crocus_XS_CA-US-FR-GB-AU",            "name": "Crocus",            "type": "early spring corm bulb",           "size": 96,  "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep purple #5B1AA7, pale lilac #C4A8E0, golden yellow #FFD700, mid-green strap #4A7C2F, white #FFFFFF",
     "shape": "Tiny upright chalice-shaped blooms in purple and white with golden stamens, narrow strap leaves at base, stems at bottom and blooms at top."},
    {"id": "flower-spike_lily_L_CA-US-FR-GB-AU",              "name": "Oriental Lily",     "type": "tall bulb perennial",              "size": 384, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "pure white #FFFFFF, deep pink #E8407A, golden stamens #FFD700, mid-green #4A7C2F, dark outline #1A0A0A",
     "shape": "Tall upright stems with large open trumpet-shaped blooms of recurved white petals spotted with pink, prominent golden stamens, broad strap leaves, stems at bottom and blooms at top."},
    {"id": "bulb-spring_muscari_XS_CA-US-FR-GB-AU",           "name": "Grape Hyacinth",   "type": "spring bulb",                      "size": 96,  "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep cobalt blue #1A3EA7, vivid blue #3E7AB8, pale blue-white #C8D8F0, mid-green strap #4A7C2F, dark outline #0A0A2E",
     "shape": "Dense upright spike of tiny round cobalt-blue grape-like florets tightly packed from tip to base, narrow strap leaves at base, stems at bottom and spike at top."},
    # ── Top new flowers ──
    {"id": "flower-spike_bleeding-heart_M_CA-US-FR-GB",       "name": "Bleeding Heart",   "type": "shade perennial",                  "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep pink #E8407A, pale blush inner #F5C8D8, white tip #FFFFFF, mid-green #4A7C2F, warm brown stems #8B5A2A",
     "shape": "Graceful arching stems with dangling heart-shaped deep pink locket flowers in a row, delicate ferny blue-green foliage below, stems at bottom and arching bloom row at top."},
    {"id": "flower-daisy_columbine_M_CA-US-FR-GB-AU",         "name": "Columbine",        "type": "perennial wildflower",             "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep violet-blue #3E3AA7, pale cream #FFF5E0, golden centre #FFD700, mid-green #4A7C2F, dark outline #1A0A2E",
     "shape": "Upright stems with distinctive five-petalled star-shaped flowers with long backward spurs in violet and cream, delicate lobed foliage below, stems at bottom and blooms at top."},
    {"id": "flower-daisy_primrose_S_CA-US-FR-GB-AU",          "name": "Primrose",         "type": "compact spring perennial",         "size": 160, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid yellow #FFD700, soft pink #F5AACB, pale cream #FFF5E0, mid-green #4A7C2F, dark outline #1A0A0A",
     "shape": "Low rosette of broad crinkled leaves with cheerful flat five-petalled primrose flowers in yellow and pink clustered at centre, stems at bottom and blooms at top."},
    {"id": "flower-rose_ranunculus_S_CA-US-FR-GB-AU",         "name": "Ranunculus",       "type": "tender bulb annual",               "size": 160, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid coral-orange #E8703A, deep rose #D42B6A, pale blush #F5C8D8, mid-green #4A7C2F, dark outline #1A0A0A",
     "shape": "Compact plant with large densely layered pompom-like blooms of many papery petals in vivid coral and rose, stems at bottom and blooms at top."},
    {"id": "flower-daisy_anemone_S_CA-US-FR-GB-AU",           "name": "Anemone",          "type": "spring bulb perennial",            "size": 160, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep crimson #C41230, vivid blue #3E7AB8, pure white #FFFFFF, dark button centre #0A0A0A, mid-green #4A7C2F",
     "shape": "Upright stems with flat open poppy-like flowers of vivid petals surrounding a bold dark button centre, deeply divided green leaves, stems at bottom and blooms at top."},
    {"id": "flower-daisy_dianthus_S_CA-US-FR-GB-AU",          "name": "Dianthus",         "type": "compact perennial",                "size": 160, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid pink #E8407A, deep crimson #C41230, pure white #FFFFFF, mid-green strap #4A7C2F, dark outline #1A0A0A",
     "shape": "Compact mound of narrow grass-like blue-green leaves topped with fringed carnation-like blooms in vivid pink and red, stems at bottom and florals at top."},
    {"id": "flower-spike_fuchsia_M_CA-US-FR-GB-AU",           "name": "Fuchsia",          "type": "tender trailing shrub",            "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep magenta #C41270, vivid purple #5B1AA7, pale pink sepals #F5AACB, mid-green #4A7C2F, dark outline #1A0A2E",
     "shape": "Trailing pendulous stems with hanging two-tone lantern-shaped flowers of magenta petticoat and purple sepals, oval leaves, stems at bottom and hanging blooms at top."},
    {"id": "flower-spike_astilbe_M_CA-US-FR-GB-AU",           "name": "Astilbe",          "type": "shade perennial",                  "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep rose-pink #D42B6A, pale pink #F5AACB, white #FFFFFF, deep green #2A5C1A, dark outline #1A0A0A",
     "shape": "Upright feathery plume-like flower spikes in rose-pink or white above finely divided dark green ferny foliage, stems at bottom and plumes at top."},
    {"id": "ground-cover_heuchera_S_CA-US-FR-GB-AU",          "name": "Heuchera",         "type": "evergreen foliage perennial",      "size": 160, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep burgundy-purple #5A1A3A, coral-red #E84A3A, silver #C8C8C8, mid-green #4A7C2F, dark outline #1A0A1A",
     "shape": "Low mound of bold lobed leaves in rich burgundy and bronze with slender wiry stems topped with tiny coral-red bell flowers, stems at bottom and leaves and florals at top."},
    {"id": "flower-cluster_verbena_S_CA-US-FR-GB-AU",         "name": "Verbena",          "type": "trailing annual",                  "size": 160, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid purple #5B1AA7, hot pink #E8407A, pale lavender #C4A8E0, mid-green #4A7C2F, dark outline #1A0A2E",
     "shape": "Low spreading plant with dense flat-topped domed clusters of tiny five-petalled flowers in vivid purple and pink, stems at bottom and florals at top."},
    {"id": "flower-cluster_agapanthus_L_CA-US-FR-GB-AU",      "name": "Agapanthus",       "type": "perennial bulb",                   "size": 384, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid blue #3E7AB8, pale blue #8AAAD8, white #FFFFFF, mid-green strap #4A7C2F, dark outline #0A1A2E",
     "shape": "Tall upright stems topped with large globe-shaped clusters of vivid blue or white trumpet-shaped florets, broad strap leaves at base, stems at bottom and globe at top."},
    {"id": "flower-spike_liatris_M_CA-US-FR-GB-AU",           "name": "Liatris",          "type": "prairie perennial",                "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid purple #7B1AA7, mid-purple #A840D8, pale lilac #C4A8E0, mid-green #4A7C2F, dark outline #1A0A2E",
     "shape": "Tall upright single stem densely packed with fluffy button-like vivid purple florets from top downward, narrow strap leaves, stem at bottom and spike at top."},
    {"id": "flower-spike_hollyhock_XL_CA-US-FR-GB-AU",        "name": "Hollyhock",        "type": "tall biennial cottage flower",     "size": 512, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep magenta #C41270, pale pink #F5AACB, vivid red #D42B2B, mid-green #4A7C2F, dark outline #1A0A0A",
     "shape": "Very tall upright spike with large flat disc-shaped blooms stacked all the way up the stem in deep pink and magenta, broad round leaves at base, stem at bottom and blooms at top."},
    # ── New vegetables ──
    {"id": "vegetable-leafy_cauliflower_M_CA-US-FR-GB-AU",    "name": "Cauliflower",      "type": "compact brassica annual",          "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "creamy white #F5F0E0, pale ivory #FFFAED, blue-green leaves #3A6A5A, grey-green #7A9A8A, dark outline #0A1A10",
     "shape": "Compact plant with a dense ivory-white rounded curd head nestled among broad blue-green leaves, stems at bottom and curd head at top."},
    {"id": "vegetable-tall_asparagus_L_CA-US-FR-GB-AU",       "name": "Asparagus",        "type": "perennial vegetable",              "size": 384, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "bright green #5AB83A, deep green #2A5C1A, pale green #8FBF6A, feathery fronds #A8D870, dark outline #0A1A0A",
     "shape": "Tall upright spear tips emerging from feathery cloud-like asparagus fern fronds, stems at bottom and feathery fronds at top."},
    {"id": "vine-leaf_peas_M_CA-US-FR-GB-AU",                 "name": "Peas",             "type": "climbing annual vegetable",        "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "mid-green #4A7C2F, bright green pods #5AB83A, pale green #8FBF6A, white flower #F5F0E8, dark outline #0A1A0A",
     "shape": "Delicate climbing tendrils with pinnate leaves, white pea flowers and plump rounded bright green pea pods, stems at bottom and climbing tendrils at top."},
    {"id": "vegetable-leafy_pumpkin_L_CA-US-FR-GB-AU",        "name": "Pumpkin",          "type": "sprawling annual vegetable",       "size": 384, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid orange #FF6B1A, deep orange #CC4A00, mid-green #4A7C2F, pale green #8FBF6A, golden yellow flower #FFD700",
     "shape": "Large sprawling plant with broad lobed leaves and vivid orange round pumpkins sitting on the ground with golden trumpet flowers, stems at bottom and fruit and leaves spreading out."},
    {"id": "vegetable-leafy_squash_M_CA-US-FR-GB-AU",         "name": "Squash",           "type": "sprawling annual vegetable",       "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "golden yellow #FFD700, pale yellow #FFF0A0, mid-green #4A7C2F, deep green #2A5C1A, dark outline #1A0A0A",
     "shape": "Spreading plant with large lobed leaves and elongated golden-yellow summer squash fruit lying at base, stems at bottom and leaves spreading at top."},
    {"id": "vegetable-leafy_swiss-chard_M_CA-US-FR-GB-AU",    "name": "Swiss Chard",      "type": "upright leafy biennial vegetable", "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "vivid red stems #D42B2B, golden yellow stems #FFD700, deep green #2A5C1A, mid-green #4A7C2F, bright green #5AB83A",
     "shape": "Upright rosette of large glossy dark green leaves on vivid red and yellow thick ribbed stems, stems at bottom and leafy florals at top."},
    {"id": "vegetable-leafy_sweet-potato_M_CA-US-FR-GB-AU",   "name": "Sweet Potato",     "type": "trailing annual vegetable",        "size": 256, "raw_dir": OUT_RAW, "clean_dir": OUT_CLEAN, "prompt_type": "plant",
     "colours": "deep orange-purple #C84A70, pale purple #C8A8D8, bright green #5AB83A, mid-green #4A7C2F, warm brown #8B5A2A",
     "shape": "Trailing spreading vine with heart-shaped bright green leaves and purple-orange sweet potato roots visible at base, stems at bottom and trailing leaves at top."},
    # ── Root vegetables ──
    {"id": "vegetable-root_onion_S_CA-US-FR-GB-AU",           "name": "Onion",            "type": "bulb vegetable",                   "size": 160, "raw_dir": RV_RAW,  "clean_dir": RV_CLEAN,  "prompt_type": "rootveg",
     "colours": "papery golden-brown #C8A050, pale white #F5F0E8, bright green strap tops #4A8C3A, mid-green #2A6010, dark outline #1A0A0A",
     "shape": "Onion bulb and strap tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Round papery golden-brown onion shoulder visible above the soil, root at bottom and strap-leaf tops."},
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
    try:
        tab = get_gemini_tab()
        ws_url = tab.get("webSocketDebuggerUrl")
    except RuntimeError as e:
        raise e
    cdp_eval(ws_url, 'window.location.href="https://gemini.google.com/app"', timeout=8)
    time.sleep(10)
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            tab = get_gemini_tab()
            ws_url = tab.get("webSocketDebuggerUrl")
            break
        except Exception:
            pass
        time.sleep(2)
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            ready = cdp_eval(ws_url, 'document.querySelector("[contenteditable=true]")!==null', timeout=5)
            if ready:
                break
        except Exception:
            pass
        time.sleep(2)
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
    raw_path   = os.path.join(plant["raw_dir"], f"{plant['id']}_raw.png")
    clean_path = os.path.join(plant["clean_dir"], f"{plant['id']}.png")

    if os.path.exists(clean_path):
        p(f"  SKIP (clean exists)")
        return True

    if plant["prompt_type"] == "rootveg":
        prompt = build_rootveg_prompt(plant["name"], plant["type"], plant["size"], plant["colours"], plant["shape"])
    else:
        prompt = build_plant_prompt(plant["name"], plant["type"], plant["size"], plant["colours"], plant["shape"])

    if not os.path.exists(raw_path):
        try:
            ws_url = navigate_fresh()
        except RuntimeError as e:
            p(f"  ABORT: {e}")
            return False

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
        p(f"  SKIP raw (exists), pipeline only...")

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
    p(f"Garden Mapper -- Item #36 Batch ({len(PLANTS)} stickers)")
    p(f"Pause between prompts: {INTER_PROMPT_DELAY}s")
    p(f"Est. time: ~{len(PLANTS) * (INTER_PROMPT_DELAY + 60) // 60} minutes")
    p("=" * 60)

    try:
        get_gemini_tab()
        p("[OK] Gemini tab found in Brave\n")
    except RuntimeError as e:
        p(f"[ABORT] {e}")
        sys.exit(1)

    already_clean = set()
    for pl in PLANTS:
        if os.path.exists(os.path.join(pl["clean_dir"], f"{pl['id']}.png")):
            already_clean.add(pl["id"])

    remaining = [pl for pl in PLANTS if pl["id"] not in already_clean]
    p(f"Already complete: {len(already_clean)}/{len(PLANTS)}")
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
    if failed:
        p(f"  Failed: {', '.join(failed)}")
    p(f"\n  Plants folder:  {OUT_CLEAN}")
    p(f"  Root veg folder: {RV_CLEAN}")
    p("=" * 60)

if __name__ == "__main__":
    main()
