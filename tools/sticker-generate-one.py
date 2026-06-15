"""
Garden Mapper — Single Plant Sticker Generator
Usage: python sticker-generate-one.py "Plant Name" [--force]

Features:
- Auto-picks correct prompt template (plant/tree/root-veg/pine/deciduous)
- Opens Gemini in Brave if not already open
- Verifies Rob's account (contactsunsetpoetvintage@gmail.com) is logged in
- Generates with chroma-key green bg, removes background, resizes
- Sends Telegram preview to Rob for approval
- On approval: adds to usePlantCatalog.js, commits to git
- --force: regenerate even if sticker already exists

Requirements:
- Brave running with: brave.exe --remote-debugging-port=9222
- websocket-client installed
"""

import json, base64, time, os, sys, subprocess, shutil
import urllib.request
import websocket

# ── Config ─────────────────────────────────────────────────────────────────────
WORKSPACE  = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner"
PIPELINE   = os.path.join(WORKSPACE, "tools", "sticker-pipeline.py")
PYTHON     = r"C:\Users\RG\AppData\Local\Python\bin\python3.exe"
OUT_DIR    = os.path.join(WORKSPACE, "stickers", "generated", "pending")
DEST       = os.path.join(WORKSPACE, "app", "public", "stickers")
CATALOG    = os.path.join(WORKSPACE, "app", "src", "hooks", "usePlantCatalog.js")
GEMINI_URL = "https://gemini.google.com/app"
ROB_ACCOUNT = "contactsunsetpoetvintage"   # substring to match in signed-in account
IMAGE_WAIT  = 240
os.makedirs(OUT_DIR, exist_ok=True)

# ── Prompt templates (Rob's wording — do not modify) ───────────────────────────
TEMPLATES = {
    "plant": (
        "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
        "No shadows. No background showing in the center of the plant. Centered, 75% "
        "canvas fill. Vibrant and iconic."
    ),
    "deciduous": (
        "Side aerial view. Art style: Plants vs. Zombies meets watercolor painting — "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, leafy, Dark outline 2-3px. No shadows. "
        "Centered, 75% canvas fill. Vibrant and iconic."
    ),
    "pine": (
        "Aerial side view. Art style: Plants vs. Zombies meets watercolor painting — "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, no trunk, bold flat icon. Dark outline 2-3px. "
        "No shadows. No background showing in the center of the plant. Centered, 75% "
        "canvas fill. Vibrant and iconic."
    ),
    "rootveg": (
        "Side aerial view. Art style: Plants vs. Zombies meets watercolor painting — "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px. "
        "Line texturing. No shadows. No background showing in the center of the plant. "
        "Centered, 75% canvas fill. Vibrant and iconic."
    ),
}

