# Terrain

The ground is made by `make-heightmap.py` from Ordnance Survey's
**OS Terrain 50**, the 50 m digital terrain model of Great Britain, OS
OpenData under the Open Government Licence v3.0, downloaded from the OS
Data Hub (https://osdatahub.os.uk/downloads/open/Terrain50) as the ASCII
grid of the whole country. Contains OS data © Crown copyright and database
right 2026. Everything is in the British National Grid (EPSG:27700), the
data's own projection, so nothing is reprojected: the fine patches are the
survey's posts themselves and land on the coarse base exactly. `region.json`
says where each lies.

- `base.png`: mainland Britain with its islands (Shetland and Scilly
  excepted), eastings 60 to 660 km and northings 0 to 1,000 km, as a 4 × 4
  block mean of the survey: 3,001 by 5,001 posts 200 m apart. The sea, which
  the survey holds as a constant per tile and leaves out where a tile is all
  sea, is set to 0 m and marked as water.
- `places.png`: the fine patches, 1,024 posts of 50 m a side each (51.2 km),
  the survey's own posts: RAF Mildenhall with Lakenheath (about 52.36° N
  0.49° E). The owner's low-level routes add the rest.
- The blue channel of both is water: how much of each post is sea, lake or
  reservoir, found in the survey as regions of one height (the sea at or
  below half a metre and connected to the open sea; a lake at least half a
  square kilometre in a basin).

`preview.png`, if present, is the script's picture of the base for checking
by eye and is not part of the app.
