"""Turn the raw dish photos into uniform 3D-looking card art.

Each output is a 640x440 WebP:
  * centre-cropped to 16:11 and downscaled
  * soft vignette + top light falloff so the dish reads as a rounded object
  * a subtle drop shadow under the dish mass
  * slight saturation/contrast lift so it pops on the dark holo cards
Also emits a tiny LQIP (blurred 20px base64) per dish for instant paint.
"""
import base64, io, json, os
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageStat

SRC, DST = "photos", "out"
W, H = 640, 440
os.makedirs(DST, exist_ok=True)

manifest = json.load(open("manifest.json"))
lqip = {}


def crop_to(im, tw, th):
    ar_t = tw / th
    w, h = im.size
    if w / h > ar_t:
        nw = int(h * ar_t)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / ar_t)
        # bias the crop upward a little — dishes sit high in most photos
        top = int((h - nh) * 0.38)
        im = im.crop((0, top, w, top + nh))
    return im.resize((tw, th), Image.LANCZOS)


def edge_falloff(size, inner=0.78, strength=0.42):
    """Mostly-white mask with a soft darkened rim — subtle, not a black hole."""
    w, h = size
    m = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(m)
    cx, cy = w / 2, h / 2
    steps = 40
    for i in range(steps):
        f = 1 - i / steps                      # 1 at the outer edge -> 0 at centre
        rx = (w / 2) * f
        ry = (h / 2) * f
        val = int(255 * (1 - strength * (f ** 2.4)))
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=val)
    return m.filter(ImageFilter.GaussianBlur(max(w, h) * 0.06))


def auto_level(im, target=138):
    """Nudge mean luminance toward `target` so every card is equally legible."""
    mean = ImageStat.Stat(im.convert("L")).mean[0]
    if mean <= 1:
        return im
    factor = max(0.85, min(2.1, target / mean))
    return ImageEnhance.Brightness(im).enhance(factor)


for did in sorted(manifest):
    p = os.path.join(SRC, did + ".jpg")
    if not os.path.exists(p):
        print(did, "missing source")
        continue
    im = Image.open(p).convert("RGB")
    im = crop_to(im, W, H)

    # legibility first: level the exposure, then punch the colour
    im = auto_level(im, 138)
    im = ImageEnhance.Color(im).enhance(1.16)
    im = ImageEnhance.Contrast(im).enhance(1.06)

    # gentle rim falloff so the dish sits in the card rather than floating
    im = Image.composite(im, Image.new("RGB", (W, H), (16, 22, 44)),
                         edge_falloff((W, H)))

    # faint warm top light
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W * 0.08, -H * 0.62, W * 0.92, H * 0.40], fill=(26, 34, 56))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    im = Image.blend(im, Image.blend(im, glow, 0.5), 0.30)

    # very light contact shadow
    sh = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(sh)
    sd.ellipse([W * 0.18, H * 0.88, W * 0.82, H * 1.10], fill=90)
    sh = sh.filter(ImageFilter.GaussianBlur(40))
    im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, sh)

    out = os.path.join(DST, did + ".webp")
    im.save(out, "WEBP", quality=84, method=6)

    # LQIP for instant first paint
    t = im.resize((20, 14), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    b = io.BytesIO()
    t.save(b, "WEBP", quality=45)
    lqip[did] = "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()

    print(f"{did}: {os.path.getsize(out)//1024} KB")

json.dump(lqip, open("lqip.json", "w"))
tot = sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST))
print(f"\n{len(os.listdir(DST))} images, {tot//1024} KB total")
