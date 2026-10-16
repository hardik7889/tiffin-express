"""Replace the dark / blurry / mis-framed dish photos.

Each replacement is picked from a wider candidate pool and filtered on:
  * no meat words (pure-veg menu)
  * title matches a dish keyword
  * the downloaded image passes a brightness + sharpness gate, so a dark or
    blurry photo is rejected at fetch time rather than shipped.
"""
import json, os, re, time, urllib.parse, urllib.request
from PIL import Image, ImageStat, ImageFilter
import io

API = "https://commons.wikimedia.org/w/api.php"
UA = "TiffinSiteBuilder/1.0 (educational food menu demo)"
OUT = "photos"

MEAT = re.compile(r"chicken|mutton|beef|pork|fish|prawn|shrimp|goat|keema|kheema|"
                  r"non[- ]?veg|egg|kebab|tandoori chick", re.I)

# dish -> (terms, title regex, what it should look like)
FIX = {
    "b3": (["Idli sambar", "Idli vada sambar", "Idli"], r"idli", "idli"),
    "b5": (["Paneer bhurji", "Paneer scramble", "Paneer bhurji masala"], r"paneer|bhurji", "paneer"),
    "d1": (["Aloo matar", "Aloo matar curry", "Matar aloo"], r"aloo|matar", "curry"),
    "l3": (["Kadhi chawal", "Punjabi kadhi", "Kadhi pakora", "Kadhi"], r"kadhi|kadi", "kadhi"),
    "l7": (["Vegetarian thali", "Indian thali", "North Indian thali"], r"thali", "thali"),
    "b1": (["Aloo paratha", "Paratha with curd"], r"paratha", "paratha"),
    "d2": (["Chana masala", "Chole masala", "Chana curry"], r"chana|chole", "curry"),
    "d6": (["Dal fry", "Dal tadka", "Tadka daal"], r"dal|daal", "dal"),
}


def api(params, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                         headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1:
                return {}
            time.sleep(1.5 * (i + 1))
    return {}


def collect(d):
    out = []
    for p in ((d.get("query") or {}).get("pages") or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii.get("url"):
            continue
        if ii.get("mime", "").split("/")[-1] not in ("jpeg", "png", "webp"):
            continue
        out.append({"title": p.get("title", "").replace("File:", ""),
                    "w": ii.get("width") or 0, "h": ii.get("height") or 0,
                    "thumb": ii.get("thumburl") or ii.get("url")})
    return out


def search(term, limit=16):
    return collect(api({"action": "query", "format": "json", "generator": "search",
                        "gsrsearch": f"filetype:bitmap {term}", "gsrnamespace": "6",
                        "gsrlimit": str(limit), "prop": "imageinfo",
                        "iiprop": "url|size|mime", "iiurlwidth": "1000"}))


def fetch(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 5000:
                return None
            return Image.open(io.BytesIO(data)).convert("RGB")
        except Exception:
            if i == 3:
                return None
            time.sleep(1.4 * (i + 1))
    return None


def quality(im):
    """(mean brightness 0-255, sharpness). Both must clear a floor."""
    g = im.convert("L")
    bright = ImageStat.Stat(g).mean[0]
    sharp = ImageStat.Stat(g.filter(ImageFilter.FIND_EDGES)).stddev[0]
    return bright, sharp


def score(c):
    if not c["w"] or not c["h"]:
        return -1
    ar = c["w"] / c["h"]
    ar_pen = 1.0 if (ar < 0.65 or ar > 2.0) else abs(ar - 1.1) / 1.1
    return (c["w"] * c["h"]) ** .5 * (1 - ar_pen * .7)


manifest = json.load(open("manifest.json"))
changed = []

for did, (terms, must, kind) in FIX.items():
    rx = re.compile(must, re.I)
    pool = []
    for t in terms:
        pool = [c for c in search(t)
                if rx.search(c["title"]) and not MEAT.search(c["title"])]
        if len(pool) >= 3:
            break
        time.sleep(.5)
    if not pool:
        print(f"{did}: no candidates")
        continue
    pool.sort(key=score, reverse=True)

    picked = None
    for c in pool[:8]:
        im = fetch(c["thumb"])
        if im is None:
            continue
        b, s = quality(im)
        # reject dark and blurry at fetch time
        if b < 78 or s < 16:
            print(f"   {did} skip {b:.0f}/{s:.1f} {c['title'][:44]}")
            continue
        picked = (c, im, b, s)
        break

    if not picked:
        print(f"{did}: all candidates dark/blurry")
        continue

    c, im, b, s = picked
    im.save(os.path.join(OUT, did + ".jpg"), "JPEG", quality=92)
    manifest[did] = {"title": c["title"], "w": c["w"], "h": c["h"],
                     "src": "https://commons.wikimedia.org/wiki/File:" +
                            urllib.parse.quote(c["title"].replace(" ", "_"))}
    changed.append(did)
    print(f"{did}: OK bright={b:.0f} sharp={s:.1f}  {c['title'][:52]}")

json.dump(manifest, open("manifest.json", "w"), indent=1)
print(f"\nreplaced {len(changed)}: {changed}")
