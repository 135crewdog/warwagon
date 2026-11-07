# Converts Ordnance Survey's OS Terrain 50 (the ASCII grid download of the
# whole of Great Britain, under the Open Government Licence) into the ground
# the app draws: one coarse BASE tile of the whole island and an ATLAS of
# fine PATCHES at the places worth flying, every post a 16-bit count of STEP
# metres above the image's lowest point in the red and green channels of a
# PNG, and how much of the post is water (the sea, a lake, a reservoir) in
# the blue channel, with region.json beside them holding the scales and
# placings. Rage's make-heightmap.py, rebuilt for one source that is already
# in the projection the app uses. A developer tool, run once; needs numpy and
# scipy, and about 3 GB of memory for the 50 m mosaic of the island:
#
#   python terrain/make-heightmap.py terr50_gagg_gb.zip terrain/
#
# Everything is in the British National Grid (EPSG:27700), OS Terrain 50's
# own grid, so nothing is reprojected: the base is a 4 × 4 block mean of the
# 50 m posts and each patch is the 50 m posts themselves. World x is east and
# z is south, in metres from ORIGIN; heights are metres above sea level
# (Ordnance Datum Newlyn). The lookup that reads these files is in
# src/render/heightmap.js, and src/render/terrain.js does the same on the GPU.
#
# Water. OS Terrain 50 holds the sea as one constant value per tile (−0.9 or
# −2.0 m, say) and leaves all-sea tiles out; lakes and reservoirs are flat at
# their surface. So water is found, not drawn: every region of identical
# height is a candidate, the sea is the candidates at or below half a metre
# that connect to a missing tile, and a lake is a candidate of at least
# LAKE_MIN posts whose shore stands above it all round (a basin, which a flat
# fen field is not). Sea posts are set to 0 m, so the coast is level with
# the flat sea beyond the base's edge.
import sys, os, io, json, zlib, struct, math, zipfile
import numpy as np
from scipy import ndimage

ORIGIN = (569000.0, 278000.0)    # easting, northing of the world origin: RAF Mildenhall
STEP = 0.5                       # m per count: finer than OS Terrain 50's own accuracy, and the low bits compress badly
BLEND = 3000.0                   # m: a patch blends into the base over this band inside its edge
FADE = 10000.0                   # m: the base eases to the flat sea over this band inside its edge
SRC = 50                         # m, OS Terrain 50's posts
BASE_POST = 200                  # m, the base's posts: a 4 × 4 block mean
BASE_E = (60000, 660000)         # the base's box: mainland Britain with its islands, Scilly and Shetland excepted
BASE_N = (0, 1000000)            #   (3,001 × 5,001 posts, under the 16.8 million pixels iOS lets one canvas hold)
PATCH = 1024                     # posts per side of every patch: 51.2 km of 50 m posts
LAKE_MIN = 200                   # posts: a flat region at least this big (half a square kilometre) in a basin is a lake
SEA_MAX = 0.5                    # m: the sea's constant is never above this
# name, centre latitude, centre longitude (WGS 84). The patch is PATCH posts of SRC metres about it, snapped to OS's posts.
PATCHES = [
    ('Mildenhall', 52.36, 0.49),
]

