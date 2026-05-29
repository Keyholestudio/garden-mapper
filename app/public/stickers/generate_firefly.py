"""
Garden Mapper Sticker Generator — Adobe Firefly via browser-use
Attaches to existing Brave Debug session, generates all 11 plants,
downloads each one to the stickers/nano-banana-2/ folder.

Usage: python generate_firefly.py
"""

import asyncio, os, time, shutil, glob
from pathlib import Path
from dotenv import load_dotenv
from browser_use import Agent, Browser, BrowserProfile
from browser_use.llm import ChatAnthropic

load_dotenv(Path(r"C:\Users\RG\.openclaw\workspace\projects\parabolic-stocks\observer\.env"))

OUT_DIR = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers\nano-banana-2"
os.makedirs(OUT_DIR, exist_ok=True)

BRAVE_DOWNLOAD_DIR = os.path.expanduser(r"~\Downloads")

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    temperature=0.0,
    api_key=os.environ["ANTHROPIC_API_KEY"]
)

# Attach to existing Brave Debug session
browser = Browser(browser_profile=BrowserProfile(cdp_url="http://127.0.0.1:9222"))

PLANT_PREFIX = "Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."

TREE_PREFIX = "Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."

PLANTS = [
    {
        "id": "herb-small_thyme",
        "type": "plant",
        "subject": "Common Thyme herb, small woody herb.",
        "colours": "sage green, dark olive, pale lavender, warm brown stems.",
        "shape": "Tiny dense mat of small oval grey-green leaves, scattered with pale lavender-pink flower clusters, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "flower-daisy_marigold",
        "type": "plant",
        "subject": "French Marigold flower, compact annual.",
        "colours": "bright orange, golden yellow, dark brown centre, mid-green, deep green stems.",
        "shape": "Bold layered bloom of orange-yellow petals around a dark warm centre disk, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "shrub-lavender_lavender",
        "type": "plant",
        "subject": "English Lavender shrub, perennial herb.",
        "colours": "purple, silver-grey foliage, pale lavender, dark outline, warm grey stems.",
        "shape": "Upright silver-grey stems topped with dense purple flower spikes, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "flower-spike_foxglove",
        "type": "plant",
        "subject": "Foxglove in full bloom, tall biennial.",
        "colours": "deep magenta, cream, forest green, dark outline, mid-green stems.",
        "shape": "Tall central spike of stacked magenta bell-shaped blooms with cream-spotted interiors, broad lance-shaped green leaves, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "tree-fruit_apple",
        "type": "tree",
        "subject": "Apple tree in fruit, round deciduous tree, aerial top-down, no trunk.",
        "colours": "mid-green, deep green, bright red apples, warm brown limbs, pale yellow-green accents.",
        "shape": "Spacious leafy canopy, sweeping central limbs. Minimal fruit, only as accent.",
    },
    {
        "id": "shrub-flowering_saskatoon",
        "type": "plant",
        "subject": "Saskatoon Berry bush, fruiting deciduous shrub.",
        "colours": "deep purple-blue berries, mid-green leaves, grey-green foliage, warm brown stems, pale white blossom.",
        "shape": "Rounded shrub with clusters of deep purple-blue berries nestled among oval green leaves, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "shrub-flowering_blueberry",
        "type": "plant",
        "subject": "Blueberry bush, compact fruiting shrub.",
        "colours": "bright blue berries, dusty blue-grey, mid-green leaves, deep green, warm brown stems.",
        "shape": "Low compact shrub covered in round bright blue berry clusters among small oval leaves, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "vegetable-root_carrot",
        "type": "root_veg",
        "subject": "Carrot, root vegetable.",
        "colours": "bright orange, deep orange, bright green tops, mid-green, pale green stem.",
        "shape": "Carrots and tops peeking from a plant wide soil line. Only show the top of the root above the minimal soil line. Bold orange carrot shoulders above soil, feathery bright green ferny foliage, root at bottom and leafy florals at the top.",
    },
    {
        "id": "tree-conifer_pine",
        "type": "tree",
        "subject": "Pine tree, tall evergreen conifer, aerial top-down, no trunk.",
        "colours": "deep forest green, mid-green, blue-green, dark outline, pale silver-green.",
        "shape": "Spacious star-shaped needle canopy, sweeping central limbs radiating outward in layered spoke pattern.",
    },
    {
        "id": "flower-cluster_phlox",
        "type": "plant",
        "subject": "Phlox, low spreading perennial flower.",
        "colours": "hot pink, pale pink, bright white, mid-green, deep green stems.",
        "shape": "Dense flat mat of small five-petalled pink and white flowers packed tightly together, stems at bottom and leafy florals at the top.",
    },
    {
        "id": "ground-cover_hostas",
        "type": "plant",
        "subject": "Hostas, shade perennial with large leaves.",
        "colours": "blue-green, pale green-white variegation, deep green, olive green, warm brown stems.",
        "shape": "Bold overlapping large heart-shaped ribbed leaves fanning outward, variegated pale centres with deep green edges, stems at bottom and leafy florals at the top.",
    },
]


