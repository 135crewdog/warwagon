# War Wagon

A KC-135R/T Stratotanker flight sim for iPhone, flown over the UK. You fly by tilting the phone, held in landscape like a yoke, with the throttles under your left thumb. No missions, no story, no score: the flying is the game. It will be a home-screen web app hosted on GitHub Pages at `https://135crewdog.github.io/warwagon/`.

The owner is a pilot and builds these apps to learn. War Wagon follows Rage (`https://github.com/135crewdog/rage`), an F-16 sim built the same way, and reuses its code wherever it fits. Rage is about real-time 3D, flight physics and fly-by-wire; War Wagon is about a big, conventionally controlled jet, where the aircraft's own stability is what you feel, and about turning published research and its charts into a flight model.

## The project rules

1. **REAL.** The jet flies by physics and its flight controls, from public KC-135 data, never by shortcuts that point it where the player wants. `docs/flight-model.md` will be the authority on everything in the simulation; `docs/kc135-data.md` will hold its numbers. If something feels wrong, the fix goes in the model, the flight controls or the input mapping.
2. **SIMPLE.** Plain HTML, CSS and JavaScript (ES modules). No framework, no build step, no runtime dependency except three.js, copied into the repo. When in doubt, choose fewer files, features, settings and words.
3. **FUTURE-PROOF.** It works offline, depends on as little as possible, and keeps working for years without maintenance.

The owner's design philosophy applies to everything a person sees or touches: https://135crewdog.github.io/hig/. Read it. Its baseline says a departure from it needs a reason, written down; this file's "Departures" section is where those reasons live.

**Working rules.**
- Build only the current milestone. Ask before adding anything this file doesn't describe. Ideas discussed and not adopted are under "Parked"; don't build them without asking.
- Propose a solution and agree it with the owner before building anything that isn't already specified here.
- Work in pull requests. A pull request waits for the owner's review; never merge one unasked.
- Every pull request description ends with a short **What this teaches** section: the one to three ideas in it worth understanding, in plain words, the way you'd explain them to a pilot who isn't a programmer. No jargon without a one-line explanation. Keep it short.
- When a test can't pass, stop and report what you found with numbers. Never loosen a test to make it pass.
- **The owner's rule on data.** Never use data from official US Air Force flight manuals or performance manuals (any T.O. 1C-135 series Dash-1, its performance supplements, checklists, air-refuelling T.O.s such as 1-1C-1, engine T.O.s), whether found directly, leaked, or quoted second-hand, unless the document carries a very clear and legally sturdy releasability statement. Even then, nothing from it is used without the owner's explicit permission. That includes the owner's own memory of the manual: where the data has a gap, the owner tunes the feel, not the numbers. `docs/kc135-sources.md` is the source register and says how the rule was applied; nothing marked there as an owner decision is used until the owner decides. Every upload's distribution statement is logged in `research/README.md` before it is read. Re-key numbers from primary sources; never copy files from other sims (several are GPL).
- **The raw research notes stay out of this repo.** Some hold numbers from sources awaiting an owner decision. Only the register is here.

## Milestones

| # | Scope | Status |
|---|---|---|
| 0 | **The data.** Read the sources in `docs/kc135-sources.md`, digitize their charts by the procedure in `docs/research-plan.md`, and write `docs/flight-model.md` and `docs/kc135-data.md`. No app code. | In progress: source register done; every source archived or logged; Owner decision 1 waiting on the owner (`docs/research-plan.md` section 5); the first chart under way |
| 1a | **Simulation core.** Atmosphere (1976 standard, tropopause included), aero with Mach effects, four F108 engines, actuators, equations of motion, trim solver, air data. Rage's `src/sim/` reused where it fits. Test layers 1 and 3 passing. No visuals. | Not started |
| 1b | **Flight controls, tuned.** Yoke to surfaces, spoiler roll assist, automatic trim, yaw damper with automatic coordination. Test layer 2 passing, and a headless flight script that prints time histories. | Not started |
| 1c | **The app.** A flat world, the placeholder jet, chase camera, HUD, UI, tilt, throttle, menus, PWA, Pages. Ends with the owner flying it on the iPhone. | Not started |
| 2 | **The UK.** A coarse base tile with six fine patches, imagery, water, earth curvature in the view, a place to choose on the start screen. | Not started |

