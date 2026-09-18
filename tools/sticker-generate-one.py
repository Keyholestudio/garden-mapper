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
RAW_ARCHIVE = os.path.join(WORKSPACE, "stickers", "raw-archive")  # local-only, never committed to git
CATALOG    = os.path.join(WORKSPACE, "app", "src", "hooks", "usePlantCatalog.js")
GEMINI_URL = "https://gemini.google.com/app"
ROB_ACCOUNT = "contactsunsetpoetvintage"   # substring to match in signed-in account
IMAGE_WAIT  = 240
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(RAW_ARCHIVE, exist_ok=True)

# -- Prompt templates (SOURCE OF TRUTH: research/STICKER-PROMPT-GUIDE.md) ---------------------
# Do not modify without updating STICKER-PROMPT-GUIDE.md first. Last synced: 2026-07-22
# Last synced: 2026-08-11
TEMPLATES = {
    "plant": (
        "Aerial side view. Art style: moderately detailed watercolor painting - "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, bold flat icon. "
        "Dark outline 2-3px max. No shadows. "
        "The plant must be Centered - occupying only 75% of the canvas width and height, "
        "leaving a wide empty background area around all sides. Vibrant and iconic."
    ),
    "cedar": (
        "Aerial side view. Art style: moderately detailed watercolor painting - tasteful simplified representation of this plant with crisp edges, "
        "focusing on a primary characteristics of the plant, no trunk, bold flat icon. Dark outline 2-3px max. No shadows. "
        "The plant must be Centered - occupying only 75% of the canvas width and height, "
        "leaving a wide empty background area around all sides. Vibrant and iconic."
    ),
    "deciduous": (
        "Side aerial view. Art style: moderately detailed watercolor painting - "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "primary characteristics of the plant, leafy canopy only, NO TRUNK, NO STEM, NO BARK VISIBLE. "
        "Dark outline 2-3px max. No shadows. "
        "The plant must be Centered - occupying only 75% of the canvas width and height, "
        "leaving a wide empty background area around all sides. Vibrant and iconic."
    ),
    "pine": (
        "Aerial side view. Art style: moderately detailed watercolor painting - "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, no trunk, bold flat icon. Dark outline 2-3px max. "
        "No shadows. The plant must be Centered - occupying only 75% of the canvas width and height, "
        "leaving a wide empty background area around all sides. Vibrant and iconic."
    ),
    "rootveg": (
        "Side aerial view. Art style: moderately detailed watercolor painting - "
        "tasteful simplified representation of this plant with crisp edges, focusing on "
        "a primary characteristics of the plant, bold flat icon. Dark outline 2-3px max. "
        "Line texturing. No shadows. "
        "The plant must be Centered - occupying only 75% of the canvas width and height, "
        "leaving a wide empty background area around all sides. Vibrant and iconic."
    ),
}

