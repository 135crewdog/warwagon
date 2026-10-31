#!/usr/bin/env python3 -I
"""Prints a chart's curves at the chart's breakpoints, interpolated along the plotted straight segments
between the recorded points, as the rows that go into docs/kc135-data.md. Points within 0.4 units of x
of one another (several data sets' symbols on one test point) are averaged first. Dev-only; needs numpy.
Usage: python3 -I research/tables.py research/charts/<chart>.json [curve ...]"""
import json, sys
import numpy as np
spec = json.load(open(sys.argv[1])); names = sys.argv[2:] or list(spec['curves'])
bps = spec['breakpoints']
print('x | ' + ' | '.join('%g' % b for b in bps))
for n in names:
    pts = sorted(spec['curves'][n]['points']); merged = []
    for x, y in pts:
        if merged and x - merged[-1][0][-1] < 0.4: merged[-1][0].append(x); merged[-1][1].append(y)
        else: merged.append(([x], [y]))
    xs = np.array([np.mean(m[0]) for m in merged]); ys = np.array([np.mean(m[1]) for m in merged])
    row = []
    for b in bps:
        row.append('%.3f' % np.interp(b, xs, ys) if xs[0] - 0.3 <= b <= xs[-1] + 0.3 else '—')
    print('%s | ' % n + ' | '.join(row))
    print('   %d points, %d after merging; x from %.2f to %.2f' % (len(pts), len(merged), xs[0], xs[-1]))