Later milestones get specified when milestone 2 is done: the aircraft's features (landing gear with ground contact and wheel brakes, flaps, speed brakes, takeoff and landing at Mildenhall), then sound and a better 3D model.

## What changes from Rage

- **No fly-by-wire.** The KC-135's controls are reversible and tab-driven: the yoke moves the surfaces, and the pilot feels the aircraft's own static stability, phugoid and dutch roll. The stability derivatives have to be right, because nothing hides them.
- **All trim is automatic** (see Departures). The stabilizer trims itself at the real stab-trim rate to unload the elevator, so with the yoke released the jet holds 1 g at whatever speed it has. The rate limit keeps the trim lag visible: a big speed change still needs the yoke for a few seconds while the trim catches up.
- **All rudder input is automatic** (see Departures). There are no pedals. The yaw damper is real; automatic turn coordination on top of it (lateral-acceleration feedback that centres the ball, as in Rage's F-16) is ours.
- **Mach is core.** The jet cruises at Mach 0.78 to 0.80, so drag rise and Mach tuck are in the aero data from the start, not a patch.
- **One weight, for good.** A reasonable gross weight and fuel load, chosen and justified in milestone 0, fixed for the whole sim. No fuel burn.
- **The world is seen from far up.** At FL300 the horizon is about 200 nm away. The simulation keeps a flat earth; the renderer drops the terrain by d²/2R in its vertex shader, and the far plane and fog grow to match.

## The aircraft and the world

- **The jet** is, for now, a low-poly placeholder built in code (`src/render/kc135.js`) from the fact sheet's dimensions: a lathed fuselage, wings swept 35° with dihedral, four engine pods on pylons, the fin, the stabilizer and the boom. Its elevators, ailerons, spoilers, rudder and stabilizer are separate named parts that move every frame to the simulation's actuator positions. A glTF model with the same part names can replace it later without touching anything else.
- **Air start** (milestone 1): 10,000 ft over a flat world, wings level, trimmed for 1 g, at a speed chosen in milestone 0. The throttle starts at the trim setting.
- **The world** (milestone 2): the UK, in the British National Grid projection, through Rage's terrain pipeline (`make-heightmap.py`, `make-imagery.py`, the geometry clipmap, the CPU heightmap). A coarse base of about 200 m posts covering roughly 51.2° to 54.9° N and 4.3° W to 1.0° E, and six fine patches:
  - RAF Mildenhall, with Lakenheath
  - the Mach Loop (LFA 7)
  - London
  - the Lake District (LFA 17: Thirlmere, Dunmail Raise)
  - RAF Fairford with Brize Norton
  - the Peak District (Ladybower and the Derwent dams)

  Heights from Copernicus GLO-30 for the base and OS Terrain 50 (Open Government Licence), GLO-30 or LiDAR for the patches; colour from Sentinel-2 imagery; the sea and the Lake and Peak reservoirs painted as water.
- **Crash:** below the ground that is there the flight ends, as in Rage.

## Throttle and engines

- One slider for all four engines, along the left edge, as in Rage.
- **The bottom is flight idle N1.**
- **A detent at MCT** (maximum continuous thrust): the thumb has to cross a small gap to go above it, up to maximum (takeoff) thrust.
- **The maximum N1 changes with altitude** (and Mach), as the F108's power management controls (PMCs) stop the engines over-boosting. The PMC's schedule isn't public, so the model caps thrust at the certified rating (take-off 22,000 lbf, or MCT below the detent, from EASA's type certificate) lapsed with Mach and altitude, and shows the N1 that gives it. The slider asks for a fraction of what's available at the present condition.
- **The spool lag is real**: slow near idle, about a 1 s time constant above 20 % thrust, and flight idle to 95 % in under 5 s, the certification ceiling.

## HUD

A Rage-style green HUD, with tanker numbers (see Departures: the real jet has none). Thin green symbols and numbers with a dark outline, no backgrounds, inside the safe area.

- **KIAS** on the left, **Mach** under it.
- **Altitude** in feet on the right, with the **VSI** at the top of the altitude display: a signed number (+ climbing, − descending) in feet per minute, lagged like a real vertical speed indicator. The KC-135's lag isn't public; a generic instrument value is used and stated.
- **Heading** across the top, degrees true.
- **Pitch ladder** with the horizon line, the **flight path marker** and the **waterline**.
- **N1 %**, from the engines, not the slider, so the spool lag shows.