# --- WGS 84 latitude and longitude to the National Grid (the same maths as src/osgb.js) ---
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
    # the OS Helmert transformation, ETRS89 to OSGB36, good to about 5 m
    tx, ty, tz, s = -446.448, 125.157, -542.060, 20.4894e-6
    rx, ry, rz = [math.radians(v / 3600) for v in (-0.1502, -0.2470, -0.8421)]
    x2 = tx + (1 + s) * x - rz * y + ry * z
    y2 = ty + rz * x + (1 + s) * y - rx * z
    z2 = tz - ry * x + rx * y + (1 + s) * z
    a, b = 6377563.396, 6356256.909          # Airy 1830
    phi, lam = geodetic(x2, y2, z2, a, b)
    F0, phi0, lam0, E0, N0 = 0.9996012717, math.radians(49), math.radians(-2), 400000.0, -100000.0
    e2 = 1 - (b / a) ** 2; n = (a - b) / (a + b)
    s, c, t = math.sin(phi), math.cos(phi), math.tan(phi)
    nu = a * F0 / math.sqrt(1 - e2 * s * s); rho = a * F0 * (1 - e2) / (1 - e2 * s * s) ** 1.5; eta2 = nu / rho - 1
    M = b * F0 * ((1 + n + 1.25 * n * n + 1.25 * n ** 3) * (phi - phi0)
                  - (3 * n + 3 * n * n + 2.625 * n ** 3) * math.sin(phi - phi0) * math.cos(phi + phi0)
                  + (1.875 * n * n + 1.875 * n ** 3) * math.sin(2 * (phi - phi0)) * math.cos(2 * (phi + phi0))
                  - 35 / 24 * n ** 3 * math.sin(3 * (phi - phi0)) * math.cos(3 * (phi + phi0)))
    I = M + N0; II = nu / 2 * s * c; III = nu / 24 * s * c ** 3 * (5 - t * t + 9 * eta2); IIIA = nu / 720 * s * c ** 5 * (61 - 58 * t * t + t ** 4)
    IV = nu * c; V = nu / 6 * c ** 3 * (nu / rho - t * t); VI = nu / 120 * c ** 5 * (5 - 18 * t * t + t ** 4 + 14 * eta2 - 58 * t * t * eta2)
    dl = lam - lam0
    return E0 + IV * dl + V * dl ** 3 + VI * dl ** 5, I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6

def world(E, N):
    return E - ORIGIN[0], -(N - ORIGIN[1])

# --- the 50 m mosaic of the island, with the water found ---
# Padded a block beyond the base's box so every base post has its 4 × 4 block. Row 0 is the north edge.
ME = (BASE_E[0] - BASE_POST, BASE_E[1] + BASE_POST); MN = (BASE_N[0] - BASE_POST, BASE_N[1] + BASE_POST)
COLS = (ME[1] - ME[0]) // SRC; ROWS = (MN[1] - MN[0]) // SRC
def col_of(E): return int(round((E - SRC / 2 - ME[0]) / SRC))     # the column whose post centre is at E
def row_of(N): return int(round((MN[1] - SRC / 2 - N) / SRC))     # the row whose post centre is at N

