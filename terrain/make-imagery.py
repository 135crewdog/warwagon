# Lays satellite imagery over the region's ground: the same base tile and
# atlas of patches as make-heightmap.py, read from region.json, so every
# colour pixel sits on the ground it belongs to. The sources are 8-bit RGB
# GeoTIFFs in WGS 84 as the Copernicus Browser exports them (Sentinel-2
# quarterly cloudless mosaics, true colour), one or more for the base (the
# island in halves, since the free export is 2,500 pixels a side) and one
# per patch; a patch without one takes the base's. Each target post is
# turned from the National Grid to latitude and longitude (the inverse of
# make-heightmap.py's osgb(), solved on a coarse grid of control points and
# interpolated between, exact to well under a metre) and the source read
# there, four samples averaged per post so a finer source doesn't alias.
# Writes base-colour.jpg and places-colour.jpg, the patches' colour at
# COLOUR_SCALE times their posts, and records them in region.json under
# "colour". A developer tool, run once; needs numpy, tifffile and Pillow:
#
#   python terrain/make-imagery.py terrain/ base=south.tiff base=north.tiff "Mildenhall=patch.tiff" "Mildenhall and Lakenheath=patch.tiff"
#
# The mosaics are low in contrast as exported, so one fixed lift of contrast
# and saturation is applied to every tile alike, as Rage's; nothing else.
import sys, os, json, math, warnings
import numpy as np
import tifffile
from PIL import Image

COLOUR_SCALE = 1     # colour pixels per height post across each patch: the 32 m export gives nothing finer than the 50 m posts, and the 5 m LiDAR patch would only repeat it
QUALITY = 85         # JPEG
CONTRAST = 1.18      # the fixed lift, the same for every tile
SATURATION = 1.25
BLACK = 12           # the value taken as black before the lift
CONTROL = 32         # posts between the control points of the grid-to-latitude solve

out = sys.argv[1]
sources = {}
for arg in sys.argv[2:]:
    name, path = arg.split('=', 1); sources.setdefault(name, []).append(path)
region = json.load(open(os.path.join(out, 'region.json')))
E0, N0 = region['origin']

# --- the forward projection, as make-heightmap.py and src/osgb.js have it ---
def osgb(lat, lon):
    def ecef(lat, lon, a, b):
        e2 = 1 - (b / a) ** 2; s, c = math.sin(lat), math.cos(lat)
        nu = a / math.sqrt(1 - e2 * s * s)
        return nu * c * math.cos(lon), nu * c * math.sin(lon), (1 - e2) * nu * s
    def geodetic(x, y, z, a, b):
        e2 = 1 - (b / a) ** 2; p = math.hypot(x, y); lat = math.atan2(z, p * (1 - e2))
        for _ in range(8):
            nu = a / math.sqrt(1 - e2 * math.sin(lat) ** 2); lat = math.atan2(z + e2 * nu * math.sin(lat), p)
        return lat, math.atan2(y, x)
    x, y, z = ecef(math.radians(lat), math.radians(lon), 6378137.0, 6356752.314245)
    tx, ty, tz, s = -446.448, 125.157, -542.060, 20.4894e-6
    rx, ry, rz = [math.radians(v / 3600) for v in (-0.1502, -0.2470, -0.8421)]
    x2 = tx + (1 + s) * x - rz * y + ry * z; y2 = ty + rz * x + (1 + s) * y - rx * z; z2 = tz - ry * x + rx * y + (1 + s) * z
    a, b = 6377563.396, 6356256.909
    phi, lam = geodetic(x2, y2, z2, a, b)
    F0, phi0, lam0, EE, NN = 0.9996012717, math.radians(49), math.radians(-2), 400000.0, -100000.0
    e2 = 1 - (b / a) ** 2; n = (a - b) / (a + b)
    s, c, t = math.sin(phi), math.cos(phi), math.tan(phi)
    nu = a * F0 / math.sqrt(1 - e2 * s * s); rho = a * F0 * (1 - e2) / (1 - e2 * s * s) ** 1.5; eta2 = nu / rho - 1
    M = b * F0 * ((1 + n + 1.25 * n * n + 1.25 * n ** 3) * (phi - phi0) - (3 * n + 3 * n * n + 2.625 * n ** 3) * math.sin(phi - phi0) * math.cos(phi + phi0)
                  + (1.875 * n * n + 1.875 * n ** 3) * math.sin(2 * (phi - phi0)) * math.cos(2 * (phi + phi0)) - 35 / 24 * n ** 3 * math.sin(3 * (phi - phi0)) * math.cos(3 * (phi + phi0)))
    I = M + NN; II = nu / 2 * s * c; III = nu / 24 * s * c ** 3 * (5 - t * t + 9 * eta2); IIIA = nu / 720 * s * c ** 5 * (61 - 58 * t * t + t ** 4)
    IV = nu * c; V = nu / 6 * c ** 3 * (nu / rho - t * t); VI = nu / 120 * c ** 5 * (5 - 18 * t * t + t ** 4 + 14 * eta2 - 58 * t * t * eta2)
    dl = lam - lam0
    return EE + IV * dl + V * dl ** 3 + VI * dl ** 5, I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6