## Departures

- **A HUD on a jet that has none.** The KC-135 has round dials or, after Block 45, glass displays. On a phone flown by tilt there's no room for a panel, and a green HUD reads against sky and ground. The owner chose it.
- **All trim is automatic.** The real KC-135 is trimmed by hand. The phone has no free thumb for a trim switch, and the owner chose automatic trim. It moves at the real trim rate, so the lag stays real.
- **All rudder input is automatic.** The real pilot coordinates with the rudder pedals. The phone has no pedals; the yaw damper is real, and the coordination on top of it is ours.
- From Rage, unchanged: a full-screen app shell that doesn't scroll; the HUD ignores the theme; focused on an iPhone held in landscape.

## Platform rules

Rage's apply unchanged (iPhone Safari, iOS 18.4 and later): motion permission requested synchronously in the Fly tap; no orientation lock, so a rotate screen in portrait; a screen wake lock; a home-screen app with `viewport-fit=cover`; no scrolling, zooming or selecting; a fixed-step physics loop with interpolation for 30, 60 and 120 Hz screens; three.js WebGL2, pixel ratio capped at 2, no shadows. The origin `135crewdog.github.io` is shared with Rage and the owner's other apps: prefix every cache with `warwagon-` and every storage key with `warwagon.`, and only ever delete caches that start with `warwagon-`. Every path is relative (`./`). The service worker never calls `skipWaiting()` on its own; updates are offered on the pause or start screen only.

## Testing

`node --test`, with nothing installed, and three layers, because there's no book check case this time:

1. **The model is the data.** Each table reproduces its digitized source points; the trim solver reproduces the cruise points back-solved from the charts.
2. **It handles like a 707-class jet.** Short period, phugoid, dutch roll with and without the yaw damper, roll response and spiral mode inside bands from MIL-F-8785C (Class III), checked against the Shell 77 board's measured dutch roll (about 5 s), the Dash 80's flight-measured modes, and Crenshaw's flight-test modes if Owner decision 1 clears them. Plus tests of the automatic systems: released yoke after a throttle change holds 1 g at the trim rate; sideslip stays in its band in full-yoke rolls; the VSI's lag; the thrust cap at sea level, FL200 and FL350.
3. **It performs like a KC-135R**, from public figures only: 530 mph at 30,000 ft and the 50,000 ft ceiling (the fact sheet), the 1998 flight-test trim point (about 240,000 lb, 21,000 ft, 622 ft/s, 2.5° pitch), the full-scale cruise polars, and the zero-g parabola. Stall speeds, Vmo/Mmo and CG limits aren't public outside the T.O.s, so they're compared with the 707/720's FAA values, not tested.

Plus Rage's browser smoke test and a debug overlay at `?debug=1`. Nothing replaces the phone.

## Versioning

One version string, `APP_VERSION` in `src/version.js`, the same value as `VERSION` in `sw.js`. Bump both with every change to anything the app serves.

## Deliberately not in the game

Missions, scores, a story, weapons, multiple aircraft, a cockpit view, fuel burn, and everything `docs/flight-model.md` will list as out of scope.

## Parked

Discussed, not adopted yet; to take up when gear, flaps, speed brakes and brakes are added. Ask before building.

- **Autopilot, two independent axes.** "Pitch: altitude hold" holds the altitude at the moment the button is pressed; "Roll: heading" holds the heading at the moment it is pressed. Each engages and disengages on its own.
- **Ground idle** on the ground; flight idle stays the bottom of the throttle in the air.
- **Automatic wheel brakes:** on the ground with the throttle at idle, the brakes are applied.
- **Speed bugs on the speed tape:** gear transit speed, flap extension speeds, approach speed, Vref.
- **Speed limits with annunciators:** a configuration change outside its limit refuses to happen and a caution flashes. For example, flaps 0 to 20 above 230 KIAS: the flaps don't move and "CHECK SPEED" flashes.
- **Air refuelling** with a receiver.
- **Rudder pedals and an engine-out**, which need the rudder off automatic.