# ── Plant lookup table ─────────────────────────────────────────────────────────
# Maps common name → (sticker_id_prefix, size_tier, size_px, family, template, colours, shape)
# Add new plants here as needed. Names are lowercase for matching.
PLANT_LOOKUP = {
    # Trees — deciduous
    "maple tree":        ("tree-deciduous_maple",        "XL", 512, "Deciduous Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, bright green #5AB83A, yellow-green #A8D848, warm brown limbs #6B3A2A", "Natural leafy canopy with distinctive lobed maple leaf silhouette."),
    "oak tree":          ("tree-deciduous_oak",          "XL", 512, "Deciduous Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, olive green #6B7A3A, warm brown limbs #6B3A2A, dark outline #0A1A0A", "Natural broad leafy canopy."),
    "weeping willow":    ("tree-deciduous_weeping-willow","XL",512, "Deciduous Tree", "deciduous", "yellow-green #A8C840, mid-green #4A8C3A, pale lime #C8E870, warm brown limbs #7A5C2A", "Natural cascading pendulous canopy."),
    # Trees — conifer
    "pine tree":         ("tree-conifer_pine",           "XL", 512, "Conifer Tree",   "pine",      "deep forest green #1A5C2A, mid-green #2E7A3A, blue-green #4A8C6A, dark outline #0A2A10, pale silver-green #8AAF8A", "Correct proportions."),
    "blue spruce":       ("tree-conifer_blue-spruce",    "XL", 512, "Conifer Tree",   "pine",      "steel blue-green #5A8AA0, mid blue-grey #7A9AAA, silver-green #8AAFA8, dark outline #0A2030, pale silver #C0D8D8", "Correct proportions."),
    # Herbs
    "basil":             ("herb-small_basil",            "S",  160, "Herb",           "plant",     "bright mid-green #5A9E3A, deep green #2A5A1A, pale lime #A8D878, warm brown stems #7A5C3A", "Bushy compact herb with large glossy rounded leaves, stems at bottom and leafy florals at top."),
    "mint":              ("herb-small_mint",             "S",  160, "Herb",           "plant",     "bright green #5AB83A, mid-green #4A7C2F, pale lilac #C8A8E8, dark outline #1A2E1A, warm brown stems #7A5C3A", "Spreading mat of oval serrated leaves with tiny pale flower clusters at tips, stems at bottom and leafy florals at top."),
    "lavender":          ("shrub-lavender_lavender",     "M",  256, "Herb / Perennial","plant",    "purple #7B5EA7, silver-grey foliage #8FAF82, pale lavender #C4A8E0, dark outline #2D1A4A, warm grey stems #A09070", "Upright silver-grey stems topped with dense purple flower spikes, stems at bottom and leafy florals at top."),
    "fountain":          ("water-feature_fountain",     "L",  384, "Water Feature",  "plant",     "cool grey stone #8A9A9A, pale marble white #F0EEE8, water blue #5A9AC8, dark outline #1A2A3A", "Aerial top-down view of circular garden water fountain, no tier, decorative cement edging around the basin rim, central spout, water ripples radiating outward. No birds. No plants. No aquatic plants. Correct proportions."),
    "fountain-v2":       ("water-feature_fountain_v2",   "L",  384, "Water Feature",  "plant",     "cool grey stone #8A9A9A, pale marble white #F0EEE8, water blue #5A9AC8, pale aqua foam #A8D8F0, dark outline #1A2A3A", "Purely architectural. Stone basin only. Water only. Nothing living. Correct proportions."),
    "fern":              ("plant-fern_fern",             "L",  384, "Fern / Groundcover","plant",    "deep forest green #1A5C2A, mid-green #3A8A3A, bright green #5AB83A, yellow-green frond tips #A8D848, dark outline #0A1A0A", "Low spreading rosette of large arching pinnate fronds radiating outward, each frond deeply divided into paired leaflets, stems at centre and fronds arching outward and upward."),
    "phlox":             ("flower-cluster_phlox",       "M",  256, "Perennial Flower","plant",     "vivid purple #7B35C8, deep violet #5A1A9A, mid lavender #A06AE0, pale lilac centre #DCC8F0, bright green #4A7C2F, dark outline #1A0A2A", "Compact rounded mound of bright green leaves completely covered in dense flat five-petalled flowers in vivid purple and violet, stems at bottom and flowers covering top."),
    "thyme":             ("herb-small_thyme",           "S",  160, "Herb",           "plant",     "silver-grey green #8FAF82, warm grey-green #7A9A6A, tiny pale lilac flowers #C8A8E0, dark olive stems #3D5A1A, warm brown woody base #7A5C3A", "Low creeping woody sub-shrub with dense tiny oval grey-green leaves covering wiry stems, tiny pale purple flower clusters at tips, stems at bottom and leafy florals at top."),
    "rosemary":          ("herb-small_rosemary",         "M",  256, "Herb",           "plant",     "silver-grey green #8FAF82, dark olive #3D5A1A, pale blue flower #A8C8E8, warm grey #A09070, brown stems #7A5C3A", "Upright woody sub-shrub with dense narrow needle-like silver-green leaves and tiny blue flowers, stems at bottom and leafy florals at top."),
    # Root veg
    "carrot":            ("vegetable-root_carrot",       "S",  160, "Root Vegetable", "rootveg",   "bright orange #FF6B1A, deep orange #CC4A00, bright green tops #4AAF2F, mid-green #2A7010, pale green stem #8FBF6A", "Carrot and tops peeking from a plant wide soil line. Only show the top above the minimal soil line. Bold orange carrot shoulders visible, root at bottom and leafy tops."),
    "beet":              ("vegetable-root_beet",         "S",  160, "Root Vegetable", "rootveg",   "deep burgundy-red #8B1A2A, dark magenta #6B0A1A, bright green tops #4AAF2F, red-veined leaves #A83A2A", "Beet and tops peeking from a plant wide soil line. Only show the top above the minimal soil line. Round dark red beet shoulders visible, root at bottom and leafy red-veined tops."),
    "onion":             ("vegetable-root_onion",        "S",  160, "Root Vegetable", "rootveg",   "papery golden-brown #C8A050, pale white #F5F0E8, bright green strap tops #4A8C3A, mid-green #2A6010, dark outline #1A0A0A", "Onion bulb and strap tops only. No soil, no ground, no dirt, no roots. Round papery golden-brown onion bulb floating cleanly, strap-leaf tops above."),
    "garlic":            ("vegetable-root_garlic",       "S",  160, "Root Vegetable", "rootveg",   "papery white #F5F0E8, pale purple tinge #C8B8D8, bright green strap #4AAF2F, mid-green #2A7010, warm tan #C8A870", "Garlic bulb and strap tops only. No soil, no ground, no dirt, no roots. Papery white garlic bulb floating cleanly, strap-leaf tops above."),
    # Flowers
    "rose":              ("flower-rose_rose",            "M",  256, "Shrub / Rose",   "plant",     "deep red #C41230, pale pink #F5B8C8, mid-green #4A7C2F, dark outline #1A0A0A, warm brown thorny stems #7A4A2A", "Upright thorny stems with large full multi-petalled rose blooms and glossy green leaves, stems at bottom and blooms at top."),
    "sunflower":         ("vegetable-tall_sunflower",    "XL", 512, "Annual Flower",  "plant",     "golden yellow #FFD700, deep brown centre #5A2A0A, mid-green #4A7C2F, pale yellow #FFF0A0, dark stem #3A2010", "Tall upright stem with large round brown seed disc surrounded by bold golden-yellow ray petals, broad leaves, stem at bottom and flower at top."),
    "tulip":             ("bulb-spring_tulip",           "S",  160, "Bulb",           "plant",     "vivid red #D42B2B, bright yellow #FFD700, deep pink #E8407A, mid-green strap #4A7C2F, dark outline #1A0A0A", "Upright smooth strap leaves with single elegant cup-shaped bloom at top, stem at bottom and bloom at top."),
    "dahlia":            ("flower-daisy_dahlia",         "M",  256, "Bulb / Annual",  "plant",     "deep magenta #C41270, coral orange #E8703A, vivid yellow #FFD700, mid-green #4A7C2F, dark outline #1A0A0A", "Upright stems with large dramatic multi-layered pompom blooms in rich colours, stems at bottom and blooms at top."),
    "poppy":             ("flower-daisy_poppy",          "M",  256, "Annual Flower",  "plant",     "vivid orange-red #E84A1A, deep scarlet #C41A0A, black centre #0A0A0A, mid-green #4A7C2F, pale green stem #8FBF6A", "Upright slender stem with large crinkled crepe-paper thin petals in vivid red-orange surrounding a dark seed capsule centre, stems at bottom and bloom at top."),
    "hydrangea":         ("flower-cluster_hydrangea",    "L",  384, "Shrub",          "plant",     "cornflower blue #5B8DD9, pale lavender #C4B8E8, soft pink #F0B8C8, mid-green #4A7C2F, dark outline #1A1A2E", "Rounded shrub with massive domed flower heads of densely packed small florets in blue and pink, stems at bottom and florals at top."),

    # ── Cacti ──────────────────────────────────────────────────────────────────────────
    "saguaro cactus":    ("cactus_saguaro",              "XL", 512, "Cactus", "plant", "pale green #8ABF6A, mid green #5A8A3A, deep green #2A5A1A, warm tan ribs #C8A870, dark outline #1A2A0A", "Tall iconic columnar cactus with 2-3 upward-curving arms, vertical ribbing, clusters of spines. Bold silhouette."),
    "barrel cactus":     ("cactus_barrel",               "M",  256, "Cactus", "plant", "mid green #5A8A3A, yellow-green #8ABF4A, pale tan ribs #D4B870, golden spines #D4A020, dark outline #1A2A0A", "Squat barrel-shaped cactus, prominent vertical ribs with hooked golden spines, slightly top-heavy. Bold silhouette."),
    "prickly pear cactus":("cactus_prickly-pear",        "L",  384, "Cactus", "plant", "blue-green #4A8A6A, mid green #3A6A4A, pale green pads #7ABF8A, golden spines #D4A020, dark outline #0A1A0A", "Flat oval pads stacked in branching clusters, each pad studded with spines, occasional bright fruit accents."),
    "golden barrel cactus":("cactus_golden-barrel",      "M",  256, "Cactus", "plant", "bright yellow-green #C8D820, mid green #7A9A2A, golden ribs #D4A020, amber spines #C87820, dark outline #1A1A0A", "Nearly spherical golden barrel cactus, tight vertical ribs, dense amber-golden spines covering surface."),
    "organ pipe cactus": ("cactus_organ-pipe",           "XL", 512, "Cactus", "plant", "mid green #5A8A3A, deep green #2A5A1A, grey-green stems #7A9A6A, pale spines #C8C8A8, dark outline #0A1A0A", "Multiple tall narrow vertical columns rising from a shared base like organ pipes, ribbed surface, no arms."),
    "cholla cactus":     ("cactus_cholla",               "L",  384, "Cactus", "plant", "yellow-green #9ABF3A, mid green #5A8A2A, pale tan joints #D4C870, silver spines #D0D0C0, dark outline #1A2A0A", "Branching cylindrical segmented stems with dense barbed silver spines giving a fuzzy appearance."),
    "fishhook cactus":   ("cactus_fishhook",             "S",  160, "Cactus", "plant", "mid green #5A8A3A, blue-green #4A7A5A, red hooked spines #C84A2A, pale spine tips #F0D0A0, dark outline #0A1A0A", "Small barrel-shaped cactus with distinctive hooked red central spines radiating from each areole."),
    "christmas cactus":  ("cactus_christmas",            "M",  256, "Cactus", "plant", "deep green #2A6A3A, mid green #4A8A5A, vivid pink-red flowers #E84A6A, pale pink #F5A0B8, dark outline #0A1A0A", "Flat segmented drooping stems with serrated edges, pendant tubular pink-red flowers at tips."),
    "hedgehog cactus":   ("cactus_hedgehog",             "S",  160, "Cactus", "plant", "mid green #5A8A3A, blue-green #4A7A5A, vivid magenta flowers #D42878, pale spine #D0D0C0, dark outline #0A1A0A", "Cluster of short cylindrical ribbed columns covered in white spines, vivid magenta flowers at crown."),
    "bunny ears cactus": ("cactus_bunny-ears",           "M",  256, "Cactus", "plant", "pale blue-green #7ABFA0, mid green #4A8A6A, cream glochid dots #F0E8C0, yellow flowers #FFD700, dark outline #0A1A0A", "Two large oval flat pads side by side like bunny ears on a small base pad, dense cream glochid dots covering surface."),
    "old man cactus":    ("cactus_old-man",              "M",  256, "Cactus", "plant", "mid green #5A8A3A, deep green #2A5A1A, white fluffy hair #F0F0F0, pale grey #D0D0D0, dark outline #0A1A0A", "Tall columnar cactus completely covered in long white woolly hair obscuring the ribs beneath."),
    "moon cactus":       ("cactus_moon",                 "S",  160, "Cactus", "plant", "vivid orange #FF6B1A, hot pink #E8407A, bright yellow #FFD700, deep green base #2A6A3A, dark outline #1A0A0A", "Small brightly coloured grafted ball cactus (orange, pink or yellow) sitting atop a green columnar base cactus."),
    "totem pole cactus": ("cactus_totem-pole",           "XL", 512, "Cactus", "plant", "pale blue-green #8ABFB0, mid green #5A9A8A, smooth skin #A8D4C8, very pale spines #E0E8E0, dark outline #0A1A18", "Tall smooth columnar cactus with irregular lumpy skin and no visible spines, like a sculptural totem."),
    "star cactus":       ("cactus_star",                 "S",  160, "Cactus", "plant", "mid green #5A8A3A, blue-green #4A7A6A, white star stripes #F0F0E0, yellow flower #FFD700, dark outline #0A1A0A", "Small flat circular cactus with 8 geometric sections creating a star pattern, white markings, small yellow flower at centre."),
    "bishops cap cactus":("cactus_bishops-cap",          "S",  160, "Cactus", "plant", "silver-grey green #8ABFA0, pale grey #C8D8C8, white geometric ribs #F0F0E8, yellow flowers #FFD700, dark outline #0A1A0A", "Geometric star-shaped cactus with 5 prominent ribs covered in silver-white scales, small yellow flower at top."),

    # ── Succulents ──────────────────────────────────────────────────────────────────────
    "aloe vera":         ("succulent_aloe-vera",         "M",  256, "Succulent", "plant", "grey-green #7A9A6A, pale green #A8C890, silvery spots #C8D8B8, orange flower spike #E87820, dark outline #0A1A0A", "Rosette of thick fleshy upward-arching lance-shaped leaves with serrated edges and pale spots, spreading from centre."),
    "echeveria":         ("succulent_echeveria",         "S",  160, "Succulent", "plant", "pale blue-green #8ABFB0, rose-pink edges #E87890, silver-green #B8D4C8, pale lavender #C8B8E0, dark outline #0A1A18", "Perfect tight rosette of plump fleshy pointed leaves graduating from pale centre to coloured tips, seen from above."),
    "jade plant":        ("succulent_jade-plant",        "M",  256, "Succulent", "plant", "deep green #2A6A3A, mid green #4A8A5A, glossy bright green #6AAF6A, red leaf edges #C84A2A, dark outline #0A1A0A", "Thick woody branching stems with pairs of plump oval glossy leaves, bonsai-like compact tree form."),
    "haworthia":         ("succulent_haworthia",         "S",  160, "Succulent", "plant", "deep green #2A5A3A, mid green #4A7A5A, white pearl stripes #F0F0E8, translucent windows #C8E8D0, dark outline #0A1A0A", "Compact rosette of dark green triangular leaves with distinctive white pearl-like stripe markings on the surface."),
    "sedum succulent":   ("succulent_sedum-succulent",   "S",  160, "Succulent", "plant", "blue-grey #7A9AAA, pale blue-green #9ABFB8, rose-pink #E87890, dusty purple #9A7AAA, dark outline #0A1818", "Low spreading mat of plump teardrop-shaped leaves in blue-grey with rosy tips, clustered stems."),
    "agave":             ("succulent_agave",             "L",  384, "Succulent", "plant", "blue-grey green #6A8A7A, pale silver-green #A8C4B8, sharp dark tip #1A2A1A, pale yellow margin #D4C870, dark outline #0A1A10", "Bold architectural rosette of thick rigid sword-shaped leaves with sharp terminal spine, spreading wide from centre."),
    "string of pearls":  ("succulent_string-of-pearls",  "S",  160, "Succulent", "plant", "bright green #5AB83A, mid green #3A8A2A, pale green pearls #8ABF6A, white flowers #F0F0E8, dark outline #0A1A0A", "Trailing stems hung with round bead-like leaves like a string of green pearls, cascading downward."),
    "hens and chicks":   ("succulent_hens-and-chicks",   "S",  160, "Succulent", "plant", "grey-green #7A9A7A, rose-purple edges #C87890, pale silver #C8D4C8, deep burgundy centre #5A1A2A, dark outline #0A1A0A", "Large central rosette (the hen) surrounded by multiple small offset rosettes (the chicks), seen from above."),
    "lithops":           ("succulent_lithops",           "S",  160, "Succulent", "plant", "warm tan #C8A870, grey-green #8A9A7A, terracotta #C87850, pale window top #D8C8A8, dark outline #1A0A0A", "Pair of plump pebble-like leaf bodies split down the middle, patterned tops resembling living stones."),
    "burros tail":       ("succulent_burros-tail",       "S",  160, "Succulent", "plant", "blue-grey green #7A9A8A, pale mint #A8C8B8, silver-green #B8D4C8, dusty rose tips #C89090, dark outline #0A1818", "Dense trailing stem packed with overlapping plump teardrop leaves like a fat braided tail."),

    # ── Tropical & Palms ─────────────────────────────────────────────────────────────────
    "coconut palm":      ("tree-palm_coconut",           "XXL",512, "Palm Tree", "pine", "deep green #2A6A3A, mid green #4A8A5A, bright green fronds #6AAF5A, warm tan trunk #C8A870, dark outline #0A1A0A", "Tall palm with arching feathery pinnate fronds, cluster of green coconuts at crown, no trunk visible."),
    "royal palm":        ("tree-palm_royal",             "XXL",512, "Palm Tree", "pine", "deep green #2A6A3A, bright green #5AB83A, silver-grey crown shaft #A8B8B8, pale grey trunk band #D0D8D0, dark outline #0A1A0A", "Stately palm with dense upright feathery fronds in a symmetrical crown, distinctive pale silver crown shaft."),
    "washingtonia palm": ("tree-palm_washingtonia",      "XXL",512, "Palm Tree", "pine", "mid green #4A8A5A, deep green #2A6A3A, pale fan fronds #7ABF8A, dry brown skirt #8A6A3A, dark outline #0A1A0A", "Fan palm with large palmate fronds radiating outward, dead brown frond skirt hanging below the crown."),
    "date palm":         ("tree-palm_date",              "XXL",512, "Palm Tree", "pine", "deep green #2A6A3A, mid green #4A8A5A, arching fronds #6AAF5A, golden-orange dates #D4901A, dark outline #0A1A0A", "Arching feathery pinnate fronds with hanging clusters of golden-orange dates near the crown base."),
    "bismarck palm":     ("tree-palm_bismarck",          "XXL",512, "Palm Tree", "pine", "striking silver-blue #7A9AB8, pale blue-grey #A8B8C8, steel blue fronds #5A7A9A, white wax bloom #E0E8F0, dark outline #0A0A1A", "Spectacular fan palm with large palmate silver-blue waxy fronds radiating symmetrically, iconic colour."),
    "travellers palm":   ("tree-palm_travellers",        "XXL",512, "Palm Tree", "pine", "deep green #2A6A3A, bright green #5AB83A, vivid green fans #6AAF5A, white base sheaths #F0F0E8, dark outline #0A1A0A", "Dramatic fan of huge banana-like leaves fanned out in a single flat plane like an open hand or peacock tail."),
    "banana tree":       ("tree-tropical_banana",        "XL", 512, "Tropical",  "deciduous", "deep green #2A6A3A, bright green #5AB83A, yellow-green #A8D848, yellow bananas #FFD700, dark outline #0A1A0A", "Large broad paddle-shaped leaves spreading from central trunk, hanging cluster of yellow bananas."),
    "bird of paradise tree":("tree-tropical_bird-of-paradise","XL",512,"Tropical","plant", "deep green #2A6A3A, mid green #4A8A5A, vivid orange #FF6B1A, electric blue #1A6AD4, dark outline #0A1A0A", "Bold upright strap leaves fanning from base, exotic orange and blue bird-like flowers on tall stems."),
    "bougainvillea":     ("tree-tropical_bougainvillea", "XL", 512, "Tropical",  "plant", "vivid magenta #E8208A, deep pink #C41270, bright coral #E8603A, mid green #4A8A5A, dark outline #1A0A2A", "Sprawling shrubby plant covered in masses of vivid magenta paper-thin bracts, small white true flowers at centre."),
    "jacaranda tree":    ("tree-tropical_jacaranda",     "XXL",512, "Tropical",  "deciduous", "vivid purple #7B35C8, mid purple #A840D8, pale lavender #C4A8E0, mid green #4A8A5A, dark outline #1A0A2A", "Spreading canopy entirely covered in vivid purple-blue trumpet flowers, delicate ferny foliage visible beneath."),
    "plumeria":          ("tree-tropical_plumeria",      "M",  256, "Tropical",  "plant", "pure white #F8F8F0, creamy yellow centre #FFE870, pale pink #F5C8D8, vivid pink #E8607A, deep green #2A6A3A, dark outline #0A1A0A", "Clusters of five-petalled waxy tropical flowers in white with yellow centre, thick succulent branches, glossy leaves."),

    # ── Perennials ──────────────────────────────────────────────────────────────────────
    "feverfew":          ("flower-daisy_feverfew",       "S",  160, "Perennial", "plant", "bright white petals #F8F8F0, vivid yellow centre #FFD700, mid green #4A8A5A, pale green #8ABF6A, dark outline #0A1A0A", "Compact bushy plant with masses of small white daisy-like flowers with bright yellow button centres, ferny aromatic foliage."),
}