def read_tiles(path):
    heights = np.full((ROWS, COLS), np.nan, np.float32)
    candidate = np.zeros((ROWS, COLS), np.uint8)     # 1: a flat region of at least 40 posts at or below SEA_MAX, perhaps sea
    lake = np.zeros((ROWS, COLS), np.uint8)          # 1: a flat basin of at least LAKE_MIN posts, a lake
    outer = zipfile.ZipFile(path)
    tiles = [n for n in outer.namelist() if n.endswith('.zip')]
    print(f'{len(tiles)} tiles')
    for k, name in enumerate(tiles):
        inner = zipfile.ZipFile(io.BytesIO(outer.read(name)))
        asc = next(n for n in inner.namelist() if n.lower().endswith('.asc'))
        lines = inner.read(asc).decode('ascii').split('\n')
        hdr = dict(l.split() for l in lines[:5]); ncols, nrows = int(hdr['ncols']), int(hdr['nrows'])
        xll, yll, cell = float(hdr['xllcorner']), float(hdr['yllcorner']), float(hdr['cellsize'])
        assert cell == SRC, name
        data = np.array(' '.join(lines[5:5 + nrows]).split(), np.float32).reshape(nrows, ncols)
        r0 = row_of(yll + cell * nrows - cell / 2); c0 = col_of(xll + cell / 2)
        if r0 < 0 or c0 < 0 or r0 + nrows > ROWS or c0 + ncols > COLS: continue   # Shetland, Scilly: outside the base
        heights[r0:r0 + nrows, c0:c0 + ncols] = data
        # flat regions: every value that fills at least 40 posts of the tile
        vals, counts = np.unique(data, return_counts=True)
        for v in vals[counts >= 40]:
            labels, n = ndimage.label(data == v)
            sizes = ndimage.sum(np.ones_like(data), labels, range(1, n + 1))
            for i, size in enumerate(sizes, 1):
                if size < 40: continue
                m = labels == i
                if v <= SEA_MAX: candidate[r0:r0 + nrows, c0:c0 + ncols][m] = 1
                if size >= LAKE_MIN:
                    shore = ndimage.binary_dilation(m) & ~m
                    inside = shore.copy(); inside[0, :] = inside[-1, :] = inside[:, 0] = inside[:, -1] = False   # a shore on the tile's edge is unknown
                    if inside.sum() >= 0.6 * shore.sum() and (data[inside] >= v).mean() >= 0.95:
                        lake[r0:r0 + nrows, c0:c0 + ncols][m] = 1
        if k % 300 == 0: print(f'  {k} tiles read')
    missing = np.isnan(heights)
    # the sea: every candidate that connects, through other candidates, to a missing tile (or the mosaic's edge)
    labels, n = ndimage.label(candidate | missing)
    edge = np.zeros(n + 1, bool)
    edge[np.unique(labels[missing])] = True
    edge[np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))] = True
    edge[0] = False
    sea = edge[labels]
    print(f'sea: {int(sea.sum() - missing.sum()):,} posts of supplied tiles; lakes: {int(lake.sum()):,} posts')
    heights[sea] = 0.0
    heights[missing] = 0.0
    water = (sea | (lake == 1)).astype(np.uint8)
    return heights, water

# --- the base: a 4 × 4 block mean of the mosaic ---
def make_base(heights, water):
    w = (BASE_E[1] - BASE_E[0]) // BASE_POST + 1; h = (BASE_N[1] - BASE_N[0]) // BASE_POST + 1
    c0 = col_of(BASE_E[0] - 1.5 * SRC); r0 = row_of(BASE_N[1] + 1.5 * SRC)
    def block(a, dtype):
        v = a[r0:r0 + 4 * h, c0:c0 + 4 * w].astype(dtype).reshape(h, 4, w, 4)
        return v.mean(axis=(1, 3))
    return block(heights, np.float32), block(water, np.float32), w, h

# --- heights to counts, and the PNG (Rage's writer, with the water in blue) ---
def quantise(z, lo):
    return np.clip(np.round((z - lo) / STEP), 0, 65535).astype(np.uint16)

def png(q, water):
    rgb = np.zeros((q.shape[0], q.shape[1], 3), np.uint8); rgb[..., 0] = q >> 8; rgb[..., 1] = q & 255
    rgb[..., 2] = np.clip(np.round(water * 255), 0, 255).astype(np.uint8)
    rows = rgb.reshape(q.shape[0], -1).astype(np.int16)
    def shifted(r): return np.concatenate([np.zeros(3, np.int16), r[:-3]])
    def paeth(a, b, c):
        p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        return np.where((pa <= pb) & (pa <= pc), a, np.where(pb <= pc, b, c))
    out = []; prev = np.zeros_like(rows[0])
    for row in rows:
        left, upleft = shifted(row), shifted(prev)
        candidates = [row, row - left, row - prev, row - ((left + prev) >> 1), row - paeth(left, prev, upleft)]
        residues = [(c & 255).astype(np.uint8) for c in candidates]
        best = min(range(5), key=lambda i: int(np.abs(residues[i].astype(np.int8).astype(np.int16)).sum()))
        out.append(bytes([best]) + residues[best].tobytes())
        prev = row
    raw = b''.join(out)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', rgb.shape[1], rgb.shape[0], 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

src, out = sys.argv[1], sys.argv[2]
heights, water = read_tiles(src)

