"""The second, independent reading of a chart: a pixel scan of the chart image at the breakpoints,
compared with the eye-read points in the chart's JSON (interpolated along the plotted straight
segments). Dev-only; not part of the app. Needs Pillow and numpy.

Usage:
  python3 -I research/scan.py research/charts/<chart>.json
      Prints, per breakpoint, the eye reading of each curve and every line crossing the scan found
      in the column (thin-line pixels only, symbols excluded), so the two can be compared by hand.
  python3 -I research/scan.py research/charts/<chart>.json --calibrate [--lines x:1-13,y:2-10]
      Finds the gridlines in the image, fits pixel = a*value + b for each axis against the JSON's
      gridline values, prints the residuals and writes the fits into the JSON as pixel_fit. When it
      finds more lines than values (a frame a grid step outside the labelled lines looks like one),
      --lines says which run to use, 1-based and inclusive; the overlay afterwards shows if it was wrong.
  python3 -I research/scan.py research/charts/<chart>.json --zoom x0,x1,y0,y1[,zoom] name
      Writes <chart>-zoom-<name>.png beside the image: that range enlarged, with a labelled fine
      grid (every 1 in x, 0.1 in y by default; set "zoom_step": [dx, dy] in the JSON) for reading by eye.
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw
spec = json.load(open(sys.argv[1])); d = os.path.dirname(sys.argv[1])
img = Image.open(os.path.join(d, spec['image'])).convert('L')
a = np.array(img) < 110; h, w = a.shape
colsum = a.sum(0); rowsum = a.sum(1)

def groups(idx):
    out = []
    for i in idx:
        if out and i - out[-1][-1] <= 2: out[-1].append(i)
        else: out.append([i])
    return [(g[0] + g[-1]) / 2 for g in out]

if '--calibrate' in sys.argv:
    vx = groups(np.where(colsum > 0.55*h)[0]); hy = groups(np.where(rowsum > 0.55*w)[0])
    for axis, found, lines in (('x', vx, spec['x']['gridlines']), ('y', hy, spec['y']['gridlines'])):
        vals = sorted(lines) if axis == 'x' else sorted(lines, reverse=True)   # left to right; top to bottom
        if len(found) < len(vals):
            print('%s: found only %d lines at %s for %d values' % (axis, len(found), [round(f, 1) for f in found], len(vals))); sys.exit(1)
        print('%s: %d lines found at %s' % (axis, len(found), [round(f) for f in found]))
        if len(found) > len(vals):
            # a frame line can sit a grid step outside the labelled lines, equally spaced, so the fit cannot tell
            # which run is right: say which with --lines x:a-b (1-based, inclusive), and check the overlay afterwards
            pick = {}
            for i, t in enumerate(sys.argv):
                if t == '--lines':
                    for tok in sys.argv[i+1].split(','):
                        ax_, rng = tok.split(':'); lo, hi = [int(v) for v in rng.split('-')]; pick[ax_] = (lo, hi)
            if axis not in pick:
                print('%s: more lines than values; say which with --lines %s:a-b' % (axis, axis)); sys.exit(1)
            lo, hi = pick[axis]; found = found[lo-1:hi]
            if len(found) != len(vals): print('%s: --lines gives %d lines for %d values' % (axis, len(found), len(vals))); sys.exit(1)
        fit = np.polyfit(vals, found, 1); res = np.abs(np.polyval(fit, vals) - found).max()
        spec[axis]['pixel_fit'] = [float(fit[0]), float(fit[1])]
        print('%s: pixel = %.3f * value + %.1f, max residual %.2f px (%.4f in value)' % (axis, fit[0], fit[1], res, res / abs(fit[0])))
    json.dump(spec, open(sys.argv[1], 'w'), indent=1); sys.exit(0)

fx, fy = spec['x']['pixel_fit'], spec['y']['pixel_fit']
x_of = lambda v: fx[0]*v + fx[1]; y_of = lambda v: fy[0]*v + fy[1]; v_of = lambda p: (p - fy[1]) / fy[0]

if '--zoom' in sys.argv:
    i = sys.argv.index('--zoom'); parts = [float(t) for t in sys.argv[i+1].split(',')]; name = sys.argv[i+2]
    x0, x1, y0, y1 = parts[:4]; z = int(parts[4]) if len(parts) > 4 else 3
    dx, dy = spec.get('zoom_step', [1, 0.1])
    px0, px1 = int(x_of(x0)), int(x_of(x1)); py0, py1 = int(y_of(y1)), int(y_of(y0))
    c = img.crop((px0-10, py0-10, px1+10, py1+10)).convert('RGB').resize(((px1-px0+20)*z, (py1-py0+20)*z)); dr = ImageDraw.Draw(c)
    v = x0
    while v <= x1 + 1e-9:
        x = (x_of(v) - px0 + 10) * z; major = abs(v / (5*dx) - round(v / (5*dx))) < 1e-6
        dr.line([(x, 0), (x, c.size[1])], fill=(0, 0, 255) if major else (255, 100, 100), width=1); dr.text((x+3, 3), ('%g' % v), fill=(200, 0, 0)); v = round(v + dx, 6)
    v = y0
    while v <= y1 + 1e-9:
        y = (y_of(v) - py0 + 10) * z; major = abs(v / (5*dy) - round(v / (5*dy))) < 1e-6
        dr.line([(0, y), (c.size[0], y)], fill=(0, 0, 255) if major else (255, 100, 100), width=1); dr.text((3, y+2), ('%g' % v), fill=(200, 0, 0)); v = round(v + dy, 6)
    out = os.path.join(d, spec['image'].replace('.png', '-zoom-%s.png' % name)); c.save(out); print('wrote', out, c.size); sys.exit(0)

mask = np.zeros(h, bool)
for g in spec['y']['gridlines']:
    y = int(round(fy[0]*g + fy[1])); mask[max(0, y-5):y+6] = True
ys = sorted(fy[0]*g + fy[1] for g in spec['y']['gridlines']); mask[:int(ys[0])+14] = True; mask[int(ys[-1])-14:] = True
def runs(x):
    col = a[:, x] & ~mask; out = []; s = None
    for y in range(h+1):
        on = y < h and col[y]
        if on and s is None: s = y
        if not on and s is not None: out.append(((s+y-1)/2, y-s)); s = None
    return out
def eye(curve, al):
    p = curve['points']
    for (x0, y0), (x1, y1) in zip(p, p[1:]):
        if x0 <= al <= x1: return y0 + (al-x0)*(y1-y0)/(x1-x0)
    return None
names = list(spec['curves'])
print('alpha | eye: ' + ' '.join('%-8s' % n for n in names) + '| scan: line crossings (value, pixels)')
for al in spec['breakpoints']:
    xc = int(round(x_of(al))); found = []
    for win in (4, 8, 14, 24, 36):
        pts = []
        for dx in range(-win, win+1):
            if colsum[xc+dx] > 0.55*h: continue
            pts += [c for c, l in runs(xc+dx) if 3 <= l <= 13]
        pts.sort(); clusters = []
        for c in pts:
            if clusters and c - clusters[-1][-1] < 12: clusters[-1].append(c)
            else: clusters.append([c])
        found = [(round(float(v_of(np.median(c))), 3), len(c)) for c in clusters if len(c) >= 4]
        if len(found) >= len(names): break
    e = ' '.join('%-8s' % ('%.3f' % eye(spec['curves'][n], al) if eye(spec['curves'][n], al) is not None else '-') for n in names)
    print('%5g | %s| %s' % (al, e, '  '.join('%.3f (%d)' % f for f in sorted(found, reverse=True))))
