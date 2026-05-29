"""
Garden Mapper Sticker Generator
Generates all 11 example plants across multiple Gemini image models.
Usage: python generate_stickers.py <API_KEY>
"""

import sys
import os
import base64
import time
import json
import google.generativeai as genai

API_KEY = sys.argv[1]
genai.configure(api_key=API_KEY)

OUTPUT_BASE = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers"

# Models to test — displayName: model_id
MODELS = {
    "nano-banana":     "models/gemini-2.5-flash-image",       # Nano Banana (original)
    "nano-banana-pro": "models/gemini-3-pro-image-preview",   # Nano Banana Pro
    "nano-banana-2":   "models/gemini-3.1-flash-image-preview", # Nano Banana 2
    "imagen4-fast":    "models/imagen-4.0-fast-generate-001", # Imagen 4 Fast
}

PLANT_PREFIX = "Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."

TREE_PREFIX = "Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."

ROOT_VEG_PREFIX = "Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."

# 11 example plants with their prompts
PLANTS = [
    {
        "id": "herb-small_thyme",
        "type": "plant",
        "size": 96,
        "subject": "Common Thyme herb, small woody herb.",
        "colours": "sage green #7B9E4E, dark olive #3D5A1A, pale lavender #C8A8D8, warm brown stems #7A5C3A.",
        "shape": "Tiny dense mat of small oval grey-green leaves, scattered with pale lavender-pink flower clusters, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "flower-daisy_marigold",
        "type": "plant",
        "size": 160,
        "subject": "French Marigold flower, compact annual.",
        "colours": "bright orange #FF8C00, golden yellow #FFD700, dark brown centre #8B3A00, mid-green #4A7C2F, deep green stems #2A5010.",
        "shape": "Bold layered bloom of orange-yellow petals around a dark warm centre disk, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "shrub-lavender_lavender",
        "type": "plant",
        "size": 256,
        "subject": "English Lavender shrub, perennial herb.",
        "colours": "purple #7B5EA7, silver-grey foliage #8FAF82, pale lavender #C4A8E0, dark outline #2D1A4A, warm grey stems #A09070.",
        "shape": "Upright silver-grey stems topped with dense purple flower spikes, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "flower-spike_foxglove",
        "type": "plant",
        "size": 384,
        "subject": "Foxglove in full bloom, tall biennial.",
        "colours": "deep magenta #D63F6C, cream #FFF5E0, forest green #2D6A2A, dark outline #1A2E1A, mid-green stems #4A7A3A.",
        "shape": "Tall central spike of stacked magenta bell-shaped blooms with cream-spotted interiors, broad lance-shaped green leaves, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "tree-fruit_apple",
        "type": "tree",
        "size": 512,
        "subject": "Apple tree in fruit, round deciduous tree, aerial top-down, no trunk.",
        "colours": "mid-green #4E8C3A, deep green #2A5C1A, bright red apples #D42B2B, warm brown limbs #6B3A2A, pale yellow-green accents #B8D474.",
        "shape": "Spacious leafy canopy, sweeping central limbs. Minimal fruit, only as accent.",
    },
    {
        "id": "shrub-flowering_saskatoon",
        "type": "plant",
        "size": 256,
        "subject": "Saskatoon Berry bush, fruiting deciduous shrub.",
        "colours": "deep purple-blue berries #4A2080, mid-green leaves #4A7C2F, grey-green foliage #8FAF82, warm brown stems #6B3A2A, pale white blossom #F5F0E8.",
        "shape": "Rounded shrub with clusters of deep purple-blue berries nestled among oval green leaves, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "shrub-flowering_blueberry",
        "type": "plant",
        "size": 256,
        "subject": "Blueberry bush, compact fruiting shrub.",
        "colours": "bright blue berries #5B8DD9, dusty blue-grey #8BAAC8, mid-green leaves #4A7C2F, deep green #2A5010, warm brown stems #6B3A2A.",
        "shape": "Low compact shrub covered in round bright blue berry clusters among small oval leaves, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "vegetable-root_carrot",
        "type": "root_veg",
        "size": 96,
        "subject": "Carrot, root vegetable.",
        "colours": "bright orange #FF6B1A, deep orange #CC4A00, bright green tops #4AAF2F, mid-green #2A7010, pale green stem #8FBF6A.",
        "shape": "Carrots and tops peeking from a plant wide soil line. Only show the top of the root/plant above the minimal soil line. Bold orange carrot shoulders visible above the soil, feathery bright green ferny foliage, root at bottom and leafy florals at the top.",
    },
    {
        "id": "tree-conifer_pine",
        "type": "tree",
        "size": 512,
        "subject": "Pine tree, tall evergreen conifer, aerial top-down, no trunk.",
        "colours": "deep forest green #1A5C2A, mid-green #2E7A3A, blue-green #4A8C6A, dark outline #0A2A10, pale silver-green #8AAF8A.",
        "shape": "Spacious star-shaped needle canopy, sweeping central limbs radiating outward in layered spoke pattern.",
    },
    {
        "id": "flower-cluster_phlox",
        "type": "plant",
        "size": 160,
        "subject": "Phlox, low spreading perennial flower.",
        "colours": "hot pink #E8407A, pale pink #F5AACB, bright white #FFFFFF, mid-green #4A7C2F, deep green stems #2A5010.",
        "shape": "Dense flat mat of small five-petalled pink and white flowers packed tightly together, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "ground-cover_hostas",
        "type": "plant",
        "size": 256,
        "subject": "Hostas, shade perennial with large leaves.",
        "colours": "blue-green #5A8A6A, pale green-white variegation #D4E8C8, deep green #2A5A3A, olive green #6B7A3A, warm brown stems #7A5C3A.",
        "shape": "Bold overlapping large heart-shaped ribbed leaves fanning outward, variegated pale centres with deep green edges, stems at bottom and leafy florals at the top.",
    },
]


