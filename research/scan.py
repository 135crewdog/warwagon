"""The second, independent reading of a chart: a pixel scan of the chart image at the breakpoints,
compared with the eye-read points in the chart's JSON (interpolated along the plotted straight
segments). Dev-only; not part of the app. Needs Pillow and numpy.

Usage:
  python3 -I research/scan.py research/charts/<chart>.json
      Prints, per breakpoint, the eye reading of each curve and every line crossing the scan found
      in the column (thin-line pixels only, symbols excluded), so the two can be compared by hand.
  python3 -I research/scan.py research/charts/<chart>.json --calibrate [--lines x:1-13,y:2-10] [--threshold 0.4] [--dark 110] [--fit x:0.1=573,1.15=3252;y:0=590,-0.04=1630]
      Finds the gridlines in the image, fits pixel = a*value + b for each axis against the JSON's
      gridline values, prints the residuals and writes the fits into the JSON as pixel_fit. When it
      finds more lines than values (a frame a grid step outside the labelled lines looks like one),
      --lines says which run to use, 1-based and inclusive; the overlay afterwards shows if it was wrong.
  python3 -I research/scan.py research/charts/<chart>.json --symbols [name] [--area 15,700]
      Finds the plotted symbols (closed shapes of symbol size once the gridlines are stripped) and prints their
      centroids in chart units; with a name, writes them into the JSON as that curve, for the overlay to check.
  python3 -I research/scan.py research/charts/<chart>.json --zoom x0,x1,y0,y1[,zoom] name
      Writes <chart>-zoom-<name>.png beside the image: that range enlarged, with a labelled fine
      grid (every 1 in x, 0.1 in y by default; set "zoom_step": [dx, dy] in the JSON) for reading by eye.
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw
spec = json.load(open(sys.argv[1])); d = os.path.dirname(sys.argv[1])
img = Image.open(os.path.join(d, spec['image'])).convert('L')
dark = int(sys.argv[sys.argv.index('--dark') + 1]) if '--dark' in sys.argv else 110   # pixels darker than this are ink; raise it for a light scan
a = np.array(img) < dark; h, w = a.shape
colsum = a.sum(0); rowsum = a.sum(1)

def groups(idx):
    out = []
    for i in idx:
        if out and i - out[-1][-1] <= 2: out[-1].append(i)
        else: out.append([i])
    return [(g[0] + g[-1]) / 2 for g in out]

if '--calibrate' in sys.argv:
    thr = float(sys.argv[sys.argv.index('--threshold') + 1]) if '--threshold' in sys.argv else 0.4
    pick = {}
    for i, t in enumerate(sys.argv):
        if t == '--lines':
            for tok in sys.argv[i+1].split(','):
                ax_, rng = tok.split(':'); lo, hi = [int(v) for v in rng.split('-')]; pick[ax_] = (lo, hi)
    def equally_spaced(found, n):
        # gridlines are equally spaced; frames, faint lines and flat data lines are not: take the n found
        # lines that best fit one spacing, scored by how many found lines land on the predicted positions
        best = None; ties = []
        for i in range(len(found)):
            for j in range(i + 1, len(found)):
                for mi in range(n):
                    for mj in range(mi + 1, n):
                        d = (found[j] - found[i]) / (mj - mi); pred = [found[i] + (m - mi) * d for m in range(n)]
                        hits = [min(found, key=lambda f: abs(f - q)) for q in pred]
                        score = sum(abs(h - q) <= 4 for h, q in zip(hits, pred)); res = max(abs(h - q) for h, q in zip(hits, pred))
                        span = hits[-1] - hits[0]       # among runs that fit, the one spanning most of the frame is the grid
                        key = (score, round(span / 10), -res)
                        if best is None or key > best[3]: best = (score, res, hits, key); ties = []
                        elif key[:2] == best[3][:2] and hits != best[2] and hits not in ties: ties.append(hits)
        return best[:3], ties
    fits = {}
    for i, t in enumerate(sys.argv):
        if t == '--fit':      # --fit x:0.1=573,1.15=3252 : two value=pixel pairs per axis, read off the image by hand
            for tok in sys.argv[i+1].split(';'):
                ax_, pairs = tok.split(':'); pts = [tuple(float(u) for u in pr.split('=')) for pr in pairs.split(',')]
                fits[ax_] = [(pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0]), 0]; fits[ax_][1] = pts[0][1] - fits[ax_][0] * pts[0][0]
    for ax_, f in fits.items():
        spec[ax_]['pixel_fit'] = [float(f[0]), float(f[1])]; print('%s: pixel = %.3f * value + %.1f, from --fit' % (ax_, f[0], f[1]))
    if len(fits) == 2: json.dump(spec, open(sys.argv[1], 'w'), indent=1); sys.exit(0)
    vx = groups(np.where(colsum > thr*h)[0])
    x0, x1 = int(vx[0]), int(vx[-1]) + 1
    hy = groups(np.where(a[:, x0:x1].sum(1) > thr*(x1 - x0))[0])
    for axis, found, lines in (('x', vx, spec['x']['gridlines']), ('y', hy, spec['y']['gridlines'])):
        if axis in fits: continue
        vals = sorted(lines) if axis == 'x' else sorted(lines, reverse=True)   # left to right; top to bottom
        print('%s: %d lines found at %s' % (axis, len(found), [round(f) for f in found]))
        if axis in pick:
            lo, hi = pick[axis]; found = found[lo-1:hi]
        elif len(found) != len(vals):
            if len(found) < len(vals): print('%s: only %d lines for %d values' % (axis, len(found), len(vals))); sys.exit(1)
            (score, res, chosen), ties = equally_spaced(found, len(vals))
            if ties:
                # two runs fit equally well (a frame one grid step outside the labelled lines): the image can't say which
                print('%s: %d equally spaced runs fit equally well: %s and %s; say which with --lines %s:a-b' % (
                    axis, 1 + len(ties), [round(f) for f in chosen], ' / '.join(str([round(f) for f in t]) for t in ties), axis)); sys.exit(1)
            found = chosen
            print('%s: chose %s' % (axis, [round(f) for f in chosen]))
            print('%s: took the equally spaced %d of them (%d land within 4 px of the spacing, worst %.1f px); --lines %s:a-b overrides' % (axis, len(vals), score, res, axis))
            if score < len(vals) - 1: print('%s: too few lines on the spacing; check the overlay or give --lines' % axis)
        if len(found) != len(vals): print('%s: %d lines for %d values' % (axis, len(found), len(vals))); sys.exit(1)
        fit = np.polyfit(vals, found, 1); res = np.abs(np.polyval(fit, vals) - found).max()
        spec[axis]['pixel_fit'] = [float(fit[0]), float(fit[1])]
        print('%s: pixel = %.3f * value + %.1f, max residual %.2f px (%.4f in value)' % (axis, fit[0], fit[1], res, res / abs(fit[0])))
    json.dump(spec, open(sys.argv[1], 'w'), indent=1); sys.exit(0)

fx, fy = spec['x']['pixel_fit'], spec['y']['pixel_fit']
x_of = lambda v: fx[0]*v + fx[1]; y_of = lambda v: fy[0]*v + fy[1]; v_of = lambda p: (p - fy[1]) / fy[0]

if '--symbols' in sys.argv:
    # the plotted test points are closed symbols (circle, square, diamond, triangle) about 25 px across at
    # 400 dpi, drawn on top of the curve line. The curve joins them into one blob, so the ink can't be used;
    # their white interiors can: small enclosed white regions inside the frame, which nothing else makes
    # (grid cells are a hundred times larger, and the axis labels are outside the frame). The curve through
    # a symbol splits its interior in two, so interiors within 15 px are grouped and their centroid taken.
    # Overlapping data sets share one interior, whose centroid is where they agree. --symbols <name> writes
    # the result into the JSON as that curve, for the overlay to check.
    from scipy import ndimage
    gx = [x_of(v) for v in spec['x']['gridlines']]; gy = [y_of(v) for v in spec['y']['gridlines']]
    fx0, fx1 = int(min(gx)) + 4, int(max(gx)) - 4; fy0, fy1 = int(min(gy)) + 4, int(max(gy)) - 4
    inside = np.zeros_like(a); inside[fy0:fy1, fx0:fx1] = True
    white = ~a & inside
    lab, n = ndimage.label(white); objs = ndimage.find_objects(lab)
    amin, amax = [int(v) for v in sys.argv[sys.argv.index('--area') + 1].split(',')] if '--area' in sys.argv else (15, 700)
    holes = []
    for i_, sl in enumerate(objs):
        hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if hh > 40 or ww > 40: continue
        m = lab[sl] == i_ + 1; area = int(m.sum())
        if not amin <= area <= amax: continue
        if sl[0].start <= fy0 + 10 or sl[0].stop >= fy1 - 10 or sl[1].start <= fx0 + 10 or sl[1].stop >= fx1 - 10: continue   # labels at the frame
        cy, cx = ndimage.center_of_mass(m); holes.append((cx + sl[1].start, cy + sl[0].start, area))
    holes.sort(); groups_ = []
    for hx, hy, ar in holes:
        for g in groups_:
            if abs(g['x'] / g['a'] - hx) < 15 and abs(g['y'] / g['a'] - hy) < 15:
                g['x'] += hx * ar; g['y'] += hy * ar; g['a'] += ar; g['n'] += 1; break
        else: groups_.append({'x': hx * ar, 'y': hy * ar, 'a': ar, 'n': 1})
    pts = sorted((round((g['x'] / g['a'] - fx[1]) / fx[0], 2), round(float(v_of(g['y'] / g['a'])), 4), g['a'], g['n']) for g in groups_)
    for q in pts: print('x %6.2f  y %8.4f  interior %4d px in %d parts' % q)
    k = sys.argv.index('--symbols'); name = sys.argv[k + 1] if len(sys.argv) > k + 1 and not sys.argv[k + 1].startswith('--') else None
    if name:
        spec['curves'][name] = {'symbol': 'auto', 'description': 'symbol centroids found by scan.py --symbols (interiors of the plotted symbols)', 'points': [[q[0], q[1]] for q in pts]}
        json.dump(spec, open(sys.argv[1], 'w'), indent=1); print('wrote curve', name)
    sys.exit(0)

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