def p(*a): print(*a, flush=True)

def slugify(name):
    return name.lower().replace(" ", "-").replace("/", "-")

def lookup_plant(name):
    key = name.lower().strip()
    if key in PLANT_LOOKUP:
        return PLANT_LOOKUP[key]
    # Fuzzy: check if any lookup key is contained in the input
    for k, v in PLANT_LOOKUP.items():
        if k in key or key in k:
            return v
    return None

def get_brave_tab(url_fragment):
    """Get a Brave CDP tab matching url_fragment. Returns None if not found."""
    try:
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
        for t in tabs:
            if url_fragment in t.get("url","") and t.get("type")=="page":
                return t
    except Exception:
        pass
    return None

def open_gemini_in_brave():
    """Open Gemini in Brave if not already open."""
    p("Opening Gemini in Brave...")
    subprocess.Popen([
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        "--remote-debugging-port=9222",
        GEMINI_URL
    ])
    # Wait for tab to appear
    deadline = time.time() + 30
    while time.time() < deadline:
        time.sleep(3)
        if get_brave_tab("gemini.google.com"):
            p("Gemini tab opened.")
            return True
    return False

def ensure_gemini_open():
    """Make sure Gemini is open. Open if needed. Returns tab or raises."""
    tab = get_brave_tab("gemini.google.com")
    if not tab:
        p("Gemini not open — opening now...")
        if not open_gemini_in_brave():
            raise RuntimeError("Could not open Gemini in Brave after 30s")
        tab = get_brave_tab("gemini.google.com")
    return tab

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
    """Check that Rob's account (contactsunsetpoetvintage) is signed in."""
    # Check page source / profile for the account identifier
    account_js = '''(function(){
        // Try to find account email in page text or aria-labels
        var all = document.body.innerText + document.body.innerHTML;
        return all.includes("contactsunsetpoetvintage") ? "ROB" : "OTHER";
    })()'''
    result = cdp(ws_url, account_js, timeout=10)
    return result == "ROB"