base, base_water, w, h = make_base(heights, water)
lo = float(np.floor(base.min()))
x0, z0 = world(BASE_E[0], BASE_N[1])
open(os.path.join(out, 'base.png'), 'wb').write(png(quantise(base, lo), base_water))
meta_base = dict(image='base.png', w=w, h=h, post=BASE_POST, x0=x0, z0=z0, min=lo, max=lo + 65535 * STEP, flat=0.0)
print(f'base: {w} x {h} posts every {BASE_POST} m, heights {lo:.0f}..{base.max():.0f} m, {base_water.mean() * 100:.0f} % water')

# the patches: PATCH posts of SRC metres about each centre, the posts OS's own, into the atlas two across
atlas_w, atlas_h = 2 * PATCH, PATCH * max(1, (len(PATCHES) + 1) // 2)
atlas = np.zeros((atlas_h, atlas_w), np.float32); atlas_water = np.zeros((atlas_h, atlas_w), np.float32)
patches = []
for k, (name, lat, lon) in enumerate(PATCHES):
    E, N = osgb(lat, lon)
    cE = round((E - SRC / 2) / SRC) * SRC + SRC / 2; cN = round((N - SRC / 2) / SRC) * SRC + SRC / 2   # the nearest post
    c0 = col_of(cE) - PATCH // 2 + 1; r0 = row_of(cN) - PATCH // 2
    z = heights[r0:r0 + PATCH, c0:c0 + PATCH]; wz = water[r0:r0 + PATCH, c0:c0 + PATCH]
    px, py = (k % 2) * PATCH, (k // 2) * PATCH
    atlas[py:py + PATCH, px:px + PATCH] = z; atlas_water[py:py + PATCH, px:px + PATCH] = wz
    xw, zw = world(cE - (PATCH // 2 - 1) * SRC, cN + (PATCH // 2) * SRC)
    patches.append(dict(name=name, px=px, py=py, size=PATCH, post=SRC, x0=xw, z0=zw, centre=[lat, lon], en=[round(E), round(N)]))
    print(f'  {name}: {PATCH * SRC / 1000:.1f} km about E {E:.0f} N {N:.0f}, heights {z.min():.0f}..{z.max():.0f} m, {wz.mean() * 100:.1f} % water, at atlas ({px}, {py})')
lo_a = float(np.floor(atlas.min()))
open(os.path.join(out, 'places.png'), 'wb').write(png(quantise(atlas, lo_a), atlas_water))
meta = dict(
    name='Great Britain from OS Terrain 50: a 200 m base of the island with 50 m patches at the places worth flying',
    crs='EPSG:27700', origin=list(ORIGIN), blend=BLEND, fade=FADE,
    base=meta_base, atlas=dict(image='places.png', w=atlas_w, h=atlas_h, min=lo_a, max=lo_a + 65535 * STEP), patches=patches,
    water='the blue channel: how much of each post is sea, lake or reservoir, found in the survey as flat regions',
)
previous = os.path.join(out, 'region.json')
if os.path.exists(previous) and 'colour' in json.load(open(previous)): meta['colour'] = json.load(open(previous))['colour']
json.dump(meta, open(previous, 'w'))
for f in ('base.png', 'places.png', 'region.json'):
    print(f'wrote {f}: {os.path.getsize(os.path.join(out, f)) / 1e6:.2f} MB')

# a preview for the eye, not for the app: the base shaded, water blue, a quarter the size
try:
    from PIL import Image
    sh = base[::4, ::4]; ww = base_water[::4, ::4]
    gx = np.gradient(sh, axis=1); light = np.clip(0.75 - gx / 40, 0.3, 1.0)
    g = np.clip(sh / 1200, 0, 1)
    land = np.stack([0.35 + 0.5 * g, 0.55 - 0.1 * g, 0.25 + 0.2 * g], -1) * light[..., None]
    img = land * (1 - ww[..., None]) + np.array([0.15, 0.3, 0.55]) * ww[..., None]
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(os.path.join(out, 'preview.png'))
    print('wrote preview.png (delete before committing)')
except ImportError:
    pass