def build_prompt(plant):
    if plant["type"] == "tree":
        prefix = TREE_PREFIX
    elif plant["type"] == "root_veg":
        prefix = ROOT_VEG_PREFIX
    else:
        prefix = PLANT_PREFIX

    if plant["type"] == "tree":
        return f"""{prefix}

Subject: {plant['subject']}
Canvas: {plant['size']}px square.
Colours: {plant['colours']}
Shape: {plant['shape']}"""
    else:
        return f"""{prefix}

Subject: {plant['subject']}
Canvas: {plant['size']}px square.
Colours: {plant['colours']}
Shape: {plant['shape']}"""


def generate_gemini(model_id, folder_name, plant):
    out_dir = os.path.join(OUTPUT_BASE, folder_name)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{plant['id']}.png")

    if os.path.exists(out_path):
        print(f"  SKIP (exists): {plant['id']}")
        return True

    prompt = build_prompt(plant)
    try:
        model = genai.GenerativeModel(model_id)
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(response_modalities=["image", "text"])
        )
        for part in response.candidates[0].content.parts:
            if hasattr(part, "inline_data") and part.inline_data:
                data = part.inline_data.data
                img_bytes = base64.b64decode(data) if isinstance(data, str) else data
                with open(out_path, "wb") as f:
                    f.write(img_bytes)
                print(f"  OK: {plant['id']} ({len(img_bytes):,} bytes)")
                return True
        print(f"  NO IMAGE in response for {plant['id']}")
        return False
    except Exception as e:
        print(f"  ERROR {plant['id']}: {e}")
        return False


def generate_imagen4(model_id, folder_name, plant):
    """Imagen 4 uses the predict endpoint via REST (different API pattern)."""
    import urllib.request
    import json as _json

    out_dir = os.path.join(OUTPUT_BASE, folder_name)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{plant['id']}.png")

    if os.path.exists(out_path):
        print(f"  SKIP (exists): {plant['id']}")
        return True

    prompt = build_prompt(plant)
    url = f"https://generativelanguage.googleapis.com/v1beta/{model_id}:predict?key={API_KEY}"
    payload = _json.dumps({
        "instances": [{"prompt": prompt}],
        "parameters": {"sampleCount": 1}
    }).encode()

    try:
        req = urllib.request.Request(url, data=payload,
                                     headers={"Content-Type": "application/json"},
                                     method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = _json.loads(resp.read())

        predictions = result.get("predictions", [])
        if predictions and "bytesBase64Encoded" in predictions[0]:
            img_bytes = base64.b64decode(predictions[0]["bytesBase64Encoded"])
            with open(out_path, "wb") as f:
                f.write(img_bytes)
            print(f"  OK: {plant['id']} ({len(img_bytes):,} bytes)")
            return True
        else:
            print(f"  NO IMAGE in response: {result}")
            return False
    except Exception as e:
        print(f"  ERROR {plant['id']}: {e}")
        return False


results = {}

for model_label, model_id in MODELS.items():
    print(f"\n{'='*60}")
    print(f"MODEL: {model_label} ({model_id})")
    print(f"{'='*60}")
    results[model_label] = {"ok": 0, "fail": 0}

    for plant in PLANTS:
        print(f"  Generating: {plant['id']}...")
        if "imagen" in model_id:
            ok = generate_imagen4(model_id, model_label, plant)
        else:
            ok = generate_gemini(model_id, model_label, plant)

        if ok:
            results[model_label]["ok"] += 1
        else:
            results[model_label]["fail"] += 1

        time.sleep(2)  # rate limit breathing room

print(f"\n{'='*60}")
print("SUMMARY")
print(f"{'='*60}")
for model_label, counts in results.items():
    print(f"  {model_label}: {counts['ok']} ok, {counts['fail']} failed")

# Save results log
log_path = os.path.join(OUTPUT_BASE, "generation_log.json")
with open(log_path, "w") as f:
    json.dump(results, f, indent=2)
print(f"\nLog saved: {log_path}")
