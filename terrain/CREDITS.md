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
- `places.png`: the fine patches at the survey's own 50 m posts, 1,024 posts
  (51.2 km) a side unless a place needs more, packed into one atlas:
  Mildenhall, 1,536 posts (76.8 km) about 52.32° N 0.54° E, taking in RAF
  Mildenhall, RAF Lakenheath, Ely, Cambridge, Newmarket and Bury St Edmunds.
  The owner's low-level routes add the rest.
- Nested inside Mildenhall's patch, **Mildenhall and Lakenheath**: 12.8 km
  (eastings 565.6 to 578.4 km, northings 272.6 to 285.4 km) at 5 m posts,
  from the Environment Agency's **LiDAR Composite DTM** (1 m, bare earth,
  England), Open Government Licence v3.0, © Environment Agency copyright
  and/or database right 2026, fetched from its WCS service
  (environment.data.gov.uk/spatialdata/lidar-composite-digital-terrain-model-dtm-1m)
  by `fetch-lidar.py`. Each 5 m post is the mean of 25 of the survey's cells;
  voids are filled from OS Terrain 50 and the water is OS Terrain 50's read
  at its posts. It blends into the OS patch over 500 m.
- The blue channel of both is water: how much of each post is sea, lake or
  reservoir, found in the survey as regions of one height (the sea at or
  below half a metre and connected to the open sea; a lake at least half a
  square kilometre in a basin).

The ground's colour is made by `make-imagery.py` from Sentinel-2 satellite
imagery: the Sentinel-2 quarterly cloudless mosaic for July to September
2026, true colour, exported by the owner from the Copernicus Browser
(https://browser.dataspace.copernicus.eu/) as 8-bit GeoTIFFs in WGS 84:
the island in two halves (each 2,500 pixels a side, the free export's
limit, about 250 m a pixel) and the Mildenhall patch's box (about 32 m a
pixel). **Contains modified Copernicus Sentinel data 2026**, free and open
under the Copernicus data licence. Each post's colour is the mean of four
samples of the source at its latitude and longitude, found from the grid
through the inverse of the projection; one fixed lift of contrast and
saturation is applied to every tile alike.

- `base-colour.jpg`: the base's colour on its own posts, 3,001 by 5,001.
- `places-colour.jpg`: the patches' colour on their own posts, in the same
  atlas layout: the OS patch at 50 m from the 32 m export, the LiDAR patch
  at 5 m from the same export, so it is no sharper than the 32 m source.

The images are sent to the GPU whole, so the base's longer side (5,001) must stay under the device's texture limit; every iPhone the app supports allows 16,384, and the app refuses to fly on a device that allows less rather than draw a shrunken, wrong ground.

`preview.png`, if present, is the script's picture of the base for checking
by eye and is not part of the app.
