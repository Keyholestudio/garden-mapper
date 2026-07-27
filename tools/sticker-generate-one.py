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

# -- Prompt templates (SOURCE OF TRUTH: research/STICKER-PROMPT-GUIDE.md) ---------------------
# Do not modify without updating STICKER-PROMPT-GUIDE.md first. Last synced: 2026-07-22
TEMPLATES = {
    "plant": (
        "Aerial side view. Art style: moderately detailed watercolor painting - "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, bold flat icon. "
        "Dark outline 2-3px max. No shadows. Centered, 75% canvas fill. Vibrant and iconic."
    ),
    "cedar": (
        "Aerial side view. Art style: moderately detailed watercolor painting - tasteful simplified representation of this plant with crisp edges, "
        "focusing on a primary characteristics of the plant, no trunk, bold flat icon. Dark outline 2-3px max. No shadows. "
        "Centered, 75% canvas fill. Vibrant and iconic."
    ),
    "deciduous": (
        "Side aerial view. Art style: moderately detailed watercolor painting - "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "primary characteristics of the plant, leafy canopy only, NO TRUNK, NO STEM, NO BARK VISIBLE. "
        "Dark outline 2-3px max. No shadows. Centered, 75% canvas fill. Vibrant and iconic."
    ),
    "pine": (
        "Aerial side view. Art style: moderately detailed watercolor painting - "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, no trunk, bold flat icon. Dark outline 2-3px max. "
        "No shadows. Centered, 75% canvas fill. Vibrant and iconic."
    ),
    "rootveg": (
        "Side aerial view. Art style: moderately detailed watercolor painting - "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px max. "
        "Line texturing. No shadows. Centered, 75% canvas fill. Vibrant and iconic."
    ),
}

