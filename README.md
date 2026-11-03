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

To run one file:

```
node --test tests/trim.test.js
```

The same command runs in GitHub Actions on every push and pull request (`.github/workflows/test.yml`).

## The research tools

`research/` holds the chart records and the dev-only Python scripts that made them (`scan.py`, `overlay.py`, `tables.py`); `research/README.md` says how to fetch the documents from the `research-archive` branch. None of it is part of the app.
