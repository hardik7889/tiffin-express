"""Process package hero photos into wide 3D banner art.

Package cards are banner-shaped, so these are 960x520 (instead of the
640x440 dish cards). Same legibility-first pipeline: level exposure,
punch colour, soft rim falloff, warm top light, contact shadow, and a
left-to-right dark gradient so white text can sit over the right side.
Also emits a blurred LQIP per package.
"""
import base64, io, json, os
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw, ImageStat

SRC, DST = "photos_pkg", "out_pkg"
W, H = 960, 520
os.makedirs(DST, exist_ok=True)

manifest = json.load(open("manifest_pkg.json"))
lqip = {}


def crop_to(im, tw, th):
    ar_t = tw / th
    w, h = im.size
    if w / h > ar_t:
        nw = int(h * ar_t)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / ar_t)
        top = int((h - nh) * 0.36)
        im = im.crop((0, top, w, top + nh))
    return im.resize((tw, th), Image.LANCZOS)


def edge_falloff(size, strength=0.40):
    w, h = size
    m = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(m)
    cx, cy = w / 2, h / 2
    steps = 40
    for i in range(steps):
        f = 1 - i / steps
        rx, ry = (w / 2) * f, (h / 2) * f
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry],
                  fill=int(255 * (1 - strength * (f ** 2.4))))
    return m.filter(ImageFilter.GaussianBlur(max(w, h) * 0.06))


def auto_level(im, target=136):
    mean = ImageStat.Stat(im.convert("L")).mean[0]
    if mean <= 1:
        return im
    return ImageEnhance.Brightness(im).enhance(max(0.85, min(2.1, target / mean)))


for pk in sorted(manifest):
    p = os.path.join(SRC, pk + ".jpg")
    if not os.path.exists(p):
        print(pk, "missing source")
        continue

    im = crop_to(Image.open(p).convert("RGB"), W, H)

    im = auto_level(im, 136)
    im = ImageEnhance.Color(im).enhance(1.16)
    im = ImageEnhance.Contrast(im).enhance(1.06)

    im = Image.composite(im, Image.new("RGB", (W, H), (16, 22, 44)),
                         edge_falloff((W, H)))

    # warm top light
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        [W * 0.05, -H * 0.70, W * 0.95, H * 0.36], fill=(26, 34, 56))
    glow = glow.filter(ImageFilter.GaussianBlur(95))
    im = Image.blend(im, Image.blend(im, glow, 0.5), 0.28)

    # contact shadow
    sh = Image.new("L", (W, H), 0)
    ImageDraw.Draw(sh).ellipse([W * 0.16, H * 0.86, W * 0.84, H * 1.10], fill=95)
    sh = sh.filter(ImageFilter.GaussianBlur(46))
    im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, sh)

    # left->right darkening so overlaid text stays readable on the right
    grad = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(grad)
    for x in range(W):
        gd.line([(x, 0), (x, H)], fill=int(210 * (x / W) ** 1.7))
    im = Image.composite(Image.new("RGB", (W, H), (4, 6, 18)), im, grad)

    out = os.path.join(DST, pk + ".webp")
    im.save(out, "WEBP", quality=84, method=6)

    t = im.resize((24, 13), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    b = io.BytesIO()
    t.save(b, "WEBP", quality=45)
    lqip[pk] = "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()

    lum = ImageStat.Stat(im.convert("L")).mean[0]
    print(f"{pk}: {os.path.getsize(out)//1024:>3} KB  lum={lum:5.1f}")

json.dump(lqip, open("lqip_pkg.json", "w"))
tot = sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST))
print(f"\n{len(os.listdir(DST))} images, {tot//1024} KB total")