# the inverse at one point, by Newton's method on the forward
def latlon(E, N, lat=54.0, lon=-2.0):
    for _ in range(12):
        e, n = osgb(lat, lon)
        if abs(e - E) < 0.01 and abs(n - N) < 0.01: break
        e1, n1 = osgb(lat + 1e-5, lon); e2, n2 = osgb(lat, lon + 1e-5)
        a, b, c, d = (e1 - e) / 1e-5, (e2 - e) / 1e-5, (n1 - n) / 1e-5, (n2 - n) / 1e-5
        det = a * d - b * c; dE, dN = E - e, N - n
        lat += (d * dE - b * dN) / det; lon += (-c * dE + a * dN) / det
    return lat, lon

# latitude and longitude of every post of a grid (x0, z0 world, post spacing, w × h), through control points
def grid_latlon(x0, z0, post, w, h):
    ci = np.arange(0, w + CONTROL, CONTROL); cj = np.arange(0, h + CONTROL, CONTROL)
    lat = np.zeros((len(cj), len(ci))); lon = np.zeros_like(lat)
    guess = (54.0, -2.0)
    for j, pj in enumerate(cj):
        for i, pi in enumerate(ci):
            guess = latlon(E0 + x0 + pi * post, N0 - (z0 + pj * post), *guess)
            lat[j, i], lon[j, i] = guess
    # bilinear between the control points
    def interp(a):
        fi = np.arange(w) / CONTROL; fj = np.arange(h) / CONTROL
        i0 = np.floor(fi).astype(int); j0 = np.floor(fj).astype(int); ti = fi - i0; tj = fj - j0
        top = a[j0][:, i0] * (1 - ti) + a[j0][:, i0 + 1] * ti
        bot = a[j0 + 1][:, i0] * (1 - ti) + a[j0 + 1][:, i0 + 1] * ti
        return top * (1 - tj)[:, None] + bot * tj[:, None]
    return interp(lat), interp(lon)

def load(path):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        with tifffile.TiffFile(path) as tif:
            page = tif.pages[0]
            rgb = page.asarray()[..., :3].astype(np.float32)
            tags = {t.name: t.value for t in page.tags.values()}
    scale = tags['ModelPixelScaleTag']; tie = tags['ModelTiepointTag']
    # the tiepoint is the top-left corner of the top-left pixel (RasterPixelIsArea); centres are half a pixel in
    geo = dict(dlon=float(scale[0]), dlat=float(scale[1]), lon0=float(tie[3]) + 0.5 * float(scale[0]), lat0=float(tie[4]) - 0.5 * float(scale[1]))
    rows, cols = rgb.shape[:2]
    geo.update(west=geo['lon0'] - 0.5 * geo['dlon'], east=geo['lon0'] + (cols - 0.5) * geo['dlon'], north=geo['lat0'] + 0.5 * geo['dlat'], south=geo['lat0'] - (rows - 0.5) * geo['dlat'])
    print(f'{os.path.basename(path)[:40]}: {cols} x {rows}, {geo["dlon"] * 111320 * math.cos(math.radians((geo["north"] + geo["south"]) / 2)):.0f} m x {geo["dlat"] * 111132:.0f} m pixels, {geo["west"]:.2f}..{geo["east"]:.2f} E, {geo["south"]:.2f}..{geo["north"]:.2f} N')
    return rgb, geo

