#!/usr/bin/env python3 -I
"""The second, independent reading of a chart: a pixel scan of the chart image at the breakpoints,
compared with the eye-read points in the chart's JSON (interpolated along the plotted straight
segments). Dev-only; not part of the app. Needs Pillow and numpy.
Usage: python3 -I research/scan.py research/charts/<chart>.json
Prints, per breakpoint, the eye reading of each curve and every line crossing the scan found in
the column (thin-line pixels only, symbols excluded), so the two can be compared by hand."""
import json, sys, os
import numpy as np
from PIL import Image
spec = json.load(open(sys.argv[1])); d = os.path.dirname(sys.argv[1])
a = np.array(Image.open(os.path.join(d, spec['image'])).convert('L')) < 110; h, w = a.shape
fx, fy = spec['x']['pixel_fit'], spec['y']['pixel_fit']
x_of = lambda v: fx[0]*v + fx[1]; v_of = lambda p: (p - fy[1]) / fy[0]
colsum = a.sum(0)
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
