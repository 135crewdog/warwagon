# Fetches the Environment Agency's LiDAR Composite DTM (1 m, bare earth,
# England, Open Government Licence) for a National Grid box from its WCS
# service, as 1 m GeoTIFF tiles for make-heightmap.py's LiDAR patches. A
# developer tool, run once per patch; the tiles are not committed. Needs
# curl. Each tile is named by its south-west corner and side, which is its
# georeferencing: the service returns the subset exactly, 1 m posts, row 0
# the north edge, voids as the most negative float.
#
#   python terrain/fetch-lidar.py E0 N0 E1 N1 outdir      (metres, multiples of TILE)
import sys, os, subprocess

TILE = 3200       # m a side per request: 41 MB of float32, a few seconds each
BASE = 'https://environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m/wcs'
COVERAGE = '13787b9a-26a4-4775-8523-806d13af58fc__Lidar_Composite_Elevation_DTM_1m'

e0, n0, e1, n1 = (int(v) for v in sys.argv[1:5]); out = sys.argv[5]
os.makedirs(out, exist_ok=True)
for e in range(e0, e1, TILE):
    for n in range(n0, n1, TILE):
        path = os.path.join(out, f'dtm1m_{e}_{n}_{TILE}.tif')
        if os.path.exists(path): continue        # a tile is only ever saved whole, so one that exists is good
        url = f'{BASE}?service=WCS&version=2.0.1&request=GetCoverage&coverageId={COVERAGE}&format=image/tiff&subset=E({e},{e + TILE})&subset=N({n},{n + TILE})'
        # into a temporary file, renamed only when curl itself succeeded (a timeout or a cut transfer after
        # the 200 leaves curl's exit code non-zero and the file short) and the server answered with a TIFF
        part = path + '.part'
        r = subprocess.run(['curl', '-sS', '-f', '-m', '900', url, '-o', part, '-w', '%{http_code} %{size_download}'], capture_output=True, text=True)
        head = open(part, 'rb').read(4) if os.path.exists(part) else b''
        if r.returncode != 0 or not r.stdout.startswith('200') or head[:2] not in (b'II', b'MM'):
            body = open(part, 'rb').read(200) if os.path.exists(part) else b''
            if os.path.exists(part): os.remove(part)
            raise SystemExit(f'{os.path.basename(path)}: curl exit {r.returncode} ({r.stderr.strip()}), reply {r.stdout!r}: {body!r}')
        os.replace(part, path)
        print(f'{os.path.basename(path)}: {os.path.getsize(path) / 1e6:.0f} MB')
print('done')
