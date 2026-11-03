# War Wagon

A KC-135R flight sim for iPhone. `CLAUDE.md` says what it is and the rules it's built under; `docs/flight-model.md` is the authority on the simulation and `docs/kc135-data.md` holds its numbers, with `research/` the charts they were read from.

## Running the tests

You need Node 20 or later and nothing else: there are no dependencies to install.

```
node --test
```

This runs every test under `tests/`. The tests print what they measured, not just pass or fail:

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

## The research tools

`research/` holds the chart records and the dev-only Python scripts that made them (`scan.py`, `overlay.py`, `tables.py`); `research/README.md` says how to fetch the documents from the `research-archive` branch. None of it is part of the app.
