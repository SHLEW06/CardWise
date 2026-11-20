# Samples the dominant face colour of each issuer photo in public/cards/ (v7,
# REDESIGN_SPEC §9.11). Usage: python3 -I scripts/sample-card-materials.py public/cards
# Prints JSON {id: {base, share, lum}}; results are pasted into
# src/data/cardMaterials.js PHOTO_MATERIALS after a visual check.
import sys, os, json
from PIL import Image
d = sys.argv[1]
out = {}
for f in sorted(os.listdir(d)):
    base, ext = os.path.splitext(f)
    if ext.lower() not in (".png", ".webp", ".jpg", ".jpeg"): continue
    if base in out: continue
    im = Image.open(os.path.join(d, f)).convert("RGBA")
    w, h = im.size
    # inner region away from rounded corners / logos-at-edges
    box = im.crop((int(w*.12), int(h*.15), int(w*.88), int(h*.85))).resize((120, 76))
    data = box.get_flattened_data() if hasattr(box, "get_flattened_data") else box.getdata()
    px = [p for p in data if p[3] > 200]
    if not px: continue
    q = Image.new("RGB", (len(px), 1)); q.putdata([p[:3] for p in px])
    q = q.quantize(colors=5, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:15]; counts = sorted(q.getcolors(), reverse=True)
    n, idx = counts[0]
    r, g, b = pal[idx*3:idx*3+3]
    share = n / len(px)
    lum = (0.2126*r + 0.7152*g + 0.0722*b) / 255
    out[base] = {"base": "#%02X%02X%02X" % (r, g, b), "share": round(share, 2), "lum": round(lum, 2)}
json.dump(out, sys.stdout, indent=0)
