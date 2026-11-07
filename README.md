# War Wagon

A KC-135R flight sim for iPhone, at `https://135crewdog.github.io/warwagon/`. `CLAUDE.md` says what it is and the rules it's built under; `docs/flight-model.md` is the authority on the simulation and `docs/kc135-data.md` holds its numbers, with `research/` the charts they were read from.

## Running the tests

You need Node 20 or later and nothing else: there are no dependencies to install.

```
node --test
```

This runs every test under `tests/` except the browser test. The tests print what they measured, not just pass or fail:

- `tests/aero.test.js` checks every table in `src/sim/data/aero.js` against the chart record in `research/charts/` it was keyed from, and the derived constants against the sections of the flight model that define them.
- `tests/trim.test.js` prints the trim solver's answers next to Crenshaw's flight conditions, the 1998 trim point and Lux's flight-measured drag polar.
- `tests/engine.test.js` prints the thrust cap's spot values, the spool time and the N1 shown.
- `tests/flight/performance.test.js` prints the cruise margin, the service ceilings and the zero-g parabola next to the public figures.
- `tests/flight/modes.test.js` linearises the bare airframe at the three tuning conditions and prints the short period, phugoid, dutch roll (bare and damped), roll and spiral modes next to the flight-test values.
- `tests/flight/manoeuvres.test.js` flies the closed-loop checks of `docs/flight-model.md` 12.2 (rolls, hands-off throttle changes, the pull, the stall, the drag rise, random inputs) and prints what each measured.

To run one file:

```
node --test tests/trim.test.js
```

## Flying headless

To watch the controls work, fly a manoeuvre from the command line and read the time history:

```
node tests/flight/fly.js idle --every=5
node tests/flight/fly.js roll --h=10000 --kcas=280 --every=0.5
node tests/flight/fly.js pull --nodamper
node tests/flight/fly.js modes
```

Run it with no arguments for the list of manoeuvres. Options are `--h` (ft), `--kcas`, `--t` (seconds), `--every` (print interval), `--throttle`, `--seed`, and `--notrim`, `--nodamper`, `--nocoord` to switch an automatic off. `modes` prints the linearised modes. The gains live in `src/sim/data/controls.js`; change one, fly again, and the difference is in the table.

The same command runs in GitHub Actions on every push and pull request (`.github/workflows/test.yml`).

## The browser smoke test

`tests/browser/smoke.js` loads the app in headless Chromium at an iPhone-sized landscape viewport, taps Fly, feeds simulated tilt and checks that it renders and the jet responds. It needs Playwright with Chromium, which is a developer tool and not part of the app:

```
npm install --no-save playwright
npx playwright install chromium
node tests/browser/smoke.js            # pass a folder to save screenshots: node tests/browser/smoke.js shots
```

CI runs it on every push. Nothing replaces the phone: headless Chromium is not iOS.

## Deploying

**The ground.** `terrain/` holds the heightmaps the app draws, made once by `terrain/make-heightmap.py` from Ordnance Survey's OS Terrain 50 (the ASCII grid download of Great Britain from the OS Data Hub, free under the Open Government Licence; `terrain/CREDITS.md`). It needs Python with numpy and scipy, about 3 GB of memory and five minutes:

```bash
python3 terrain/fetch-lidar.py 565600 272600 578400 285400 lidar/
```

```bash
python3 terrain/make-heightmap.py terr50_gagg_gb.zip terrain/ lidar/
```

The first fetches the Environment Agency's 1 m LiDAR for the two bases' box from its WCS service into `lidar/` (about 800 MB, not committed; a minute or two); the second writes `base.png` (the island at 200 m posts), `places.png` (the fine patches: OS Terrain 50 at 50 m, the LiDAR at 5 m) and `region.json`, plus `preview.png`, a picture of the base for checking by eye that is not committed. To add a place, add a line to `PATCHES` in the script (a centre for an OS patch, a grid box for a LiDAR one, fetched first) and run it again; the base does not change. The tests read the real files (`tests/terrain.test.js` checks the summits, the seas and the Fens).

Pushing to `main` runs the tests and publishes the app to GitHub Pages (`.github/workflows/pages.yml`). Phones keep the version they have until a new one is offered on the start or pause screen, which happens only when `APP_VERSION` in `src/version.js` and `VERSION` in `sw.js` change: bump both with every change to anything the app serves. The debug overlay at `?debug=1` shows the raw sensor angles, the derived pitch and roll, the yoke, n_z, α, β, the surfaces, N1 and the frame rate. The icons are drawn by `icons/make-icons.mjs`.

## The research tools

`research/` holds the chart records and the dev-only Python scripts that made them (`scan.py`, `overlay.py`, `tables.py`); `research/README.md` says how to fetch the documents from the `research-archive` branch. None of it is part of the app.
