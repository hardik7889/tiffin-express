"""Fetch one hero photo per tiffin package from Wikimedia Commons.

Same discipline as the dish photos: no meat (pure-veg menu), title must
match the package's keyword, and the downloaded image has to clear a
brightness/sharpness gate so a dark or blurry shot is rejected at fetch
time. Titles already used by the 21 dish cards are excluded so no two
cards in the site show the same photograph.
"""
import io, json, os, re, time, urllib.parse, urllib.request
from PIL import Image, ImageStat, ImageFilter

API = "https://commons.wikimedia.org/w/api.php"
UA = "TiffinSiteBuilder/1.0 (educational food menu demo)"
OUT = "photos_pkg"
os.makedirs(OUT, exist_ok=True)

MEAT = re.compile(r"chicken|mutton|beef|pork|fish|prawn|shrimp|goat|keema|kheema|"
                  r"non[- ]?veg|egg|kebab|tandoori chick|biryani.*chick", re.I)

# package -> (search terms, title must match this)
PKGS = {
    "pkg_full": (["Indian thali vegetarian", "Vegetarian thali", "Punjabi thali",
                  "North Indian thali"], r"thali"),
    "pkg_ld":   (["South Indian meals", "Indian meal curry rice",
                  "Thali lunch dinner", "Indian food platter"], r"thali|meal|platter"),
    "pkg_bf":   (["Indian breakfast platter", "Indian breakfast",
                  "Dosa breakfast", "Upma breakfast"], r"breakfast|dosa|upma|idli|poha|paratha"),
    "pkg_lunch": (["Lunch thali India", "Indian lunch meal", "Meals ready to eat India",
                   "Veg meals India"], r"thali|meal|lunch"),
    "pkg_dinner": (["Indian dinner curry roti", "North Indian curry",
                    "Roti sabzi dinner", "Indian dinner thali"], r"curry|roti|dinner|thali|sabzi"),
}

PINNED = {
    "pkg_full": "Indian thali.jpg",
}


def api(params, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                         headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            if i == tries - 1:
                print(f"    ! api {e}", flush=True)
                return {}
            time.sleep(2.0 * (i + 1))
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
                        "iiprop": "url|size|mime", "iiurlwidth": "1100"}))


def by_title(t):
    return collect(api({"action": "query", "format": "json", "titles": "File:" + t,
                        "prop": "imageinfo", "iiprop": "url|size|mime",
                        "iiurlwidth": "1100"}))


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
            time.sleep(1.5 * (i + 1))
    return None


def quality(im):
    g = im.convert("L")
    return ImageStat.Stat(g).mean[0], ImageStat.Stat(g.filter(ImageFilter.FIND_EDGES)).stddev[0]


def score(c):
    if not c["w"] or not c["h"]:
        return -1
    ar = c["w"] / c["h"]
    # package heroes are banner-shaped, so prefer landscape
    ar_pen = 0.0 if 1.25 <= ar <= 2.0 else (abs(ar - 1.6) / 1.6)
    return (c["w"] * c["h"]) ** .5 * (1 - ar_pen * .5)


used = set(v["title"] for v in json.load(open("manifest.json")).values())
manifest = json.load(open("manifest_pkg.json")) if os.path.exists("manifest_pkg.json") else {}

for pk, (terms, must) in PKGS.items():
    if pk in manifest and os.path.exists(os.path.join(OUT, pk + ".jpg")):
        print(f"{pk}: cached")
        continue
    rx = re.compile(must, re.I)

    pool = []
    if pk in PINNED:
        pool = [c for c in by_title(PINNED[pk])
                if rx.search(c["title"]) and not MEAT.search(c["title"])
                and c["title"] not in used]
    if not pool:
        for t in terms:
            got = [c for c in search(t)
                   if rx.search(c["title"]) and not MEAT.search(c["title"])
                   and c["title"] not in used]
            if len(got) >= 2:
                pool = got
                break
            time.sleep(.7)
    if not pool:
        print(f"{pk}: NO CANDIDATES  {terms}")
        continue

    pool.sort(key=score, reverse=True)
    picked = None
    for c in pool[:8]:
        im = fetch(c["thumb"])
        if im is None:
            continue
        b, s = quality(im)
        if b < 75 or s < 15:
            print(f"   {pk} skip {b:.0f}/{s:.1f} {c['title'][:42]}")
            continue
        picked = (c, im, b, s)
        break

    if not picked:
        print(f"{pk}: all candidates dark/blurry")
        continue

    c, im, b, s = picked
    im.save(os.path.join(OUT, pk + ".jpg"), "JPEG", quality=92)
    used.add(c["title"])
    manifest[pk] = {"title": c["title"], "w": c["w"], "h": c["h"],
                    "src": "https://commons.wikimedia.org/wiki/File:" +
                           urllib.parse.quote(c["title"].replace(" ", "_"))}
    json.dump(manifest, open("manifest_pkg.json", "w"), indent=1)
    print(f"{pk}: OK b={b:.0f} s={s:.1f}  {c['title'][:52]}")

print(f"\n{len(manifest)}/{len(PKGS)} package photos")
