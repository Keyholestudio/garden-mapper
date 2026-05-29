"""
Garden Mapper Sticker Generator — Google Gemini (gemini.google.com)
Attaches to existing Brave Debug session, uses the open Gemini tab.
Generates all 11 plants by typing prompts and downloading the images.
Usage: python generate_gemini_chat.py
"""

import asyncio, os, time, shutil, glob
from pathlib import Path
from dotenv import load_dotenv
from browser_use import Agent, Browser, BrowserProfile
from browser_use.llm import ChatAnthropic

load_dotenv(Path(r"C:\Users\RG\.openclaw\workspace\projects\parabolic-stocks\observer\.env"))

OUT_DIR = r"C:\Users\RG\.openclaw\workspace\projects\garden-planner\stickers\gemini-chat"
os.makedirs(OUT_DIR, exist_ok=True)

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    temperature=0.0,
    api_key=os.environ["ANTHROPIC_API_KEY"]
)

browser = Browser(browser_profile=BrowserProfile(cdp_url="http://127.0.0.1:9222"))

PLANT_PREFIX = "Generate an image: Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."

TREE_PREFIX = "Generate an image: Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting, simplified representation of this plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2-3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic."

PLANTS = [
    {"id": "herb-small_thyme", "type": "plant",
     "subject": "Common Thyme herb, small woody herb.",
     "colours": "sage green, dark olive, pale lavender, warm brown stems.",
     "shape": "Tiny dense mat of small oval grey-green leaves, scattered with pale lavender-pink flower clusters, stems at bottom and leafy florals at the top."},
    {"id": "flower-daisy_marigold", "type": "plant",
     "subject": "French Marigold flower, compact annual.",
     "colours": "bright orange, golden yellow, dark brown centre, mid-green, deep green stems.",
     "shape": "Bold layered bloom of orange-yellow petals around a dark warm centre disk, stems at bottom and leafy florals at the top."},
    {"id": "shrub-lavender_lavender", "type": "plant",
     "subject": "English Lavender shrub, perennial herb.",
     "colours": "purple, silver-grey foliage, pale lavender, dark outline, warm grey stems.",
     "shape": "Upright silver-grey stems topped with dense purple flower spikes, stems at bottom and leafy florals at the top."},
    {"id": "flower-spike_foxglove", "type": "plant",
     "subject": "Foxglove in full bloom, tall biennial.",
     "colours": "deep magenta, cream, forest green, dark outline, mid-green stems.",
     "shape": "Tall central spike of stacked magenta bell-shaped blooms with cream-spotted interiors, broad lance-shaped green leaves, stems at bottom and leafy florals at the top."},
    {"id": "tree-fruit_apple", "type": "tree",
     "subject": "Apple tree in fruit, round deciduous tree, aerial top-down, no trunk.",
     "colours": "mid-green, deep green, bright red apples, warm brown limbs, pale yellow-green accents.",
     "shape": "Spacious leafy canopy, sweeping central limbs. Minimal fruit, only as accent."},
    {"id": "shrub-flowering_saskatoon", "type": "plant",
     "subject": "Saskatoon Berry bush, fruiting deciduous shrub.",
     "colours": "deep purple-blue berries, mid-green leaves, grey-green foliage, warm brown stems, pale white blossom.",
     "shape": "Rounded shrub with clusters of deep purple-blue berries nestled among oval green leaves, stems at bottom and leafy florals at the top."},
    {"id": "shrub-flowering_blueberry", "type": "plant",
     "subject": "Blueberry bush, compact fruiting shrub.",
     "colours": "bright blue berries, dusty blue-grey, mid-green leaves, deep green, warm brown stems.",
     "shape": "Low compact shrub covered in round bright blue berry clusters among small oval leaves, stems at bottom and leafy florals at the top."},
    {"id": "vegetable-root_carrot", "type": "plant",
     "subject": "Carrot, root vegetable.",
     "colours": "bright orange, deep orange, bright green tops, mid-green, pale green stem.",
     "shape": "Carrots and tops peeking from a plant wide soil line. Only show the top of the root above the minimal soil line. Bold orange carrot shoulders above soil, feathery bright green ferny foliage, root at bottom and leafy florals at the top."},
    {"id": "tree-conifer_pine", "type": "tree",
     "subject": "Pine tree, tall evergreen conifer, aerial top-down, no trunk.",
     "colours": "deep forest green, mid-green, blue-green, dark outline, pale silver-green.",
     "shape": "Spacious star-shaped needle canopy, sweeping central limbs radiating outward in layered spoke pattern."},
    {"id": "flower-cluster_phlox", "type": "plant",
     "subject": "Phlox, low spreading perennial flower.",
     "colours": "hot pink, pale pink, bright white, mid-green, deep green stems.",
     "shape": "Dense flat mat of small five-petalled pink and white flowers packed tightly together, stems at bottom and leafy florals at the top."},
    {"id": "ground-cover_hostas", "type": "plant",
     "subject": "Hostas, shade perennial with large leaves.",
     "colours": "blue-green, pale green-white variegation, deep green, olive green, warm brown stems.",
     "shape": "Bold overlapping large heart-shaped ribbed leaves fanning outward, variegated pale centres with deep green edges, stems at bottom and leafy florals at the top."},
]


