# Skill: Gemini Image Generation via CDP

How to generate sticker images through the open Gemini tab in Brave Debug.
No API key, no billing — uses the logged-in Gemini subscription in Brave.

---

## How It Works

1. Brave runs with `--remote-debugging-port=9222`
2. A Gemini tab is already open and logged in (contactsunsetpoetvintage@gmail.com)
3. We connect via WebSocket CDP, type the prompt, click Send, wait for the blob image to appear, then canvas-capture it

---

## Key Technical Rules

### Sending a Prompt
```python
# 1. Find contenteditable input and clear it
js_clear = """
(function(){
    var box = document.querySelector('[contenteditable="true"]');
    if (!box) return 'NO_BOX';
    box.focus();
    box.innerHTML = '';
    return 'CLEARED';
})()
"""

# 2. Type via CDP insertText (NOT execCommand — it's deprecated)
ws.send(json.dumps({"id": 1, "method": "Input.insertText",
                    "params": {"text": prompt}}))

# 3. Click the Send button via JS (Enter key does NOT submit in Gemini)
js_send = """
(function(){
    var btn = document.querySelector('button[aria-label="Send message"]');
    if (btn) { btn.click(); return 'CLICKED'; }
    return 'NOT_FOUND';
})()
"""
```

### Detecting When Image Is Ready
Gemini generates images as `blob:` URLs and **replaces** them in place (does NOT add new blobs).
Track the **src URL change**, not the count:

```python
def get_blob_src(ws_url):
    js = 'var imgs=Array.from(document.querySelectorAll("img")).filter(i=>i.src.startsWith("blob:")); imgs.length ? imgs[imgs.length-1].src : ""'
    return cdp_eval(ws_url, js) or ""

src_before = get_blob_src(ws_url)
# ... send prompt ...
# Poll until src changes
while time.time() < deadline:
    time.sleep(4)
    src_now = get_blob_src(ws_url)
    if src_now and src_now != src_before:
        break  # new image ready
```

### Saving the Image (Canvas Grab)
Gemini images are cross-origin blobs — can't fetch() them. Use canvas:

```python
js_grab = """
(function(){
    var imgs = Array.from(document.querySelectorAll('img')).filter(i=>i.src.startsWith('blob:'));
    var img = imgs[imgs.length - 1];  // LAST blob = most recent
    if (!img || img.naturalWidth < 100) return 'NONE';
    var c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
})()
"""
data_url = cdp_eval(ws_url, js_grab)
b64 = data_url.split(",", 1)[1]
img_bytes = base64.b64decode(b64)
with open(out_path, "wb") as f:
    f.write(img_bytes)
```

---

## Critical Gotchas

| Gotcha | Fix |
|---|---|
| Enter key doesn't submit | Click `button[aria-label="Send message"]` via JS |
| Blob count doesn't increase | Track src URL change, not count — Gemini replaces in place |
| Multiple images in one response | Send ONE plant per prompt. Never batch multiple plants in one message. |
| execCommand deprecated | Use `Input.insertText` CDP method instead |
| Tab URL changes per conversation | Always re-fetch tab list to get current `webSocketDebuggerUrl` |
| Canvas tainted (CORS) | Works fine for blob: URLs from same origin — no issue |

---

## One Prompt = One Plant

**Always send one plant per prompt.** Gemini will combine multiple subjects into a single illustration if the prompt contains more than one plant. This was the bug discovered on 2026-05-27.

Bad: `"Subject: Thyme. Also generate: Marigold. Also generate: Lavender."`
Good: Send three separate prompts, one per plant, each waiting for the image before moving on.

---

## Working Script

Main script: `projects/garden-planner/stickers/generate_gemini_hybrid.py`
- Reads PLANTS list
- Skips already-saved files
- Tracks blob src before/after
- Saves via canvas to `stickers/gemini-chat/`

One-shot grab utility: `projects/garden-planner/stickers/grab_gemini_image.py`
- Usage: `python grab_gemini_image.py <plant_id>`
- Grabs whatever is currently displayed in the Gemini tab

---

## Prompt Template (from STICKER-PROMPT-GUIDE.md)

### Plants
```
Slight angled top-down aerial view. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: [PLANT NAME], [TYPE OF PLANT].
Canvas: [SIZE]px square.
Colours: [4-5 colours or hex codes].
Shape: [Primary characteristics], stems at bottom and leafy florals at the top.
```

### Trees
```
Top-down aerial view, looking straight down. Art style: Plants vs. Zombies meets watercolor painting — simplified representation of this plant, focusing on a primary characteristics of the plant, leafy with central limbs, no trunk, bold flat icon. Dark outline 2–3px. Line texturing. No shadows. Transparent background. Centered, 75% canvas fill. Vibrant and iconic.

Subject: [PLANT NAME], [BASIC DESCRIPTION], aerial top-down, no trunk.
Canvas: 512px square.
Colours: [4-5 colours or hex codes]
Shape: [Primary characteristics], Spacious leafy canopy, sweeping central limbs.
```

---

## Token-Efficient Automation

To run overnight without burning session tokens, use an **isolated cron job**:
- Script runs headlessly via Python, not through the AI session
- AI is only needed if the script breaks or needs debugging
- Normal run: zero AI tokens (pure CDP + Python)

See cron job: `garden-sticker-gen` (scheduled overnight, generates remaining plants from PLANT-DATABASE.md)