# ── Plant lookup table ─────────────────────────────────────────────────────────
# Maps common name → (sticker_id_prefix, size_tier, size_px, family, template, colours, shape)
# Add new plants here as needed. Names are lowercase for matching.
PLANT_LOOKUP = {
    # Trees — deciduous
    "maple tree":        ("tree-deciduous_maple",        "XL", 512, "Deciduous Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, bright green #5AB83A, yellow-green #A8D848, warm brown limbs #6B3A2A", "Natural leafy canopy with distinctive lobed maple leaf silhouette."),
    "lemon tree":        ("tree-fruit_lemon",             "XXL",512, "Fruit Tree",  "deciduous", "deep green #2A6A2A, mid-green #4A8A3A, bright green #5AB83A, bright yellow lemons #FFD700, warm brown limbs #6B3A2A, dark outline #0A1A0A", "Natural broad leafy canopy. Vivid yellow lemons visible as accent fruit throughout canopy. NO TRUNK visible. Canopy fills the frame."),
    "raspberry":         ("shrub-flowering_raspberry",     "M",  256, "Shrub / Fruit", "plant", "deep red #C41230, vivid red #E82040, bright green leaves #4A8A3A, pale pink flowers #F5C8D8, mid-green #3A7A2A, dark outline #0A1A0A", "Arching thorny shrub with bright green leaves and clusters of vivid red raspberries. Correct proportions. No roots."),
    "asparagus":         ("vegetable-tall_asparagus",      "M",  256, "Vegetable",   "plant", "bright green #5AB83A, mid-green #4A8A3A, deep green #2A6A2A, pale green tips #8ABF6A, dark outline #0A1A0A", "Multiple thick asparagus spears growing upright, tightly bunched together. Plump spears with tightly closed purple-tipped heads. No soil. Correct proportions."),
    "peas":              ("vine-leaf_peas",                "M",  256, "Vegetable",   "plant", "bright green #5AB83A, mid-green #4A8A3A, pale green pods #8ABF6A, white flowers #F8F8F0, dark outline #0A1A0A", "Climbing pea plant with bright green tendrils, broad leaves, white flowers, and plump green pea pods. Correct proportions. No roots."),
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
    # ── Ferns — Woodland ─────────────────────────────────────────────────────────────────
    "lady fern":         ("plant-fern_lady-fern",         "M",  256, "Fern / Groundcover", "plant", "mid green #4A8A3A, bright green #5AB83A, pale lime frond tips #A8D870, deep green #2A5A1A, dark outline #0A1A0A", "Bushy spreading rosette of elegantly arched pinnate fronds, each frond finely divided into delicate opposite leaflets with slightly toothed edges, fronds radiating gracefully outward from the centre in a full bushy clump."),
    "male fern":         ("plant-fern_male-fern",         "M",  256, "Fern / Groundcover", "plant", "deep forest green #2A6A3A, mid green #4A8A5A, bright green #5AB83A, pale green undersides #8ABF6A, dark outline #0A1A0A", "Robust upright vase of large pinnate fronds, each frond broadly lance-shaped with rounded lobed pinnules, fronds arching outward from the centre in a semi-evergreen clump."),
    "ostrich fern":      ("plant-fern_ostrich-fern",      "M",  256, "Fern / Groundcover", "plant", "vivid green #5AB83A, deep green #2A6A3A, bright lime-green #7AC83A, pale green #8ABF6A, dark outline #0A1A0A", "Iconic vase-shaped fern with large broadly lance-shaped fronds that are wide in the middle and narrow at both ends, fronds spreading dramatically outward like a shuttlecock or ostrich plume."),
    "japanese painted fern": ("plant-fern_japanese-painted-fern", "M", 256, "Fern / Groundcover", "plant", "silver-grey #A8B8B0, pewter-green #7A9A8A, burgundy-red midrib #8B2A2A, pale silver fronds #C8D8D0, dark outline #0A1818", "Bushy fern with many fronds, distinctive silver-grey fronds marked with a deep burgundy-red midrib, fronds are pinnate and elegantly arched, full lush clump radiating from centre, giving a painted metallic appearance."),
    "hart's tongue fern": ("plant-fern_harts-tongue-fern", "M", 256, "Fern / Groundcover", "plant", "deep glossy green #1A6A3A, bright green #4AAF5A, pale green #8ABF6A, dark outline #0A1A0A", "Highly distinctive fern with undivided strap-shaped glossy green fronds arising from the centre in a rosette, each frond is a single uncut strap — no leaflets, no divisions — glossy and leathery. Plant fills 60% of the canvas, centred, with plenty of space around it."),
    "maidenhair fern":   ("plant-fern_maidenhair-fern",   "M",  256, "Fern / Groundcover", "plant", "bright green #5AB83A, mid green #4A8A3A, black wiry stems #1A0A0A, pale yellow-green #A8D870, dark outline #0A1A0A", "Plant takes up 75% of the center of the image. Bushy fronds. Dense spreading maidenhair fern with many slender black wiry stems bearing fan-shaped light green leaflets, full lush clump radiating from centre."),
    "soft shield fern":  ("plant-fern_soft-shield-fern",  "M",  256, "Fern / Groundcover", "plant", "mid green #4A8A3A, deep green #2A6A3A, bright green tips #6AAF5A, pale green undersides #8ABF6A, dark outline #0A1A0A", "Arching spreading fern with softly textured pinnate fronds, each frond has finely divided pinnules giving a lacy feathery appearance, fronds arch gently outward from the centre in a spreading clump."),
    "broad buckler fern": ("plant-fern_broad-buckler-fern", "M", 256, "Fern / Groundcover", "plant", "mid green #4A8A3A, deep green #2A6A3A, grey-green undersides #7A9A7A, dark outline #0A1A0A", "Bushy fern with many fronds, side view, large broadly triangular spreading fronds arching outward and upward from the centre, each frond broadly triangular with wide-angled pinnate leaflets, full lush clump."),
    "royal fern":        ("plant-fern_royal-fern",        "M",  256, "Fern / Groundcover", "plant", "vivid green #5AB83A, deep green #2A6A3A, mid green #4A8A5A, brown fertile fronds #8A5A2A, dark outline #0A1A0A", "Tall imposing fern with large broadly lance-shaped fronds that are pinnate with widely spaced rounded pinnules, some fronds have distinct brown fertile tips at the crown, overall an open vase shape."),
    "interrupted fern":  ("plant-fern_interrupted-fern",  "M",  256, "Fern / Groundcover", "plant", "mid green #4A8A3A, bright green #5AB83A, dark brown fertile pinnules #6A3A1A, pale green #8ABF6A, dark outline #0A1A0A", "Distinctive fern with pinnate fronds interrupted midway along by pairs of shrivelled dark brown fertile pinnules, creating a gap in the otherwise green frond — the unique interrupted appearance."),
    "cinnamon fern":     ("plant-fern_cinnamon-fern",     "M",  256, "Fern / Groundcover", "plant", "vivid green #5AB83A, deep green #2A6A3A, warm cinnamon-brown #A85A2A, mid green #4A8A5A, dark outline #0A1A0A", "Vase-shaped fern with cinnamon-colored fertile fronds prominently upright in the center, surrounded by large spreading bright green sterile fronds arching outward — the warm cinnamon-brown fertile fronds are the focal point at the heart of the plant."),
    "sensitive fern":    ("plant-fern_sensitive-fern",    "M",  256, "Fern / Groundcover", "plant", "mid green #4A8A3A, bright green #5AB83A, pale green lobed fronds #8ABF6A, warm brown bead fronds #8A5A2A, dark outline #0A1A0A", "Spreading fern with broadly triangular fronds divided into broad rounded lobes along a central rachis, separate upright stiff brown bead-like fertile fronds persist through winter alongside the green sterile fronds."),
    # ── Aquatic ──────────────────────────────────────────────────────────────────────
    # ── Perennials / Spikes ───────────────────────────────────────────────────────
    "iris":              ("flower-spike_iris",             "M",  256, "Perennial",        "plant", "vivid purple #7B35C8, deep violet #5A1A9A, golden yellow falls #E8C020, pale lavender #C4A8E0, mid-green strap #4A7C3A, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "a cluster of Bearded iris. Bold upright strap leaves with one or two large iris flowers. Ruffled upright standards and drooping falls with yellow beard. Correct proportions. No roots."),
    "lupin":             ("flower-spike_lupin",             "M",  256, "Perennial",        "plant", "vivid purple #7B35C8, deep violet #5A1A9A, rich purple #9B45D8, mid-green palmate #4A7C2F, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "Several purple lupin flowers in a bunch. Correct proportions. No roots."),
    # ── Shrubs ──────────────────────────────────────────────────────────────────
    "azalea":            ("shrub-flowering_azalea",         "M",  256, "Shrub",            "plant", "vivid coral-red #E84A2A, bright orange-red #D43A1A, mid-green #4A7C2F, deep green #2A5A1A, dark outline #0A1A0A", "Rounded flowering shrub covered in clusters of vivid funnel-shaped flowers. Dense leafy mound. Correct proportions. No roots."),
    "buddleia":          ("shrub-flowering_buddleia",       "M",  256, "Shrub",            "plant", "vivid purple #7B35C8, deep violet #5A1A9A, pale lilac #C4A8E0, mid-green #4A7C2F, arching stems #6A4A2A, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "A large bush of Buddleia flowers. Correct proportions. No roots."),
    "forsythia":         ("shrub-flowering_forsythia",      "M",  256, "Shrub",            "plant", "vivid golden yellow #FFD700, deep yellow #E8B020, bright gold #FFA500, bare brown stems #6A4A1A, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "Arching shrub with bare stems covered in masses of bright golden-yellow four-petalled flowers before leaves emerge. Correct proportions. No roots."),
    "spirea":            ("shrub-flowering_spiraea",        "M",  256, "Shrub",            "plant", "vivid pink #E8407A, deep rose #C41260, pale pink #F5A8C8, mid-green #4A7C2F, arching stems #4A3A2A, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "a cluster of Rounded arching bush covered in masses of small PINK flower clusters along arching stems. Flowers are pink - NO white, NO cream flowers. Correct proportions. No roots."),
    "weigela":           ("shrub-flowering_weigela",        "M",  256, "Shrub",            "plant", "vivid pink #E8407A, deep rose #C41260, pale pink #F5A8C8, mid-green #4A7C2F, arching stems #4A3A2A, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "a cluster of Rounded arching shrub with clusters of tubular bell-shaped pink flowers along stems. Correct proportions. No roots."),
    "boxwood":           ("shrub-round_boxwood",            "M",  256, "Shrub",            "plant", "deep glossy green #1A6A2A, mid-green #3A8A3A, bright green #5AB83A, dark outline #0A1A0A", "Neatly clipped round dense evergreen mound. Glossy small oval leaves tightly packed. Perfect sphere shape. Correct proportions. No roots."),
    "bush beans":        ("vegetable-tall_beans",          "S",  160, "Vegetable",        "plant", "bright green pods #5AB83A, mid-green #3A8A2A, pale green #8ABF6A, dark outline #0A1A0A", "Compact bushy plant loaded with green beans. Multiple upright stems with flat oval leaves and clusters of long green bean pods. Correct proportions. No roots."),
    "radish":            ("vegetable-root_radish",         "S",  160, "Root Vegetable",   "rootveg", "vivid red #D42B2B, deep red #A81A1A, bright green tops #5AB83A, pale white lower bulb #F5F0E8, dark outline #0A1A0A", "Round red radish bulb and leafy green tops peeking from a soil line. Only show the top above the minimal soil line. Bold round red shoulders visible above the soil, leafy green tops above."),
    "spinach":           ("vegetable-leafy_spinach",       "S",  160, "Vegetable",        "plant", "deep green #1A6A2A, bright green #4AAF5A, mid-green #3A8A3A, dark outline #0A1A0A", "Big lush bunch of spinach. Dense rosette of large rounded dark green leaves spreading outward. Full bushy clump. Correct proportions. No roots."),
    "delphinium":        ("flower-spike_delphinium",       "M",  256, "Perennial",        "plant", "vivid blue #2A5AD4, deep violet-blue #1A3A9A, pale blue #8AB8E8, mid-green #4A7C2F, dark outline #0A1A0A", "Tall vertical spike densely packed with vivid blue flowers. Multiple florets arranged up the stem. Correct proportions. No roots."),
    "foxglove":          ("flower-spike_foxglove",         "M",  256, "Biennial",         "plant", "deep purple #7B35C8, pale pink #F5A8D0, spotted throat #2A1A4A, mid-green #4A7C2F, cream #F5F0E8, dark outline #0A1A0A", "Tall vertical spike with pendulous tubular bell-shaped flowers arranged up the stem. Flowers spotted inside. Correct proportions. No roots."),
    "agapanthus":        ("flower-cluster_agapanthus",    "M",  256, "Bulb / Perennial", "plant", "vivid blue #3A6AD4, deep violet-blue #2A4AA8, pale blue #8AB8E8, mid-green strap #4A7C3A, dark outline #0A1A0A", "Tall upright stems topped with large round clusters of small tubular blue flowers. Strap-like leaves at base. Correct proportions. No roots."),
    "hollyhock":         ("flower-spike_hollyhock",        "XL", 512, "Biennial",         "plant", "vivid pink #E8407A, deep rose #C41260, pale pink #F5A8C8, bright yellow centre #FFD700, mid-green #4A7C2F, dark outline #0A1A0A", "Tall vertical spike with large open funnel-shaped flowers arranged up the stem. Correct proportions. No roots."),
    "cauliflower":       ("vegetable-leafy_cauliflower",   "M",  256, "Vegetable",        "plant", "pure white curd #F8F8F0, pale cream #F0EEE0, blue-green leaves #4A7A5A, mid-green #5A8A5A, dark outline #0A1A0A", "Compact cauliflower head. Large dense white curd surrounded by broad blue-green leaves. Correct proportions. No roots."),
    "crocus":            ("bulb-spring_crocus",            "XS", 96,  "Bulb",        "plant", "pale purple #A878D8, deep violet #6A2A9A, soft lavender #C8A8E8, pale yellow centre #FFE870, mid-green strap #4A7C2F, dark outline #0A1A0A", "Correct proportions. No roots."),
    "garden verbena":    ("flower-cluster_verbena",        "S",  160, "Annual Flower","plant", "vivid purple #7B35C8, deep violet #5A1A9A, bright crimson #C41230, mid-green #4A7C2F, pale lavender #C4A8E0, dark outline #0A1A0A", "Correct proportions. No roots."),
    "water lily":        ("aquatic_water-lily",            "M",  256, "Aquatic",     "plant", "dark outline #0A1A0A, flat solid magenta background (#FF00FF)", "Moderately detailed watercolor painting. Water lily floating on still water. Large round green lily pads with one or two open white or pink flowers sitting on top. Top-down view. No stems visible. Correct proportions."),
    # ── Daisy-type Flowers ───────────────────────────────────────────────────────────
    "black eyed susan":  ("flower-daisy_black-eyed-susan",  "M",  256, "Perennial",   "plant", "golden yellow #FFD700, deep golden #E8A820, dark brown centre #3A1A0A, mid-green #4A7C2F, bright green stems #5A8A3A, dark outline #0A1A0A", "Correct proportions. No roots."),
    "echinacea":         ("flower-daisy_echinacea",         "M",  256, "Perennial",   "plant", "warm orange-brown spiky cone #C86820, pale reflexed lavender-white petals #E8D8F0, mid-green stems #4A7C2F, deep green leaves #2A5A1A, dark outline #0A1A0A", "Echinacea coneflower. Prominent spiky orange-brown central cone. Drooping pale lavender-white petals swept backward away from the cone. Mid-green stems and leaves. NO pink or magenta petals. Correct proportions. No roots."),
    "lobelia":           ("flower-daisy_lobelia",           "XS", 96,  "Annual Flower","plant", "vivid blue-purple #5B35C8, deep violet #3A1A9A, pale lavender #B8A8E8, bright green #4A7C2F, white eye #F8F8F8, dark outline #0A1A0A", "Correct proportions. No roots."),
    "marigold":          ("flower-daisy_marigold",          "S",  160, "Annual Flower","plant", "bright orange #FF8C00, golden yellow #FFD700, deep amber #CC6000, dark brown centre #3A1A0A, mid-green #4A7C2F, dark outline #0A1A0A", "Correct proportions. No roots."),
    "nasturtium":        ("flower-daisy_nasturtium",        "S",  160, "Annual Flower","plant", "vivid orange #FF6B1A, golden yellow #FFD700, deep red #C41A0A, round green leaves #5A9A3A, dark outline #0A1A0A", "Correct proportions. No roots."),
    "pansy":             ("flower-daisy_pansy",             "S",  160, "Annual Flower","plant", "deep purple #5A1A9A, bright yellow #FFD700, vivid violet #7B35C8, pale lavender #C4A8E0, dark face markings #1A0A0A, dark outline #0A1A0A", "Correct proportions. No roots."),
    "petunia":           ("flower-daisy_petunia",           "S",  160, "Annual Flower","plant", "vivid pink #E8207A, deep magenta #C41260, pale lavender #C4A8E0, bright white #F8F8F8, mid-green #4A7C2F, dark outline #0A1A0A", "Correct proportions. No roots."),
    "zinnia":            ("flower-daisy_zinnia",            "S",  160, "Annual Flower","plant", "vivid orange #FF6B1A, bright red #D42B2B, hot pink #E8407A, golden yellow #FFD700, mid-green #4A7C2F, dark outline #0A1A0A", "Correct proportions. No roots."),
    "phlox":             ("flower-cluster_phlox",       "M",  256, "Perennial Flower","plant",     "vivid purple #7B35C8, deep violet #5A1A9A, mid lavender #A06AE0, pale lilac centre #DCC8F0, bright green #4A7C2F, dark outline #1A0A2A", "Compact rounded mound of bright green leaves completely covered in dense flat five-petalled flowers in vivid purple and violet, stems at bottom and flowers covering top."),
    "thyme":             ("herb-small_thyme",           "S",  160, "Herb",           "plant",     "silver-grey green #8FAF82, warm grey-green #7A9A6A, tiny pale lilac flowers #C8A8E0, dark olive stems #3D5A1A, warm brown woody base #7A5C3A", "Low creeping woody sub-shrub with dense tiny oval grey-green leaves covering wiry stems, tiny pale purple flower clusters at tips, stems at bottom and leafy florals at top."),
    "rosemary":          ("herb-small_rosemary",         "M",  256, "Herb",           "plant",     "silver-grey green #8FAF82, dark olive #3D5A1A, pale blue flower #A8C8E8, warm grey #A09070, brown stems #7A5C3A", "Upright woody sub-shrub with dense narrow needle-like silver-green leaves and tiny blue flowers, stems at bottom and leafy florals at top."),
    # Root veg
    "carrot":            ("vegetable-root_carrot",       "S",  160, "Root Vegetable", "rootveg",   "bright orange #FF6B1A, deep orange #CC4A00, bright green tops #4AAF2F, mid-green #2A7010, pale green stem #8FBF6A", "Carrot and tops peeking from a plant wide soil line. Only show the top above the minimal soil line. Bold orange carrot shoulders visible, root at bottom and leafy tops."),
    "beet":              ("vegetable-root_beet",         "S",  160, "Root Vegetable", "rootveg",   "deep burgundy-red #8B1A2A, dark magenta #6B0A1A, bright green tops #4AAF2F, red-veined leaves #A83A2A", "Beet and tops peeking from a plant wide soil line. Only show the top above the minimal soil line. Round dark red beet shoulders visible, root at bottom and leafy red-veined tops."),
    "onion":             ("vegetable-root_onion",        "S",  160, "Root Vegetable", "rootveg",   "papery golden-brown #C8A050, pale white #F5F0E8, bright green strap tops #4A8C3A, mid-green #2A6010, dark outline #1A0A0A", "Onion bulb and strap tops only. No soil, no ground, no dirt, no roots. Round papery golden-brown onion bulb floating cleanly, strap-leaf tops above."),
    "kohlrabi":          ("vegetable-root_kohlrabi",     "S",  160, "Root Vegetable", "rootveg",   "pale green bulb #A8D870, purple-green tinge #8A9A50, bright green strap leaves #4AAF2F, mid-green #2A7010, dark outline #1A2A0A", "Kohlrabi bulb and strap leaves only. No soil, no ground, no dirt, no roots. Round pale green bulb with leaf stalks growing directly from the bulb surface, leafy tops above."),
    "garlic":            ("vegetable-root_garlic",       "S",  160, "Root Vegetable", "rootveg",   "papery white #F5F0E8, pale purple tinge #C8B8D8, bright green strap #4AAF2F, mid-green #2A7010, warm tan #C8A870", "Garlic bulb and strap tops only. No soil, no ground, no dirt, no roots. Papery white garlic bulb floating cleanly, strap-leaf tops above."),
    # Flowers
    "rose":              ("flower-rose_rose",            "M",  256, "Shrub / Rose",   "plant",     "deep red #C41230, pale pink #F5B8C8, mid-green #4A7C2F, dark outline #1A0A0A, warm brown thorny stems #7A4A2A", "Upright thorny stems with large full multi-petalled rose blooms and glossy green leaves, stems at bottom and blooms at top."),
    "sunflower":         ("vegetable-tall_sunflower",    "XL", 512, "Annual Flower",  "plant",     "golden yellow #FFD700, deep brown centre #5A2A0A, mid-green #4A7C2F, pale yellow #FFF0A0, dark stem #3A2010", "Tall upright stem with large round brown seed disc surrounded by bold golden-yellow ray petals, broad leaves, stem at bottom and flower at top."),
    "tulip":             ("bulb-spring_tulip",           "S",  160, "Bulb",           "plant",     "vivid red #D42B2B, bright yellow #FFD700, deep pink #E8407A, mid-green strap #4A7C2F, dark outline #1A0A0A", "Upright smooth strap leaves with single elegant cup-shaped bloom at top, stem at bottom and bloom at top."),
    "dahlia":            ("flower-daisy_dahlia",         "M",  256, "Bulb / Annual",  "plant",     "deep magenta #C41270, coral orange #E8703A, vivid yellow #FFD700, mid-green #4A7C2F, dark outline #1A0A0A", "Upright stems with large dramatic multi-layered pompom blooms in rich colours, stems at bottom and blooms at top."),
    "poppy":             ("flower-daisy_poppy",          "M",  256, "Annual Flower",  "plant",     "vivid orange-red #E84A1A, deep scarlet #C41A0A, black centre #0A0A0A, mid-green #4A7C2F, pale green stem #8FBF6A", "Upright slender stem with large crinkled crepe-paper thin petals in vivid red-orange surrounding a dark seed capsule centre, stems at bottom and bloom at top."),
    "hydrangea":         ("flower-cluster_hydrangea",    "L",  384, "Shrub",          "plant",     "cornflower blue #5B8DD9, pale lavender #C4B8E8, soft pink #F0B8C8, mid-green #4A7C2F, dark outline #1A1A2E", "Rounded shrub with massive domed flower heads of densely packed small florets in blue and pink, stems at bottom and florals at top."),

    # ── Conifers (additions) ──────────────────────────────────────────────────────────
    "cedar thuja":       ("tree-conifer_cedar-thuja",       "XL", 512, "Conifer Tree",   "cedar",     "deep forest green #1A5C1A, mid-green #2E7A2E, bright green tips #5AB83A, dark outline #0A2010, No browns", "Correct proportions."),

    # ── Cacti ──────────────────────────────────────────────────────────────────────────
    "saguaro cactus":    ("cactus_saguaro",              "M",  256, "Cactus", "plant", "pale green #8ABF6A, mid green #5A8A3A, deep green #2A5A1A, warm tan ribs #C8A870, dark outline #1A2A0A", "Tall iconic columnar cactus with 2-3 upward-curving arms, vertical ribbing, clusters of spines. Bold silhouette."),
    "barrel cactus":     ("cactus_barrel",               "M",  256, "Cactus", "plant", "mid green #5A8A3A, yellow-green #8ABF4A, pale tan ribs #D4B870, golden spines #D4A020, dark outline #1A2A0A", "Squat barrel-shaped cactus, prominent vertical ribs with hooked golden spines, slightly top-heavy. Bold silhouette."),
    "prickly pear cactus":("cactus_prickly-pear",        "M",  256, "Cactus", "plant", "blue-green #4A8A6A, mid green #3A6A4A, pale green pads #7ABF8A, golden spines #D4A020, dark outline #0A1A0A", "Flat oval pads stacked in branching clusters, each pad studded with spines, occasional bright fruit accents."),
    "golden barrel cactus":("cactus_golden-barrel",      "M",  256, "Cactus", "plant", "bright yellow-green #C8D820, mid green #7A9A2A, golden ribs #D4A020, amber spines #C87820, dark outline #1A1A0A", "Nearly spherical golden barrel cactus, tight vertical ribs, dense amber-golden spines covering surface."),
    "organ pipe cactus": ("cactus_organ-pipe",           "M",  256, "Cactus", "plant", "mid green #5A8A3A, deep green #2A5A1A, grey-green stems #7A9A6A, pale spines #C8C8A8, dark outline #0A1A0A", "Multiple tall narrow vertical columns rising from a shared base like organ pipes, ribbed surface, no arms."),
    "cholla cactus":     ("cactus_cholla",               "M",  256, "Cactus", "plant", "yellow-green #9ABF3A, mid green #5A8A2A, pale tan joints #D4C870, silver spines #D0D0C0, dark outline #1A2A0A", "Branching cylindrical segmented stems with dense barbed silver spines giving a fuzzy appearance."),
    "fishhook cactus":   ("cactus_fishhook",             "S",  160, "Cactus", "plant", "mid green #5A8A3A, blue-green #4A7A5A, red hooked spines #C84A2A, pale spine tips #F0D0A0, dark outline #0A1A0A", "Small barrel-shaped cactus with distinctive hooked red central spines radiating from each areole."),
    "christmas cactus":  ("cactus_christmas",            "M",  256, "Cactus", "plant", "deep green #2A6A3A, mid green #4A8A5A, vivid pink-red flowers #E84A6A, pale pink #F5A0B8, dark outline #0A1A0A", "Flat segmented drooping stems with serrated edges, pendant tubular pink-red flowers at tips."),
    "hedgehog cactus":   ("cactus_hedgehog",             "S",  160, "Cactus", "plant", "mid green #5A8A3A, blue-green #4A7A5A, vivid magenta flowers #D42878, pale spine #D0D0C0, dark outline #0A1A0A", "Cluster of short cylindrical ribbed columns covered in white spines, vivid magenta flowers at crown."),
    "bunny ears cactus": ("cactus_bunny-ears",           "M",  256, "Cactus", "plant", "pale blue-green #7ABFA0, mid green #4A8A6A, cream glochid dots #F0E8C0, yellow flowers #FFD700, dark outline #0A1A0A", "Two large oval flat pads side by side like bunny ears on a small base pad, dense cream glochid dots covering surface."),
    "old man cactus":    ("cactus_old-man",              "M",  256, "Cactus", "plant", "mid green #5A8A3A, deep green #2A5A1A, white fluffy hair #F0F0F0, pale grey #D0D0D0, dark outline #0A1A0A", "Tall columnar cactus completely covered in long white woolly hair obscuring the ribs beneath."),
    "moon cactus":       ("cactus_moon",                 "S",  160, "Cactus", "plant", "vivid orange #FF6B1A, hot pink #E8407A, bright yellow #FFD700, deep green base #2A6A3A, dark outline #1A0A0A", "Small brightly coloured grafted ball cactus (orange, pink or yellow) sitting atop a green columnar base cactus."),
    "totem pole cactus": ("cactus_totem-pole",           "M",  256, "Cactus", "plant", "pale blue-green #8ABFB0, mid green #5A9A8A, smooth skin #A8D4C8, very pale spines #E0E8E0, dark outline #0A1A18", "Tall smooth columnar cactus with irregular lumpy skin and no visible spines, like a sculptural totem."),
    "star cactus":       ("cactus_star",                 "S",  160, "Cactus", "plant", "mid green #5A8A3A, blue-green #4A7A6A, white star stripes #F0F0E0, yellow flower #FFD700, dark outline #0A1A0A", "Small flat circular cactus with 8 geometric sections creating a star pattern, white markings, small yellow flower at centre."),
    "bishops cap cactus":("cactus_bishops-cap",          "S",  160, "Cactus", "plant", "silver-grey green #8ABFA0, pale grey #C8D8C8, white geometric ribs #F0F0E8, yellow flowers #FFD700, dark outline #0A1A0A", "Geometric star-shaped cactus with 5 prominent ribs covered in silver-white scales, small yellow flower at top."),

    # ── Succulents ──────────────────────────────────────────────────────────────────────
    "aloe vera":         ("succulent_aloe-vera",         "M",  256, "Succulent", "plant", "grey-green #7A9A6A, pale green #A8C890, silvery spots #C8D8B8, orange flower spike #E87820, dark outline #0A1A0A", "Rosette of thick fleshy upward-arching lance-shaped leaves with serrated edges and pale spots, spreading from centre."),
    "echeveria":         ("succulent_echeveria",         "S",  160, "Succulent", "plant", "pale blue-green #8ABFB0, rose-pink edges #E87890, silver-green #B8D4C8, pale lavender #C8B8E0, dark outline #0A1A18", "Perfect tight rosette of plump fleshy pointed leaves graduating from pale centre to coloured tips, seen from above."),
    "jade plant":        ("succulent_jade-plant",        "S",  160, "Succulent", "plant", "deep green #2A6A3A, mid green #4A8A5A, glossy bright green #6AAF6A, red leaf edges #C84A2A, dark outline #0A1A0A", "Thick woody branching stems with pairs of plump oval glossy leaves, bonsai-like compact tree form."),
    "haworthia":         ("succulent_haworthia",         "S",  160, "Succulent", "plant", "deep green #2A5A3A, mid green #4A7A5A, white pearl stripes #F0F0E8, translucent windows #C8E8D0, dark outline #0A1A0A", "Compact rosette of dark green triangular leaves with distinctive white pearl-like stripe markings on the surface."),
    "sedum succulent":   ("succulent_sedum-succulent",   "S",  160, "Succulent", "plant", "blue-grey #7A9AAA, pale blue-green #9ABFB8, rose-pink #E87890, dusty purple #9A7AAA, dark outline #0A1818", "Low spreading mat of plump teardrop-shaped leaves in blue-grey with rosy tips, clustered stems."),
    "agave":             ("succulent_agave",             "M",  256, "Succulent", "plant", "blue-grey green #6A8A7A, pale silver-green #A8C4B8, sharp dark tip #1A2A1A, pale yellow margin #D4C870, dark outline #0A1A10", "Bold architectural rosette of thick rigid sword-shaped leaves with sharp terminal spine, spreading wide from centre."),
    "string of pearls":  ("succulent_string-of-pearls",  "S",  160, "Succulent", "plant", "bright green #5AB83A, mid green #3A8A2A, pale green pearls #8ABF6A, white flowers #F0F0E8, dark outline #0A1A0A", "Trailing stems hung with round bead-like leaves like a string of green pearls, cascading downward."),
    "hens and chicks":   ("succulent_hens-and-chicks",   "S",  160, "Succulent", "plant", "grey-green #7A9A7A, rose-purple edges #C87890, pale silver #C8D4C8, deep burgundy centre #5A1A2A, dark outline #0A1A0A", "Large central rosette (the hen) surrounded by multiple small offset rosettes (the chicks), seen from above."),
    "lithops":           ("succulent_lithops",           "S",  160, "Succulent", "plant", "warm tan #C8A870, grey-green #8A9A7A, terracotta #C87850, pale window top #D8C8A8, dark outline #1A0A0A", "Pair of plump pebble-like leaf bodies split down the middle, patterned tops resembling living stones."),
    "burros tail":       ("succulent_burros-tail",       "S",  160, "Succulent", "plant", "blue-grey green #7A9A8A, pale mint #A8C8B8, silver-green #B8D4C8, dusty rose tips #C89090, dark outline #0A1818", "Dense trailing stem packed with overlapping plump teardrop leaves like a fat braided tail."),

    # ── Tropical & Palms ─────────────────────────────────────────────────────────────────
    "coconut palm":      ("tree-palm_coconut",           "XXL",512, "Palm Tree", "pine", "deep green #2A6A3A, mid green #4A8A5A, bright green fronds #6AAF5A, warm tan trunk #C8A870, dark outline #0A1A0A", "Tall palm with arching feathery pinnate fronds, cluster of green coconuts at crown, no trunk visible."),
    "royal palm":        ("tree-palm_royal",             "XXL",512, "Palm Tree", "pine", "deep green #2A6A3A, bright green #5AB83A, silver-grey crown shaft #A8B8B8, pale grey #D0D8D0, dark outline #0A1A0A", "Dense crown of upright feathery pinnate fronds completely hiding any trunk. Trunk hidden by palms. Fronds fill the entire canvas. No bare trunk visible. Silver crown shaft visible between frond bases only."),
    "washingtonia palm": ("tree-palm_washingtonia",      "XXL",512, "Palm Tree", "pine", "mid green #4A8A5A, deep green #2A6A3A, pale fan fronds #7ABF8A, dry brown skirt #8A6A3A, dark outline #0A1A0A", "Fan palm with large palmate fronds radiating outward, dead brown frond skirt hanging below the crown."),
    "date palm":         ("tree-palm_date",              "XXL",512, "Palm Tree", "pine", "deep green #2A6A3A, mid green #4A8A5A, arching fronds #6AAF5A, golden-orange dates #D4901A, dark outline #0A1A0A", "Arching feathery pinnate fronds with hanging clusters of golden-orange dates near the crown base."),
    "bismarck palm":     ("tree-palm_bismarck",          "XXL",512, "Palm Tree", "pine", "striking silver-blue #7A9AB8, pale blue-grey #A8B8C8, steel blue fronds #5A7A9A, white wax bloom #E0E8F0, dark outline #0A0A1A", "Spectacular fan palm with large palmate silver-blue waxy fronds radiating symmetrically, iconic colour."),
    "travellers palm":   ("tree-palm_travellers",        "XXL",512, "Palm Tree", "pine", "deep green #2A6A3A, bright green #5AB83A, vivid green fans #6AAF5A, white base sheaths #F0F0E8, dark outline #0A1A0A", "Dramatic fan of huge banana-like leaves fanned out in a single flat plane like an open hand or peacock tail."),
    "banana tree":       ("tree-tropical_banana",        "XL", 512, "Tropical",  "deciduous", "deep green #2A6A3A, bright green #5AB83A, yellow-green #A8D848, yellow bananas #FFD700, dark outline #0A1A0A", "Large broad paddle-shaped leaves spreading from central trunk, hanging cluster of yellow bananas."),
    "bird of paradise tree":("tree-tropical_bird-of-paradise","M", 256,"Tropical","plant", "deep green #2A6A3A, mid green #4A8A5A, vivid orange #FF6B1A, electric blue #1A6AD4, dark outline #0A1A0A", "Bold upright strap leaves fanning from base, exotic orange and blue bird-like flowers on tall stems."),
    "bougainvillea":     ("tree-tropical_bougainvillea", "XL", 512, "Tropical",  "plant", "vivid magenta #E8208A, deep pink #C41270, bright coral #E8603A, mid green #4A8A5A, dark outline #1A0A2A", "Sprawling shrubby plant covered in masses of vivid magenta paper-thin bracts, small white true flowers at centre."),
    "jacaranda tree":    ("tree-tropical_jacaranda",     "XXL",512, "Tropical",  "deciduous", "vivid purple #7B35C8, mid purple #A840D8, pale lavender #C4A8E0, mid green #4A8A5A, dark outline #1A0A2A", "Spreading canopy entirely covered in vivid purple-blue trumpet flowers, delicate ferny foliage visible beneath."),
    "plumeria":          ("tree-tropical_plumeria",      "M",  256, "Tropical",  "plant", "pure white #F8F8F0, creamy yellow centre #FFE870, pale pink #F5C8D8, vivid pink #E8607A, deep green #2A6A3A, dark outline #0A1A0A", "Clusters of five-petalled waxy tropical flowers in white with yellow centre, thick succulent branches, glossy leaves."),

    # Vegetables - Leafy
    "arugula":               ("vegetable-leafy_arugula",          "S",  160, "Leafy Vegetable",  "plant",   "bright green #5AB83A, deep green #2A5A1A, pale green #8ABF6A, dark outline #0A1A0A", "Low rosette of deeply lobed peppery leaves with jagged toothed edges, stems at base, leaves arching outward."),
    "rocket":                ("vegetable-leafy_arugula",          "S",  160, "Leafy Vegetable",  "plant",   "bright green #5AB83A, deep green #2A5A1A, pale green #8ABF6A, dark outline #0A1A0A", "Low rosette of deeply lobed peppery leaves with jagged toothed edges, stems at base, leaves arching outward."),
    "radicchio":             ("vegetable-leafy_radicchio",        "S",  160, "Leafy Vegetable",  "plant",   "deep burgundy-red #8B1A2A, dark red #6B0A1A, pale cream-white veins #F5F0E8, dark outline #1A0A0A", "Compact tight round head of deep red-burgundy leaves with distinctive white veining, rosette form."),
    "endive":                ("vegetable-leafy_endive",           "S",  160, "Leafy Vegetable",  "plant",   "pale yellow-green #C8D870, mid green #5A8A3A, cream-white #F5F0E8, dark outline #0A1A0A", "Rosette of broad frilly curly-edged leaves in yellow-green, blanched pale inner leaves, ruffled texture."),
    "red amaranth":          ("vegetable-leafy_red-amaranth",     "M",  256, "Leafy Vegetable",  "plant",   "deep magenta-red #C41250, vivid red #E82050, deep green #2A5A1A, dark outline #1A0A0A", "Upright bushy plant with broad pointed leaves in striking deep red-magenta colour, stems at bottom."),
    "lamb's lettuce":       ("vegetable-leafy_lambs-lettuce",    "XS", 160, "Leafy Vegetable",  "plant",   "mid green #4A8A3A, bright green #6AAF5A, pale green #8ABF6A, dark outline #0A1A0A", "Tiny compact rosette of small rounded spoon-shaped leaves, very low-growing and tidy."),
    "mache":                 ("vegetable-leafy_lambs-lettuce",    "XS", 160, "Leafy Vegetable",  "plant",   "mid green #4A8A3A, bright green #6AAF5A, pale green #8ABF6A, dark outline #0A1A0A", "Tiny compact rosette of small rounded spoon-shaped leaves, very low-growing and tidy."),
    "new zealand spinach":   ("vegetable-leafy_nz-spinach",       "M",  256, "Leafy Vegetable",  "plant",   "mid green #4A8A3A, deep green #2A5A1A, bright green #6AAF5A, dark outline #0A1A0A", "Sprawling mat of thick fleshy triangular leaves on spreading stems, low groundcover habit."),
    "malabar spinach":       ("vegetable-leafy_malabar-spinach",  "M",  256, "Leafy Vegetable",  "plant",   "deep glossy green #1A6A3A, vivid green #3AAA5A, red stems #C84A2A, dark outline #0A1A0A", "Climbing vine with thick glossy heart-shaped leaves on fleshy red-purple stems."),
    "good king henry":       ("vegetable-leafy_good-king-henry",  "M",  256, "Leafy Vegetable",  "plant",   "mid green #4A8A3A, deep green #2A5A1A, pale mealy surface #C8D4B8, dark outline #0A1A0A", "Upright clump of large arrow-shaped leaves with mealy coating, upright flower spikes above."),
    "silverbeet":            ("vegetable-leafy_silverbeet",       "M",  256, "Leafy Vegetable",  "plant",   "deep green #1A6A3A, bright green #3AAA5A, pure white stems #F5F0E8, dark outline #0A1A0A", "Bold upright leaves with broad glossy green blade and thick white midrib and stems."),
    # Vegetables - Root
    "celeriac":              ("vegetable-root_celeriac",          "M",  256, "Root Vegetable",   "rootveg", "pale cream-tan bulb #D4C890, mid green tops #4A8A3A, celery-green #6AAF5A, dark outline #0A1A0A", "Bulb peeking from soil line with upright celery-like green stalks above. Nothing showing beneath the soil line, focusing on what's not in the soil."),
    "jerusalem artichoke":   ("vegetable-root_jerusalem-artichoke", "XL", 512, "Root Vegetable", "rootveg", "bright yellow flowers #FFD700, deep green #2A5A1A, mid green #4A8A3A, pale tan tuber #D4B870, dark outline #0A1A0A", "Tall sunflower-like plant with golden-yellow blooms above and knobbly pale tubers peeking from soil line."),
    "salsify":               ("vegetable-root_salsify",           "M",  256, "Root Vegetable",   "rootveg", "pale cream-white root #F0E8C8, mid green strap tops #4A8A3A, purple flower #7B35C8, dark outline #0A1A0A", "Salsify root vegetable (NOT a dandelion). Long slender pale cream-white taproot peeking from soil line with upright narrow grass-like strap leaves above. No dandelion. No round seed puff. A single small purple composite flower on a separate stalk."),
    "scorzonera":            ("vegetable-root_scorzonera",        "M",  256, "Root Vegetable",   "rootveg", "deep black-brown root #2A1A0A, pale cream flesh hint #F0E8C8, mid green strap tops #4A8A3A, yellow flower #FFD700, dark outline #0A0A0A", "Long dark-skinned black root peeking from soil line with upright strap leaves and yellow dandelion-like flower."),
    "hamburg parsley":       ("vegetable-root_hamburg-parsley",   "M",  256, "Root Vegetable",   "rootveg", "pale cream root #F0E8C0, bright green parsley #5AB83A, dark outline #0A1A0A", "Thick white parsnip-like root top peeking from soil line, ONLY the crown and shoulders visible above the soil, root body hiding below soil. Curly bright green parsley-like tops rising above. Hidden root."),
    "sweet potato":          ("vegetable-root_sweet-potato",      "M",  256, "Root Vegetable",   "rootveg", "warm orange #E87820, deep orange #C45A10, bright green vines #5AB83A, leaves #4A8A3A, dark outline #0A1A0A", "The tops only of orange sweet potatoes peeking out from soil line with natural chaotic leafy bunch. No tubers visible below the soil."),
    "oca":                   ("vegetable-root_oca",               "S",  160, "Root Vegetable",   "rootveg", "vivid orange-yellow #E8A020, pale yellow #F5D070, bright green clover-like leaves #5AB83A, dark outline #0A1A0A", "Cluster of small bright orange-yellow tubers peeking from soil with small clover-like bright green leaves."),
    "skirret":               ("vegetable-root_skirret",           "M",  256, "Root Vegetable",   "rootveg", "pale cream roots #F0E8C8, mid green tops #4A8A3A, white flowers #F5F5E8, dark outline #0A1A0A", "Cluster of slender pale cream roots peeking from soil with upright ferny green tops and white flower clusters."),
    "yacon":                 ("vegetable-root_yacon",             "XL", 512, "Root Vegetable",   "rootveg", "warm tan tuber #C8A060, deep yellow-orange #D48830, bright green #5AB83A, broad leaves #3A8A3A, dark outline #0A1A0A", "Large daisy-like plant with big broad leaves above and large tan-golden tubers visible at soil line."),
    # Vegetables - Bulb
    "shallot":               ("vegetable-bulb_shallot",           "S",  160, "Bulb Vegetable",   "rootveg", "papery golden-brown #C8A050, pale copper #D4904A, bright green strap tops #4A8A3A, dark outline #1A0A0A", "Cluster of small papery golden-brown bulbs with multiple green strap shoots above, no soil."),
    "spring onion":          ("vegetable-bulb_spring-onion",      "S",  160, "Bulb Vegetable",   "rootveg", "pure white bulb #F5F0E8, pale green neck #C8D870, bright green strap tops #4A8A3A, dark outline #0A1A0A", "Slim white bulb base with long bright green hollow strap leaves above, clean floating view."),
    "scallion":              ("vegetable-bulb_spring-onion",      "S",  160, "Bulb Vegetable",   "rootveg", "pure white bulb #F5F0E8, pale green neck #C8D870, bright green strap tops #4A8A3A, dark outline #0A1A0A", "Slim white bulb base with long bright green hollow strap leaves above, clean floating view."),
    "elephant garlic":       ("vegetable-bulb_elephant-garlic",   "M",  256, "Bulb Vegetable",   "rootveg", "papery white #F5F0E8, pale purple tinge #C8B8D8, broad green strap #4A8A3A, dark outline #0A1A0A", "Very large single garlic bulb floating cleanly with broad flat strap leaves above, much bigger than regular garlic."),
    "florence fennel":       ("vegetable-bulb_florence-fennel",   "M",  256, "Bulb Vegetable",   "rootveg", "pale white-green bulb #D4E8C0, mid green #4A8A3A, feathery bright green fronds #6AAF5A, dark outline #0A1A0A", "Broad flat white-green fennel bulb with overlapping layers and feathery green fronds rising above."),
    "cipollini onion":       ("vegetable-bulb_cipollini",         "S",  160, "Bulb Vegetable",   "rootveg", "pale golden-brown #C8A050, cream white #F5F0D8, short green tops #4A8A3A, dark outline #0A1A0A", "Flat disc-shaped onion bulb, much wider than tall, papery golden-brown skin with short green tops."),
    "walking onion":         ("vegetable-bulb_walking-onion",     "M",  256, "Bulb Vegetable",   "rootveg", "mid green #4A8A3A, bright green #5AB83A, small topset bulbs #C8A050, dark outline #0A1A0A", "Upright hollow green stems with a cluster of small bulblets forming at the very top, arching under their weight."),
    "hardneck garlic":       ("vegetable-bulb_hardneck-garlic",   "S",  160, "Bulb Vegetable",   "rootveg", "papery white #F5F0E8, pale purple tinge #C8B8D8, stiff green scape #4A8A3A, dark outline #0A1A0A", "Papery garlic bulb floating cleanly with a stiff green scape curling into a loop above."),
    # Vegetables - Stem
    "globe artichoke":       ("vegetable-stem_globe-artichoke",   "XL", 512, "Stem Vegetable",   "plant",   "blue-grey green #6A8A7A, silver-green #8AAF8A, deep purple-green bud #4A5A3A, pale green bracts #A8C890, dark outline #0A1A10", "Architectural plant with large silver-green deeply divided leaves and one or more large round flower buds on tall stems."),
    "cardoon":               ("vegetable-stem_cardoon",           "XL", 512, "Stem Vegetable",   "plant",   "silver-grey #8AAFC0, pale silver #C8D8D0, violet-purple flower #7B35C8, dark outline #0A1018", "Massive architectural plant with large deeply-lobed silver-grey thistle-like leaves and tall spiny stems with purple flowers."),
    "bok choy":              ("vegetable-stem_bok-choy",          "S",  160, "Stem Vegetable",   "plant",   "bright green #5AB83A, deep green #2A5A1A, pure white stems #F5F0E8, dark outline #0A1A0A", "Compact rosette with broad glossy green leaves and thick crisp white stalks fanning from base."),
    "pak choi":              ("vegetable-stem_bok-choy",          "S",  160, "Stem Vegetable",   "plant",   "bright green #5AB83A, deep green #2A5A1A, pure white stems #F5F0E8, dark outline #0A1A0A", "Compact rosette with broad glossy green leaves and thick crisp white stalks fanning from base."),
    "samphire":              ("vegetable-stem_samphire",          "S",  160, "Stem Vegetable",   "plant",   "vivid bright green #5AB83A, blue-green #4A8A7A, succulent stems #8ABF8A, dark outline #0A1A10", "Low bushy succulent-stemmed coastal plant with finger-like cylindrical bright green stems and tiny yellow flowers."),
    # Vegetables - Fruiting
    "tomatillo":             ("vegetable-fruiting_tomatillo",     "M",  256, "Fruiting Vegetable", "plant", "mid green #4A8A3A, pale papery husk #D4C870, green-yellow fruit #A8C840, dark outline #0A1A0A", "Bushy plant with papery lantern-like husks enclosing green-yellow fruit, spreading habit."),
    "cape gooseberry":       ("vegetable-fruiting_cape-gooseberry", "M", 256, "Fruiting Vegetable", "plant", "mid green #4A8A3A, pale papery husk #D4C890, golden fruit #D4A020, dark outline #0A1A0A", "Upright bushy plant with distinctive papery lantern husks, golden-yellow round fruit visible inside split husks."),
    "ground cherry":         ("vegetable-fruiting_ground-cherry",  "S", 160, "Fruiting Vegetable", "plant", "mid green #4A8A3A, pale golden husk #D4C890, small yellow fruit #FFD700, dark outline #0A1A0A", "Compact low plant with small papery husks containing tiny golden cherry-like fruit."),
    "luffa":                 ("vegetable-fruiting_luffa",          "L", 384, "Fruiting Vegetable", "plant", "mid green #4A8A3A, deep green #2A5A1A, pale tan mature fruit #D4B870, bright green young fruit #6AAF5A, dark outline #0A1A0A", "Climbing vine with large green leaves and long pale green cylindrical sponge-gourd hanging from stem."),
    "armenian cucumber":     ("vegetable-fruiting_armenian-cucumber", "L", 384, "Fruiting Vegetable", "plant", "pale green #A8C870, mid green vine #4A8A3A, long curved fruit #8ABF5A, dark outline #0A1A0A", "Climbing vine with large leaves and very long slender curved pale green cucumber hanging."),
    "bitter melon":          ("vegetable-fruiting_bitter-melon",   "M", 256, "Fruiting Vegetable", "plant", "bright green #5AB83A, mid green vine #4A8A3A, vivid green warty fruit #3A8A2A, pale cream #D4C890, dark outline #0A1A0A", "Climbing vine with distinctive deeply warty bumpy-skinned oblong green fruit hanging from tendrils."),
    "butternut squash":      ("vegetable-fruiting_butternut-squash", "L", 384, "Fruiting Vegetable", "plant", "warm tan-cream #D4B870, pale golden #C8A050, broad green leaves #4A8A3A, orange flesh hint #E87820, dark outline #0A1A0A", "Sprawling plant with large broad leaves and distinctive pear-shaped butternut squash in warm tan-cream colour."),
    # Vegetables - Legumes
    "broad bean":            ("vegetable-legume_broad-bean",      "L",  384, "Legume",           "plant",   "mid green #4A8A3A, deep green #2A5A1A, pale cream flowers #F5F0E8, fat grey-green pods #7A9A6A, dark outline #0A1A0A", "Upright tall sturdy stems with pairs of grey-green leaves and large plump fat pods hanging from the plant."),
    "fava bean":             ("vegetable-legume_broad-bean",      "L",  384, "Legume",           "plant",   "mid green #4A8A3A, deep green #2A5A1A, pale cream flowers #F5F0E8, fat grey-green pods #7A9A6A, dark outline #0A1A0A", "Upright tall sturdy stems with pairs of grey-green leaves and large plump fat pods hanging from the plant."),
    "borlotti bean":         ("vegetable-legume_borlotti-bean",   "M",  256, "Legume",           "plant",   "mid green #4A8A3A, cream-red speckled pods #E8C8A0, vivid red-pink speckles #C84A4A, dark outline #0A1A0A", "Bushy plant with bright cream-pink speckled pods with red-pink markings, distinctive ornamental pods."),
    "chickpea":              ("vegetable-legume_chickpea",        "M",  256, "Legume",           "plant",   "mid green #4A8A3A, deep green #2A5A1A, pale cream pods #D4C890, white flowers #F5F0E8, dark outline #0A1A0A", "Compact bushy plant with small pinnate leaves and small plump cream pea-pods with 1-2 seeds visible."),
    "snow pea":              ("vegetable-legume_snow-pea",        "M",  256, "Legume",           "plant",   "bright green #5AB83A, deep green #2A5A1A, flat bright green pods #6AAF5A, white flowers #F5F0E8, dark outline #0A1A0A", "Climbing plant with tendrils and distinctive flat translucent-green pods showing seed outlines."),
    "snap pea":              ("vegetable-legume_snap-pea",        "M",  256, "Legume",           "plant",   "vivid green #5AB83A, deep green #2A5A1A, plump round pods #6AAF5A, white flowers #F5F0E8, dark outline #0A1A0A", "Climbing plant with tendrils and plump round-sectioned crisp snap pea pods."),
    "mangetout":             ("vegetable-legume_snap-pea",        "M",  256, "Legume",           "plant",   "vivid green #5AB83A, deep green #2A5A1A, plump round pods #6AAF5A, white flowers #F5F0E8, dark outline #0A1A0A", "Climbing plant with tendrils and plump round-sectioned crisp snap pea pods."),
    "lima bean":             ("vegetable-legume_lima-bean",       "M",  256, "Legume",           "plant",   "mid green #4A8A3A, deep green #2A5A1A, pale cream pods #D4C890, flat plump pods #C8C090, dark outline #0A1A0A", "Bushy plant with broad flat pale green-cream pods, each holding 2-3 plump flat butter beans."),
    "asparagus bean":        ("vegetable-legume_asparagus-bean",  "XL", 512, "Legume",           "plant",   "mid green #4A8A3A, deep green #2A5A1A, very long dark green pods #2A6A3A, dark outline #0A1A0A", "Climbing plant with enormously long pendant dark green pods hanging like ropes, 50-60cm length."),
    "yardlong bean":         ("vegetable-legume_asparagus-bean",  "XL", 512, "Legume",           "plant",   "mid green #4A8A3A, deep green #2A5A1A, very long dark green pods #2A6A3A, dark outline #0A1A0A", "Climbing plant with enormously long pendant dark green pods hanging like ropes, 50-60cm length."),
    "winged bean":           ("vegetable-legume_winged-bean",     "L",  384, "Legume",           "plant",   "mid green #4A8A3A, deep green #2A5A1A, bright green 4-winged pods #5AB83A, pale blue flower #A8C8E8, dark outline #0A1A0A", "Climbing tropical plant with distinctive 4-winged angular pods with frilly fins running the length."),
    # Vegetables - Brassica
    "sprouting broccoli":    ("vegetable-brassica_sprouting-broccoli", "L", 384, "Brassica",    "plant",   "deep purple-green #4A3A6A, vivid purple #7B35C8, mid green #4A8A3A, pale green #8ABF6A, dark outline #0A0A1A", "Tall branching plant with many small purple broccoli florets at shoot tips, leafy base."),
    "savoy cabbage":         ("vegetable-brassica_savoy-cabbage",  "M",  256, "Brassica",        "plant",   "deep blue-green #2A6A4A, mid green #4A8A5A, crinkled yellow-green #8ABF6A, dark outline #0A1A10", "Compact round head of deeply crinkled wavy-textured blue-green leaves, very textured surface."),
    "romanesco":             ("vegetable-brassica_romanesco",      "M",  256, "Brassica",        "plant",   "vivid yellow-green #8ABF2A, mid green #5A8A3A, pale lime-green #C8D870, geometric spirals #6A9A2A, dark outline #0A1A0A", "Striking fractal spiral head of vivid lime-green romanesco with perfect pointed logarithmic spirals radiating from centre."),
    # Vegetables - Asian Greens
    "pak choy":              ("vegetable-asian_pak-choy",          "S",  160, "Asian Green",      "plant",   "bright green #5AB83A, deep green #2A5A1A, pure white stems #F5F0E8, dark outline #0A1A0A", "Compact rosette of glossy bright green leaves on thick white crunchy stems, very clean and fresh."),
    "napa cabbage":          ("vegetable-asian_napa-cabbage",      "M",  256, "Asian Green",      "plant",   "pale yellow-green #C8D870, mid green #4A8A3A, cream-white centre #F5F0E8, dark outline #0A1A0A", "Tall oval-shaped head of pale crinkly yellow-green leaves forming a tight elongated barrel shape."),
    "chinese cabbage":       ("vegetable-asian_napa-cabbage",      "M",  256, "Asian Green",      "plant",   "pale yellow-green #C8D870, mid green #4A8A3A, cream-white centre #F5F0E8, dark outline #0A1A0A", "Tall oval-shaped head of pale crinkly yellow-green leaves forming a tight elongated barrel shape."),
    "mizuna":                ("vegetable-asian_mizuna",            "S",  160, "Asian Green",      "plant",   "bright green #5AB83A, mid green #4A8A3A, deep green #2A5A1A, pale stems #D4E8C0, dark outline #0A1A0A", "Low spreading rosette of deeply pinnate feathery bright green leaves with narrow lobes, very frilly."),
    "tatsoi":                ("vegetable-asian_tatsoi",            "S",  160, "Asian Green",      "plant",   "deep glossy green #1A6A3A, mid green #3A8A5A, white stems #F5F0E8, dark outline #0A1A10", "Perfect flat rosette of deep glossy rounded spoon-shaped leaves spreading symmetrically from centre."),
    "garland chrysanthemum": ("vegetable-asian_garland-chrysanthemum", "M", 256, "Asian Green",  "plant",   "bright green #5AB83A, mid green #4A8A3A, golden-yellow flowers #FFD700, pale yellow #FFE870, dark outline #0A1A0A", "Bushy plant with finely divided aromatic leaves and bright golden daisy-like flowers at tips."),
    "water spinach":         ("vegetable-asian_water-spinach",    "M",  256, "Asian Green",      "plant",   "vivid green #5AB83A, deep green #2A6A3A, pale stems #D4E8C0, hollow stems #8ABF6A, dark outline #0A1A0A", "Sprawling aquatic plant with hollow stems and arrow-shaped vivid green leaves."),
    "chinese spinach":       ("vegetable-asian_chinese-spinach",  "M",  256, "Asian Green",      "plant",   "deep magenta-red #C41250, vivid red #E82050, deep green #2A5A1A, dark outline #1A0A0A", "Upright bushy plant with broad pointed leaves in striking red-green colouring."),
    # Vegetables - Perennial
    "sea kale":              ("vegetable-perennial_sea-kale",     "M",  256, "Perennial Vegetable", "plant", "blue-grey green #6A8A9A, silver-blue #8AAFC0, white flowers #F5F0E8, dark outline #0A1018", "Bold architectural plant with large blue-grey wavy-edged leaves and dense clusters of small white flowers on tall stems."),
    "nine-star broccoli":    ("vegetable-perennial_nine-star-broccoli", "L", 384, "Perennial Vegetable", "plant", "deep blue-green #2A6A4A, mid green #4A8A5A, pale cream-white heads #F0EEE0, dark outline #0A1A10", "Large perennial brassica plant with multiple small creamy-white sprouting broccoli heads at branch tips."),
    "turkish rocket":        ("vegetable-perennial_turkish-rocket", "M", 256, "Perennial Vegetable", "plant", "mid green #4A8A3A, bright green #5AB83A, vivid yellow flowers #FFD700, pale green #8ABF6A, dark outline #0A1A0A", "Bushy leafy plant with bright green lobed leaves and clusters of small vivid yellow mustard-family flowers."),
    "perennial leek":        ("vegetable-perennial_perennial-leek", "M", 256, "Perennial Vegetable", "plant", "blue-green strap #6A9A7A, mid green #4A8A5A, pale white base #F0EEE8, dark outline #0A1A10", "Vertical bunch of leeks with long green tops. Multiple whole leeks bundled together upright, showing white base bulbs at the bottom and long flat green strap leaves extending upward. No flowers. No soil."),
    # Fruit - Stone
    "apricot":               ("tree-fruit_apricot",               "L",  384, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, warm golden-orange apricot #E89040, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural rounded leafy canopy. Small clusters of warm golden-orange apricot fruit as accent. Canopy fills the frame."),
    "nectarine":             ("tree-fruit_nectarine",             "L",  384, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, vivid red-yellow nectarine #D44A2A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural rounded leafy deciduous canopy. Red-yellow smooth-skinned nectarine fruit as accent. Canopy fills the frame."),
    "damson":                ("tree-fruit_damson",                "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, deep purple-blue damson #4A2A7A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural compact rounded canopy. Small deep purple-blue damson plums as accent. Canopy fills the frame."),
    "greengage":             ("tree-fruit_greengage",             "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, golden-green greengage #A8C840, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural rounded compact canopy. Small golden-green round plum fruit as accent. Canopy fills the frame."),
    "sloe":                  ("tree-fruit_sloe",                  "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, blue-black sloe berries #2A1A4A, white blossom #F8F8F0, warm brown limbs #6B3A2A", "Compact spiny shrub-like canopy with white spring blossom and clusters of tiny blue-black sloe berries."),
    "blackthorn":            ("tree-fruit_sloe",                  "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, blue-black sloe berries #2A1A4A, white blossom #F8F8F0, warm brown limbs #6B3A2A", "Compact spiny shrub-like canopy with white spring blossom and clusters of tiny blue-black sloe berries."),
    "mirabelle":             ("tree-fruit_mirabelle",             "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, golden-yellow mirabelle #FFD700, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural rounded compact canopy. Clusters of tiny golden-yellow round mirabelle plums as accent. Canopy fills the frame."),
    "almond":                ("tree-fruit_almond",                "L",  384, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, pale pink blossom #F5C8D8, green velvet hull #8ABF5A, warm brown limbs #6B3A2A", "Natural spreading canopy. Pale pink spring blossom and green velvety almond hulls as accents. Canopy fills the frame."),
    # Fruit - Citrus
    "orange":                ("tree-fruit_orange",                "L",  384, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, vivid orange fruit #E87820, warm brown limbs #6B3A2A, pale yellow #D4C870", "Dense glossy evergreen canopy with vivid round orange fruits as accent. Canopy fills the frame."),
    "lime":                  ("tree-fruit_lime",                  "M",  256, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, vivid lime-green fruit #6ABF2A, warm brown limbs #6B3A2A, bright green #8ABF5A", "Dense compact glossy canopy with vivid small round lime-green fruits as accent. Canopy fills the frame."),
    "grapefruit":            ("tree-fruit_grapefruit",            "L",  384, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, pale golden-yellow grapefruit #E8D050, warm brown limbs #6B3A2A, bright green #8ABF5A", "Dense glossy canopy with large pale golden-yellow grapefruit as accent. Canopy fills the frame."),
    "mandarin":              ("tree-fruit_mandarin",              "M",  256, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, vivid orange mandarin #E87020, warm brown limbs #6B3A2A, bright green #8ABF5A", "Compact glossy canopy with clusters of small vivid orange mandarin fruits as accent. Canopy fills the frame."),
    "clementine":            ("tree-fruit_mandarin",              "M",  256, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, vivid orange mandarin #E87020, warm brown limbs #6B3A2A, bright green #8ABF5A", "Compact glossy canopy with clusters of small vivid orange mandarin fruits as accent. Canopy fills the frame."),
    "meyer lemon":           ("tree-fruit_meyer-lemon",           "M",  256, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, pale golden-yellow lemon #E8D050, warm brown limbs #6B3A2A, bright green #8ABF5A", "Compact bushy glossy canopy with round pale golden-yellow meyer lemons as accent. Rounder softer than regular lemon."),
    "kumquat":               ("tree-fruit_kumquat",               "S",  160, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, vivid orange kumquat #E87020, warm brown limbs #6B3A2A, bright green #8ABF5A", "Small compact glossy shrub with clusters of tiny oval vivid orange kumquat fruits. Much smaller than other citrus."),
    "blood orange":          ("tree-fruit_blood-orange",          "M",  256, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, deep red-orange fruit #C84A2A, dark crimson blush #8B1A2A, warm brown limbs #6B3A2A", "Dense glossy canopy with distinctive deep red-blushed orange fruits. Darker more dramatic colour than regular orange."),
    "pomelo":                ("tree-fruit_pomelo",                "L",  384, "Citrus Fruit",     "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, very large pale green-yellow pomelo #C8D870, warm brown limbs #6B3A2A, bright green #8ABF5A", "Dense glossy canopy with very large pale greenish-yellow pomelo fruits, noticeably bigger than other citrus."),
    # Fruit - Berry
    "strawberry":            ("fruit-berry_strawberry",           "XS", 160, "Berry Fruit",      "plant",   "vivid red #D42B2B, deep red #A01A1A, bright green trifoliate leaves #5AB83A, pale pink flower #F5C8D8, dark outline #1A0A0A", "Low spreading mat of trifoliate toothed leaves with bright red heart-shaped strawberries and runners."),
    "white currant":         ("fruit-berry_white-currant",        "S",  160, "Berry Fruit",      "plant",   "mid green #4A8A3A, pale translucent white berries #F5F0E8, cream-white clusters #E8E0D0, dark outline #0A1A0A", "Compact bushy shrub with drooping strigs of translucent pale white-cream currant berries."),
    "boysenberry":           ("fruit-berry_boysenberry",          "M",  256, "Berry Fruit",      "plant",   "deep purple-red #6B1A2A, vivid dark red #8B2A2A, mid green cane #4A8A3A, pale pink blossom #F5C8D8, dark outline #1A0A1A", "Arching cane with deeply lobed leaves and large dark purple-red compound berries."),
    "loganberry":            ("fruit-berry_loganberry",           "M",  256, "Berry Fruit",      "plant",   "deep red #8B1A2A, vivid red #C42A2A, mid green cane #4A8A3A, pale pink blossom #F5C8D8, dark outline #1A0A0A", "Arching cane with lobed leaves and elongated dark red compound berries, longer than raspberry."),
    "tayberry":              ("fruit-berry_tayberry",             "M",  256, "Berry Fruit",      "plant",   "deep purple-red #7B1A2A, vivid red #B82A2A, mid green cane #4A8A3A, pale pink blossom #F5C8D8, dark outline #1A0A1A", "Arching cane with lobed leaves and large elongated deep purple-red compound berries."),
    # Fruit - Vine
    "table grape":           ("fruit-vine_table-grape",           "XL", 512, "Vine Fruit",       "plant",   "mid green #4A8A3A, deep green #2A5A1A, deep purple-black grapes #3A1A5A, pale green grapes #C8D870, dark outline #0A0A1A", "Climbing vine with large lobed leaves and hanging pendulous clusters of round grapes in deep purple-black."),
    "wine grape":            ("fruit-vine_wine-grape",            "XL", 512, "Vine Fruit",       "plant",   "mid green #4A8A3A, deep green #2A5A1A, deep burgundy grapes #5A1A3A, pale green autumn leaves #C8D870, dark outline #0A0A1A", "Climbing vine with lobed leaves and tight dense clusters of small dark burgundy wine grapes."),
    "kiwi":                  ("fruit-vine_kiwi",                  "XL", 512, "Vine Fruit",       "plant",   "deep green #2A6A3A, mid green #4A8A5A, brown fuzzy kiwi #8A5A2A, pale cream flesh hint #F0E8C8, dark outline #0A1A10", "Vigorous climbing vine with large heart-shaped leaves and clusters of oval fuzzy brown kiwifruit."),
    "hardy kiwi":            ("fruit-vine_hardy-kiwi",            "XL", 512, "Vine Fruit",       "plant",   "deep green #2A6A3A, mid green #4A8A5A, smooth green mini kiwi #6AAF3A, pale green #A8C870, dark outline #0A1A10", "Climbing vine with smaller leaves and clusters of smooth small grape-sized green kiwi fruit."),
    "passion fruit":         ("fruit-vine_passion-fruit",         "XL", 512, "Vine Fruit",       "plant",   "mid green #4A8A3A, deep green #2A6A3A, vivid purple passion fruit #5A1A7A, exotic purple-white flower #9A5AC8, dark outline #0A0A1A", "Climbing vine with exotic star-shaped purple-white flowers and round deep purple passion fruits."),
    "dragon fruit":          ("fruit-vine_dragon-fruit",          "L",  384, "Vine Fruit",       "plant",   "vivid pink #E8208A, deep green ribs #2A6A3A, white flesh hint #F5F0E8, green scale tips #5AB83A, dark outline #1A0A2A", "Climbing cactus-like vine with vivid hot pink scaled fruit with green-tipped scales and trailing stems."),
    # Fruit - Tropical
    "mango":                 ("tree-fruit_mango",                 "XL", 512, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, glossy mid-green #3A8A5A, vivid golden-red mango #E87820, deep red blush #C84A2A, warm brown limbs #6B3A2A", "Dense spreading glossy-leaved canopy with vivid golden-orange mango fruit with red blush as accent."),
    "papaya":                ("tree-fruit_papaya",                "L",  384, "Tropical Fruit",   "plant",   "deep green #1A6A3A, mid-green #3A8A5A, golden-orange papaya #E8A020, pale yellow #D4C870, green stem trunk #4A8A5A, dark outline #0A1A10", "Tall unbranched trunk with crown of large deeply-lobed star-shaped leaves and cluster of large golden-orange papaya fruits at crown."),
    "guava":                 ("tree-fruit_guava",                 "L",  384, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, pale yellow-green guava #C8D870, warm pink blush #E8A090, warm brown limbs #6B3A2A", "Rounded compact canopy with oval pale yellow-green guava fruits with subtle pink blush as accent."),
    "avocado":               ("tree-fruit_avocado",               "XL", 512, "Tropical Fruit",   "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, dark purple-green avocado #3A4A2A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Spreading glossy-leaved canopy with distinctive pear-shaped dark purple-green avocado fruit as accent."),
    "lychee":                ("tree-fruit_lychee",                "L",  384, "Tropical Fruit",   "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, vivid red lychee #C42A2A, pale pink #F5A0A0, warm brown limbs #6B3A2A", "Dense rounded canopy with clusters of small bright red warty-skinned lychee fruits as accent."),
    "pineapple":             ("fruit-tropical_pineapple",         "M",  256, "Tropical Fruit",   "plant",   "golden-yellow #D4A020, vivid yellow #E8C040, deep green crown #2A6A3A, spiky blue-green leaves #5A8A7A, dark outline #0A1A10", "Ground-growing plant with stiff spiky blue-green bromeliad leaves and a large golden-yellow pineapple at centre."),
    "starfruit":             ("tree-fruit_starfruit",             "L",  384, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, vivid golden-yellow starfruit #D4C040, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Rounded spreading canopy with distinctive golden-yellow star-shaped carambola fruits as accent."),
    "carambola":             ("tree-fruit_starfruit",             "L",  384, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, vivid golden-yellow starfruit #D4C040, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Rounded spreading canopy with distinctive golden-yellow star-shaped carambola fruits as accent."),
    "feijoa":                ("tree-fruit_feijoa",                "L",  384, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, grey-green #7A9A7A, oval green-grey feijoa #8AAF7A, vivid red-pink flower #E8207A, warm brown limbs #6B3A2A", "Compact rounded canopy with silvery-green leaves and oval feijoa fruits and exotic red-pink flowers as accent."),
    "jaboticaba":            ("tree-fruit_jaboticaba",            "M",  256, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, deep purple-black berries #1A0A2A, warm brown trunk #6B3A2A, pale bark #C8B8A8", "Unusual shrub-tree with fruit growing directly on the trunk and main branches in clusters of deep purple-black berries."),
    "jackfruit":             ("tree-fruit_jackfruit",             "XXL", 512, "Tropical Fruit",  "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, enormous green-brown jackfruit #8A7A4A, spiky skin #6A5A3A, warm brown trunk #6B3A2A", "Large tropical canopy with truly enormous spiky oval jackfruit visible on the trunk and branches."),
    # Fruit - Melons
    "watermelon":            ("fruit-melon_watermelon",           "L",  384, "Melon",            "plant",   "deep green stripes #2A6A3A, pale green stripes #8ABF6A, vivid red flesh hint #C42A2A, mid green vines #4A8A3A, dark outline #0A1A0A", "Sprawling vine with large green leaves and a big round watermelon with distinctive dark and light green stripes."),
    "cantaloupe":            ("fruit-melon_cantaloupe",           "M",  256, "Melon",            "plant",   "tan-cream netting #C8A870, warm golden #D4A050, orange flesh hint #E87820, mid green vine #4A8A3A, dark outline #0A1A0A", "Compact vine with large leaves and a round tan-netted cantaloupe melon with orange flesh visible at stem end."),
    "honeydew":              ("fruit-melon_honeydew",             "M",  256, "Melon",            "plant",   "smooth pale green-cream #C8D8B8, pale yellow #D4C870, cool white-green #D8E8D0, mid green vine #4A8A3A, dark outline #0A1A10", "Compact vine with large leaves and a smooth oval pale cream-green honeydew melon."),
    "charentais melon":      ("fruit-melon_charentais",           "M",  256, "Melon",            "plant",   "pale grey-green #B8C8B0, subtle ribbing #A8B8A0, vivid orange flesh hint #E87820, mid green vine #4A8A3A, dark outline #0A1A10", "Compact vine with a small pale grey-green round ribbed charentais melon, intensely aromatic French variety."),
    "galia melon":           ("fruit-melon_galia",                "M",  256, "Melon",            "plant",   "tan netted skin #C8A870, pale green-gold #C8C870, mid green vine #4A8A3A, dark outline #0A1A0A", "Compact vine with a netted-skin galia melon, similar to cantaloupe but with greenish-gold interior."),
    "winter melon":          ("fruit-melon_winter-melon",         "XL", 512, "Melon",            "plant",   "deep green wax #2A6A4A, pale waxy blue-green #7A9A8A, white waxy bloom #E8EEE8, mid green vine #4A8A3A, dark outline #0A1A10", "Large climbing vine with enormous pale waxy blue-green oblong winter melon with white powdery bloom."),
    # Fruit - Nuts
    "walnut":                ("tree-nut_walnut",                  "XXL", 512, "Nut",             "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, green-hulled walnut #5A7A3A, pale brown nut #C8A870, warm brown limbs #6B3A2A", "Massive spreading canopy with large pinnate leaves and round green-hulled walnuts as accent."),
    "chestnut":              ("tree-nut_chestnut",                "XXL", 512, "Nut",             "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, spiky green burr #5A7A3A, warm brown chestnut #8A5A2A, warm brown limbs #6B3A2A", "Large spreading canopy with distinctive spiky green burrs containing shiny brown chestnuts as accent."),
    "pecan":                 ("tree-nut_pecan",                   "XL", 512, "Nut",             "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, elongated tan pecan #C8A870, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Large spreading canopy with long pinnate leaves and elongated oval tan pecan nuts in green husks as accent."),
    "macadamia":             ("tree-nut_macadamia",               "L",  384, "Nut",             "plant",   "deep glossy green #1A6A3A, mid-green #3A8A5A, round tan macadamia #C8A870, white flower spike #F5F0E8, dark outline #0A1A10", "Dense evergreen canopy with long glossy leaves and clusters of round hard-shelled macadamia nuts on strings."),
    "pistachio":             ("tree-nut_pistachio",               "L",  384, "Nut",             "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, pale tan split shell #D4B870, vivid green nut #6AAF3A, warm brown limbs #6B3A2A", "Spreading compact canopy with clusters of tan split-shell pistachio nuts showing vivid green nut inside as accent."),
    # ── Fruit Trees — Pome ──────────────────────────────────────────────────────────────
    "quince":            ("tree-fruit_quince",          "XL", 512, "Fruit Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, golden-yellow quince #E8C040, warm brown limbs #6B3A2A, pale yellow-green accents #B8D474", "Natural leafy deciduous canopy. Minimal golden-yellow fruit as accent. Canopy fills the frame."),
    "medlar":            ("tree-fruit_medlar",          "XL", 512, "Fruit Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, russet-brown medlar fruit #8B4A1A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural rounded leafy canopy. Only a tiny hint of very small russet-brown fruit barely visible as a subtle accent — fruit must be very small relative to the canopy. Canopy fills the frame."),
    "loquat":            ("tree-fruit_loquat",          "XL", 512, "Fruit Tree", "deciduous", "deep glossy green #1A5C2A, mid-green #3A8A3A, orange-yellow loquat fruit #E8821A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural dense glossy-leaved evergreen canopy. Clusters of orange-yellow fruit as accent. Canopy fills the frame."),
    "nashi pear":        ("tree-fruit_nashi-pear",      "XL", 512, "Fruit Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, pale golden-green nashi fruit #D4C870, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural leafy deciduous canopy. Round pale golden-green fruit as accent. Canopy fills the frame."),
    "asian pear":        ("tree-fruit_nashi-pear",      "XL", 512, "Fruit Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, pale golden-green nashi fruit #D4C870, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural leafy deciduous canopy. Round pale golden-green fruit as accent. Canopy fills the frame."),

    # ── Perennials ──────────────────────────────────────────────────────────────────────
    "feverfew":          ("flower-daisy_feverfew",       "S",  160, "Perennial", "plant", "bright white petals #F8F8F0, vivid yellow centre #FFD700, mid green #4A8A5A, pale green #8ABF6A, dark outline #0A1A0A", "Compact bushy plant with masses of small white daisy-like flowers with bright yellow button centres, ferny aromatic foliage."),

    # ── Herbs — Culinary ─────────────────────────────────────────────────────────────────
    "dill":              ("herb-culinary_dill",          "M",  256, "Herb", "plant", "bright yellow-green #C8E04A, mid-green #6A9A2A, soft olive #8FA040, pale yellow-green umbels #D4E870, dark stem #3A5A10", "Correct proportions. No roots."),
    "cilantro":          ("herb-culinary_cilantro",       "S",  160, "Herb", "plant", "bright green #5AAF2A, mid-green #3A8A10, pale green #8FD060, soft white flower #F0F0E0, dark stem #2A5010", "Fully grown bushy plant. Delicate lacy flat leaves fanning out with tiny white flower clusters at tips, stems at bottom and leafy florals at the top."),
    "coriander":         ("herb-culinary_cilantro",       "S",  160, "Herb", "plant", "bright green #5AAF2A, mid-green #3A8A10, pale green #8FD060, soft white flower #F0F0E0, dark stem #2A5010", "Fully grown bushy plant. Delicate lacy flat leaves fanning out with tiny white flower clusters at tips, stems at bottom and leafy florals at the top."),
    "oregano":           ("herb-culinary_oregano",        "S",  160, "Herb", "plant", "mid-green #5A8A2A, deep green #2A5A10, olive green #7A9040, soft purple flower #B070C0, warm brown stem #6A4020", "Small bushy herb. Compact mound of small oval leaves with tiny purple flower clusters at tips, stems at bottom and leafy florals at the top."),
    "lemon balm":        ("herb-culinary_lemon-balm",     "M",  256, "Herb", "plant", "bright yellow-green #A8D040, mid-green #5A9020, pale lemon #E0EF80, deep green #2A5A10, warm brown stem #7A5030", "Bushy rounded herb mound with crinkled textured leaves and small white flower clusters, stems at bottom and leafy florals at the top."),
    "tarragon":          ("herb-culinary_tarragon",       "M",  256, "Herb", "plant", "grey-green #7A9A60, mid-green #4A7A30, pale silver-green #A8C090, deep green #2A5010, warm brown stem #6A4020", "A FULL BUSHY ROUNDED SHRUB — NOT a single branch. Many upright stems radiating from the base forming a dense bushy mound. Narrow lance-shaped grey-green leaves densely covering all stems. Entire plant visible, fills 75% of canvas."),
    "french tarragon":   ("herb-culinary_tarragon",       "M",  256, "Herb", "plant", "grey-green #7A9A60, mid-green #4A7A30, pale silver-green #A8C090, deep green #2A5010, warm brown stem #6A4020", "Small bushy herb. Upright slim plant with narrow lance-shaped leaves along arching stems, stems at bottom and leafy florals at the top."),
    "chervil":           ("herb-culinary_chervil",        "M",  256, "Herb", "plant", "bright green #5AAF2A, mid-green #3A8A10, pale green #8FD060, soft white flower #F0F0E0, dark stem #2A5010", "Small bush. Delicate lacy finely divided leaves with small white umbrella flower clusters at tips, stems at bottom and leafy florals at the top."),
    "fennel":            ("herb-culinary_fennel",         "M", 256, "Herb", "plant", "bright yellow-green #C8E04A, mid-green #6A9A2A, soft olive #8FA040, pale green #A8C870, dark stem #3A5A10", "Correct proportions. No roots."),
    "caraway":           ("herb-culinary_caraway",        "M",  256, "Herb", "plant", "mid-green #5A8A2A, bright green #7ABF4A, pale green #A8D870, soft white flower #F0F0E0, dark stem #2A5010", "Small bush. Upright plant with finely cut ferny leaves and small white umbrella flower clusters, stems at bottom and leafy florals at the top."),
    "lovage":            ("herb-culinary_lovage",         "XL", 512, "Herb", "plant", "deep glossy green #2A6A1A, mid-green #4A8A2A, bright green #6AAF3A, golden yellow flower #E8C050, dark stem #1A3A10", "Small bush. Tall robust plant with large divided celery-like glossy leaves and flat yellow-green flower umbels at top, stems at bottom and leafy florals at the top."),
    "anise":             ("herb-culinary_anise",          "M",  256, "Herb", "plant", "mid-green #5A8A2A, bright green #7ABF4A, pale green #A8D870, creamy white flower #F5F0E0, dark stem #2A5010", "Small bush. Upright plant with rounded lower leaves and finely divided upper leaves, small creamy-white umbrella flower clusters at tips, stems at bottom and leafy florals at the top."),
    "horseradish":       ("herb-culinary_horseradish",     "M",  256, "Herb", "plant", "deep glossy green #2A6A1A, bright green #4AAF2A, mid-green #5A8A2A, pale green #8ABF6A, dark stem #1A3A10", "Small bush. Natural full grown plant. Bold upright clump of very large broad strap-like wrinkled glossy leaves, stems at bottom and leafy growth filling the frame."),
    "chives":            ("herb-small_chives",           "M",  256, "Herb", "plant", "bright green #5AB83A, mid-green #4A7C2F, pale purple pompom flowers #C8A8E8, dark outline #0A1A0A", "Dense clump of long hollow cylindrical grass-like green chive leaves growing upright. Small round purple pompom flowers on tall stalks. Full bushy clump. Correct proportions. No roots."),
    "parsley herb":      ("herb-small_parsley",           "M",  256, "Herb", "plant", "bright green #5AB83A, mid-green #4A7C2F, deep green #2A5A1A, dark outline #0A1A0A", "Dense bushy clump of deeply divided curly bright green parsley leaves. Full bushy mound. Correct proportions. No roots."),
    "garlic chives":     ("herb-culinary_garlic-chives",   "S",  160, "Herb", "plant", "bright green #5AB83A, mid-green #3A8A10, pale green #8FD060, white flower cluster #F5F5F0, dark stem #2A5010", "Small bush. Natural full grown plant. Upright clump of flat narrow strap leaves topped with globe-shaped white flower clusters, stems at bottom and florals at the top."),
    "vietnamese coriander": ("herb-culinary_vietnamese-coriander", "S", 160, "Herb", "plant", "mid-green #5A8A2A, deep green #2A5A10, burgundy-red leaf markings #8B1A2A, pale green #8FD060, dark stem #2A5010", "Small bush. Natural full grown plant. Spreading clump of narrow pointed leaves with distinctive dark V-shaped chevron markings, stems at bottom and leafy growth at the top."),
    "cumin":             ("herb-culinary_cumin",           "S",  160, "Herb", "plant", "mid-green #5A8A2A, bright green #7ABF4A, pale green #A8D870, white-pink flower #F0E8E0, dark stem #2A5010", "Small bush. Natural full grown plant. Slender upright plant with fine thread-like leaves and small white-pink umbrella flower clusters at tips, stems at bottom and leafy florals at the top."),
    "st johns wort":     ("herb-medicinal_st-johns-wort",  "M",  256, "Herb", "plant", "bright yellow #FFD700, golden yellow #E8C050, mid-green #5A8A2A, deep green #2A5A10, dark stem #3A5A10", "Small bush. Natural full grown plant. Bushy upright plant with small oval leaves and masses of bright five-petalled yellow star-shaped flowers, stems at bottom and florals at the top."),
    "valerian":          ("herb-medicinal_valerian",       "L",  384, "Herb", "plant", "pale pink flower #F0B8C8, mid-green #5A8A2A, deep green #2A5A10, white flower clusters #F5F5F0, dark stem #2A5010", "Small bush. Natural full grown plant. Tall upright plant with pinnate feathery leaves and large domed clusters of tiny pale pink-white flowers at the top, stems at bottom and florals at the top."),
    "german chamomile":  ("herb-medicinal_german-chamomile", "S", 160, "Herb", "plant", "bright white petals #F8F8F0, vivid yellow centre #FFD700, mid-green #5A8A2A, pale green #8ABF6A, dark stem #2A5010", "Small bush. Natural full grown plant. Compact branching plant with finely divided ferny leaves and masses of small white daisy flowers with bright yellow centres, stems at bottom and florals at the top."),
    "comfrey":           ("herb-medicinal_comfrey",         "L",  384, "Herb", "plant", "soft purple #9070C0, mid purple #7A50A0, mid-green #5A8A2A, deep green #2A5A10, dark stem #2A5010", "Small bush. Natural full grown plant. Bold large-leaved plant with rough hairy leaves and drooping clusters of tubular purple-pink bell-shaped flowers on arching stems, stems at bottom and florals at the top."),
    "hyssop":            ("herb-medicinal_hyssop",          "M",  256, "Herb", "plant", "vivid blue-violet #5535A8, mid blue #6A50C0, mid-green #5A8A2A, deep green #2A5A10, dark stem #2A5010", "Small bush. Natural full grown plant. Upright woody herb with narrow dark green leaves and dense spikes of vivid blue-violet tubular flowers running up the stems, stems at bottom and florals at the top."),
    "lemon verbena":     ("herb-medicinal_lemon-verbena",   "M",  256, "Herb", "plant", "pale lilac flower #D0B8E8, bright green #5AB83A, mid-green #3A8A10, pale green #8FD060, dark stem #2A5010", "Small bush. Natural full grown plant. Upright woody shrub with long lance-shaped bright green lemon-scented leaves and small pale lilac flower spikes at tips, stems at bottom and leafy growth at the top."),
    "sweet marjoram":    ("herb-medicinal_sweet-marjoram",   "M",  256, "Herb", "plant", "soft green #6A9A3A, mid-green #4A7A20, pale green #9AD060, tiny white-pink flowers #F0EAE8, dark stem #2A5010", "A FULL BUSHY ROUNDED SHRUB — NOT a single branch or stem. Multiple branching stems radiating from the base forming a dense compact mound. Entire plant visible. Small rounded leaves covering all stems. Tiny white-pink flower clusters at tips. Fills 75% of canvas."),
    "mugwort":           ("herb-medicinal_mugwort",          "L",  384, "Herb", "plant", "deep green #3A6A20, silver-grey underside #B8C8B0, pale grey-green #8AAA7A, dark stem #2A4A10, tiny pale flower #D8D8C8", "Small bush. Fully grown bushy plant. Tall upright branching plant with deeply lobed dark green leaves with silver-grey undersides and small clusters of tiny pale yellowish flowers along arching stems, stems at bottom and leafy growth at the top."),
    "rue":               ("herb-medicinal_rue",              "M",  256, "Herb", "plant", "blue-grey green #7A9A7A, mid grey-green #5A7A5A, soft yellow flower #E8D860, pale blue-green #A8C0A0, dark stem #3A5A30", "Small bush. Fully grown bushy plant. Compact rounded shrubby plant with distinctive blue-grey deeply divided fan-shaped leaves and small bright yellow four-petalled flowers at tips, stems at bottom and leafy growth at the top."),
    "wormwood":          ("herb-medicinal_wormwood",         "L",  384, "Herb", "plant", "silver-grey #B8C8B0, pale grey-green #A0B890, soft grey #C8D0C0, dark stem #4A5A40, tiny yellow flower #D8C850", "Small bush. Fully grown bushy plant. Tall silvery-grey aromatic plant with deeply divided silky silver leaves and tall branching stems with small round pale yellow button flowers, stems at bottom and silvery-grey leafy growth at the top."),
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

def detect_background_chroma(image_path):
    """
    Auto-detect the background chroma colour from the raw Gemini image.
    Samples the four corners of the image and finds the most saturated / pure colour.
    Returns a hex string like 'FF00FF', '00FFFF', 'FFFF00', or None (defaults to magenta).
    """
    try:
        from PIL import Image as PILImage
        import numpy as np
        img = PILImage.open(image_path).convert('RGB')
        w, h = img.size
        margin = max(10, min(w, h) // 20)  # sample 5% of shorter edge
        # Sample corners
        corners = [
            img.crop((0, 0, margin, margin)),
            img.crop((w - margin, 0, w, margin)),
            img.crop((0, h - margin, margin, h)),
            img.crop((w - margin, h - margin, w, h)),
        ]
        samples = []
        for c in corners:
            arr = np.array(c, dtype=np.float32).reshape(-1, 3)
            samples.append(arr.mean(axis=0))
        # Average across corners
        avg = np.mean(samples, axis=0)  # [R, G, B]
        r, g, b = avg
        # Classify by dominant channel(s)
        threshold = 140  # channel must be this bright to count as "on"
        dark = 80        # channel must be below this to count as "off"
        if r > threshold and b > threshold and g < dark:
            return 'FF00FF'  # magenta
        elif g > threshold and b > threshold and r < dark:
            return '00FFFF'  # cyan
        elif r > threshold and g > threshold and b < dark:
            return 'FFFF00'  # neon yellow
        elif g > threshold and r < dark and b < dark:
            return '00FF00'  # green
        else:
            # Default to magenta (most common Gemini output)
            return 'FF00FF'
    except Exception as e:
        p(f"  [warn] chroma detection failed: {e} — defaulting to magenta")
        return 'FF00FF'


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
    # Strip any existing background colour spec from the colours string (prevent duplicates).
    # Rule: if the colours string already contains a background spec, use it as-is.
    # Otherwise, append the default magenta background.
    import re as _re
    # Match: "flat solid <any words> background (#RRGGBB)" — handles multi-word colour names like "neon yellow"
    _bg_pattern = _re.compile(r',?\s*flat solid [\w\s]+ background \(#[0-9A-Fa-f]{6}\)', _re.IGNORECASE)
    _bg_match = _bg_pattern.search(colours)
    colours_has_bg = bool(_bg_match)
    colours_clean = _bg_pattern.sub('', colours).strip().rstrip(',')
    # Determine background line: use what's in colours if specified, else default magenta
    if colours_has_bg:
        bg_spec = _bg_match.group(0).strip().lstrip(',')
    else:
        bg_spec = 'flat solid magenta background (#FF00FF)'
    colours_line = f"{colours_clean}, {bg_spec}"

    prefix = TEMPLATES[template]
    if template == "deciduous":
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}, No trunk.\n"
            f"Canvas: {size_px}px square.\n"
            f"Suggested Colours: {colours_line}\n"
            f"Shape: Natural full leafy canopy, distinctive lobed leaf shapes visible. No trunk. No branches. Canopy fills the frame. Spring/summer only. No fall colours."
        )
    elif template == "rootveg":
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}, vegetable.\n"
            f"Canvas: {size_px}px square.\n"
            f"Suggested Colours: {colours_line}\n"
            f"Shape: {shape} Natural proportions."
        )
    elif template == "cedar":
        prompt = (
            f"{prefix}\n\n"
            f"Subject: Cedar Thuja Conical Tree, no trunk.\n"
            f"Canvas: {size_px}px square.\n"
            f"Suggested Colours: {colours_line}\n"
            f"Shape: Correct proportions."
        )
    elif template == "pine":
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}, no trunk.\n"
            f"Canvas: {size_px}px square.\n"
            f"Suggested Colours: {colours_line}\n"
            f"Shape: Correct proportions."
        )
    else:
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}.\n"
            f"Canvas: {size_px}px square.\n"
            f"Suggested Colours: {colours_line}\n"
            f"Shape: {shape}"
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
    # Always detect chroma from the raw image, not the prompt colours string.
    # Gemini ignores background colour instructions — it generates whatever it wants.
    # We auto-detect the dominant background corner colour from the raw image instead.
    pipeline_cmd = [PYTHON, PIPELINE]
    detected_chroma = detect_background_chroma(raw_path)
    if detected_chroma:
        pipeline_cmd += ["--chroma", detected_chroma]
    pipeline_cmd.append(raw_path)
    result = subprocess.run(pipeline_cmd, capture_output=True, text=True)
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

    # NOTE: --force only means "regenerate even if sticker already exists".
    # It does NOT auto-upload or auto-commit.
    # Approval gate is always required. See L032 + Workflow 2.

if __name__ == "__main__":
    main()