def build_prompt(plant):
    prefix = TREE_PREFIX if plant["type"] == "tree" else PLANT_PREFIX
    return f"{prefix} Subject: {plant['subject']} Colours: {plant['colours']} Shape: {plant['shape']}"


async def generate_plant(plant):
    out_path = os.path.join(OUT_DIR, f"{plant['id']}.png")
    if os.path.exists(out_path):
        print(f"  SKIP (exists): {plant['id']}")
        return True

    prompt = build_prompt(plant)

    task = f"""
You are on the Google Gemini chat page at https://gemini.google.com.

Do these steps:
1. Click the message input box (it says "Ask Gemini" or similar)
2. Type this exact prompt: {prompt}
3. Press Enter to send it
4. Wait up to 60 seconds for Gemini to generate an image in its response
5. Once you see the generated image in the response, right-click on it
6. Choose "Save image as..." or look for a download button near the image
7. If you see a download icon or button on the image, click it to download
8. Wait 3 seconds for download to complete
9. Report: DONE: {plant['id']}

Important: You are looking for an IMAGE generated by Gemini, not text. Wait for the image to appear.
If Gemini says it cannot generate images, report: FAILED: cannot generate images.
"""

    fresh_browser = Browser(browser_profile=BrowserProfile(cdp_url="http://127.0.0.1:9222"))
    agent = Agent(task=task, llm=llm, browser=fresh_browser)
    result = await agent.run(max_steps=25)

    # Check for downloaded file in browser-use temp dirs
    tmp_dirs = glob.glob(os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Temp', 'browser-use-downloads-*'))
    all_imgs = []
    for d in tmp_dirs:
        all_imgs.extend(glob.glob(os.path.join(d, '*.png')))
        all_imgs.extend(glob.glob(os.path.join(d, '*.jpg')))
        all_imgs.extend(glob.glob(os.path.join(d, '*.webp')))

    if all_imgs:
        latest = max(all_imgs, key=os.path.getmtime)
        if time.time() - os.path.getmtime(latest) < 120:
            dest = os.path.join(OUT_DIR, f"{plant['id']}.png")
            shutil.copy2(latest, dest)
            print(f"  OK: {plant['id']} -> {dest}")
            return True

    print(f"  WARN: {plant['id']} - no download detected, check result")
    return False


async def main():
    print(f"Output dir: {OUT_DIR}")
    print(f"Using: Google Gemini (gemini.google.com)")
    print(f"Plants: {len(PLANTS)}\n")

    ok = 0
    for i, plant in enumerate(PLANTS):
        print(f"[{i+1}/{len(PLANTS)}] {plant['id']}")
        success = await generate_plant(plant)
        if success:
            ok += 1
        await asyncio.sleep(3)

    print(f"\nDone: {ok}/{len(PLANTS)} generated -> {OUT_DIR}")


asyncio.run(main())