def navigate_fresh(ws_url):
    # Click "New chat" in the Gemini sidebar — clears the conversation without page reload.
    # No navigation = no account switch. Account re-verify is skipped after this call.
    p("Clicking New chat...")
    click_js = """(function(){
        var links = Array.from(document.querySelectorAll('a, button'));
        var nc = links.find(function(l){ return l.textContent.trim() === 'New chat'; });
        if (nc) { nc.click(); return 'CLICKED'; }
        return 'NOT_FOUND';
    })()"""
    result = cdp(ws_url, click_js, timeout=8)
    p(f"New chat: {result}")
    time.sleep(2)
    return ws_url

def send_telegram_preview(image_path, plant_name):
    """Send the sticker preview to Rob via Telegram (Garden Mapper topic)."""
    openclaw = r"openclaw"  # use PATH-resolved openclaw CLI
    cmd = [
        openclaw, "message", "send",
        "--channel", "telegram",
        "--target", "-1003881533717",
        "--thread", "3954",
        "--file", image_path,
        "--message", f"Sticker preview: *{plant_name}* — reply OK to add to Garden Mapper, or describe changes."
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            p(f"Telegram preview sent for {plant_name}")
        else:
            p(f"Telegram send warning: {result.stderr[:200]}")
    except Exception as e:
        p(f"Telegram send failed: {e}")

def add_to_catalog(plant_id, label, family, src_path, size_tier):
    """Insert plant entry into usePlantCatalog.js before the closing ]."""
    with open(CATALOG, "r", encoding="utf-8") as f:
        content = f.read()

    filename = os.path.basename(src_path)
    entry = (
        f"  {{ key:'{plant_id}', label:'{label}', family:'{family}', "
        f"src:'/stickers/{filename}', size:'{size_tier}' }},\n"
    )

    # Check if already in catalog
    if plant_id in content:
        p(f"  Already in catalog: {plant_id}")
        return False

    # Insert before the closing ] of PLANT_CATALOG
    insert_marker = "\n  // ── Reference entry"
    if insert_marker in content:
        content = content.replace(insert_marker, f"\n  // ── New additions\n{entry}{insert_marker}")
    else:
        content = content.replace("\n]", f"\n{entry}\n]")

    with open(CATALOG, "w", encoding="utf-8") as f:
        f.write(content)
    p(f"  Added to catalog: {plant_id}")
    return True

def main():
    args = sys.argv[1:]
    force = "--force" in args
    args = [a for a in args if not a.startswith("--")]

    if not args:
        print("Usage: python sticker-generate-one.py \"Plant Name\" [--force]")
        sys.exit(1)

    plant_name = " ".join(args)
    p("=" * 60)
    p(f"Garden Mapper — Single Sticker: {plant_name}")
    p("=" * 60)

    # ── Look up plant data ──────────────────────────────────
    data = lookup_plant(plant_name)
    if not data:
        p(f"ERROR: '{plant_name}' not in PLANT_LOOKUP table.")
        p("Add it to the PLANT_LOOKUP dict in this script first.")
        sys.exit(1)

    sticker_prefix, size_tier, size_px, family, template, colours, shape = data
    regions = "CA-US-FR-GB-AU"
    plant_id = f"{sticker_prefix}_{size_tier}_{regions}"
    filename = f"{plant_id}.png"
    raw_path   = os.path.join(OUT_DIR, plant_id + "_raw.png")
    clean_path = os.path.join(OUT_DIR, plant_id + ".png")
    dest_path  = os.path.join(DEST, filename)

    p(f"Sticker ID:  {plant_id}")
    p(f"Template:    {template} | Size: {size_tier} ({size_px}px)")

    if os.path.exists(dest_path) and not force:
        p(f"Already exists in app. Use --force to regenerate.")
        sys.exit(0)

    # Force: delete existing
    if force:
        for path in [raw_path, clean_path, dest_path]:
            if os.path.exists(path):
                os.remove(path)
                p(f"Deleted: {os.path.basename(path)}")

    # ── Build prompt ─────────────────────────────────────────
    prefix = TEMPLATES[template]
    if template == "deciduous":
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}, No trunk.\n"
            f"Canvas: {size_px}px square.\n"
            f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
            f"Shape: Natural leafy canopy. {shape}"
        )
    elif template == "rootveg":
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}, vegetable.\n"
            f"Canvas: {size_px}px square.\n"
            f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
            f"Shape: {shape} Natural proportions."
        )
    elif template == "pine":
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}, no trunk.\n"
            f"Canvas: {size_px}px square.\n"
            f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
            f"Shape: Correct proportions."
        )
    else:
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}.\n"
            f"Canvas: {size_px}px square.\n"
            f"Colours: {colours}, flat chroma-key green background (#00FF00)\n"
            f"Shape: {shape} Only a few leaves and flowers, small plant. Correct proportions."
        )

    # ── Ensure Gemini is open ────────────────────────────────
    p("\nChecking Gemini tab...")
    tab = ensure_gemini_open()
    ws_url = tab["webSocketDebuggerUrl"]
    time.sleep(3)

    # ── Verify Rob's account (before navigation) ───────────────
    p("Verifying account...")
    if not verify_account(ws_url):
        p("ERROR: Rob's account (contactsunsetpoetvintage@gmail.com) is NOT signed in.")
        p("Please sign in at gemini.google.com and try again.")
        p("Image generation requires Rob's Gemini subscription for quality output.")
        sys.exit(1)
    p("[OK] Rob's account confirmed.")

    # ── Navigate to fresh chat ────────────────────────────────
    p("Navigating to fresh chat...")
    ws_url = navigate_fresh(ws_url)


    img_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>(x.src.startsWith("blob:")||x.src.includes("lh3.googleusercontent"))&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    src_before = cdp(ws_url, img_js) or ""
    p(f"Baseline: {src_before[:60] if src_before else 'none'}")

    # ── Send prompt ──────────────────────────────────────────
    cdp(ws_url, '(function(){var b=document.querySelector("[contenteditable=true]");if(b){b.focus();b.innerHTML="";}return "OK";})()', timeout=8)
    time.sleep(0.5)
    ws2 = websocket.create_connection(ws_url, timeout=10)
    ws2.send(json.dumps({"id":1,"method":"Input.insertText","params":{"text":prompt}}))
    try: ws2.recv()
    except: pass
    ws2.close()
    time.sleep(0.5)
    sent = cdp(ws_url, "(function(){var b=document.querySelector(\"button[aria-label='Send message']\");if(b){b.click();return 'SENT';}return 'NO_BTN';})()", timeout=8)
    p(f"Prompt sent: {sent} | Waiting up to {IMAGE_WAIT}s...")

    # ── Wait for image ───────────────────────────────────────
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
        p("FAIL: no image after 240s"); sys.exit(1)

    # ── Grab image ───────────────────────────────────────────
    # Try blob first (same-origin, always works), then lh3 via browser fetch API (avoids 403)
    blob_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.startsWith("blob:")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
    blob_src = cdp(ws_url, blob_js) or ""
    data_url = ""
    if blob_src:
        grab_js = f'(function(){{var img=document.querySelector(\'img[src="{blob_src}"]\');if(!img)return "NONE";var c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext("2d").drawImage(img,0,0);return c.toDataURL("image/png");}})() '
        data_url = cdp(ws_url, grab_js, timeout=20) or ""

    if not data_url or data_url == "NONE":
        # Fallback: browser fetch API with cookies (works for lh3 since user is signed in)
        p("No blob found - trying browser fetch API for lh3...")
        lh3_js = 'var i=Array.from(document.querySelectorAll("img")).filter(x=>x.src.includes("lh3.googleusercontent")&&x.naturalWidth>100); i.length?i[i.length-1].src:""'
        lh3_url = cdp(ws_url, lh3_js) or ""
        if lh3_url:
            fetch_js = """(async function(){
                var r = await fetch('""" + lh3_url + """', {credentials:'include'});
                var buf = await r.arrayBuffer();
                var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
                return 'data:image/png;base64,' + b64;
            })()"""
            ws2 = websocket.create_connection(ws_url, timeout=35)
            ws2.settimeout(35)
            ws2.send(json.dumps({"id":99,"method":"Runtime.evaluate","params":{"expression":fetch_js,"returnByValue":True,"awaitPromise":True}}))
            deadline2 = time.time() + 35
            while time.time() < deadline2:
                try:
                    d = json.loads(ws2.recv())
                    if d.get("id") == 99:
                        data_url = d.get("result",{}).get("result",{}).get("value","")
                        break
                except: break
            ws2.close()

    if not data_url or data_url in ("", "NONE"):
        p("FAIL: could not grab image from browser"); sys.exit(1)

    if data_url.startswith("data:image"):
        img_bytes = base64.b64decode(data_url.split(",",1)[1])
        with open(raw_path,"wb") as f: f.write(img_bytes)
        p(f"RAW saved: {len(img_bytes)//1024}KB")
    else:
        p(f"FAIL: unexpected data format: {data_url[:80]}"); sys.exit(1)

    # ── Run pipeline ─────────────────────────────────────────
    p("Running pipeline (background removal)...")
    result = subprocess.run([PYTHON, PIPELINE, raw_path], capture_output=True, text=True)
    if result.returncode != 0:
        p(f"Pipeline error: {result.stderr}"); sys.exit(1)

    tmp_nobg = raw_path.replace("_raw.png", "_raw_nobg.png")
    if not os.path.exists(tmp_nobg):
        p("Pipeline ran but no output found"); sys.exit(1)

    if os.path.exists(clean_path): os.remove(clean_path)
    os.rename(tmp_nobg, clean_path)
    p(f"CLEAN saved: {os.path.basename(clean_path)}")

    # ── Send Telegram preview ────────────────────────────────
    p("\nSending Telegram preview to Rob...")
    send_telegram_preview(clean_path, plant_name)
    p("\nWaiting for Rob's approval (send OK in Telegram to proceed)...")
    p("(Or run with --force to skip preview and upload immediately)")

    # ── Approval wait ─────────────────────────────────────────
    # In practice, Rob replies in Telegram and the next message triggers the upload.
    # For now, print instructions. Full auto-approval flow requires webhook integration.
    p("\n" + "=" * 60)
    p("PREVIEW SENT")
    p(f"Clean sticker: {clean_path}")
    p(f"When Rob approves, run:")
    p(f"  python sticker-generate-one.py \"{plant_name}\" --upload-only")
    p("=" * 60)

    # Auto-upload if --force was passed (for batch use)
    if force:
        shutil.copy2(clean_path, dest_path)
        add_to_catalog(plant_id, plant_name, family, dest_path, size_tier)
        subprocess.run(
            ["git", "add", "-A"],
            cwd=WORKSPACE, capture_output=True
        )
        subprocess.run(
            ["git", "commit", "-m", f"Add sticker: {plant_name} ({plant_id})"],
            cwd=WORKSPACE, capture_output=True
        )
        p(f"Auto-uploaded and committed: {plant_name}")

if __name__ == "__main__":
    main()
