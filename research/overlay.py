#!/usr/bin/env python3 -I
"""Draws a chart's digitized points over its image, so a misread point shows at a glance.
Dev-only; not part of the app. Needs Pillow.
Usage: python3 -I research/overlay.py research/charts/<chart>.json
Writes research/check/<chart>.png: the chart at 2x with the points as red crosses, and a red
line through them; each curve labelled."""
import json, sys, os
from PIL import Image, ImageDraw
spec = json.load(open(sys.argv[1])); d = os.path.dirname(sys.argv[1])
im = Image.open(os.path.join(d, spec['image'])).convert('RGB')
z = 2; im = im.resize((im.width*z, im.height*z)); draw = ImageDraw.Draw(im)
fx, fy = spec['x']['pixel_fit'], spec['y']['pixel_fit']
px = lambda v: (fx[0]*v + fx[1]) * z; py = lambda v: (fy[0]*v + fy[1]) * z
for name, c in spec['curves'].items():
    pts = [(px(x), py(y)) for x, y in c['points']]
    draw.line(pts, fill=(255, 0, 0), width=2)
    for x, y in pts:
        draw.line([(x-9, y), (x+9, y)], fill=(255, 0, 0), width=2); draw.line([(x, y-9), (x, y+9)], fill=(255, 0, 0), width=2)
    draw.text((pts[-1][0] + 12, pts[-1][1] - 8), name, fill=(255, 0, 0))
out = os.path.join(d, '..', 'check', os.path.basename(sys.argv[1]).replace('.json', '.png'))
im.save(out); print('wrote', os.path.normpath(out))
