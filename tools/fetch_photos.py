"""Fetch a photo for each menu dish from Wikimedia Commons.

Strategy: search with a primary term, fall back through alternates, retry
empty responses with backoff, then download a 900px thumbnail. Picks the
candidate whose aspect ratio best suits a square-ish card crop and which
has the highest resolution.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "TiffinSiteBuilder/1.0 (educational food menu demo)"
OUT = "photos"
os.makedirs(OUT, exist_ok=True)

# dish id -> search terms, most specific first
DISHES = {
    "b1": ["Aloo paratha"],
    "b2": ["Poha flattened rice", "Poha"],
    "b3": ["Idli sambar"],
    "b4": ["Gobi paratha", "Aloo gobi paratha"],
    "b5": ["Paneer bhurji"],
    "b6": ["Chole bhature"],
    "b7": ["Halwa poori", "Puri bhaji", "Sooji halwa"],
    "l1": ["Rajma chawal"],
    "l2": ["Aloo gobi"],
    "l3": ["Kadhi chawal"],
    "l4": ["Dal tadka", "Tadka daal", "Dal makhani"],
    "l5": ["Vegetable biryani", "Hyderabadi biryani", "Biryani"],
    "l6": ["Paneer butter masala"],
    "l7": ["Indian thali vegetarian", "Indian thali"],
    "d1": ["Mix veg curry Indian", "Mixed vegetable curry", "Aloo matar"],
    "d2": ["Chana masala", "Chole"],
    "d3": ["Paneer tikka masala"],
    "d4": ["Dal makhani"],
    "d5": ["Aloo matar"],
    "d6": ["Dal fry", "Tadka daal", "Dal tadka"],
    "d7": ["Malai kofta"],
}

# a few Commons files whose search results are unreliable — pinned directly
PINNED = {
    "l5": "Hyderabadi Vegetable Biryani.jpg",
    "b7": "Halwa Poori.jpg",
    "l4": "Dal Tadka.jpg",
    "d6": "Dal Fry.jpg",
}


def api(params, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(
                API + "?" + urllib.parse.urlencode(params),
                headers={"User-Agent": UA},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            if i == tries - 1:
                print(f"    ! api fail: {e}", flush=True)
                return {}
            time.sleep(1.2 * (i + 1))
    return {}


def search(term, limit=10):
    d = api({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f"filetype:bitmap {term}", "gsrnamespace": "6",
        "gsrlimit": str(limit), "prop": "imageinfo",
        "iiprop": "url|size|mime", "iiurlwidth": "1000",
    })
    out = []
    for p in ((d.get("query") or {}).get("pages") or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii.get("url"):
            continue
        if ii.get("mime", "").split("/")[-1] not in ("jpeg", "png", "webp"):
            continue
        out.append({
            "title": p.get("title", "").replace("File:", ""),
            "w": ii.get("width") or 0, "h": ii.get("height") or 0,
            "thumb": ii.get("thumburl") or ii.get("url"),
        })
    return out


def by_title(title):
    d = api({
        "action": "query", "format": "json", "titles": "File:" + title,
        "prop": "imageinfo", "iiprop": "url|size|mime", "iiurlwidth": "1000",
    })
    for p in ((d.get("query") or {}).get("pages") or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("url"):
            return [{
                "title": p.get("title", "").replace("File:", ""),
                "w": ii.get("width") or 0, "h": ii.get("height") or 0,
                "thumb": ii.get("thumburl") or ii.get("url"),
            }]
    return []


def score(c):
    """Prefer big, and aspect between 0.7 and 1.8 (crops nicely to a card)."""
    if not c["w"] or not c["h"]:
        return -1
    ar = c["w"] / c["h"]
    if ar < 0.6 or ar > 2.2:
        ar_pen = 1.0
    else:
        ar_pen = abs(ar - 1.15) / 1.15
    return (c["w"] * c["h"]) ** 0.5 * (1 - ar_pen * 0.6)


def download(url, dest, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 3000:
                raise ValueError("too small")
            with open(dest, "wb") as f:
                f.write(data)
            return True
        except Exception as e:
            if i == tries - 1:
                print(f"    ! dl fail: {e}", flush=True)
                return False
            time.sleep(1.5 * (i + 1))
    return False


manifest = {}
if os.path.exists("manifest.json"):
    manifest = json.load(open("manifest.json"))

only = sys.argv[1:] or list(DISHES)

for did in only:
    if did in manifest and os.path.exists(os.path.join(OUT, did + ".jpg")):
        print(f"{did}: cached")
        continue
    terms = DISHES[did]
    cands = []
    if did in PINNED:
        cands = by_title(PINNED[did])
    if not cands:
        for t in terms:
            cands = search(t)
            if cands:
                break
            time.sleep(.6)
    if not cands:
        print(f"{did}: NO CANDIDATES  ({terms})")
        continue
    cands.sort(key=score, reverse=True)
    best = cands[0]
    dest = os.path.join(OUT, did + ".jpg")
    ok = download(best["thumb"], dest)
    print(f"{did}: {'OK ' if ok else 'FAIL'} {best['w']}x{best['h']}  {best['title'][:60]}")
    if ok:
        manifest[did] = {
            "title": best["title"],
            "w": best["w"], "h": best["h"],
            "src": "https://commons.wikimedia.org/wiki/File:" +
                   urllib.parse.quote(best["title"].replace(" ", "_")),
        }
        json.dump(manifest, open("manifest.json", "w"), indent=1)
    time.sleep(.4)

print(f"\n{len(manifest)}/{len(DISHES)} photos in {OUT}/")