def build_prompt(plant):
    prefix = TREE_PREFIX if plant["type"] == "tree" else PLANT_PREFIX
    return f"{prefix} Subject: {plant['subject']} Colours: {plant['colours']} Shape: {plant['shape']}"


def get_latest_download(before_files):
    """Return the newest file in Downloads that wasn't there before."""
    time.sleep(3)
    current = set(glob.glob(os.path.join(BRAVE_DOWNLOAD_DIR, "*")))
    new_files = current - before_files
    if new_files:
        return max(new_files, key=os.path.getmtime)
    return None


async def generate_plant(plant):
    out_path = os.path.join(OUT_DIR, f"{plant['id']}.png")
    if os.path.exists(out_path):
        print(f"  SKIP (exists): {plant['id']}")
        return True

    prompt = build_prompt(plant)

    task = f"""
You are on the Adobe Firefly Generate Image page at https://firefly.adobe.com/generate/image.
The model should already be set to Gemini 3.1 (w/ Nano Banana 2).

Do these steps exactly:
1. Click the Prompt text box (at the bottom of the page)
2. Select all existing text (Ctrl+A) and delete it
3. Type this prompt exactly: {prompt}
4. Click the Generate button
5. Wait up to 60 seconds for the image to appear (the grey loading area will fill with an image)
6. Once the image is visible, click the Download button (top right of the image area, shows a download icon)
7. If a download options dialog appears, click the first/default download option
8. Wait 3 seconds for the download to complete
9. Report: DONE: <plant_id>

Plant ID for reporting: {plant['id']}
"""

    # Fresh browser connection per plant to avoid CDP stale session
    fresh_browser = Browser(browser_profile=BrowserProfile(cdp_url="http://127.0.0.1:9222"))
    agent = Agent(task=task, llm=llm, browser=fresh_browser)
    result = await agent.run(max_steps=20)

    # browser-use saves downloads to its own temp dir — find the latest PNG
    tmp_dirs = glob.glob(os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Temp', 'browser-use-downloads-*'))
    all_pngs = []
    for d in tmp_dirs:
        all_pngs.extend(glob.glob(os.path.join(d, '*.png')))
    
    if all_pngs:
        latest = max(all_pngs, key=os.path.getmtime)
        # Only use if modified in last 2 minutes
        if time.time() - os.path.getmtime(latest) < 120:
            dest = os.path.join(OUT_DIR, f"{plant['id']}.png")
            shutil.copy2(latest, dest)
            print(f"  OK: {plant['id']} -> {dest}")
            return True

    print(f"  WARN: {plant['id']} - no download detected")
    return False


async def main():
    print(f"Output dir: {OUT_DIR}")
    print(f"Firefly model: Gemini 3.1 (Nano Banana 2)")
    print(f"Plants to generate: {len(PLANTS)}\n")

    ok = 0
    for i, plant in enumerate(PLANTS):
        print(f"[{i+1}/{len(PLANTS)}] {plant['id']}")
        success = await generate_plant(plant)
        if success:
            ok += 1
        await asyncio.sleep(2)

    print(f"\nDone: {ok}/{len(PLANTS)} generated → {OUT_DIR}")


asyncio.run(main())