# the colour at latitude and longitude arrays from the first source that covers each point, bilinear
def sample(srcs, lat, lon):
    out = np.zeros(lat.shape + (3,), np.float32); done = np.zeros(lat.shape, bool)
    for rgb, geo in srcs:
        rows, cols = rgb.shape[:2]
        here = ~done & (lon >= geo['west']) & (lon <= geo['east']) & (lat <= geo['north']) & (lat >= geo['south'])
        if not here.any(): continue
        fr = np.clip((geo['lat0'] - lat[here]) / geo['dlat'], 0, rows - 1.001); fc = np.clip((lon[here] - geo['lon0']) / geo['dlon'], 0, cols - 1.001)
        r0 = np.floor(fr).astype(int); c0 = np.floor(fc).astype(int); tr = (fr - r0)[:, None]; tc = (fc - c0)[:, None]
        out[here] = (rgb[r0, c0] * (1 - tc) + rgb[r0, c0 + 1] * tc) * (1 - tr) + (rgb[r0 + 1, c0] * (1 - tc) + rgb[r0 + 1, c0 + 1] * tc) * tr
        done |= here
    if not done.all(): print(f'  {int((~done).sum()):,} posts outside every source: left dark')
    return out

# a grid's colour: four samples per post, a quarter post each way from its centre, averaged
def colour(srcs, x0, z0, post, w, h):
    acc = np.zeros((h, w, 3), np.float32)
    for di, dj in ((-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25), (0.25, 0.25)):
        lat, lon = grid_latlon(x0 + di * post, z0 + dj * post, post, w, h)
        acc += sample(srcs, lat, lon)
    return acc / 4

def lift(rgb):
    v = np.clip((rgb - BLACK) / (255 - BLACK), 0, 1)
    v = np.clip((v - 0.5) * CONTRAST + 0.5, 0, 1)
    grey = v.mean(axis=-1, keepdims=True)
    v = np.clip(grey + (v - grey) * SATURATION, 0, 1)
    return (v * 255 + 0.5).astype(np.uint8)

base_srcs = [load(p) for p in sources.pop('base')]
b = region['base']
print(f'the base: {b["w"]} x {b["h"]} posts')
base_rgb = np.zeros((b['h'], b['w'], 3), np.uint8)
step = 500
for r in range(0, b['h'], step):          # in bands of rows, to keep the memory down
    hh = min(step, b['h'] - r)
    base_rgb[r:r + hh] = lift(colour(base_srcs, b['x0'], b['z0'] + r * b['post'], b['post'], b['w'], hh))
Image.fromarray(base_rgb).save(os.path.join(out, 'base-colour.jpg'), quality=QUALITY)

a = region['atlas']
atlas_rgb = np.zeros((a['h'] * COLOUR_SCALE, a['w'] * COLOUR_SCALE, 3), np.uint8)
for p in region['patches']:
    srcs = [load(q) for q in sources.get(p['name'], [])] or base_srcs
    n = p['size'] * COLOUR_SCALE; post = p['post'] / COLOUR_SCALE
    print(f'{p["name"]}: {n} x {n} colour pixels every {post:.1f} m' + ('' if p['name'] in sources else ' (from the base\'s sources)'))
    px, py = p['px'] * COLOUR_SCALE, p['py'] * COLOUR_SCALE
    atlas_rgb[py:py + n, px:px + n] = lift(colour(srcs, p['x0'], p['z0'], post, n, n))
Image.fromarray(atlas_rgb).save(os.path.join(out, 'places-colour.jpg'), quality=QUALITY)

region['colour'] = dict(base='base-colour.jpg', atlas='places-colour.jpg', scale=COLOUR_SCALE, source='Sentinel-2 quarterly cloudless mosaic, true colour, from the Copernicus Browser')
json.dump(region, open(os.path.join(out, 'region.json'), 'w'))
for f in ('base-colour.jpg', 'places-colour.jpg'):
    print(f'wrote {f}: {os.path.getsize(os.path.join(out, f)) / 1e6:.2f} MB')