# ── Plant lookup table ─────────────────────────────────────────────────────────
# Maps common name → (sticker_id_prefix, size_tier, size_px, family, template, colours, shape)
# Add new plants here as needed. Names are lowercase for matching.
PLANT_LOOKUP = {

    # ── Trees — Deciduous (pack-trees-deciduous) ────────────────────────────────────────
    "crabapple":         ("tree-deciduous_crabapple",    "XL", 512, "Deciduous Tree", "deciduous", "vivid pink blossom #E8407A, pale blush #F5C8D8, bright green #5AB83A, tiny red-pink fruit #C84A4A, warm brown limbs #6B3A2A", "Natural rounded leafy canopy covered in masses of vivid pink blossom. Small red-pink crabapple fruits visible as accent. No trunk."),
    "ornamental plum":   ("tree-deciduous_ornamental-plum", "L", 384, "Deciduous Tree", "deciduous", "deep purple-red foliage #5A1A2A, vivid pink blossom #E8407A, pale pink #F5C8D8, warm brown limbs #6B3A2A", "Natural rounded canopy of deep purple-red leaves with masses of vivid pink spring blossom. No trunk."),
    "dogwood":           ("tree-deciduous_dogwood",      "L",  384, "Deciduous Tree", "deciduous", "pure white bracts #F8F8F0, pale pink #F5C8D8, bright green #5AB83A, warm brown limbs #6B3A2A, vivid red berries #C84A2A", "Natural tiered spreading canopy with large showy white four-bract flowers covering the branches. No trunk."),
    "eastern redbud":    ("tree-deciduous_redbud",       "L",  384, "Deciduous Tree", "deciduous", "vivid magenta-pink #C84A7A, deep rose #A82860, bright green heart leaves #5AB83A, warm brown limbs #6B3A2A", "Natural spreading canopy with masses of vivid magenta-pink pea-like flowers covering the bare branches before leaves emerge. No trunk."),
    "judas tree":        ("tree-deciduous_judas-tree",   "L",  384, "Deciduous Tree", "deciduous", "vivid rosy-pink #D44878, deep rose #A82860, glaucous blue-green round leaves #5A8A7A, warm brown limbs #6B3A2A", "Natural spreading rounded canopy with vivid rosy-pink flowers directly on branches and trunk in spring, followed by round blue-green leaves. No trunk."),
    "laburnum":          ("tree-deciduous_laburnum",     "L",  384, "Deciduous Tree", "deciduous", "vivid golden yellow #FFD700, deep yellow #E8B020, bright green trifoliate leaves #5AB83A, warm brown limbs #6B3A2A", "Natural arching canopy with long cascading chains of vivid golden-yellow pea-like flowers. No trunk."),
    "amelanchier":       ("tree-deciduous_amelanchier",  "L",  384, "Deciduous Tree", "deciduous", "pure white blossom #F8F8F0, pale pink #F5C8D8, bright green oval leaves #5AB83A, small blue-black berries #2A1A4A, warm brown limbs #6B3A2A", "Natural multi-stemmed canopy with delicate white star-shaped spring blossom and small round berries. No trunk."),
    "ginkgo":            ("tree-deciduous_ginkgo",       "XL", 512, "Deciduous Tree", "deciduous", "vivid golden yellow #FFD700, deep yellow #E8C020, bright green fan leaves #5AB83A, pale yellow-green #C8D870, warm brown limbs #6B3A2A", "Natural spreading canopy of distinctive fan-shaped leaves. No trunk."),
    "rowan":             ("tree-deciduous_rowan",        "L",  384, "Deciduous Tree", "deciduous", "vivid scarlet-orange berries #E84A1A, mid-green pinnate leaves #4A8A3A, deep green #2A5A1A, warm brown limbs #6B3A2A", "Natural rounded canopy of pinnate leaves with large clusters of vivid scarlet-orange rowan berries. No trunk."),
    "hawthorn":          ("tree-deciduous_hawthorn",     "L",  384, "Deciduous Tree", "deciduous", "pure white blossom #F8F8F0, vivid red haws #C84A2A, bright green lobed leaves #5AB83A, warm brown limbs #6B3A2A", "Natural dense thorny rounded canopy with masses of white blossom or vivid red haw berries. No trunk."),
    "linden":            ("tree-deciduous_linden",       "XL", 512, "Deciduous Tree", "deciduous", "mid-green heart leaves #4A8A3A, bright green #5AB83A, pale yellow-green #A8D848, warm brown limbs #6B3A2A", "Natural large rounded spreading canopy of heart-shaped leaves. No trunk."),
    "european beech":    ("tree-deciduous_beech",        "XXL",512, "Deciduous Tree", "deciduous", "deep copper-purple foliage #5A2A1A, mid-green #4A8A3A, pale green-copper #8A6A4A, warm brown limbs #6B3A2A", "Natural massive domed canopy of smooth oval leaves. No trunk."),
    "horse chestnut":    ("tree-deciduous_horse-chestnut", "XXL",512, "Deciduous Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, white candle flowers #F8F8F0, warm brown limbs #6B3A2A, spiky green conker #6A8A3A", "Natural massive domed canopy with large palmate leaves and upright white flower candles. No trunk."),
    "tulip tree":        ("tree-deciduous_tulip-tree",   "XXL",512, "Deciduous Tree", "deciduous", "deep green #2A5C1A, bright green #5AB83A, vivid yellow-green tulip flowers #A8C840, warm brown limbs #6B3A2A", "Natural tall straight canopy with distinctive lobed leaves and large pale green-yellow tulip-shaped flowers. No trunk."),
    "persian ironwood":  ("tree-deciduous_persian-ironwood", "L", 384, "Deciduous Tree", "deciduous", "vivid scarlet-crimson #C84A2A, deep orange #E8703A, golden yellow #FFD700, mid-green oval leaves #4A8A3A, warm brown limbs #6B3A2A", "Natural spreading multi-stemmed canopy with spectacular fiery autumn colour. No trunk."),
    "snowbell":          ("tree-deciduous_snowbell",     "L",  384, "Deciduous Tree", "deciduous", "pure white pendant flowers #F8F8F0, bright green oval leaves #5AB83A, warm brown limbs #6B3A2A", "Natural graceful tiered canopy with masses of pendant bell-shaped white flowers hanging beneath the branches. No trunk."),
    "field maple":       ("tree-deciduous_field-maple",  "L",  384, "Deciduous Tree", "deciduous", "mid-green lobed leaves #4A8A3A, bright green #5AB83A, golden yellow autumn #E8C020, warm brown limbs #6B3A2A", "Natural rounded compact canopy of small lobed maple leaves. No trunk."),

    "sweetgum":          ("tree-deciduous_sweetgum",     "XL", 512, "Deciduous Tree", "deciduous", "vivid scarlet #C82A1A, deep orange #E87030, golden yellow #FFD700, mid-green star leaves #4A8A3A, warm brown limbs #6B3A2A", "Natural rounded conical canopy of distinctive star-shaped lobed leaves with spectacular autumn colour. No trunk."),
    "london plane":      ("tree-deciduous_london-plane",  "XXL",512, "Deciduous Tree", "deciduous", "mid-green lobed leaves #4A8A3A, bright green #5AB83A, pale cream-tan bark #D4BF9A, spiky round seed balls #8A7A5A, warm grey limbs #9A8A7A", "Natural massive spreading canopy of large lobed maple-like leaves with distinctive spiky round seed balls hanging below. No trunk."),
    "elm":               ("tree-deciduous_elm",           "XL", 512, "Deciduous Tree", "deciduous", "deep green #2A5C1A, mid-green #4A8A3A, bright green #5AB83A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural tall vase-shaped canopy of oval toothed elm leaves. No trunk."),
    "catalpa":           ("tree-deciduous_catalpa",       "XL", 512, "Deciduous Tree", "deciduous", "bright green #5AB83A, mid-green #4A8A3A, white orchid flowers #F8F8F0, pale yellow #FFE870, warm brown limbs #6B3A2A", "Natural rounded canopy of very large heart-shaped leaves with upright clusters of white orchid-like flowers with yellow markings. No trunk."),
    "white ash":         ("tree-deciduous_white-ash",     "XL", 512, "Deciduous Tree", "deciduous", "deep green pinnate leaves #2A5C1A, mid-green #4A8A3A, vivid purple-red autumn #8A2A4A, warm brown limbs #6B3A2A, golden yellow #FFD700", "Natural tall rounded canopy of compound pinnate leaves with spectacular purple-red autumn colour. No trunk."),
    "alder":             ("tree-deciduous_alder",         "L",  384, "Deciduous Tree", "deciduous", "deep green rounded leaves #2A5C1A, mid-green #4A8A3A, dark brown catkins #4A2A1A, small woody cones #3A2A1A, warm brown limbs #6B3A2A", "Natural rounded canopy of glossy rounded leaves with distinctive small woody cone-like seed clusters. No trunk."),
    "river birch":       ("tree-deciduous_river-birch",   "L",  384, "Deciduous Tree", "deciduous", "mid-green diamond leaves #4A8A3A, bright green #5AB83A, cinnamon-salmon peeling bark #C87050, pale cream inner bark #F5E0C8, warm brown limbs #6B3A2A", "Natural graceful multi-stemmed canopy with distinctive peeling cinnamon-salmon bark and small diamond-shaped leaves. No trunk."),
    "black tupelo":      ("tree-deciduous_black-tupelo",  "XL", 512, "Deciduous Tree", "deciduous", "vivid scarlet #C82A1A, deep red #A81A0A, brilliant orange #E8701A, deep glossy green #1A6A2A, warm brown limbs #6B3A2A", "Natural rounded canopy of glossy oval leaves with some of the most brilliant scarlet-red autumn colour of any tree. No trunk."),
    "pussy willow":      ("tree-deciduous_pussy-willow",  "L",  384, "Deciduous Tree", "deciduous", "silver-grey fuzzy catkins #C8C8C0, pale silver #D8D8D0, narrow lanceolate willow leaves #5AB83A, warm brown twigs #6B3A2A", "Natural rounded multi-stemmed shrubby canopy. Prominent silver-grey fuzzy oval catkin buds clustered along slender brown twigs. Small narrow lanceolate willow-shaped leaves (not round or broad). No trunk."),
    "holm oak":          ("tree-evergreen_holm-oak",      "XXL",512, "Evergreen Tree", "deciduous", "deep glossy dark green #1A4A1A, mid-green #2A6A2A, silver-grey underleaf #8AA08A, deep black-grey bark #2A2A20, warm grey limbs #7A7A6A", "Natural massive spreading domed canopy of small oval evergreen oak leaves, very dense dark foliage. No trunk."),
    "cherry laurel":     ("tree-evergreen_cherry-laurel", "L",  384, "Evergreen Tree", "deciduous", "deep glossy green #1A6A2A, rich green #2A7A3A, bright new growth #5AB83A, white flower spikes #F8F8F0, dark outline #0A1A0A", "Natural dense rounded screening canopy of large glossy dark green oval leaves with upright white flower spikes. No trunk."),
    "portugal laurel":   ("tree-evergreen_portugal-laurel", "L", 384, "Evergreen Tree", "deciduous", "deep glossy green #1A5A1A, rich green #2A7A3A, dark red-black berries #5A0A1A, red stems #8A2A1A, dark outline #0A1A0A", "Natural rounded dense canopy of glossy dark green oval leaves with small white flowers and dark red-black berries. No trunk."),
    "griselinia":        ("tree-evergreen_griselinia",    "L",  384, "Evergreen Tree", "deciduous", "vivid apple-green #6AAA3A, bright yellow-green #8ACC5A, mid-green #4A8A3A, pale cream-green #B8D890, dark outline #0A2A0A", "Natural rounded upright dense canopy of distinctive vivid apple-green oval leathery leaves. No trunk."),
    "scots pine":        ("tree-conifer_scots-pine",      "XXL",512, "Coniferous Tree", "pine", "deep forest green #1A5C2A, mid-green #2E7A3A, blue-green #4A8C6A, dark outline #0A2A10, distinctive orange-red upper bark #C87040", "Tall conical to flat-topped canopy of long paired blue-green needles. No trunk. Distinctive character."),
    "norway spruce":     ("tree-conifer_norway-spruce",   "XXL",512, "Coniferous Tree", "pine", "deep forest green #1A5C2A, mid-green #2E7A3A, blue-green #4A8C6A, dark outline #0A2A10, pale silver-green #8AAF8A", "Classic tall narrow conical christmas tree shape with dense dark green needle-covered branches in tiered layers. No trunk."),
    "douglas fir":       ("tree-conifer_douglas-fir",     "XXL",512, "Coniferous Tree", "pine", "deep forest green #1A5C2A, mid-green #2E7A3A, blue-green #4A8C6A, dark outline #0A2A10, pale silver-green #8AAF8A", "Tall narrow pyramidal conifer with dense deep green soft needles in layered horizontal branches. No trunk."),
    "larch":             ("tree-conifer_larch",            "XL", 512, "Coniferous Tree", "pine", "vivid bright green #5AB83A, mid-green #4A8A3A, warm golden yellow #FFD700, pale russet orange #C87830, warm brown limbs #6B3A2A", "Distinctive deciduous conifer with tufts of soft bright green needles on tiered branches turning golden yellow in autumn. No trunk."),
    "nordmann fir":      ("tree-conifer_nordmann-fir",    "XL", 512, "Coniferous Tree", "pine", "deep glossy dark green #1A5C2A, rich green #2E7A3A, silver-white needle undersides #D8E8D8, dark outline #0A2A10, pale silver-green #8AAF8A", "Perfect symmetrical narrow Christmas tree shape with dense dark glossy green flat needles, silver-white undersides visible. No trunk."),
    # ── Trees — Evergreen (pack-trees-evergreen) ─────────────────────────────────────
    "olive tree":        ("tree-evergreen_olive",        "L",  384, "Evergreen Tree", "deciduous", "silver-grey green foliage #8AAF82, deep grey-green #5A7A5A, tiny black olives #1A1A0A, pale silver #C8D0B8, warm grey bark #9A8A7A", "Natural gnarled spreading canopy of narrow silver-grey leaves with tiny black olives as accent. No trunk."),
    "holly":             ("tree-evergreen_holly",        "L",  384, "Evergreen Tree", "deciduous", "deep glossy green #1A6A2A, bright green #4A8A3A, vivid red berries #C84A2A, pale cream #F5F0E8, dark outline #0A1A0A", "Natural dense rounded canopy of spiny glossy green leaves with clusters of vivid red berries. No trunk."),
    "photinia":          ("tree-evergreen_photinia",     "L",  384, "Evergreen Tree", "deciduous", "vivid scarlet-red new growth #C84A2A, deep glossy green #1A6A2A, mid-green #3A8A3A, warm brown limbs #6B3A2A", "Natural dense rounded canopy with vivid scarlet-red young shoots contrasting against deep glossy green older leaves. No trunk."),
    "strawberry tree":   ("tree-evergreen_strawberry-tree", "L", 384, "Evergreen Tree", "deciduous", "deep glossy green #1A6A2A, vivid red-orange strawberry fruits #E84A1A, white pendant flowers #F8F8F0, warm brown limbs #6B3A2A", "Natural rounded compact canopy with white pendant flowers and vivid red strawberry-like fruits simultaneously. No trunk."),
    "cordyline":         ("tree-evergreen_cordyline",    "XL", 512, "Evergreen Tree", "deciduous", "deep green #1A6A2A, mid-green #3A8A5A, purple-green #4A2A4A, dark outline #0A1A0A", "Architectural palm-like plant with long sword-shaped leaves radiating from a central crown. Single stem crowned with bold strap leaves."),
    "southern magnolia": ("tree-evergreen_southern-magnolia", "XXL", 512, "Evergreen Tree", "deciduous", "deep glossy green #1A6A2A, rich green #2A7A3A, enormous white flower #F8F8F0, pale cream #F5F0E8, warm brown limbs #6B3A2A", "Natural massive rounded canopy of large glossy dark green leaves with enormous white fragrant flowers. No trunk."),
    "eucalyptus":        ("tree-evergreen_eucalyptus",   "XL", 512, "Evergreen Tree", "deciduous", "silver-blue green #7A9AB0, pale silver-green #A8C0B0, glaucous blue #6A8AA0, pale cream bark #D4C8A8, warm grey limbs #9A8A7A, flat solid cyan background (#00FFFF)", "Round open canopy of eucalyptus gum tree. Leaves are long, narrow, pendulous, sickle-curved or lance-shaped — NOT lobed, NOT round, NOT oak-shaped. Think long thin drooping grey-green strips, like classic gum tree foliage. Sparse airy canopy. No trunk."),
    "bottlebrush":       ("tree-evergreen_bottlebrush",  "L",  384, "Evergreen Tree", "deciduous", "vivid scarlet-red bottlebrush #C84A2A, deep red #A82A1A, mid-green narrow leaves #4A8A3A, pale yellow stamens #FFE870, warm brown limbs #6B3A2A", "Natural rounded canopy with vivid scarlet cylindrical bottlebrush flower spikes. No trunk."),
    "italian cypress":   ("tree-conifer_italian-cypress", "XL", 512, "Coniferous Tree", "pine", "deep forest green #1A5C1A, mid-green #2E7A2E, blue-green #3A7A3A, NO black outline, NO dark border, NO stroke around edges", "Tall narrow pencil-thin dark green columnar tree. Smooth tight foliage texture — fine needle-like texture, NOT large scales or overlapping leaf shapes. Slim flame/obelisk silhouette, tapers to a point at top, very narrow at base. No individual leaf or scale detail visible — smooth dense column of fine dark green foliage. NO dark outline or border around the tree edge."),
    "yew tree":          ("tree-conifer_yew",            "XL", 512, "Coniferous Tree", "pine", "deep dark green #1A4A1A, mid-green #2E6A2E, vivid red berry #C84A2A, dark outline #0A1A0A", "Dense dark green rounded or columnar conifer with small vivid red berried fruits (arils) visible. No trunk."),
    "monkey puzzle":     ("tree-conifer_monkey-puzzle",  "XL", 512, "Coniferous Tree", "pine", "deep forest green #1A5C1A, mid-green #2E7A2E, bright green #4A8A3A, dark outline #0A2010", "Distinctive symmetrical architectural tree with spirally arranged sharp-pointed scale-like leaves on tiered spreading branches. No trunk."),
    "dawn redwood":      ("tree-conifer_dawn-redwood",   "XXL",512, "Coniferous Tree", "pine", "vivid bright green #5AB83A, mid-green #4A8A3A, warm russet autumn #C87830, warm brown limbs #6B3A2A, dark outline #0A2010", "Natural tall conical canopy of feathery bright green pinnate needles. No trunk."),

    # ── Ornamental Grasses (pack-grasses-ornamental) ──────────────────────────────────
    "miscanthus":        ("grass-ornamental_miscanthus",   "XL", 512, "Ornamental Grass", "plant", "warm golden-buff #C8A870, pale silver-gold #E0C890, mid-green #4A8A3A, russet seed heads #A87840, dark outline #2A1A0A", "Tall arching ornamental grass with elegant feathery silver-buff plumes above long arching mid-green blades. Fountain shape. Correct proportions. No roots."),
    "pennisetum":        ("grass-ornamental_pennisetum",   "M",  256, "Ornamental Grass", "plant", "vivid burgundy-red #6A1A2A, deep purple-red #4A0A1A, mid-green #3A6A2A, fluffy purple-brown caterpillar plumes #3A1A2A, dark outline #1A0A0A", "Dense mounding ornamental grass with fuzzy bottlebrush caterpillar-like seed heads in deep purple-burgundy above fine blades. Correct proportions. No roots."),
    "stipa":             ("grass-ornamental_stipa",        "M",  256, "Ornamental Grass", "plant", "pale silver-gold #E0D090, warm straw #C8B870, mid-green #5A7A3A, pale buff feathers #E8E0B0, dark outline #2A2A1A", "Delicate feather grass with long filmy silver-gold feathery awns catching the light above a low clump of fine green blades. Correct proportions. No roots."),
    "carex":             ("grass-ornamental_carex",        "S",  160, "Ornamental Grass", "plant", "warm golden-bronze #C8A040, mid-green #4A7A2A, deep bronze #8A5A10, pale cream variegation #E8DCA0, dark outline #2A1A0A", "Low arching mound of fine bronze-gold sedge foliage with graceful arching habit. Correct proportions. No roots."),
    "festuca":           ("grass-ornamental_festuca",      "S",  160, "Ornamental Grass", "plant", "vivid steel-blue #5A8AA0, pale blue-grey #8AAFB8, silver-blue #7A9EB0, blue-green #4A7A8A, dark outline #0A1A2A", "Compact rounded dome of fine steel-blue/silver-blue needle-like grass blades. Like a spiky blue cushion. Correct proportions. No roots."),
    "molinia":           ("grass-ornamental_molinia",      "L",  384, "Ornamental Grass", "plant", "warm golden-amber #C89040, deep amber #A87020, mid-green #4A8A3A, transparent purple seed heads #8A7090, dark outline #2A1A0A", "Tall upright ornamental grass with airy purple-amber seed heads on tall wiry stems above a low base of green blades. Correct proportions. No roots. 2-3px dark border around the whole plant."),
    "deschampsia":       ("grass-ornamental_deschampsia",  "M",  256, "Ornamental Grass", "plant", "pale silver-gold #E0D090, bright green #5AB83A, mid-green #3A7A2A, silver-buff flower cloud #E8E0C0, dark outline #1A2A0A", "Graceful tufted grass with a haze of fine silver-green flower panicles floating above arching bright green blades. Correct proportions. No roots. 2-3px dark border around the entire plant including all the tall plumed seed heads and fine wispy tips."),
    "bamboo":            ("grass-ornamental_bamboo",       "XL", 512, "Ornamental Grass", "plant", "deep green #1A6A2A, mid-green #3A8A3A, bright green #5AB83A, warm olive #6A8A3A, golden-yellow cane #C8A840", "Upright clump of tall green bamboo canes with feathery side branches of narrow lance-shaped leaves. Fountain of green from a central base. Correct proportions. No roots."),
    "black bamboo":      ("grass-ornamental_black-bamboo", "XL", 512, "Ornamental Grass", "plant", "deep near-black canes #1A1A10, mid-green leaves #3A7A2A, bright green #4A8A2A, dark grey-black stem #2A2A1A, olive green #5A7A2A", "Dramatic clump of near-black bamboo canes with bright green feathery side branches. Upright then arching at top. Correct proportions. No roots."),
    "cortaderia":        ("grass-ornamental_cortaderia",   "XL", 512, "Ornamental Grass", "plant", "bright white fluffy plumes #F5F0E8, pale cream #E8E0D0, mid-green arching blades #3A8A2A, silver-white #F8F8F0, warm straw #D0C890", "Large fountain of long arching green grass blades crowned with tall bright white fluffy pampas plumes. Majestic scale. Correct proportions. No roots. 2-3px dark border around the whole plant."),

    # ── Groundcovers (pack-groundcovers) ──────────────────────────────────────────────
    "ajuga":             ("groundcover_ajuga",             "XS",  96, "Perennial",        "plant", "deep blue-purple flower spikes #3A1A8A, mid-blue #4A2A9A, glossy dark green rosette #1A5A2A, bronze-purple leaves #3A1A1A, dark outline #0A0A1A", "Low mat of glossy dark rosette leaves with upright short spikes of vivid deep blue-purple flowers. Dense ground-hugging. Correct proportions. No roots."),
    "vinca":             ("groundcover_vinca",             "S",  160, "Perennial",        "plant", "vivid violet-blue #3A3A9A, deep blue-purple #2A2A7A, bright green trailing #4A8A3A, pale blue #7A7AB8, dark outline #0A0A1A", "Trailing evergreen ground cover with glossy bright green stems and vivid blue-violet five-petalled periwinkle flowers. Spreading habit. Correct proportions. No roots."),
    "pachysandra":       ("groundcover_pachysandra",       "S",  160, "Perennial",        "plant", "deep glossy green #1A5A2A, mid-green #3A7A3A, bright green #4A8A3A, pale cream flowers #F0EEE0, dark outline #0A1A0A", "Dense low rosette-like carpet of glossy dark green oval leaves in whorls with tiny pale cream flower spikes. Shade groundcover. Correct proportions. No roots."),
    "ivy":               ("groundcover_ivy",               "M",  256, "Perennial",        "plant", "deep glossy green #1A5A2A, mid-green #3A7A2A, pale cream veins #D0D8C0, bright green new growth #5AB83A, dark outline #0A1A0A", "Spreading mat of classic five-lobed ivy leaves in deep glossy green with pale vein markings. Dense low trailing carpet. Correct proportions. No roots."),
    "epimedium":         ("groundcover_epimedium",         "S",  160, "Perennial",        "plant", "vivid yellow #FFD700, pale lemon #FFE870, mid-green heart leaves #4A8A3A, deep green #2A5A2A, dark outline #0A1A0A", "Low spreading woodland groundcover with heart-shaped leaves and dainty small yellow or pink spider-like flowers on wiry stems. Correct proportions. No roots."),
    "alchemilla":        ("groundcover_alchemilla",        "S",  160, "Perennial",        "plant", "vivid acid-yellow-green #A8D840, bright green #5AB83A, mid-green #4A8A3A, pale lime #C8E870, dark outline #0A1A0A", "Low mounding groundcover with distinctive scalloped round pale green leaves and frothy masses of tiny acid-yellow-green flowers. Lady's mantle. Correct proportions. No roots."),
    "sedum":             ("groundcover_sedum",             "XS",  96, "Perennial",        "plant", "vivid rose-pink #E84070, deep rose #C42050, pale pink #F5A8C8, mid-green succulent #3A7A3A, dark outline #0A0A1A", "Low flat mat of succulent star-shaped leaf clusters topped with flat-headed clusters of vivid pink flowers. Stonecrop. Correct proportions. No roots."),
    "thyme groundcover": ("groundcover_thyme",             "XS",  96, "Perennial",        "plant", "vivid rose-pink #E84070, pale lilac #C4A8E0, deep green tiny leaves #1A5A2A, mid-green #3A7A3A, dark outline #0A0A2A", "Low creeping mat of tiny rounded dark green aromatic leaves completely smothered in tiny vivid pink-lilac flowers. Creeping thyme. Correct proportions. No roots."),
    "pratia":            ("groundcover_pratia",            "XS",  96, "Perennial",        "plant", "pure white tiny flowers #F8F8F0, pale cream #F5F0E8, vivid green mat #5AB83A, mid-green #3A7A2A, dark outline #0A1A0A", "Ultra-low dense green mat of tiny oval leaves with masses of small white star-shaped flowers. Creeping ground cover. Correct proportions. No roots."),
    "liriope":           ("groundcover_liriope",           "S",  160, "Perennial",        "plant", "vivid violet-purple #5A2A9A, deep purple #3A1A7A, mid-green strap leaves #3A7A2A, glossy dark green #1A5A2A, dark outline #0A0A1A", "Low clump of strap-like glossy dark green leaves with upright spikes of vivid violet-purple small flower beads. Lilyturf. Correct proportions. No roots."),

    # ── Fern packs (tree/evergreen ferns) ─────────────────────────────────────────────
    "tree fern":         ("plant-fern_tree-fern",          "XL", 512, "Fern",             "plant", "deep green #1A6A2A, mid-green #3A8A3A, bright green new fronds #5AB83A, brown scaly trunk #6B3A2A, pale green unfurling #8AC890", "Architectural tree fern with a rough brown trunk topped by a crown of large spreading deep green fronds. Crown view from side. Correct proportions. No roots."),
    "sword fern":        ("plant-fern_sword-fern",         "M",  256, "Fern",             "plant", "deep green #1A6A2A, mid-green #3A8A3A, bright green #5AB83A, pale green new growth #8AC890, dark outline #0A1A0A", "Dense clump of long arching sword-shaped dark green fern fronds radiating from a central crown. Bold and upright. Correct proportions. No roots."),
    "autumn fern":       ("plant-fern_autumn-fern",        "M",  256, "Fern",             "plant", "vivid copper-red new fronds #C87830, deep orange-red #A85820, mid-green #3A8A3A, bronze-green #6A8A3A, dark outline #1A0A0A", "Clump of arching fern fronds — vivid copper-red new growth contrasting with deeper green older fronds. Correct proportions. No roots."),
    "wood fern":         ("plant-fern_wood-fern",          "M",  256, "Fern",             "plant", "deep forest green #1A5A2A, mid-green #3A7A3A, bright green #4A8A3A, pale green new growth #8AC890, dark outline #0A1A0A", "Medium rounded clump of gracefully arching deeply divided dark green fern fronds. Classic woodland fern form. Correct proportions. No roots."),

    # ── Remaining bulbs ────────────────────────────────────────────────────────────────
    "gladiolus":         ("bulb-summer_gladiolus",         "L",  384, "Summer Bulb",      "plant", "vivid magenta-pink #E840A0, deep rose #C42080, pale pink #F5A8D8, bright green sword leaves #3A8A3A, dark outline #1A0A1A", "Tall upright sword-like leaves with an elegant spike of large vivid pink trumpet-shaped gladiolus flowers arranged up one side. Correct proportions. No roots."),
    "canna":             ("bulb-summer_canna",             "L",  384, "Summer Bulb",      "plant", "vivid scarlet-orange #E84A1A, deep red #C82A0A, broad tropical green leaves #2A7A2A, golden yellow #FFD700, dark outline #1A0A0A", "Bold tropical plant with very large broad paddle-shaped leaves and vivid scarlet-orange exotic flowers on upright stems. Correct proportions. No roots."),
    "elephant ear":      ("bulb-summer_elephant-ear",      "XL", 512, "Summer Bulb",      "plant", "deep green #1A6A2A, mid-green #3A8A3A, bright green #5AB83A, pale green veins #8AC890, dark outline #0A1A0A", "Dramatic plant with enormous heart-shaped or arrow-shaped dark green tropical leaves on tall stems. Architectural. Correct proportions. No roots."),
    "agapanthus bulb":   ("bulb-summer_agapanthus",        "M",  256, "Summer Bulb",      "plant", "vivid blue #3A3AD4, mid-blue #4A4AB8, deep purple-blue #2A2A9A, bright green strap leaves #3A8A3A, dark outline #0A0A1A", "Clump of arching strap leaves topped by tall stems bearing vivid blue ball-like umbels of trumpet flowers. Correct proportions. No roots."),
    "allium":            ("bulb-summer_allium",            "M",  256, "Summer Bulb",      "plant", "vivid violet-purple #5A2A9A, deep purple #3A1A7A, pale lilac #B890D0, mid-green hollow stems #3A8A3A, dark outline #0A0A1A", "Tall straight stems topped by perfect globe-shaped heads of vivid violet star-shaped tiny flowers. Ornamental onion. Correct proportions. No roots."),
    "nerine":            ("bulb-summer_nerine",            "S",  160, "Summer Bulb",      "plant", "vivid coral-pink #E87070, deep rose #C84060, pale pink #F5C0C0, mid-green strap leaves #3A8A3A, dark outline #0A0A1A", "Slender stems topped with loose clusters of vivid coral-pink spider-lily flowers with reflexed petals above narrow strap leaves. Correct proportions. No roots."),

    # ── Aquatic & Pond Plants (pack-aquatics) ─────────────────────────────────────────
    "lotus":             ("aquatic_lotus",              "L",  384, "Aquatic",      "plant", "vivid pink #E87090, pale pink #F5C0D0, golden yellow centre #FFD700, deep green round pads #1A6A2A, mid-green #3A8A3A, flat solid red background (#FF0000)", "Sacred lotus flower with large round floating green pads and tall elegant vivid pink bowl-shaped flower above. Top-down view, no water, no stems visible. Correct proportions. No roots."),
    "water hyacinth":    ("aquatic_water-hyacinth",    "S",  160, "Aquatic",      "plant", "vivid lavender-blue #7A7AB8, pale violet #B0A8D8, bright green rosette #4A8A3A, mid-green floating leaves #3A7A2A, flat solid red background (#FF0000)", "Water hyacinth floating rosette with bright green rounded leaves and upright vivid lavender-blue flower spikes. Top-down view, no water. Correct proportions. No roots."),
    "water iris":        ("aquatic_water-iris",        "M",  256, "Aquatic",      "plant", "vivid violet-blue #4A2A9A, deep purple #3A1A7A, pale lavender #B0A8D8, bright green sword leaves #3A8A3A, golden yellow falls #FFD700, flat solid magenta background (#FF00FF)", "Water iris with tall upright sword-like bright green leaves and vivid violet-purple iris flowers with yellow markings. Marginal pond plant. Correct proportions. No roots."),
    "marsh marigold":    ("aquatic_marsh-marigold",   "S",  160, "Aquatic",      "plant", "vivid golden yellow #FFD700, deep yellow #E8B020, bright green rounded leaves #4A8A3A, mid-green #3A7A2A, flat solid magenta background (#FF00FF)", "Marsh marigold clump with bright green rounded leaves and masses of vivid golden-yellow buttercup-like flowers. Marginal pond plant. Correct proportions. No roots."),
    "pickerel weed":     ("aquatic_pickerel-weed",    "M",  256, "Aquatic",      "plant", "vivid blue-violet #4A4AB8, deep blue #2A2A8A, bright green arrow leaves #3A8A3A, mid-green #2A6A2A, flat solid red background (#FF0000)", "Pickerel weed with tall upright arrow-shaped bright green leaves and vivid blue-violet flower spikes. Marginal pond plant. Correct proportions. No roots."),
    "arrowhead plant":   ("aquatic_arrowhead",        "M",  256, "Aquatic",      "plant", "pure white flowers #F8F8F0, pale cream #F5F0E8, bright green arrow-shaped leaves #3A8A3A, deep green #1A6A2A, flat solid magenta background (#FF00FF)", "Arrowhead aquatic plant with distinctive arrow-shaped bright green leaves and white three-petalled flowers on upright stems. Correct proportions. No roots."),
    "water forget-me-not": ("aquatic_water-forget-me-not", "XS", 96, "Aquatic", "plant", "vivid sky-blue #3A8AD4, pale blue #A8C8E8, bright green oval leaves #4A8A3A, yellow eye #FFE870, flat solid red background (#FF0000)", "Low creeping marginal plant with small vivid sky-blue forget-me-not flowers with yellow centres above bright green oval leaves. Correct proportions. No roots."),
    "water canna":       ("aquatic_water-canna",      "L",  384, "Aquatic",      "plant", "vivid yellow #FFD700, deep orange #E87020, broad tropical green leaves #2A7A2A, bright green #4A8A3A, flat solid magenta background (#FF00FF)", "Tropical water canna with very large broad paddle-shaped green leaves and vivid yellow-orange exotic flowers on upright stems above water. Correct proportions. No roots."),
    "bulrush":           ("aquatic_bulrush",          "L",  384, "Aquatic",      "plant", "warm brown seed heads #8A5A2A, deep brown #5A3A1A, bright green upright stems #3A8A3A, mid-green #2A6A2A, flat solid magenta background (#FF00FF)", "Tall upright bulrush with slender bright green stems topped by distinctive dark brown cylindrical sausage-shaped seed heads. Correct proportions. No roots."),
    "yellow flag iris":  ("aquatic_yellow-flag-iris", "M",  256, "Aquatic",      "plant", "vivid golden yellow #FFD700, deep yellow #E8B020, bright green sword leaves #3A8A3A, orange-brown veining #C87830, flat solid magenta background (#FF00FF)", "Yellow flag iris with tall upright sword-like bright green leaves and vivid golden-yellow iris flowers with orange veining. Marginal pond plant. Correct proportions. No roots."),

    # ── Architectural / Statement Plants (pack-architectural) ─────────────────────────
    "agave":             ("plant-architectural_agave",  "L",  384, "Architectural", "plant", "blue-grey green #5A8090, pale silver-blue #8AAFB0, deep grey-green #3A6070, sharp spine tips #C8C0B0, flat solid red background (#FF0000)", "Agave succulent. Thick rigid blue-grey pointed leaves in a radial rosette. Sharp spines at tips. Slight overhead angle. Correct proportions. No roots."),
    "yucca":             ("plant-architectural_yucca",  "L",  384, "Architectural", "plant", "deep green #1A6A2A, mid-green #3A8A3A, sharp cream-white tips #F0EEE0, pale green #8AC890, flat solid magenta background (#FF00FF)", "Yucca plant. Stiff upright sword-shaped leaves with cream-white tips radiating from a central base. Slight overhead angle. Correct proportions. No roots."),
    "phormium":          ("plant-architectural_phormium", "L", 384, "Architectural", "plant", "deep burgundy-red #5A1A1A, dark bronze #3A1A0A, mid-green #3A6A2A, warm red-brown #7A2A1A, flat solid cyan background (#00FFFF)", "New Zealand flax with tall upright sword-shaped leaves in deep burgundy-red and bronze fanning out from a central base. Bold and architectural. Correct proportions. No roots."),
    "acanthus":          ("plant-architectural_acanthus", "L", 384, "Architectural", "plant", "deep glossy green #1A5A2A, mid-green #3A7A3A, white-purple flower spike #8A5A9A, pale pink #D4A8C8, dark outline #0A1A0A", "Dramatic acanthus with large deeply lobed glossy green leaves and a tall upright purple-white flower spike. Bold architectural perennial. Correct proportions. No roots."),
    "gunnera":           ("plant-architectural_gunnera", "XL", 512, "Architectural", "plant", "deep green #1A5A2A, mid-green #2A7A2A, vivid green #3A8A3A, red-brown stems #7A3A1A, dark outline #0A1A0A", "Enormous gunnera with huge umbrella-like deeply lobed dark green leaves on thick red-brown prickly stems. Giant architectural plant. Correct proportions. No roots."),
    "tree aloe":         ("plant-architectural_tree-aloe", "XL", 512, "Architectural", "plant", "vivid orange-red flowers #E84A1A, deep scarlet #C82A0A, blue-grey succulent leaves #5A8090, grey-green #6A9090, dark outline #0A1A2A", "Tree aloe with a crown of thick blue-grey succulent leaves and upright branched candelabra of vivid orange-red tubular flowers. Correct proportions. No roots."),

    # ── Cottage / Wildflower extras ─────────────────────────────────────────────────
    "primrose":          ("flower-daisy_primrose",    "S",  160, "Perennial",    "plant", "vivid pale yellow #FFE870, deep yellow #E8C020, pale cream #F5F0C0, bright green oval leaves #4A8A3A, dark outline #0A1A0A", "Low rosette of bright green crinkled leaves with masses of vivid pale yellow five-petalled primrose flowers on short stems. Correct proportions. No roots."),
    "cowslip":           ("flower-cluster_cowslip",   "S",  160, "Perennial",    "plant", "vivid golden yellow #FFD700, deep yellow #E8B020, bright green oval leaves #4A8A3A, pale green stem #8ABF6A, dark outline #0A1A0A", "Low rosette of bright green leaves with upright stems bearing nodding clusters of vivid golden-yellow tubular cowslip flowers. Correct proportions. No roots."),
    "wood anemone":      ("flower-daisy_wood-anemone", "XS", 96, "Perennial",   "plant", "pure white petals #F8F8F0, pale cream #F5F0E8, yellow stamens #FFD700, bright green divided leaves #4A8A3A, dark outline #0A1A0A", "Delicate low plant with bright green divided leaves and masses of simple white five-petalled wood anemone flowers with golden centres. Correct proportions. No roots."),
    "ragged robin":      ("flower-cluster_ragged-robin", "M", 256, "Perennial", "plant", "vivid rose-pink #E84070, deep rose #C42050, pale pink #F5A8C8, mid-green lance leaves #3A8A3A, dark outline #0A0A1A", "Tall slender wildflower with distinctive ragged-edged vivid pink petals on branching stems above lance-shaped leaves. Correct proportions. No roots."),
    "red valerian":      ("flower-cluster_red-valerian", "L", 384, "Perennial", "plant", "vivid coral-red #E84A2A, deep scarlet #C82A0A, pale coral #F5907A, blue-grey green leaves #5A8A7A, flat solid magenta background (#FF00FF)", "Tall branching plant with blue-grey-green leaves and vivid coral-red dense domed flower clusters on upright stems. Correct proportions. No roots."),
    "toadflax":          ("flower-spike_toadflax-purple", "S", 160, "Annual",   "plant", "vivid violet-purple #5A2A9A, deep purple #3A1A7A, pale lavender #B0A8D8, mid-green lance leaves #3A8A3A, dark outline #0A0A1A", "Slender upright plant with narrow lance-like leaves and vivid violet snapdragon-like toadflax flowers on delicate stems. Correct proportions. No roots."),
    "meadowsweet":       ("flower-cluster_meadowsweet", "L", 384, "Perennial", "plant", "pale cream-white #F5F0E0, warm ivory #E8DCC0, mid-green pinnate leaves #3A7A3A, deep green #1A5A2A, dark outline #0A1A0A", "Tall plant with pinnate mid-green leaves and frothy plumes of tiny creamy-white meadowsweet flowers. Cottage garden wildflower. Correct proportions. No roots."),
    "bistort":           ("flower-spike_bistort",     "M",  256, "Perennial",   "plant", "vivid rose-pink #E84070, pale pink #F5A8C8, mid-green broad leaves #3A8A3A, deep green #1A6A2A, dark outline #0A0A1A", "Upright plant with broad mid-green leaves and vivid rose-pink poker-like cylindrical flower spikes. Snakeweed/bistort. Correct proportions. No roots."),
    "sweet violet":      ("flower-daisy_sweet-violet", "XS", 96, "Perennial",  "plant", "deep violet-purple #3A1A5A, vivid purple #5A2A8A, pale lilac #B0A0D0, bright green heart leaves #4A8A3A, dark outline #0A0A1A", "Low spreading plant with heart-shaped bright green leaves and masses of deep violet five-petalled sweet violet flowers with delicate veining. Correct proportions. No roots."),


    "bluebell":          ("flower-cluster_bluebell",   "M",  256, "Perennial",    "plant", "vivid violet-blue #3A3A9A, deep indigo #2A2A7A, pale lavender #B0A8D8, bright green strap leaves #4A8A3A, dark outline #0A0A1A", "Clump of arching bright green strap-like leaves with nodding clusters of vivid violet-blue tubular bluebell flowers hanging from curved stems. Correct proportions. No roots."),
    "oxlip":             ("flower-cluster_oxlip",      "S",  160, "Perennial",    "plant", "vivid pale yellow #FFE870, deep yellow #E8C020, bright green oval leaves #4A8A3A, pale green stem #8ABF6A, dark outline #0A1A0A", "Low rosette of bright green crinkled leaves with upright stems bearing one-sided clusters of nodding pale yellow oxlip flowers. Correct proportions. No roots."),
    "herb robert":       ("flower-daisy_herb-robert",  "S",  160, "Annual",       "plant", "vivid bright pink #E87090, deep rose #C85070, pale pink #F5B8C8, deeply divided bright green leaves #4A8A3A, red stems #C84A3A, dark outline #0A0A1A", "Low scrambling plant with deeply divided bright green leaves on red stems and masses of vivid bright pink five-petalled flowers. Correct proportions. No roots."),
    "lords and ladies":  ("plant-architectural_lords-and-ladies", "S", 160, "Perennial", "plant", "vivid green spathe #4A8A3A, pale cream-white hood #F5F0E0, deep purple spadix #3A1A5A, bright green arrow leaves #3A8A2A, dark outline #0A1A0A", "Distinctive woodland plant with glossy arrow-shaped bright green leaves and unusual hooded cream-white spathe with deep purple spadix inside. Correct proportions. No roots."),
    "agave plant":       ("plant-architectural_agave",  "L",  384, "Architectural", "plant", "blue-grey green #5A8090, pale silver-blue #8AAFB0, deep grey-green #3A6070, sharp spine tips #C8C0B0, flat solid red background (#FF0000)", "Agave succulent. Thick rigid blue-grey pointed leaves in a radial rosette. Sharp spines at tips. Slight overhead angle. Correct proportions. No roots."),
    "phormium plant":    ("plant-architectural_phormium", "L", 384, "Architectural", "plant", "deep burgundy-red #5A1A1A, dark bronze #3A1A0A, mid-green #3A6A2A, warm red-brown #7A2A1A, flat solid cyan background (#00FFFF)", "New Zealand flax with tall upright sword-shaped leaves in deep burgundy-red and bronze fanning out from a central base. Bold and architectural. Correct proportions. No roots."),
    "lotus flower":      ("aquatic_lotus",              "L",  384, "Aquatic",      "plant", "vivid pink #E87090, pale pink #F5C0D0, golden yellow centre #FFD700, deep green round pads #1A6A2A, mid-green #3A8A3A, flat solid magenta background (#FF00FF)", "Sacred lotus with large round floating green pads and tall elegant vivid pink bowl-shaped flower above. Top-down view, no water, no stems visible. Correct proportions. No roots."),
    "pickerel rush":     ("aquatic_pickerel-weed",     "M",  256, "Aquatic",      "plant", "vivid blue-violet #4A4AB8, deep blue #2A2A8A, bright green arrow leaves #3A8A3A, mid-green #2A6A2A, flat solid red background (#FF0000)", "Pickerel weed with tall upright arrow-shaped bright green leaves and vivid blue-violet flower spikes. Marginal pond plant. Correct proportions. No roots."),
    "arrowhead":         ("aquatic_arrowhead",         "M",  256, "Aquatic",      "plant", "pure white flowers #F8F8F0, pale cream #F5F0E8, bright green arrow-shaped leaves #3A8A3A, deep green #1A6A2A, flat solid magenta background (#FF00FF)", "Arrowhead aquatic plant with distinctive arrow-shaped bright green leaves and white three-petalled flowers on upright stems. Correct proportions. No roots."),
    "limelight hydrangea": ("shrub-flowering_limelight-hydrangea", "M", 256, "Flowering Shrub", "plant", "pale lime-green #C8E870, cream-white #F5F0E0, vivid green #5AB83A, mid-green oval leaves #3A8A3A, dark outline #0A1A0A", "Limelight hydrangea shrub with large conical cone-shaped flower panicles in vivid lime-green to cream-white above oval mid-green leaves. Correct proportions. No roots."),
    "ragged robin flower": ("flower-cluster_ragged-robin", "M", 256, "Perennial", "plant", "vivid rose-pink #E84070, deep rose #C42050, pale pink #F5A8C8, mid-green lance leaves #3A8A3A, dark outline #0A0A1A", "Tall slender wildflower with distinctive ragged-edged vivid pink petals on branching stems above lance-shaped leaves. Correct proportions. No roots."),
    "tree aloe plant":   ("plant-architectural_tree-aloe", "XL", 512, "Architectural", "plant", "vivid orange-red flowers #E84A1A, deep scarlet #C82A0A, blue-grey succulent leaves #5A8090, grey-green #6A9090, dark outline #0A1A2A", "Tree aloe with a crown of thick blue-grey succulent leaves and upright branched candelabra of vivid orange-red tubular flowers. Correct proportions. No roots."),
    "phacelia":          ("flower-cluster_phacelia-blue", "S", 160, "Annual",     "plant", "vivid blue #3A3AD4, mid-blue #4A4AB8, pale blue #8A8AD8, bright green ferny leaves #4A8A3A, dark outline #0A0A1A", "Low bushy annual with ferny bright green leaves and masses of vivid blue five-petalled scorpion weed flowers with prominent stamens. Correct proportions. No roots."),
    "jacob's ladder flower": ("flower-spike_jacobs-ladder-blue", "M", 256, "Perennial", "plant", "vivid blue-purple #4A2A9A, pale lavender #B0A0D0, bright green pinnate leaves #4A8A3A, golden stamens #FFD700, dark outline #0A0A1A", "Upright plant with elegant bright green pinnate leaves and loose clusters of vivid blue-purple five-petalled Jacob's ladder flowers. Correct proportions. No roots."),
    "water soldier":     ("aquatic_water-soldier",     "M",  256, "Aquatic",      "plant", "deep green spiky rosette #1A6A2A, mid-green #3A8A3A, white flowers #F8F8F0, sharp-toothed leaves #2A7A2A, flat solid magenta background (#FF00FF)", "Water soldier with spiky deep green rosette of sharp-toothed leaves like a pineapple top floating at water surface with white flowers. Correct proportions. No roots."),
    "frogbit":           ("aquatic_frogbit",           "XS",  96, "Aquatic",     "plant", "vivid green round pads #4A8A3A, mid-green #3A7A2A, white tiny flowers #F8F8F0, pale green #8ABF6A, flat solid magenta background (#FF00FF)", "Frogbit with small round vivid green floating pads like tiny lily pads with delicate white flowers. Top-down view, no water. Correct proportions. No roots."),
    "hornwort":          ("aquatic_hornwort",          "S",  160, "Aquatic",      "plant", "vivid green #4A8A3A, deep green #1A6A2A, bright green feathery #5AB83A, mid-green #3A7A2A, flat solid magenta background (#FF00FF)", "Submerged oxygenating pond plant with vivid green feathery whorled branches. Floating cloud of green. Correct proportions. No roots."),
    "flowering rush":    ("aquatic_flowering-rush",    "L",  384, "Aquatic",      "plant", "vivid rose-pink #E87090, deep pink #C85070, mid-green rush leaves #3A8A3A, pale pink #F5B8C8, flat solid cyan background (#00FFFF)", "Flowering rush with tall slender mid-green leaves and elegant umbels of vivid rose-pink three-petalled flowers at the top. Correct proportions. No roots."),

    # ── Coniferous Shrubs (pack-shrubs-coniferous) ───────────────────────────────────────
    "mugo pine":         ("shrub-conifer_mugo-pine",     "S",  160, "Coniferous Shrub", "pine", "deep forest green #1A5C1A, mid-green #2E7A2E, dark olive #1A4A10, dark outline #0A2010", "Low compact rounded mound of dense dark green pine needles. Correct proportions."),
    "dwarf alberta spruce": ("shrub-conifer_dwarf-alberta-spruce", "S", 160, "Coniferous Shrub", "pine", "bright green #5AB83A, mid-green #3A7A2A, pale green new growth #A8D848, dark outline #0A2010", "Compact tight perfect cone shape of dense fine bright green needles. Classic Christmas tree shape in miniature."),
    "globe blue spruce":  ("shrub-conifer_globe-blue-spruce", "S", 160, "Coniferous Shrub", "pine", "steel blue-green #5A8AA0, mid blue-grey #7A9AAA, silver-green #8AAFA8, dark outline #0A2030", "Compact perfect globe/dome shape of dense silver-blue needles."),
    "mugo pine":         ("shrub-conifer_mugo-pine",     "S",  160, "Coniferous Shrub", "pine", "deep forest green #1A5C1A, mid-green #2E7A2E, dark olive #1A4A10", "Low compact rounded spreading mound of dense dark green pine foliage."),
    "creeping juniper":  ("shrub-conifer_creeping-juniper", "XS", 96, "Coniferous Shrub", "pine", "steel blue-green #5A8AA0, silver-blue #7A9AB0, pale grey-blue #A8BEC8, dark outline #0A2030", "Ultra-low flat-spreading mat of dense silver-blue juniper foliage, very ground-hugging."),

    # ── Climbers — Flowering (pack-climbers-flowering) ─────────────────────────────────
    "climbing hydrangea": ("vine-climbing_climbing-hydrangea", "XL", 512, "Flowering Climber", "plant", "pure white lacecap flowers #F8F8F0, pale cream #F5F0E8, bright green rounded leaves #5AB83A, mid-green #3A7A2A, dark outline #0A1A0A", "Climbing plant with large flat lacecap flower heads of white florets surrounding a centre of tiny flowers, above rounded bright green leaves. Correct proportions. No roots."),
    "black-eyed susan vine": ("vine-climbing_black-eyed-susan", "M", 256, "Flowering Climber", "plant", "vivid orange #E87820, golden yellow #FFD700, deep brown-black centre #1A0A00, bright green leaves #4A8A3A, dark outline #0A1A0A", "Twining climbing vine with bright green leaves and masses of vivid orange five-petalled flowers with distinctive dark brown-black centres. Correct proportions. No roots."),
    "climbing snapdragon": ("vine-climbing_climbing-snapdragon", "M", 256, "Flowering Climber", "plant", "vivid pink #E8407A, deep rose #C41260, pale lavender #C4A8E0, bright green leaves #4A8A3A, dark outline #0A1A0A", "Delicate twining climber with soft ferny foliage and snapdragon-like tubular flowers in vivid pink and lavender. Correct proportions. No roots."),
    "cup and saucer vine": ("vine-climbing_cup-and-saucer",   "XL", 512, "Flowering Climber", "plant", "deep violet-purple #5A1A9A, pale green calyx #8ABF6A, mid-green pinnate leaves #4A8A3A, dark outline #0A1A0A", "Vigorous climbing vine with large deep violet bell-shaped flowers sitting in a pale green saucer calyx above pinnate leaves. Correct proportions. No roots."),
    "mandevilla":        ("vine-climbing_mandevilla",    "M",  256, "Flowering Climber", "plant", "vivid pink #E8407A, deep rose #C41260, pale pink throat #F5A8C8, deep glossy green #1A6A2A, dark outline #0A1A0A", "Tropical twining vine with deep glossy green leaves and masses of large vivid pink trumpet-shaped flowers. Correct proportions. No roots."),
    "star jasmine":      ("vine-climbing_star-jasmine",   "L",  384, "Evergreen Climber", "plant", "pure white star flowers #F8F8F0, pale cream #F5F0E8, deep glossy green #1A6A2A, mid-green #3A8A3A, dark outline #0A1A0A", "Twining evergreen climber with deep glossy green leaves and masses of small star-shaped intensely fragrant white flowers. Correct proportions. No roots."),
    "hops":              ("vine-climbing_hops",          "XL", 512, "Deciduous Climber", "plant", "bright green #5AB83A, mid-green #4A8A3A, pale green papery hops #C8D870, deep green #2A5A1A, dark outline #0A1A0A", "Vigorous twining vine with large lobed green leaves and clusters of pale green papery hop cones. Correct proportions. No roots."),
    "everlasting pea":   ("vine-climbing_everlasting-pea", "L", 384, "Deciduous Climber", "plant", "vivid rose-pink #E84078, deep rose #C42058, pale pink #F5A8C8, bright green leaves #4A8A3A, dark outline #0A0A1A", "Climbing perennial pea with bright green leaves and masses of vivid rose-pink pea-like flowers on tendrilled stems. Correct proportions. No roots."),
    "plumbago":          ("vine-climbing_plumbago",      "L",  384, "Evergreen Climber", "plant", "vivid sky-blue #3A8AD4, mid blue #2A6AB8, pale ice blue #A8C8E8, bright green leaves #4A8A3A, dark outline #0A0A1A", "Sprawling evergreen climber or shrub with masses of vivid sky-blue phlox-like five-petalled flowers. Correct proportions. No roots."),
    "canary creeper":    ("vine-climbing_canary-creeper", "M",  256, "Deciduous Climber", "plant", "vivid canary yellow #FFD700, deep yellow #E8B020, bright green leaves #4A8A3A, dark outline #0A1A0A", "Delicate climbing nasturtium with fine ferny leaves and vivid canary yellow fringed flowers. Correct proportions. No roots."),
    "flame creeper":     ("vine-climbing_flame-creeper",  "L",  384, "Deciduous Climber", "plant", "vivid scarlet-red #C84A2A, deep red #A82A1A, bright green #5AB83A, dark outline #0A1A0A", "Slender twining climber with vivid scarlet tubular flowers contrasting against bright green leaves. Correct proportions. No roots."),
    "schisandra":        ("vine-climbing_schisandra",    "L",  384, "Deciduous Climber", "plant", "vivid pink flowers #E87890, pale blush #F5A8C8, bright red berries #C84A2A, bright green #5AB83A, dark outline #0A1A0A", "Twining climber with pale pink flowers and vivid red berries in drooping clusters. Correct proportions. No roots."),
    "boston ivy":        ("vine-climbing_boston-ivy",    "XL", 512, "Evergreen Climber", "plant", "vivid scarlet-crimson #C84A2A, deep red #A82A1A, deep green trilobed leaves #1A6A2A, orange-red autumn #E87820, dark outline #0A1A0A", "Vigorous climbing vine with three-lobed leaves that turn spectacular vivid scarlet in autumn. Correct proportions. No roots."),
    "crimson glory vine": ("vine-climbing_crimson-glory-vine", "XL", 512, "Deciduous Climber", "plant", "vivid crimson-scarlet #C82A2A, deep burgundy #8A1A1A, golden orange #E8A020, large broad green leaves #2A6A2A, dark outline #0A1A0A", "Vigorous ornamental vine with large broad leaves that turn spectacular crimson and scarlet in autumn. Correct proportions. No roots."),
    "clematis armandii": ("vine-climbing_clematis-armandii", "XL", 512, "Evergreen Climber", "plant", "pure white flowers #F8F8F0, pale cream #F5F0E8, deep glossy green trifoliate leaves #1A6A2A, dark outline #0A1A0A", "Vigorous evergreen clematis with large trifoliate glossy leaves and masses of large white fragrant flowers. Correct proportions. No roots."),
    "ornamental kiwi vine": ("vine-climbing_ornamental-kiwi", "L", 384, "Deciduous Climber", "plant", "pink-white-green variegated leaves #D4A8B8, pale pink #F5C8D8, cream-white #F5F0E8, bright green new growth #5AB83A, dark outline #0A1A0A", "Vigorous twining vine with distinctive leaves variegated in pink, white and green. Correct proportions. No roots."),
    "schizophragma":     ("vine-climbing_schizophragma",  "XL", 512, "Deciduous Climber", "plant", "pure white sterile sepals #F8F8F0, pale cream #F5F0E8, bright green rounded leaves #5AB83A, mid-green #3A7A2A, dark outline #0A1A0A", "Climbing plant with large flat lacecap-like flower heads with showy white sterile sepals, resembling climbing hydrangea. Correct proportions. No roots."),
    "trumpet vine":      ("vine-climbing_trumpet-vine",   "XL", 512, "Flowering Climber", "plant", "vivid scarlet-orange #E84A1A, deep orange #C83A0A, bright green pinnate leaves #4A8A3A, mid-green #2A6A2A, dark outline #0A1A0A", "Vigorous climber with masses of bold vivid scarlet-orange trumpet-shaped flowers in clusters above pinnate leaves. Correct proportions. No roots."),
    "chocolate vine":    ("vine-climbing_chocolate-vine",  "M",  256, "Evergreen Climber", "plant", "deep maroon-purple flowers #5A1A2A, rich purple #7A2A4A, deep glossy green trifoliate leaves #1A6A2A, pale cream #F5E8E0, dark outline #0A0A1A", "Twining climber with deeply chocolate-purple pendant tubular flowers and attractive glossy trifoliate leaves. Correct proportions. No roots."),
    "coral vine":        ("vine-climbing_coral-vine",      "L",  384, "Evergreen Climber", "plant", "vivid coral-pink #E87070, deep rose #C84A5A, heart-shaped green leaves #4A8A3A, bright green #5AB83A, dark outline #0A1A0A", "Vigorous twining climber with masses of vivid coral-pink small flowers in loose clusters above heart-shaped leaves. Correct proportions. No roots."),
    "wild grape":        ("vine-climbing_wild-grape",      "XL", 512, "Deciduous Climber", "plant", "vivid scarlet-crimson #C82A2A, deep burgundy #8A1A1A, deep green lobed grape leaves #2A6A2A, dark blue grapes #2A1A4A, dark outline #0A1A0A", "Vigorous ornamental grape vine with large lobed leaves turning vivid scarlet in autumn and small clusters of dark grapes. Correct proportions. No roots."),
    "climbing nasturtium": ("vine-climbing_climbing-nasturtium", "L", 384, "Flowering Climber", "plant", "vivid orange #E87820, golden yellow #FFD700, bright green round leaves #4A8A3A, pale yellow #FFE870, dark outline #0A1A0A", "Scrambling climber with round peltate bright green leaves and vivid orange and yellow funnel-shaped flowers with long spurs. Correct proportions. No roots."),
    "chocolate cosmos vine": ("vine-climbing_chocolate-cosmos", "M", 256, "Flowering Climber", "plant", "deep chocolate-maroon #3A0A0A, rich velvet brown #5A1A0A, mid-green #4A8A3A, dark outline #0A0A0A", "Twining climber with deep chocolate-maroon velvety daisy-like flowers above mid-green leaves. Correct proportions. No roots."),

    # ── Shrubs — Deciduous (pack-shrubs-deciduous) ───────────────────────────────────────
    "mock orange":       ("shrub-flowering_mock-orange",  "M",  256, "Deciduous Shrub", "plant", "pure white #F8F8F0, pale cream #F5F0E8, bright yellow stamens #FFD700, bright green #5AB83A, dark outline #0A1A0A", "Rounded arching shrub covered in masses of large pure white fragrant four-petalled flowers with golden stamens. Correct proportions. No roots."),
    "deutzia":           ("shrub-flowering_deutzia",      "S",  160, "Deciduous Shrub", "plant", "pure white #F8F8F0, pale pink #F5C8D8, bright green #5AB83A, warm brown arching stems #6B3A2A, dark outline #0A1A0A", "Compact arching shrub smothered in masses of small star-shaped white flowers along arching stems. Most watercolor details — visible petal texture, soft shading within the flowers, delicate leaf veining. Correct proportions. No roots."),
    "kerria":            ("shrub-flowering_kerria",       "M",  256, "Deciduous Shrub", "plant", "vivid golden yellow #FFD700, deep yellow #E8B020, bright green serrated leaves #5AB83A, green arching stems #4A8A3A, dark outline #0A1A0A", "Arching shrub with bright green stems and masses of vivid golden-yellow pompom flowers. Correct proportions. No roots."),
    "potentilla":        ("shrub-flowering_potentilla",   "S",  160, "Deciduous Shrub", "plant", "vivid yellow #FFD700, warm orange #E87820, pale cream #F5F0E8, bright green fine leaves #5AB83A, dark outline #0A1A0A", "Low compact rounded shrub covered in masses of small five-petalled flowers in vivid yellow or orange. Long-blooming. Correct proportions. No roots."),
    "guelder rose":      ("shrub-flowering_guelder-rose", "M",  256, "Deciduous Shrub", "plant", "pure white pompom #F8F8F0, pale cream #F5F0E8, bright green lobed leaves #5AB83A, vivid red translucent berries #C84A2A, dark outline #0A1A0A", "Rounded shrub with large round snowball-like pure white pompom flower clusters and vivid red berries. Correct proportions. No roots."),
    "beauty bush":       ("shrub-flowering_beauty-bush",  "M",  256, "Deciduous Shrub", "plant", "soft pink #F0A8C0, pale blush #F5D8E8, deep pink #D47890, mid-green #4A8A3A, dark outline #0A1A0A", "Arching fountain-shaped shrub covered in masses of small tubular pink flowers in spring. Correct proportions. No roots."),
    "abelia":            ("shrub-flowering_abelia",       "M",  256, "Deciduous Shrub", "plant", "pale pink #F5C8D8, white-pink #F8E8F0, vivid pink buds #E84078, mid-green glossy leaves #3A8A3A, dark outline #0A1A0A", "Arching shrub with small glossy leaves and masses of small tubular pale pink funnel flowers. Long-blooming. Correct proportions. No roots."),
    "flowering currant": ("shrub-flowering_flowering-currant", "M", 256, "Deciduous Shrub", "plant", "vivid deep red #C84A2A, deep crimson #A82A1A, pale pink #F5C8D8, bright green rounded leaves #5AB83A, dark outline #0A1A0A", "Upright shrub with masses of pendant clusters of vivid deep red tubular flowers in early spring before leaves. Correct proportions. No roots."),
    "black currant":     ("shrub-edible_black-currant",   "M",  256, "Deciduous Shrub", "plant", "deep black-purple berries #1A0A2A, mid-green lobed leaves #4A8A3A, dark green #2A5A1A, pale green catkins #C8D870, dark outline #0A1A0A", "Compact rounded shrub with bright green lobed leaves and drooping clusters of deep black-purple currants. Correct proportions. No roots."),
    "red currant":       ("shrub-edible_red-currant",     "S",  160, "Deciduous Shrub", "plant", "vivid translucent red berries #C84A2A, mid-green lobed leaves #4A8A3A, pale green #8ABF6A, dark outline #0A1A0A", "Compact upright shrub with bright green lobed leaves and drooping strings of vivid translucent red currants. Correct proportions. No roots."),
    "gooseberry":        ("shrub-edible_gooseberry",      "S",  160, "Deciduous Shrub", "plant", "pale green-yellow berries #C8D870, vivid green #5AB83A, mid-green rounded leaves #4A8A3A, thorny stems #6B3A2A, dark outline #0A1A0A", "Compact thorny shrub with bright green lobed leaves and plump pale green-yellow gooseberry fruits. Correct proportions. No roots."),
    "elderberry":        ("shrub-edible_elderberry",      "L",  384, "Deciduous Shrub", "plant", "deep purple-black berries #1A0A2A, flat cream-white flower clusters #F5F0E8, bright green pinnate leaves #5AB83A, dark outline #0A1A0A", "Large upright shrub with bright green pinnate leaves and large flat cream-white flower clusters or heavy drooping clusters of deep purple-black berries. Correct proportions. No roots."),
    "goji berry":        ("shrub-edible_goji-berry",      "M",  256, "Deciduous Shrub", "plant", "vivid orange-red berries #E84A2A, deep red #C42A1A, small pale purple flowers #C4A8E0, mid-green #4A8A3A, dark outline #0A1A0A", "Arching shrub with small leaves and masses of vivid elongated orange-red goji berries. Correct proportions. No roots."),
    "smokebush":         ("shrub-ornamental_smokebush",   "L",  384, "Deciduous Shrub", "plant", "deep purple-red foliage #5A1A2A, vivid purple #7B35C8, misty pink-purple smoke #C8A8D8, pale lavender #D4C8E8, dark outline #0A0A1A", "Large rounded shrub with deep purple-red leaves surrounded by billowing misty pink-purple smoke-like flower plumes. Correct proportions. No roots."),
    "oakleaf hydrangea": ("shrub-flowering_oakleaf-hydrangea", "M", 256, "Deciduous Shrub", "plant", "pure white cone flowers #F8F8F0, pale cream #F5F0E8, large oak-lobed leaves #4A8A3A, vivid autumn red #C84A2A, dark outline #0A1A0A", "Upright shrub with large distinctive oak-shaped leaves and large cone-shaped white flower panicles that age to pink. Correct proportions. No roots."),
    "american beautyberry": ("shrub-ornamental_beautyberry", "M", 256, "Deciduous Shrub", "plant", "vivid electric purple berries #7B35C8, deep violet #5A1A9A, pale lilac #C4A8E0, bright green #5AB83A, dark outline #0A0A1A", "Arching shrub with masses of vivid electric purple berries clustered tightly along the arching stems in autumn. Correct proportions. No roots."),
    "fothergilla":       ("shrub-flowering_fothergilla",  "M",  256, "Deciduous Shrub", "plant", "pure white bottlebrush #F8F8F0, pale cream stamens #F5F0E8, vivid fiery autumn #E87820, golden yellow #FFD700, bright green rounded leaves #5AB83A, dark outline #0A1A0A", "Compact rounded shrub with fragrant white bottlebrush flowers in spring and spectacular fiery red-orange-yellow autumn colour. Correct proportions. No roots."),
    "hornbeam":          ("shrub-hedge_hornbeam",         "L",  384, "Deciduous Shrub", "plant", "mid-green ribbed leaves #4A8A3A, pale yellow-green catkins #C8D870, golden yellow autumn #E8C020, warm brown limbs #6B3A2A, dark outline #0A1A0A", "Upright or rounded shrub/hedge with ribbed oval leaves, pendulous catkins and good autumn colour. Correct proportions. No roots."),
    "hazel":             ("shrub-edible_hazel",           "L",  384, "Deciduous Shrub", "plant", "mid-green rounded leaves #4A8A3A, pale yellow catkins #E8D870, brown hazelnuts #8A5A2A, bright green #5AB83A, dark outline #0A1A0A", "Multi-stemmed shrub with rounded toothed leaves, long pale yellow catkins and clusters of brown hazelnuts. Correct proportions. No roots."),
    "dogwood shrub":     ("shrub-ornamental_dogwood",     "M",  256, "Deciduous Shrub", "plant", "vivid scarlet-red stems #C84A2A, bright green oval leaves #5AB83A, pale cream berries #F5F0E8, dark outline #0A1A0A", "Upright multi-stemmed shrub with vivid scarlet-red winter stems — the main feature. Correct proportions. No roots."),

    # ── Shrubs — Evergreen (pack-shrubs-evergreen) ───────────────────────────────────────
    "camellia":          ("shrub-evergreen_camellia",     "M",  256, "Evergreen Shrub", "plant", "vivid rose-pink #E84078, deep red #C42A1A, pale blush #F5C8D8, deep glossy green #1A6A2A, mid-green #3A8A3A, dark outline #0A1A0A", "Rounded shrub with deep glossy green leaves and large multi-petalled vivid pink or red flowers. Correct proportions. No roots."),
    "pieris":            ("shrub-evergreen_pieris",       "M",  256, "Evergreen Shrub", "plant", "vivid scarlet-red new growth #C84A2A, deep glossy green #1A6A2A, pale cream lily-of-the-valley flowers #F5F0E8, mid-green #3A8A3A, dark outline #0A1A0A", "Rounded shrub with vivid scarlet-red new shoot growth and drooping clusters of small cream lily-of-the-valley flowers. Correct proportions. No roots."),
    "mahonia":           ("shrub-evergreen_mahonia",      "M",  256, "Evergreen Shrub", "plant", "vivid golden yellow #FFD700, deep yellow #E8B020, deep glossy holly-green #1A5A2A, spiny blue-black berries #2A1A4A, dark outline #0A1A0A", "Upright architectural shrub with spiny holly-like glossy leaves and upright clusters of vivid golden-yellow flowers. Correct proportions. No roots."),
    "sweet box":         ("shrub-evergreen_sweet-box",    "S",  160, "Evergreen Shrub", "plant", "deep glossy green #1A6A2A, mid-green #3A8A3A, tiny white flowers #F8F8F0, pale cream #F5F0E8, black berries #0A0A0A, dark outline #0A1A0A", "Low spreading shrub with deep glossy dark green leaves and tiny white fragrant flowers along the stems. Correct proportions. No roots."),
    "daphne":            ("shrub-evergreen_daphne",       "S",  160, "Evergreen Shrub", "plant", "vivid pink-purple #D44878, deep rose #A82858, pale pink #F5A8C8, deep glossy green #1A6A2A, dark outline #0A1A0A", "Compact rounded shrub with deep glossy green leaves and clusters of vivid pink-purple intensely fragrant tubular flowers. Correct proportions. No roots."),
    "skimmia":           ("shrub-evergreen_skimmia",      "S",  160, "Evergreen Shrub", "plant", "vivid red berries #C84A2A, deep glossy green #1A6A2A, mid-green #3A8A3A, pale cream flower buds #F5F0E8, dark outline #0A1A0A", "Compact rounded shrub with deep glossy green leaves and clusters of vivid red berries or pale cream flower buds. Correct proportions. No roots."),
    "elaeagnus":         ("shrub-evergreen_elaeagnus",    "L",  384, "Evergreen Shrub", "plant", "silver-green leaves #8AAF82, pale silver underside #C8D4B8, warm yellow-orange fruit #D4A020, deep green #2A6A2A, dark outline #0A1A0A", "Large dense screening shrub with distinctive silver-green leaves with silvery undersides and tiny fragrant flowers. Correct proportions. No roots."),
    "aucuba":            ("shrub-evergreen_aucuba",       "M",  256, "Evergreen Shrub", "plant", "deep glossy green #1A6A2A, vivid golden-yellow spots #FFD700, mid-green #3A8A3A, vivid red berries #C84A2A, dark outline #0A1A0A", "Rounded shrub with large deep glossy leaves speckled with vivid golden-yellow spots. Vivid red berries visible. Correct proportions. No roots."),
    "fatsia":            ("shrub-evergreen_fatsia",       "L",  384, "Evergreen Shrub", "plant", "deep glossy green #1A6A2A, mid-green #3A8A3A, bright green #5AB83A, white ball flowers #F8F8F0, dark outline #0A1A0A", "Bold architectural shrub with very large deeply-lobed hand-shaped glossy leaves and ball-shaped cream flower clusters. Correct proportions. No roots."),
    "ceanothus":         ("shrub-evergreen_ceanothus",    "L",  384, "Evergreen Shrub", "plant", "vivid electric blue #3A5AD4, deep violet-blue #2A3A9A, pale blue #8AB8E8, deep glossy green #1A6A2A, dark outline #0A0A1A", "Dense rounded shrub with deep glossy small leaves covered in masses of vivid electric blue fluffy flower clusters. Correct proportions. No roots."),
    "rock rose":         ("shrub-evergreen_rock-rose",    "S",  160, "Evergreen Shrub", "plant", "vivid pink #E84078, white #F8F8F0, deep rose #C42058, vivid yellow centre #FFD700, grey-green leaves #7A9A6A, dark outline #0A1A0A", "Low spreading mound of grey-green leaves covered in large tissue-paper thin pink or white flowers with yellow centres. Correct proportions. No roots."),
    "hebe":              ("shrub-evergreen_hebe",         "S",  160, "Evergreen Shrub", "plant", "vivid purple #7B35C8, deep violet #5A1A9A, pale lavender #C4A8E0, deep glossy green #1A6A2A, dark outline #0A0A1A", "Compact rounded shrub with dense small glossy leaves and upright spikes of vivid purple flowers. Correct proportions. No roots."),
    "myrtle":            ("shrub-evergreen_myrtle",       "M",  256, "Evergreen Shrub", "plant", "pure white flowers #F8F8F0, vivid yellow stamens #FFD700, deep glossy green #1A6A2A, small aromatic leaves #3A8A3A, dark outline #0A1A0A", "Rounded aromatic shrub with deep small glossy leaves and white flowers with prominent yellow stamens. Correct proportions. No roots."),
    "heather":           ("shrub-evergreen_heather",      "XS",  96, "Evergreen Shrub", "plant", "vivid purple #7B35C8, deep heather #5A1A9A, pale pink #F5A8C8, dark green fine needles #1A4A2A, dark outline #0A0A1A", "Low spreading mat of fine dark green needle-like leaves completely covered in vivid purple or pink bell heather flowers. Correct proportions. No roots."),
    "pittosporum":       ("shrub-evergreen_pittosporum",  "M",  256, "Evergreen Shrub", "plant", "deep glossy green #1A6A2A, pale cream-white variegation #F5F0E8, mid-green #3A8A3A, dark outline #0A1A0A", "Rounded dense shrub with glossy oval leaves, often with cream-white variegated edges. Correct proportions. No roots."),

    # ── Shrubs — Flowering (pack-shrubs-flowering) ──────────────────────────────────────
    "choisya":           ("shrub-flowering_choisya",      "M",  256, "Flowering Shrub", "plant", "pure white star flowers #F8F8F0, pale cream #F5F0E8, vivid yellow-green aromatic leaves #A8C840, deep glossy green #1A6A2A, dark outline #0A1A0A", "Rounded glossy-leaved shrub covered in clusters of pure white star-shaped fragrant flowers. Correct proportions. No roots."),
    "osmanthus":         ("shrub-flowering_osmanthus",    "M",  256, "Flowering Shrub", "plant", "pure white tiny flowers #F8F8F0, pale cream #F5F0E8, deep glossy green #1A6A2A, mid-green #3A8A3A, dark outline #0A1A0A", "Compact rounded shrub with deep glossy holly-like leaves and masses of tiny white intensely fragrant flowers. Correct proportions. No roots."),
    "flowering quince":  ("shrub-flowering_quince",       "M",  256, "Flowering Shrub", "plant", "vivid scarlet-red #C84A2A, deep crimson #A82A1A, pale pink #F5C8D8, bright green #5AB83A, dark outline #0A1A0A", "Dense spiny shrub with masses of vivid scarlet-red cup-shaped flowers on bare stems in early spring. Correct proportions. No roots."),
    "hydrangea paniculata": ("shrub-flowering_hydrangea-paniculata", "M", 256, "Flowering Shrub", "plant", "pure white cone #F8F8F0, pale cream #F5F0E8, soft pink aged #F0A8B8, bright green #5AB83A, dark outline #0A1A0A", "Upright shrub with large cone-shaped flower panicles that start pure white and age to soft pink. Correct proportions. No roots."),
    "rose of sharon":    ("shrub-flowering_rose-of-sharon", "M", 256, "Flowering Shrub", "plant", "vivid pink #E84078, deep violet #5A1A9A, pale lavender #C4A8E0, white #F8F8F8, bright green #5AB83A, dark outline #0A0A1A", "Upright vase-shaped shrub with large open hibiscus-like flowers in vivid pink, purple or white. Long-blooming. Correct proportions. No roots."),
    "russian sage":      ("shrub-flowering_russian-sage",  "M",  256, "Flowering Shrub", "plant", "soft lavender-blue #9A8AC8, pale blue #C8C0E8, silver-grey aromatic stems #A8B0A0, silver-white foliage #C8D0C0, dark outline #0A0A1A", "Upright airy shrub with silver-grey aromatic stems and masses of tiny lavender-blue flowers creating a misty haze. Correct proportions. No roots."),
    "caryopteris":       ("shrub-flowering_caryopteris",  "S",  160, "Flowering Shrub", "plant", "vivid blue #3A5AD4, mid blue #2A4AB8, pale blue #8AB8E8, silver-grey aromatic leaves #8A9A80, dark outline #0A0A1A", "Low mounding shrub with silver-grey aromatic leaves covered in clusters of vivid blue flowers attracting bees. Correct proportions. No roots."),
    "hydrangea paniculata limelight": ("shrub-flowering_limelight", "M", 256, "Flowering Shrub", "plant", "pale lime-green #C8D870, soft cream #F5F0E8, pure white #F8F8F0, bright green #5AB83A, dark outline #0A1A0A", "Upright shrub with very large cone-shaped lime-green flower panicles ageing to cream. Correct proportions. No roots."),
    "chaste tree":       ("shrub-flowering_chaste-tree",  "L",  384, "Flowering Shrub", "plant", "vivid violet-blue #5A35C8, deep violet #3A1A9A, pale lavender #C4A8E0, silver-grey aromatic leaves #8A9A80, dark outline #0A0A1A", "Large arching shrub with silver-grey aromatic palmate leaves and long upright spikes of vivid violet-blue flowers. Correct proportions. No roots."),
    "lilac miss kim":    ("shrub-flowering_lilac",         "M",  256, "Flowering Shrub", "plant", "soft lavender #C4A8E0, pale lilac #D8C8F0, vivid purple #7B35C8, mid-green rounded leaves #4A8A3A, dark outline #0A0A1A", "Compact rounded shrub with large dense upright clusters of fragrant lilac flowers above rounded green leaves. Correct proportions. No roots."),
    "viburnum koreanspice": ("shrub-flowering_viburnum-carlesii", "M", 256, "Flowering Shrub", "plant", "pale pink buds #E87890, pure white open flowers #F8F8F0, soft blush #F5D8E8, mid-green rounded leaves #4A8A3A, dark outline #0A1A0A", "Rounded shrub with round clusters of intensely fragrant flowers, pink in bud opening to white, above rounded leaves. Correct proportions. No roots."),
    "sweet pepperbush":  ("shrub-flowering_sweet-pepperbush", "M", 256, "Flowering Shrub", "plant", "pure white upright spikes #F8F8F0, pale cream #F5F0E8, bright green glossy leaves #5AB83A, mid-green #3A8A3A, dark outline #0A1A0A", "Upright shrub with glossy green serrated leaves and upright spikes of small fragrant white flowers in summer. Correct proportions. No roots."),
    "mexican sage":      ("shrub-flowering_mexican-sage", "M",  256, "Flowering Shrub", "plant", "vivid purple velvet #7B35C8, deep violet #5A1A9A, white flowers #F8F8F0, soft silver-green leaves #8A9A80, dark outline #0A0A1A", "Large sprawling sage with silver-green aromatic leaves and vivid purple velvety flower spikes with white corollas. Correct proportions. No roots."),

    # Trees — deciduous (existing)
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
    "marsh fern":        ("plant-fern_marsh-fern",        "M",  256, "Fern / Groundcover", "plant", "bright green #5AB83A, mid green #4A8A3A, yellow-green frond tips #A8D870, pale green undersides #8ABF6A, dark outline #0A1A0A", "Delicate spreading fern with finely pinnate fronds, each frond lance-shaped with opposite rounded pinnules that taper toward the frond tip, light airy texture, fronds spreading outward in a loose open clump. Plant fills 60% of canvas."),  # 🌿 WILD — do last
    "hay-scented fern":  ("plant-fern_hay-scented-fern",  "M",  256, "Fern / Groundcover", "plant", "yellow-green #A8D848, bright green #5AB83A, pale lime fronds #C8E870, mid green #4A8A3A, dark outline #0A1A0A", "Spreading colony-forming fern with finely divided lacy fronds that are broadly lance-shaped and taper at both ends, fronds are a distinctive yellow-green colour, light feathery texture, fronds arch outward forming a dense spreading mat. Plant fills 60% of canvas."),
    "boston fern":       ("plant-fern_boston-fern",       "M",  256, "Fern / Groundcover", "plant", "vivid green #5AB83A, deep green #2A6A3A, bright lime #7AC83A, mid green #4A8A5A, dark outline #0A1A0A", "Classic arching fern with long sword-shaped fronds that arch gracefully outward and downward, each frond densely covered in opposite rounded pinnules creating a lush feathery texture, full cascading clump perfect for hanging baskets."),
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
    "hollyhock":         ("flower-spike_hollyhock",        "XL", 512, "Biennial",         "plant", "vivid pink #E8407A, deep rose #C41260, pale pink #F5A8C8, bright yellow centre #FFD700, mid-green #4A7C2F, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "Tall vertical spike with large open funnel-shaped flowers arranged up the stem. Correct proportions. No roots."),
    "cauliflower":       ("vegetable-leafy_cauliflower",   "M",  256, "Vegetable",        "plant", "pure white curd #F8F8F0, pale cream #F0EEE0, blue-green leaves #4A7A5A, mid-green #5A8A5A, dark outline #0A1A0A", "Compact cauliflower head. Large dense white curd surrounded by broad blue-green leaves. Correct proportions. No roots."),
    "crocus":            ("bulb-spring_crocus",            "XS", 96,  "Bulb",        "plant", "pale purple #A878D8, deep violet #6A2A9A, soft lavender #C8A8E8, pale yellow centre #FFE870, mid-green strap #4A7C2F, dark outline #0A1A0A", "Correct proportions. No roots."),
    "garden verbena":    ("flower-cluster_verbena",        "S",  160, "Annual Flower","plant", "vivid purple #7B35C8, deep violet #5A1A9A, bright crimson #C41230, mid-green #4A7C2F, pale lavender #C4A8E0, dark outline #0A1A0A", "Correct proportions. No roots."),
    "water lily":        ("aquatic_water-lily",            "M",  256, "Aquatic",     "plant", "dark outline #0A1A0A, flat solid magenta background (#FF00FF)", "Water lily pads sitting naturally in a pond. White pink flowers. No water. Top-down view. No stems visible. Correct proportions."),
    # ── Daisy-type Flowers ───────────────────────────────────────────────────────────
    "black eyed susan":  ("flower-daisy_black-eyed-susan",  "M",  256, "Perennial",   "plant", "golden yellow #FFD700, deep golden #E8A820, dark brown centre #3A1A0A, mid-green #4A7C2F, bright green stems #5A8A3A, dark outline #0A1A0A", "Correct proportions. No roots."),
    "echinacea":         ("flower-daisy_echinacea",         "M",  256, "Perennial",   "plant", "warm orange-brown spiky cone #C86820, lavender-pink petals #D8A0C8, mid-green stems #4A7C2F, deep green leaves #2A5A1A, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "A large cluster of Echinacea plants with leaves. Correct proportions. No roots."),
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
    "onion":             ("vegetable-root_onion",        "S",  160, "Root Vegetable", "rootveg",   "papery golden-brown #C8A050, pale white #F5F0E8, bright green strap tops #4A8C3A, mid-green #2A6010, dark outline #1A0A0A", "Vertical onion with tall frond/shoots. Onion bulb and strap tops only. No soil, no ground, no dirt, no roots. Round papery golden-brown onion bulb floating cleanly, strap-leaf tops above."),
    "kohlrabi":          ("vegetable-root_kohlrabi",     "S",  160, "Root Vegetable", "rootveg",   "pale green bulb #A8D870, purple-green tinge #8A9A50, bright green strap leaves #4AAF2F, mid-green #2A7010, dark outline #1A2A0A", "Kohlrabi bulb and strap leaves only. No soil, no ground, no dirt, no roots. Round pale green bulb with leaf stalks growing directly from the bulb surface, leafy tops above."),
    "garlic":            ("vegetable-root_garlic",       "S",  160, "Root Vegetable", "rootveg",   "papery white #F5F0E8, pale purple tinge #C8B8D8, bright green strap #4AAF2F, mid-green #2A7010, warm tan #C8A870", "Garlic bulb and strap tops only. No soil, no ground, no dirt, no roots. Papery white garlic bulb floating cleanly, strap-leaf tops above."),
    # Flowers
    "rose":              ("flower-rose_rose",            "M",  256, "Shrub / Rose",   "plant",     "deep red #C41230, pale pink #F5B8C8, mid-green #4A7C2F, dark outline #1A0A0A, warm brown thorny stems #7A4A2A", "Upright thorny stems with large full multi-petalled rose blooms and glossy green leaves, stems at bottom and blooms at top."),
    "sunflower":         ("vegetable-tall_sunflower",    "XL", 512, "Annual Flower",  "plant",     "golden yellow #FFD700, deep brown centre #5A2A0A, mid-green #4A7C2F, pale yellow #FFF0A0, dark stem #3A2010", "Tall upright stem with large round brown seed disc surrounded by bold golden-yellow ray petals, broad leaves, stem at bottom and flower at top."),
    "tulip":             ("bulb-spring_tulip",           "S",  160, "Bulb",           "plant",     "vivid red #D42B2B, bright yellow #FFD700, deep pink #E8407A, mid-green strap #4A7C2F, dark outline #1A0A0A", "Upright smooth strap leaves with single elegant cup-shaped bloom at top, stem at bottom and bloom at top."),
    "dahlia":            ("flower-daisy_dahlia",         "M",  256, "Bulb / Annual",  "plant",     "deep magenta #C41270, coral orange #E8703A, vivid yellow #FFD700, mid-green #4A7C2F, dark outline #1A0A0A", "Upright stems with large dramatic multi-layered pompom blooms in rich colours, stems at bottom and blooms at top."),
    "poppy":             ("flower-daisy_poppy",          "M",  256, "Annual Flower",  "plant",     "vivid orange-red #E84A1A, deep scarlet #C41A0A, black centre #0A0A0A, mid-green #4A7C2F, pale green stem #8FBF6A", "Upright slender stem with large crinkled crepe-paper thin petals in vivid red-orange surrounding a dark seed capsule centre, stems at bottom and bloom at top."),
    "hydrangea":         ("flower-cluster_hydrangea",    "L",  384, "Shrub",          "plant",     "cornflower blue #5B8DD9, pale lavender #C4B8E8, soft pink #F0B8C8, mid-green #4A7C2F, dark outline #1A1A2E", "Rounded shrub with massive domed flower heads of densely packed small florets in blue and pink, stems at bottom and florals at top."),

    # ── Perennials (pack-flowers-perennials) ─────────────────────────────────────────────
    "rudbeckia":         ("flower-daisy_rudbeckia",       "M",  256, "Perennial",        "plant", "golden yellow #FFD700, deep golden #E8A820, dark brown-black centre #1A0A00, bright green stems #4A7C2F, mid-green leaves #3A6A2A, dark outline #0A1A0A", "Cluster of daisy-like flowers with bold golden-yellow ray petals and a prominent dark brown-black dome centre. Correct proportions. No roots."),
    "catmint":           ("herb-small_catmint",           "S",  160, "Perennial",        "plant", "soft lavender-blue #9A8AC8, mid lavender #7A6AB8, pale blue #C8C0E8, silver-grey green foliage #8A9A7A, warm brown stems #7A6A5A, dark outline #0A0A1A", "Low mounding spreading perennial with aromatic silver-grey-green leaves and masses of tiny tubular lavender-blue flowers on arching stems. Correct proportions. No roots."),
    "shasta daisy":      ("flower-daisy_shasta-daisy",    "M",  256, "Perennial",        "plant", "pure white petals #F8F8F0, bright yellow centre #FFD700, mid-green stems #4A7C2F, deep green leaves #2A5A1A, dark outline #0A1A0A", "Cluster of classic daisy flowers with crisp white ray petals surrounding a vivid yellow disc centre. Correct proportions. No roots."),
    "verbena bonariensis":("flower-spike_verbena-bonariensis","L", 384, "Perennial",     "plant", "vivid purple #7B35C8, deep violet #5A1A9A, pale lilac #C4A8E0, dark green wiry stems #2A4A1A, mid-green #4A7C2F, dark outline #0A0A1A", "a dense cluster of flowers. Tall airy branching wiry stems topped with tight flat clusters of tiny vivid purple flowers. Minimal foliage — mostly bare stems. Very open, see-through plant silhouette. Correct proportions. No roots."),
    "gypsophila":        ("flower-cluster_gypsophila",    "M",  256, "Perennial",        "plant", "pure white #F8F8F8, pale cream #F5F0E8, light grey-white #E8E8E0, soft green stems #7A9A6A, mid-green #4A7C2F, dark outline #0A1A0A", "Billowing cloud of countless tiny white flowers on very fine branching stems. Extremely airy misty appearance. Correct proportions. No roots."),
    "yarrow":            ("flower-cluster_yarrow",        "M",  256, "Perennial",        "plant", "golden yellow #FFD700, warm yellow #E8C020, pale cream #F5F0C8, mid-green feathery foliage #4A7C2F, deep green #2A5A1A, dark outline #0A1A0A", "Flat-topped flower heads (corymbs) of many tiny golden-yellow florets clustered together above feathery finely-divided aromatic foliage. Correct proportions. No roots."),
    "monarda":           ("flower-cluster_monarda",       "M",  256, "Perennial",        "plant", "vivid scarlet-red #D42B1A, deep red #A81A0A, bright green leaves #4A7C2F, pale green bracts #8ABF6A, dark outline #0A1A0A", "Shaggy mop-headed flower with a central rounded disc surrounded by ragged tubular scarlet-red petals radiating outward like a firework or pompom. Square stems and broad leaves below. Correct proportions. No roots."),
    "joe pye weed":      ("flower-cluster_joe-pye-weed",  "L",  384, "Perennial",        "plant", "dusty mauve-pink #C87890, pale rose #E8A8B8, deep rose-purple #8A3A5A, mid-green #4A7C2F, deep green #2A5A1A, dark outline #0A1A0A", "Tall upright plant with large domed clusters of dusty mauve-pink fluffy flowers at the top of sturdy stems with whorled leaves. Correct proportions. No roots."),
    "hardy geranium":    ("flower-daisy_hardy-geranium",  "S",  160, "Perennial",        "plant", "vivid violet-blue #5A35C8, deep violet #3A1A9A, pale lavender #C4A8E0, bright green leaves #4A7C2F, dark veining #1A0A2A, dark outline #0A0A1A", "Low mounding spreading perennial with rounded deeply-lobed green leaves and vivid violet-blue five-petalled flowers. Correct proportions. No roots."),
    "phacelia":          ("flower-cluster_phacelia",      "S",  160, "Annual Flower",    "plant", "vivid electric blue #3A5AD4, deep violet-blue #2A3A9A, pale blue #8AB8E8, bright green foliage #4A7C2F, dark outline #0A0A1A", "Dense upright clusters of vivid electric-blue small flowers on curling scorpioid cymes above ferny foliage. Correct proportions. No roots."),
    "kniphofia":         ("flower-spike_kniphofia",       "L",  384, "Perennial",        "plant", "vivid orange-red #E85A1A, deep scarlet #C43A0A, bright yellow tip #FFD700, mid-green strap leaves #4A7C3A, dark outline #0A1A0A", "Dramatic upright torch-like flower spike with vivid orange-red tubular florets at top grading to yellow at the tip, rising from a clump of long strap-like leaves. Correct proportions. No roots."),
    "japanese anemone":  ("flower-daisy_japanese-anemone","M",  256, "Perennial",        "plant", "soft pink #F0A8C0, pale blush #F8D8E8, bright yellow stamens #FFD700, deep rose centre #D47890, mid-green leaves #4A7C2F, dark outline #0A1A0A", "Elegant branching stems with large open five-petalled flowers in soft pink surrounding a central boss of bright yellow stamens. Correct proportions. No roots."),
    "helenium":          ("flower-daisy_helenium",        "M",  256, "Perennial",        "plant", "warm orange #E87820, deep copper-red #C05010, golden yellow #FFD700, dark brown centre #3A1A0A, mid-green #4A7C2F, dark outline #0A1A0A", "Cluster of daisy-like flowers with drooping reflexed petals in warm orange and copper-red tones around a prominent dark brown dome centre. Correct proportions. No roots."),
    "sanguisorba":       ("flower-spike_sanguisorba",     "M",  256, "Perennial",        "plant", "deep burgundy-red #6A1A2A, dark maroon #4A0A1A, slender airy stems #4A7C2F, mid-green #3A6A2A, dark outline #0A1A0A", "Airy branching stems topped with small dense oval dark burgundy-red bottlebrush flower heads. Very light open silhouette with minimal foliage. Correct proportions. No roots."),
    "autumn joy sedum":  ("flower-cluster_autumn-joy-sedum","S", 160, "Perennial",       "plant", "deep rose-pink #C85878, dusty mauve #A84868, pale pink #E8A8B8, blue-grey succulent leaves #7A9A8A, dark outline #0A1A0A", "Compact mounding succulent with flat-topped domed clusters of tiny deep rose-pink flowers sitting above fleshy blue-grey oval leaves. Correct proportions. No roots."),
    "hellebore":         ("flower-cup_hellebore",           "S",  160, "Perennial",        "plant", "deep rose-pink flowers #C87890, pale blush #F0C0D0, soft cream #F5EED8, dark green nodding petals #2A6A3A, mid-green leaves #4A7C2F, dark outline #0A1A0A", "Low clump of deep green palmate leaves with several nodding cup-shaped flowers in soft pink and cream, flowers face slightly downward. Correct proportions. No roots."),
    "pulmonaria":        ("flower-cluster_pulmonaria",      "S",  160, "Perennial",        "plant", "bright pink buds #E87890, soft blue-violet open flowers #6A5AB8, pale lavender #C4A8E0, deep green spotted leaves #2A5A1A, mid-green #4A7C2F, dark outline #0A1A0A", "Low spreading clump with large spotted elliptical leaves and clusters of small tubular flowers showing both pink buds and open blue-violet flowers simultaneously. Correct proportions. No roots."),
    "bergenia":          ("flower-cluster_bergenia",        "S",  160, "Perennial",        "plant", "vivid magenta-pink #D44878, deep rose #A82858, pale pink #F0A8C0, dark glossy green #1A5A2A, mid-green #3A8A3A, dark outline #0A1A0A", "Bold clump of large glossy rounded leaves with upright stems bearing clusters of vivid magenta-pink flowers. Correct proportions. No roots."),
    "brunnera":          ("flower-cluster_brunnera",        "S",  160, "Perennial",        "plant", "vivid sky-blue #3A8AD4, mid blue #2A6AB8, pale ice blue #A8C8E8, silver-variegated leaves #C0C8B8, mid-green #4A7C2F, dark outline #0A1A0A", "Spreading clump of large heart-shaped variegated leaves with silver markings and delicate branching sprays of tiny sky-blue forget-me-not flowers. Correct proportions. No roots."),
    "camassia":          ("flower-spike_camassia",          "M",  256, "Perennial",        "plant", "vivid violet-blue #5A3AC8, deep violet #3A1A9A, pale lavender #C4A8E0, mid blue #7A60C8, bright green strap leaves #4A7C3A, dark outline #0A0A1A", "Tall upright spike densely packed with star-shaped violet-blue flowers, rising from a clump of long strap-like leaves. Correct proportions. No roots."),
    "coreopsis":         ("flower-daisy_coreopsis",          "M",  256, "Perennial",        "plant", "vivid golden yellow #FFD700, deep yellow #E8B820, warm amber #E89020, dark brown centre #3A1A0A, bright green leaves #4A7C2F, dark outline #0A1A0A", "Cluster of cheerful daisy-like flowers with bright golden-yellow ray petals and a small dark centre, on slender branching stems above fine ferny foliage. Correct proportions. No roots."),
    "gaillardia":        ("flower-daisy_gaillardia",         "M",  256, "Perennial",        "plant", "vivid red-orange #D44A1A, bright orange #E87820, golden yellow tips #FFD700, dark maroon centre #3A0A0A, mid-green #4A7C2F, dark outline #0A1A0A", "Cluster of bold daisy-like flowers with vivid red-orange ray petals tipped with golden yellow surrounding a prominent dark maroon dome centre. Correct proportions. No roots."),
    "veronica":          ("flower-spike_veronica",           "M",  256, "Perennial",        "plant", "vivid violet-blue #4A35C8, deep violet #2A1A9A, pale blue #8AB8E8, mid-green leaves #4A7C2F, bright green #5A8A3A, dark outline #0A0A1A", "Upright dense tapering spikes of tiny vivid violet-blue flowers, multiple spikes rising from a clump of lance-shaped leaves. Correct proportions. No roots."),
    "agastache":         ("flower-spike_agastache",          "M",  256, "Perennial",        "plant", "vivid orange #E87820, deep coral #C85A1A, pale peach #F0C0A0, grey-green aromatic foliage #7A9A6A, dark outline #0A1A0A", "Upright branching stems with dense tubular orange flower spikes above aromatic grey-green foliage. Correct proportions. No roots."),
    "aster":             ("flower-daisy_aster",               "M",  256, "Perennial",        "plant", "vivid purple #7B35C8, deep violet #5A1A9A, pale lilac #C4A8E0, bright yellow centre #FFD700, mid-green leaves #4A7C2F, dark outline #0A0A1A", "Dense bushy plant covered in masses of small daisy-like flowers with vivid purple ray petals and bright yellow disc centres. Correct proportions. No roots."),
    "woodland sage":     ("flower-spike_woodland-sage",       "S",  160, "Perennial",        "plant", "vivid violet-blue #5A35C8, deep violet #3A1A9A, pale blue #8AB8E8, silver-grey green foliage #8A9A7A, dark outline #0A0A1A", "Upright compact spikes densely packed with vivid violet-blue flowers above aromatic grey-green leaves. Correct proportions. No roots."),
    "lisianthus":        ("flower-cup_lisianthus",            "S",  160, "Perennial",        "plant", "deep purple #7B35C8, pale lavender #C4A8E0, soft white #F8F8F0, vivid violet #5A1A9A, mid-green #4A7C2F, dark outline #0A1A0A", "Elegant upright stems bearing large ruffled cup-shaped flowers in deep purple and pale lavender, resembling roses in bud. Correct proportions. No roots."),
    "scabiosa":          ("flower-daisy_scabiosa",            "M",  256, "Perennial",        "plant", "soft lavender-blue #8A7AC8, pale lilac #C4B8E8, mid blue #6A5AB8, bright green leaves #4A7C2F, dark outline #0A0A1A", "Slender branching stems topped with pincushion-like flowers of soft lavender-blue, each with a domed centre of tiny florets surrounded by larger outer petals. Correct proportions. No roots."),
    "penstemon":         ("flower-spike_penstemon",           "M",  256, "Perennial",        "plant", "vivid pink #E8407A, deep rose #C41260, pale blush #F5A8C8, bright white throat #F8F8F0, mid-green #4A7C2F, dark outline #0A1A0A", "Tall upright spikes of tubular bell-shaped flowers in vivid pink with white throats, arranged alternately up the stem. Correct proportions. No roots."),

    # ── Bulbs (pack-flowers-bulbs) ────────────────────────────────────────
    "scilla":            ("bulb-spring_scilla",               "XS",  96, "Bulb",             "plant", "vivid blue #3A6AD4, deep violet-blue #2A4AA8, pale blue #8AB8E8, bright green strap leaves #4A7C3A, dark outline #0A0A1A", "Low cluster of tiny vivid blue star-shaped flowers on short upright stems above narrow strap leaves. Correct proportions. No roots."),
    "leucojum":          ("bulb-spring_leucojum",             "S",  160, "Bulb",             "plant", "pure white #F8F8F0, pale green tips #A8D870, bright green stems #4A7C3A, pale cream #F5F0E8, dark outline #0A1A0A", "Slender upright stems bearing nodding bell-shaped white flowers with distinctive green-tipped petals. Correct proportions. No roots."),
    "chionodoxa":        ("bulb-spring_chionodoxa",           "XS",  96, "Bulb",             "plant", "vivid sky-blue #3A8AD4, mid blue #2A6AB8, white centre #F8F8F8, bright green strap leaves #4A7C3A, dark outline #0A0A1A", "Low cluster of star-shaped vivid blue flowers with distinctive white centres on short stems. Correct proportions. No roots."),
    "puschkinia":        ("bulb-spring_puschkinia",           "XS",  96, "Bulb",             "plant", "pale ice-blue #C0D0E8, soft blue-white #D8E8F0, pale blue stripe #8AB0D4, bright green leaves #4A7C3A, dark outline #0A1A0A", "Delicate small spikes of pale blue-white star-shaped flowers with a faint blue central stripe on short stems. Correct proportions. No roots."),
    "fritillaria":       ("bulb-spring_fritillaria",          "L",  384, "Bulb",             "plant", "vivid orange #E87820, deep orange-red #C85A10, golden yellow #FFD700, dark brown markings #3A1A0A, bright green stems #4A7C3A, dark outline #0A1A0A", "Tall dramatic stem topped with a crown of large pendant bell-shaped orange flowers and a tuft of green leaves at the very top — like a crown imperial. Correct proportions. No roots."),
    "crocosmia":         ("bulb-summer_crocosmia",            "M",  256, "Bulb",             "plant", "vivid orange #E87820, deep orange-red #C85A10, bright orange #FF6B1A, mid-green strap leaves #4A7C3A, dark outline #0A1A0A", "Arching branched stems bearing cascading funnel-shaped vivid orange flowers, with upright sword-like strap leaves below. Correct proportions. No roots."),
    "arum lily":         ("bulb-summer_arum-lily",           "M",  256, "Bulb",             "plant", "pure white spathe #F8F8F0, pale cream #F5F0E8, vivid yellow spadix #FFD700, deep glossy green #1A6A3A, mid-green #4A7C2F, dark outline #0A1A0A", "Elegant large funnel-shaped white spathe surrounding an upright yellow spadix, with large glossy arrow-shaped leaves below. Correct proportions. No roots."),

    # ── Cottage Garden (pack-flowers-cottage) ────────────────────────────
    "nigella":           ("flower-daisy_nigella",            "M",  256, "Annual Flower",    "plant", "vivid cornflower-blue #3A6AD4, pale blue #8AB8E8, soft white #F8F8F8, deep violet #2A1A8A, feathery green bracts #4A7C2F, dark outline #0A0A1A", "Delicate five-petalled blue flowers surrounded by a haze of finely divided feathery green bracts giving a misty love-in-a-mist appearance. Correct proportions. No roots."),
    "larkspur":          ("flower-spike_larkspur",           "L",  384, "Annual Flower",    "plant", "vivid violet-blue #4A35C8, deep indigo #2A1A9A, pale lavender #C4A8E0, mid-green #4A7C2F, dark outline #0A0A1A", "Tall upright spike densely packed with vivid blue-violet spurred flowers arranged up the stem. Correct proportions. No roots."),
    "stock":             ("flower-spike_stock",              "M",  256, "Annual Flower",    "plant", "vivid pink #E8407A, deep rose #C41260, pale lavender #C4A8E0, soft white #F8F8F8, mid-green #4A7C2F, dark outline #0A1A0A", "Dense upright spikes of fragrant four-petalled flowers in vivid pink and soft white. Correct proportions. No roots."),
    "geum":              ("flower-daisy_geum",               "S",  160, "Perennial",        "plant", "vivid orange #E87820, deep orange-red #C85A10, warm yellow #FFD700, bright green leaves #4A7C2F, dark outline #0A1A0A", "Low clump of deeply lobed green leaves with slender branching stems bearing vivid orange cup-shaped flowers with prominent stamens. Correct proportions. No roots."),
    "lambs ears":        ("groundcover_lambs-ears",          "S",  160, "Perennial",        "plant", "soft silver-grey #C8D0C8, pale woolly white #E8EEE8, mid silver-green #A8B8A8, warm grey #B0B8B0, dark outline #3A4A3A", "Low spreading rosette of large thick woolly silver-grey paddle-shaped leaves with a soft felted texture. Minimal flowers. Correct proportions. No roots."),
    "astrantia":         ("flower-daisy_astrantia",          "M",  256, "Perennial",        "plant", "pale pink #F0A8C0, deep rose #D47890, soft white #F8F8F0, pale green bracts #A8C890, mid-green #4A7C2F, dark outline #0A1A0A", "Domed pincushion-like flower heads with tiny pink florets surrounded by papery star-shaped bracts giving an intricate lacy appearance. Correct proportions. No roots."),
    "jacob's ladder":    ("flower-spike_jacobs-ladder",      "M",  256, "Perennial",        "plant", "vivid blue #3A6AD4, soft lavender #C4A8E0, pale blue #8AB8E8, mid-green pinnate leaves #4A7C2F, dark outline #0A0A1A", "Upright stems with pinnate ladder-like leaves and loose clusters of vivid blue cup-shaped flowers. Correct proportions. No roots."),
    "knautia":           ("flower-daisy_knautia",            "M",  256, "Perennial",        "plant", "vivid crimson #C41230, deep maroon #8A0A1A, bright crimson #D42B2B, mid-green #4A7C2F, dark outline #0A1A0A", "Wiry branching stems topped with pincushion-like domed heads of tiny vivid crimson florets. Correct proportions. No roots."),
    "campanula":         ("flower-cluster_campanula",        "L",  384, "Perennial",        "plant", "vivid violet-blue #5A35C8, pale lavender #C4A8E0, soft white #F8F8F8, mid-green #4A7C2F, dark outline #0A0A1A", "Tall branching plant covered in masses of open star-shaped bell flowers in vivid violet-blue. Correct proportions. No roots."),
    "meadow rue":        ("flower-cluster_meadow-rue",       "L",  384, "Perennial",        "plant", "soft lilac-purple #C4A8E0, pale lavender #E0D0F0, vivid purple stamens #7B35C8, mid-green divided leaves #4A7C2F, dark outline #0A0A1A", "Tall airy plant with delicate divided leaves and frothy clusters of tiny lilac-purple flowers with prominent stamens giving a misty cloud effect. Correct proportions. No roots."),
    "verbascum":         ("flower-spike_verbascum",           "XL", 512, "Biennial",         "plant", "vivid yellow #FFD700, warm golden #E8C020, pale cream #F5F0C8, silver-grey woolly leaves #C8D0C0, dark outline #0A1A0A", "Tall dramatic spike densely packed with flat-faced vivid yellow flowers rising from a rosette of large silver-grey woolly leaves. Correct proportions. No roots."),
    "plume poppy":       ("flower-cluster_plume-poppy",       "XL", 512, "Perennial",        "plant", "creamy white plumes #F5F0E8, pale buff #E8E0D0, blue-grey green leaves #5A7A6A, deep blue-green #2A5A4A, dark outline #0A1A0A", "Very tall bold plant with large deeply lobed blue-grey leaves and branching plumes of tiny creamy-white feathery flowers at the top. Correct proportions. No roots."),
    "acanthus":          ("flower-spike_acanthus",            "L",  384, "Perennial",        "plant", "soft lilac-white #E8D0E8, deep purple hood #5A1A6A, pale white #F5F0F0, deep glossy green #1A6A3A, dark spiny bracts #3A2A1A, dark outline #0A1A0A", "Tall dramatic architectural spike of hooded purple-and-white flowers above large deeply lobed glossy dark green leaves with spiny tips. Correct proportions. No roots."),
    "impatiens":         ("flower-daisy_impatiens",           "S",  160, "Annual Flower",    "plant", "vivid coral-pink #E8507A, deep rose #C41260, bright white #F8F8F8, vivid red #D42B2B, mid-green leaves #4A7C2F, dark outline #0A1A0A", "Compact mounding plant completely smothered in flat-faced five-petalled flowers in vivid coral-pink and red, with fresh green leaves barely visible beneath. Correct proportions. No roots."),
    "begonia":           ("flower-daisy_begonia",             "S",  160, "Annual Flower",    "plant", "vivid coral-pink #E8507A, deep rose #C41260, pale blush #F5C8D8, glossy dark green leaves #1A5A2A, bronze-red leaf tinge #6A2A1A, dark outline #0A1A0A", "Compact bushy plant with glossy rounded leaves and clusters of vivid pink waxy flowers. Correct proportions. No roots."),
    "alyssum":           ("flower-cluster_alyssum",           "XS",  96, "Annual Flower",    "plant", "pure white #F8F8F0, pale cream #F5F0E8, soft lavender #D8C8E8, bright green leaves #4A7C2F, dark outline #0A1A0A", "Low spreading mound completely covered in tiny fragrant four-petalled white flowers in dense clusters. Correct proportions. No roots."),
    "calibrachoa":       ("flower-daisy_calibrachoa",         "XS",  96, "Annual Flower",    "plant", "vivid purple #7B35C8, vivid pink #E8407A, bright yellow centre #FFD700, mid-green #4A7C2F, dark outline #0A1A0A", "Trailing mound of tiny petunia-like flowers in vivid purple and pink with yellow centres, masses of blooms over fine foliage. Correct proportions. No roots."),
    "toadflax":          ("flower-spike_toadflax",            "M",  256, "Perennial",        "plant", "vivid purple #7B35C8, deep violet #5A1A9A, pale lilac #C4A8E0, soft white throat #F8F8F0, slender grey-green stems #7A9A6A, dark outline #0A0A1A", "Slender airy upright stems with tiny snapdragon-like purple flowers densely arranged along the upper stem. Correct proportions. No roots."),
    "veronicastrum":     ("flower-spike_veronicastrum",       "L",  384, "Perennial",        "plant", "soft lilac-white #E8D8F0, pale lavender #D0C0E8, mid-green #4A7C2F, upright spires #7A9A6A, dark outline #0A0A1A", "Tall elegant candelabra plant with multiple slender tapering spikes of tiny pale lilac-white flowers radiating from a central stem. Correct proportions. No roots."),
    "sidalcea":          ("flower-spike_sidalcea",            "M",  256, "Perennial",        "plant", "vivid pink #E8407A, deep rose #C41260, pale blush #F5A8C8, mid-green #4A7C2F, dark outline #0A1A0A", "Tall upright spikes of open five-petalled silky pink flowers arranged up the stem, resembling a miniature hollyhock. Correct proportions. No roots."),
    "mountain cornflower":("flower-daisy_mountain-cornflower", "M",  256, "Perennial",        "plant", "vivid cornflower-blue #3A6AD4, deep blue #2A4AA8, pale blue centre #8AB8E8, mid-green leaves #4A7C2F, dark outline #0A0A1A", "Shaggy ragged-petalled vivid blue cornflower heads on sturdy stems with grey-green leaves. Correct proportions. No roots."),
    "blue flax":         ("flower-daisy_blue-flax",           "S",  160, "Perennial",        "plant", "vivid sky-blue #3A8AD4, pale blue #8AB8E8, soft white centre #F8F8F8, slender grey-green stems #7A9A6A, mid-green #4A7C2F, dark outline #0A0A1A", "Airy branching plant with delicate open five-petalled vivid sky-blue flowers on slender stems. Correct proportions. No roots."),

    # ── Wildflowers (pack-flowers-wildflowers) ───────────────────────────
    "field poppy":       ("flower-daisy_field-poppy",         "M",  256, "Annual Flower",    "plant", "vivid scarlet-red #D42B2B, deep red #A81A0A, black centre #0A0A0A, mid-green hairy stem #4A7C2F, dark outline #0A1A0A", "Upright hairy stems with large crinkled papery vivid scarlet-red four-petalled flowers with a dark centre. Correct proportions. No roots."),
    "ox-eye daisy":      ("flower-daisy_ox-eye-daisy",        "M",  256, "Perennial",        "plant", "pure white petals #F8F8F0, vivid yellow centre #FFD700, mid-green stems #4A7C2F, deep green leaves #2A5A1A, dark outline #0A1A0A", "Classic large white daisy flowers with crisp white ray petals surrounding a broad vivid yellow disc, on tall stems. Correct proportions. No roots."),
    "cornflower":        ("flower-daisy_cornflower",          "M",  256, "Annual Flower",    "plant", "vivid cornflower-blue #3A6AD4, deep blue #2A4AA8, pale blue #8AB8E8, silver-grey green stem #7A9A6A, dark outline #0A0A1A", "Shaggy vivid blue cornflower heads with finely divided florets on slender branching stems with narrow grey-green leaves. Correct proportions. No roots."),
    "california poppy":  ("flower-daisy_california-poppy",   "S",  160, "Annual Flower",    "plant", "vivid orange #FF6B1A, golden yellow #FFD700, deep orange #CC4A00, blue-grey green ferny foliage #5A7A6A, dark outline #0A1A0A", "Low spreading plant with vivid orange cup-shaped four-petalled flowers above finely divided blue-grey ferny foliage. Correct proportions. No roots."),
    "wallflower":        ("flower-spike_wallflower",          "S",  160, "Biennial",         "plant", "vivid orange #E87820, deep orange-red #C85A10, warm yellow #FFD700, dark green leaves #2A5A1A, dark outline #0A1A0A", "Compact upright plant with dense spikes of vivid fragrant four-petalled flowers in warm orange and yellow. Correct proportions. No roots."),
    "sea thrift":        ("flower-cluster_sea-thrift",        "XS",  96, "Perennial",        "plant", "vivid pink #E8407A, deep rose #C41260, pale blush #F5A8C8, dark green grass-like leaves #2A5A2A, dark outline #0A1A0A", "Neat cushion of dark grass-like leaves topped with perfectly round pompom heads of vivid pink flowers on upright stems. Correct proportions. No roots."),
    "creeping phlox":    ("groundcover_creeping-phlox",     "XS",  96, "Perennial",        "plant", "vivid pink #E84070, deep rose #C42050, pale lavender #C4A8E0, bright green mat foliage #4A7C2F, dark outline #0A0A1A", "Dense low creeping mat of tiny needle-like evergreen leaves completely smothered in vivid five-petalled pink flowers in spring. Correct proportions. No roots."),
    "field poppy":       ("flower-daisy_field-poppy",         "M",  256, "Annual Flower",    "plant", "vivid scarlet-red #D42B1A, deep red #A81A0A, black centre #0A0A0A, pale green stem #8FBF6A, dark outline #0A1A0A", "Delicate upright slender stems with vivid scarlet-red crinkled four-petalled flowers, black stamens, and hairy buds. Classic corn poppy silhouette. Correct proportions. No roots."),
    "wood anemone":      ("flower-daisy_wood-anemone",        "S",  160, "Perennial",        "plant", "pure white petals #F8F8F0, pale blush #F5E8EC, bright yellow stamens #FFD700, deep green lobed leaves #2A5A1A, mid-green #4A7C2F, dark outline #0A1A0A", "Delicate woodland wildflower with star-shaped white flowers above deeply lobed bright green leaves. Correct proportions. No roots."),
    "wild garlic":       ("flower-cluster_wild-garlic",       "M",  256, "Perennial",        "plant", "pure white star flowers #F8F8F0, bright green strap leaves #4A8A3A, pale green stems #8ABF6A, dark outline #0A1A0A", "Clump of broad bright green strap leaves with loose clusters of small star-shaped white flowers on upright stems. Correct proportions. No roots."),
    "solomon's seal":    ("flower-arch_solomons-seal",        "M",  256, "Perennial",        "plant", "mid green #4A8A3A, deep green #2A5A1A, pure white bells #F8F8F0, pale cream #F5F0E8, dark outline #0A1A0A", "Elegant arching stems with alternating oval leaves and pairs of small pendant white bell-shaped flowers hanging beneath the stems. Correct proportions. No roots."),
    "cowslip":           ("flower-cluster_cowslip",           "S",  160, "Perennial",        "plant", "vivid yellow #FFD700, deep golden #E8B820, soft yellow #FFF0A0, mid-green wrinkled leaves #4A7C2F, dark outline #0A1A0A", "Low rosette of wrinkled mid-green leaves with an upright stem bearing a nodding cluster of vivid yellow tubular flowers. Correct proportions. No roots."),
    "meadow cranesbill": ("flower-daisy_meadow-cranesbill",   "M",  256, "Perennial",        "plant", "vivid violet-blue #5A3AC8, deep violet #3A1A9A, pale lavender #C4A8E0, bright green deeply-lobed leaves #4A7C2F, dark outline #0A0A1A", "Bushy clump of deeply lobed bright green leaves covered in vivid violet-blue open five-petalled flowers. Correct proportions. No roots."),
    "wild carrot":       ("flower-cluster_wild-carrot",       "M",  256, "Biennial",         "plant", "pure white #F8F8F0, pale cream #F5F0E8, single dark purple centre floret #4A0A4A, mid-green ferny foliage #4A7C2F, dark outline #0A1A0A", "Flat-topped lacy white umbel flower head (Queen Anne's Lace) above finely divided ferny foliage, with a single tiny dark purple floret at the centre. Correct proportions. No roots."),
    "meadowsweet":       ("flower-cluster_meadowsweet",       "M",  256, "Perennial",        "plant", "creamy white #F5F0E0, pale ivory #F8F4E8, warm yellow-white stamens #F5E898, mid-green pinnate leaves #4A7C2F, dark outline #0A1A0A", "Upright stems with clusters of fluffy creamy-white frothy flowers above pinnate bright green leaves. Sweet meadow wildflower. Correct proportions. No roots."),
    "hepatica":          ("flower-cup_hepatica",               "XS",  96, "Perennial",        "plant", "vivid violet-blue #5A3AC8, pale lavender #C4A8E0, soft white #F8F8F0, bright yellow stamens #FFD700, deep green three-lobed leaves #2A5A1A, dark outline #0A0A1A", "Low woodland wildflower with small cup-shaped violet-blue flowers on slender stems above distinctive three-lobed liver-shaped leaves. Correct proportions. No roots."),
    "wild cyclamen":     ("flower-cup_wild-cyclamen",          "S",  160, "Perennial",        "plant", "vivid pink #E8407A, deep rose #C41260, pale blush #F5A8C8, dark marbled leaves #2A5A1A, silver-green marbling #8AB08A, dark outline #0A1A0A", "Delicate nodding swept-back pink flowers on slender stems above low rosette of beautifully marbled dark green heart-shaped leaves with silver patterning. Correct proportions. No roots."),

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
    "spring onion":          ("vegetable-bulb_spring-onion",      "S",  160, "Bulb Vegetable",   "rootveg", "pure white bulb #F5F0E8, pale green neck #C8D870, bright green strap tops #4A8A3A, dark outline #0A1A0A", "Cluster of slim white spring onion bulbs. Show the full onion tops and foliage — long bright green hollow strap leaves extending well upward. Vertical bulbs in a cluster with tall green leaves above. No soil. No roots."),
    "scallion":              ("vegetable-bulb_spring-onion",      "S",  160, "Bulb Vegetable",   "rootveg", "pure white bulb #F5F0E8, pale green neck #C8D870, bright green strap tops #4A8A3A, dark outline #0A1A0A", "Slim white bulb base with long bright green hollow strap leaves above, clean floating view."),
    "elephant garlic":       ("vegetable-bulb_elephant-garlic",   "L",  384, "Bulb Vegetable",   "rootveg", "papery white #F5F0E8, pale purple tinge #C8B8D8, broad green strap #4A8A3A, dark outline #0A1A0A", "Very large single papery white garlic bulb with broad flat strap leaves extending well above. Scale the entire plant small enough that the foliage tips are fully visible within the canvas with clear space above. Bulb at lower third, leaves reaching upper portion. No soil. No roots. No cropping."),
    "florence fennel":       ("vegetable-bulb_florence-fennel",   "M",  256, "Bulb Vegetable",   "rootveg", "pale white-green bulb #D4E8C0, mid green #4A8A3A, feathery bright green fronds #6AAF5A, dark outline #0A1A0A", "Broad flat white-green fennel bulb with overlapping layers. Show the full foliage — feathery bright green fronds extending generously upward. Vertical plant with prominent bulb at base and tall feathery tops. No soil. No roots."),
    "cipollini onion":       ("vegetable-bulb_cipollini",         "S",  160, "Bulb Vegetable",   "rootveg", "pale golden-brown #C8A050, cream white #F5F0D8, bright green strap tops #4A8A3A, dark outline #0A1A0A", "Cluster of flat disc-shaped cipollini onion bulbs, much wider than tall, papery golden-brown skin. Show the full onion tops and foliage extending upward. Vertical bulbs in a cluster with green strap leaves above. No soil. No roots."),
    "walking onion":         ("vegetable-bulb_walking-onion",     "M",  256, "Bulb Vegetable",   "rootveg", "mid green #4A8A3A, bright green #5AB83A, small topset bulbs #C8A050, dark outline #0A1A0A", "Upright hollow green stems with a cluster of small bulblets forming at the very top, arching under their weight."),
    "hardneck garlic":       ("vegetable-bulb_hardneck-garlic",   "S",  160, "Bulb Vegetable",   "rootveg", "papery white #F5F0E8, pale purple tinge #C8B8D8, stiff green scape #4A8A3A, dark outline #0A1A0A", "Papery white garlic bulb. Show the full tops and foliage — stiff green scape curling into a loop above, with green strap leaves. Vertical bulb in a cluster. No soil. No roots."),
    # Vegetables - Stem
    "globe artichoke":       ("vegetable-stem_globe-artichoke",   "M",  256, "Stem Vegetable",   "plant",   "blue-grey green #6A8A7A, silver-green #8AAF8A, deep purple-green bud #4A5A3A, pale green bracts #A8C890, dark outline #0A1A10, flat solid cyan background (#00FFFF)", "Architectural plant with large silver-green deeply divided leaves and one or more large round flower buds on tall stems. Viewed from a 3/4 overhead angle, slight perspective depth. The plant must be small and centered — occupying only 65% of the canvas width and height, leaving a wide empty cyan border around all sides."),
    "cardoon":               ("vegetable-stem_cardoon",           "XL", 512, "Stem Vegetable",   "plant",   "silver-grey #8AAFC0, pale silver #C8D8D0, violet-purple flower #7B35C8, dark outline #0A1018", "Massive architectural plant with large deeply-lobed silver-grey thistle-like leaves and tall spiny stems with purple flowers."),
    "bok choy":              ("vegetable-stem_bok-choy",          "S",  160, "Stem Vegetable",   "plant",   "bright green #5AB83A, deep green #2A5A1A, pure white stems #F5F0E8, dark outline #0A1A0A", "Compact rosette with broad glossy green leaves and thick crisp white stalks fanning from base."),
    "pak choi":              ("vegetable-stem_bok-choy",          "S",  160, "Stem Vegetable",   "plant",   "bright green #5AB83A, deep green #2A5A1A, pure white stems #F5F0E8, dark outline #0A1A0A", "Compact rosette with broad glossy green leaves and thick crisp white stalks fanning from base."),
    "samphire":              ("vegetable-stem_samphire",          "S",  160, "Stem Vegetable",   "plant", "vivid bright green #5AB83A, blue-green #4A8A7A, succulent stems #8ABF8A, dark outline #0A1A10", "Low bushy succulent-stemmed coastal plant with finger-like cylindrical bright green stems and tiny yellow flowers."),  # 🌿 WILD — do last
    # Vegetables - Fruiting
    "tomatillo":             ("vegetable-fruiting_tomatillo",     "M",  256, "Fruiting Vegetable", "plant", "mid green #4A8A3A, pale papery husk #D4C870, green-yellow fruit #A8C840, dark outline #0A1A0A", "Bushy plant with papery lantern-like husks enclosing green-yellow fruit, spreading habit."),
    "cape gooseberry":       ("vegetable-fruiting_cape-gooseberry", "M", 256, "Fruiting Vegetable", "plant", "mid green #4A8A3A, pale papery husk #D4C890, golden fruit #D4A020, dark outline #0A1A0A", "Upright bushy plant with distinctive papery lantern husks, golden-yellow round fruit visible inside split husks."),  # 🌿 WILD — do last
    "ground cherry":         ("vegetable-fruiting_ground-cherry",  "S", 160, "Fruiting Vegetable", "plant", "mid green #4A8A3A, pale golden husk #D4C890, small yellow fruit #FFD700, dark outline #0A1A0A", "Compact low plant with small papery husks containing tiny golden cherry-like fruit."),
    "luffa":                 ("vegetable-fruiting_luffa",          "L", 384, "Fruiting Vegetable", "plant", "mid green #4A8A3A, deep green #2A5A1A, pale tan mature fruit #D4B870, bright green young fruit #6AAF5A, dark outline #0A1A0A", "Climbing vine with large green leaves and long pale green cylindrical sponge-gourd hanging from stem."),  # 🌿 WILD — do last
    "armenian cucumber":     ("vegetable-fruiting_armenian-cucumber", "L", 384, "Fruiting Vegetable", "plant", "pale green #A8C870, mid green vine #4A8A3A, long curved fruit #8ABF5A, dark outline #0A1A0A", "Climbing vine with large leaves and very long slender curved pale green cucumber hanging."),
    "bitter melon":          ("vegetable-fruiting_bitter-melon",   "M", 256, "Fruiting Vegetable", "plant", "bright green #5AB83A, mid green vine #4A8A3A, vivid green warty fruit #3A8A2A, pale cream #D4C890, dark outline #0A1A0A", "Climbing vine with distinctive deeply warty bumpy-skinned oblong green fruit hanging from tendrils."),
    "butternut squash":      ("vegetable-fruiting_butternut-squash", "L", 384, "Fruiting Vegetable", "plant", "warm tan-cream #D4B870, pale golden #C8A050, broad green leaves #4A8A3A, dark outline #0A1A0A", "Sprawling vine plant with large broad leaves and a distinctive pear-shaped butternut squash in warm tan-cream colour. Do not show the interior of the squash. Exterior skin only. Correct proportions. No roots."),
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
    "romanesco":             ("vegetable-brassica_romanesco",      "M",  256, "Brassica",        "plant",   "vivid yellow-green #8ABF2A, mid green #5A8A3A, pale lime-green #C8D870, geometric spirals #6A9A2A, dark outline #0A1A0A, flat solid cyan background (#00FFFF)", "Simplified 3d shape, surrounded by plant foliage. Striking fractal spiral head of vivid lime-green romanesco viewed from a 3/4 overhead angle, slight perspective depth. The plant must be small and centered — occupying only 65% of the canvas width and height, leaving a wide empty cyan border around all sides."),
    # Vegetables - Asian Greens
    "pak choy":              ("vegetable-asian_pak-choy",          "S",  160, "Asian Green",      "plant",   "bright green #5AB83A, deep green #2A5A1A, pure white stems #F5F0E8, dark outline #0A1A0A", "Compact rosette of glossy bright green leaves on thick white crunchy stems, very clean and fresh."),
    "napa cabbage":          ("vegetable-asian_napa-cabbage",      "M",  256, "Asian Green",      "plant",   "pale yellow-green #C8D870, mid green #4A8A3A, cream-white centre #F5F0E8, vivid outer green leaves #4A8A3A, dark outline #0A1A0A", "Tall upright vertical napa cabbage plant. Show the full foliage — broad crinkly outer green leaves spreading outward with pale yellow-green inner leaves. Vertical plant, full height. No soil. No roots."),
    "chinese cabbage":       ("vegetable-asian_napa-cabbage",      "M",  256, "Asian Green",      "plant",   "pale yellow-green #C8D870, mid green #4A8A3A, cream-white centre #F5F0E8, dark outline #0A1A0A", "Tall oval-shaped head of pale crinkly yellow-green leaves forming a tight elongated barrel shape."),
    "mizuna":                ("vegetable-asian_mizuna",            "S",  160, "Asian Green",      "plant",   "bright green #5AB83A, mid green #4A8A3A, deep green #2A5A1A, pale stems #D4E8C0, dark outline #0A1A0A", "Low spreading rosette of deeply pinnate feathery bright green leaves with narrow lobes, very frilly."),
    "tatsoi":                ("vegetable-asian_tatsoi",            "S",  160, "Asian Green",      "plant",   "deep glossy green #1A6A3A, mid green #3A8A5A, white stems #F5F0E8, dark outline #0A1A10", "Perfect flat rosette of deep glossy rounded spoon-shaped leaves spreading symmetrically from centre."),
    "garland chrysanthemum": ("vegetable-asian_garland-chrysanthemum", "M", 256, "Asian Green",  "plant", "bright green #5AB83A, mid green #4A8A3A, golden-yellow flowers #FFD700, pale yellow #FFE870, dark outline #0A1A0A", "Bushy plant with finely divided aromatic leaves and bright golden daisy-like flowers at tips."),  # 🌿 WILD — do last
    "water spinach":         ("vegetable-asian_water-spinach",    "M",  256, "Asian Green",      "plant", "vivid green #5AB83A, deep green #2A6A3A, pale stems #D4E8C0, hollow stems #8ABF6A, dark outline #0A1A0A", "Sprawling aquatic plant with hollow stems and arrow-shaped vivid green leaves."),  # 🌿 WILD — do last
    "chinese spinach":       ("vegetable-asian_chinese-spinach",  "M",  256, "Asian Green",      "plant",   "deep magenta-red #C41250, vivid red #E82050, deep green #2A5A1A, dark outline #1A0A0A", "Upright bushy plant with broad pointed leaves in striking red-green colouring."),
    # Vegetables - Perennial
    "sea kale":              ("vegetable-perennial_sea-kale",     "M",  256, "Perennial Vegetable", "plant", "blue-grey green #6A8A9A, silver-blue #8AAFC0, white flowers #F5F0E8, dark outline #0A1018", "Bold architectural plant with large blue-grey wavy-edged leaves and dense clusters of small white flowers on tall stems."),  # 🌿 WILD — do last
    "nine-star broccoli":    ("vegetable-perennial_nine-star-broccoli", "L", 384, "Perennial Vegetable", "plant", "deep blue-green #2A6A4A, mid green #4A8A5A, pale cream-white heads #F0EEE0, dark outline #0A1A10", "Large perennial brassica plant with multiple small creamy-white sprouting broccoli heads at branch tips."),
    "turkish rocket":        ("vegetable-perennial_turkish-rocket", "M", 256, "Perennial Vegetable", "plant", "mid green #4A8A3A, bright green #5AB83A, vivid yellow flowers #FFD700, pale green #8ABF6A, dark outline #0A1A0A", "Bushy leafy plant with bright green lobed leaves and clusters of small vivid yellow mustard-family flowers."),  # 🌿 WILD — do last
    "perennial leek":        ("vegetable-perennial_perennial-leek", "M", 256, "Perennial Vegetable", "plant", "blue-green strap #6A9A7A, mid green #4A8A5A, pale white base #F0EEE8, dark outline #0A1A10", "Vertical bunch of leeks with long green tops. Multiple whole leeks bundled together upright, showing white base bulbs at the bottom and long flat green strap leaves extending upward. No flowers. No soil."),
    # Fruit - Stone
    "apricot":               ("tree-fruit_apricot",               "L",  384, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, warm golden-orange apricot #E89040, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural rounded leafy canopy. Small clusters of warm golden-orange apricot fruit as accent. Canopy fills the frame."),
    "nectarine":             ("tree-fruit_nectarine",             "L",  384, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, vivid red-yellow nectarine #D44A2A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural rounded leafy deciduous canopy. Red-yellow smooth-skinned nectarine fruit as accent. Canopy fills the frame."),
    "damson":                ("tree-fruit_damson",                "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, deep purple-blue damson #4A2A7A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural compact rounded canopy. Small deep purple-blue damson plums as accent. Canopy fills the frame."),
    "greengage":             ("tree-fruit_greengage",             "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, golden-green greengage #A8C840, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Natural rounded compact canopy. Small golden-green round plum fruit as accent. Canopy fills the frame."),
    "sloe":                  ("tree-fruit_sloe",                  "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, blue-black sloe berries #2A1A4A, white blossom #F8F8F0, warm brown limbs #6B3A2A", "Compact spiny shrub-like canopy with white spring blossom and clusters of tiny blue-black sloe berries."),  # 🌿 WILD — do last
    "blackthorn":            ("tree-fruit_sloe",                  "M",  256, "Stone Fruit",      "deciduous", "deep green #2A5C1A, mid-green #4A8C3A, blue-black sloe berries #2A1A4A, white blossom #F8F8F0, warm brown limbs #6B3A2A", "Compact spiny shrub-like canopy with white spring blossom and clusters of tiny blue-black sloe berries."),  # 🌿 WILD — do last
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
    "strawberry":            ("fruit-berry_strawberry",           "XS", 160, "Berry Fruit",      "plant",   "vivid red #D42B2B, deep red #A01A1A, bright green trifoliate leaves #5AB83A, pale pink flower #F5C8D8, dark outline #1A0A0A, flat solid cyan background (#00FFFF)", "Low spreading mat of trifoliate toothed leaves with bright red heart-shaped strawberries and runners."),
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
    "guava":                 ("tree-fruit_guava",                 "L",  384, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, vivid pale yellow-green guava #C8D870, warm pink blush #E8A090, warm brown limbs #6B3A2A", "Rounded compact canopy with oval pale yellow-green guava fruits clearly visible as accent. The guava fruit must be prominent and recognisable on the tree. Multiple guava fruits showing."),
    "avocado":               ("tree-fruit_avocado",               "XL", 512, "Tropical Fruit",   "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, dark purple-black avocado #2A3A1A, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Spreading glossy-leaved canopy with multiple distinctive pear-shaped dark purple-black avocado fruits clearly visible and prominent on the tree. The avocado fruit must be the focal accent — large, obvious, and recognisable."),
    "lychee":                ("tree-fruit_lychee",                "L",  384, "Tropical Fruit",   "deciduous", "deep glossy green #1A6A3A, mid-green #3A8A5A, vivid red lychee #C42A2A, pale pink #F5A0A0, warm brown limbs #6B3A2A", "Dense rounded canopy with clusters of small bright red warty-skinned lychee fruits as accent."),
    "pineapple":             ("fruit-tropical_pineapple",         "M",  256, "Tropical Fruit",   "plant",   "golden-yellow #D4A020, vivid yellow #E8C040, deep green crown #2A6A3A, spiky blue-green leaves #5A8A7A, dark outline #0A1A10", "Ground-growing plant with stiff spiky blue-green bromeliad leaves and a large golden-yellow pineapple at centre."),
    "starfruit":             ("tree-fruit_starfruit",             "L",  384, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, vivid golden-yellow starfruit #D4C040, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Rounded spreading canopy with distinctive golden-yellow star-shaped carambola fruits as accent."),
    "carambola":             ("tree-fruit_starfruit",             "L",  384, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, vivid golden-yellow starfruit #D4C040, warm brown limbs #6B3A2A, pale yellow-green #B8D474", "Rounded spreading canopy with distinctive golden-yellow star-shaped carambola fruits as accent."),
    "feijoa":                ("tree-fruit_feijoa",                "L",  384, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, grey-green #7A9A7A, oval green-grey feijoa #8AAF7A, vivid red-pink flower #E8207A, warm brown limbs #6B3A2A", "Compact rounded canopy with silvery-green leaves and oval feijoa fruits and exotic red-pink flowers as accent."),
    "jaboticaba":            ("tree-fruit_jaboticaba",            "M",  256, "Tropical Fruit",   "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, deep purple-black berries #1A0A2A, warm brown trunk #6B3A2A, pale bark #C8B8A8", "Unusual shrub-tree with fruit growing directly on the trunk and main branches in clusters of deep purple-black berries."),
    "jackfruit":             ("tree-fruit_jackfruit",             "XXL", 512, "Tropical Fruit",  "deciduous", "deep green #1A6A3A, mid-green #3A8A5A, enormous green-brown jackfruit #8A7A4A, spiky skin #6A5A3A, warm brown trunk #6B3A2A", "Large tropical canopy with truly enormous spiky oval jackfruit visible on the trunk and branches."),
    # Fruit - Melons
    "watermelon":            ("fruit-melon_watermelon",           "L",  384, "Melon",            "plant",   "deep green stripes #2A6A3A, pale green stripes #8ABF6A, mid green vines #4A8A3A, dark outline #0A1A0A", "Sprawling vine with large green leaves and a big round watermelon with distinctive dark and light green stripes. Do not show the inside of the watermelon. Viewed from a 3/4 overhead angle, slight perspective depth, rounded globe shape with visible curvature."),
    "cantaloupe":            ("fruit-melon_cantaloupe",           "M",  256, "Melon",            "plant",   "tan-cream netting #C8A870, warm golden #D4A050, mid green vine #4A8A3A, dark green leaves #2A5A1A, dark outline #0A1A0A", "Compact vine with large leaves and a round tan-netted cantaloupe melon. Do not show the inside of the fruit. Exterior skin only — tan beige netting pattern on the whole melon. Correct proportions. No roots."),
    "honeydew":              ("fruit-melon_honeydew",             "M",  256, "Melon",            "plant",   "smooth pale green-cream #C8D8B8, pale yellow #D4C870, cool white-green #D8E8D0, mid green vine #4A8A3A, dark outline #0A1A10", "Compact vine with large leaves and a smooth oval pale cream-green honeydew melon."),
    "charentais melon":      ("fruit-melon_charentais",           "M",  256, "Melon",            "plant",   "pale grey-green skin #B8C8B0, subtle grey-green ribbing #A8B8A0, mid green vine #4A8A3A, dark green leaves #2A5A1A, dark outline #0A1A10", "Compact vine with large leaves and a small round pale grey-green ribbed Charentais melon. Do not show the inside of the fruit. Exterior skin only — pale grey-green with subtle ribbing. Correct proportions. No roots."),
    "galia melon":           ("fruit-melon_galia",                "M",  256, "Melon",            "plant",   "pale yellow-green netted skin #C8D870, tan netting #C8A870, mid green vine #4A8A3A, dark green leaves #2A5A1A, dark outline #0A1A0A", "Compact vine with large leaves and a round pale yellow-green netted Galia melon. Do not show the inside of the fruit. Exterior skin only — pale greenish-yellow with tan netting pattern. Correct proportions. No roots."),
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

def get_brave_tab(url_fragment, tab_index=0):
    """Get the Nth Brave CDP tab matching url_fragment (0-based). Returns None if not found."""
    try:
        tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5).read())
        matches = [t for t in tabs if url_fragment in t.get("url","") and t.get("type")=="page"]
        if tab_index < len(matches):
            return matches[tab_index]
    except Exception:
        pass
    return None

def open_gemini_in_brave():
    """Open a new Gemini tab in Brave (Brave must already be running with CDP)."""
    p("Opening new Gemini tab in Brave...")
    # Open a new tab via CDP rather than spawning a new Brave process
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:9222/json/new?{GEMINI_URL}",
            method="PUT"
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        # Fallback: open new Brave window
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

def ensure_gemini_open(tab_index=0):
    """Make sure the Nth Gemini tab is open. Opens a new one if needed. Returns tab or raises."""
    tab = get_brave_tab("gemini.google.com", tab_index)
    if not tab:
        p(f"Gemini tab {tab_index} not open — opening now...")
        if not open_gemini_in_brave():
            raise RuntimeError("Could not open Gemini in Brave after 30s")
        tab = get_brave_tab("gemini.google.com", tab_index)
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

def navigate_fresh(ws_url, tab_index=0):
    # Navigate the tab directly to gemini.google.com/app via CDP Page.navigate.
    # This is tab-specific and atomic — avoids the race condition where two agents
    # both click 'New chat' and land in the same session.
    p(f"Navigating tab {tab_index} to fresh Gemini chat...")
    try:
        ws = websocket.create_connection(ws_url, timeout=10)
        ws.send(json.dumps({"id": 1, "method": "Page.navigate", "params": {"url": "https://gemini.google.com/app"}}))
        try:
            ws.recv()  # ack
        except Exception:
            pass
        ws.close()
    except Exception as e:
        p(f"  [warn] navigate failed: {e} — continuing")
    time.sleep(4)  # wait for page load
    # Re-fetch tab by index after navigation (URL will have changed to /app)
    fresh = get_brave_tab("gemini.google.com", tab_index)
    if fresh:
        p(f"  Tab {tab_index} fresh URL: {fresh['url'][:60]}")
        return fresh["webSocketDebuggerUrl"]
    return ws_url

def send_telegram_preview(image_path, plant_name):
    """Log the pending sticker path for the main agent to send via Telegram.
    The openclaw CLI hangs when called from a subprocess context — previews are
    sent by the main agent using the message tool after the script completes.
    """
    p(f"PREVIEW_READY: {image_path}")
    p(f"Sticker saved to pending. Main agent will send Telegram preview for: {plant_name}")

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
        elif r > threshold and g < dark and b < dark:
            return 'FF0000'  # red
        else:
            # Default to magenta (most common Gemini output)
            return 'FF00FF'
    except Exception as e:
        p(f"  [warn] chroma detection failed: {e} — defaulting to magenta")
        return 'FF00FF'


def main():
    args = sys.argv[1:]
    force = "--force" in args

    # Parse --tab N (default 0)
    tab_index = 0
    for i, a in enumerate(args):
        if a == "--tab" and i + 1 < len(args):
            try:
                tab_index = int(args[i + 1])
            except ValueError:
                pass

    # Strip all flags
    clean_args = []
    skip_next = False
    for a in args:
        if skip_next:
            skip_next = False
            continue
        if a == "--tab":
            skip_next = True
            continue
        if a.startswith("--"):
            continue
        clean_args.append(a)
    args = clean_args

    if not args:
        print("Usage: python sticker-generate-one.py \"Plant Name\" [--force] [--tab N]")
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

    # ── Auto-select safest background chroma ─────────────────────────────────
    # Parse plant hex colours and pick the chroma background that is furthest
    # from ALL plant colours, minimising bleed during background removal.
    # If the colours string already has a hardcoded background spec, honour it.
    def _pick_safe_chroma(colour_string):
        """Return (bg_name, hex) — the chroma background furthest from plant colours."""
        import re as _r2
        # Extract all #RRGGBB hex values from the plant colour string
        hexes = _r2.findall(r'#([0-9A-Fa-f]{6})', colour_string)
        plant_rgb = []
        for h in hexes:
            plant_rgb.append((int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)))
        # Four candidate backgrounds (name, hex, RGB)
        candidates = [
            ('magenta',  'FF00FF', (255,   0, 255)),
            ('cyan',     '00FFFF', (  0, 255, 255)),
            ('red',      'FF0000', (255,   0,   0)),
            ('green',    '00FF00', (  0, 255,   0)),
        ]
        if not plant_rgb:
            return candidates[0]  # default magenta if no colours parsed
        best_name, best_hex, best_rgb = None, None, None
        best_min_dist = -1
        for cname, chex, crgb in candidates:
            # Min distance from this chroma to any plant colour
            min_d = min(
                ((r - crgb[0])**2 + (g - crgb[1])**2 + (b - crgb[2])**2) ** 0.5
                for r, g, b in plant_rgb
            )
            if min_d > best_min_dist:
                best_min_dist = min_d
                best_name, best_hex, best_rgb = cname, chex, crgb
        return best_name, best_hex, best_rgb

    if colours_has_bg:
        bg_spec = _bg_match.group(0).strip().lstrip(',')
        p(f"  Background: using hardcoded spec from colours string")
    else:
        bg_name, bg_hex, _ = _pick_safe_chroma(colours_clean)
        bg_spec = f'flat solid {bg_name} background (#{bg_hex})'
        p(f"  Background: auto-selected {bg_name} (#{bg_hex}) as safest chroma for plant colours")
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
            f"Shape: Correct proportions. Viewed from a 3/4 overhead angle, slight perspective depth."
        )
    elif template == "pine":
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}, no trunk.\n"
            f"Canvas: {size_px}px square.\n"
            f"Suggested Colours: {colours_line}\n"
            f"Shape: Correct proportions. Viewed from a 3/4 overhead angle, slight perspective depth."
        )
    else:
        prompt = (
            f"{prefix}\n\n"
            f"Subject: {plant_name}.\n"
            f"Canvas: {size_px}px square.\n"
            f"Suggested Colours: {colours_line}\n"
            f"Shape: {shape} Viewed from a 3/4 overhead angle, slight perspective depth."
        )

    # ── Ensure Gemini is open ────────────────────────────────
    p(f"\nChecking Gemini tab (index {tab_index})...")
    tab = ensure_gemini_open(tab_index)
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
    ws_url = navigate_fresh(ws_url, tab_index)

    # ── Verify this tab has a unique conversation URL ─────────
    # Guard against two parallel agents landing on the same Gemini session.
    # /app with no path suffix = true new chat. /app/<id> = existing convo (still ok, but log it).
    try:
        tab_now = get_brave_tab("gemini.google.com", tab_index)
        tab_url = tab_now["url"] if tab_now else "unknown"
        p(f"Tab {tab_index} URL after navigate: {tab_url}")
        # If URL still has a long conversation ID and tab_index > 0, warn
        if tab_index > 0 and "/app/" in tab_url and len(tab_url.split("/app/")[-1]) > 10:
            p(f"  [warn] Tab {tab_index} landed on existing conversation — may not be isolated. Waiting 2s extra...")
            time.sleep(2)
    except Exception:
        pass

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
    # Use the same ws_url we sent to — don't re-fetch (would grab wrong Gemini tab)
    while time.time() < deadline:
        time.sleep(5)
        try:
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

    # ── Archive raw file (move out of pending, never goes to app/public or git) ──
    raw_archive_path = os.path.join(RAW_ARCHIVE, os.path.basename(raw_path))
    if os.path.exists(raw_path):
        shutil.move(raw_path, raw_archive_path)
        p(f"RAW archived: stickers/raw-archive/{os.path.basename(raw_path)}")

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
