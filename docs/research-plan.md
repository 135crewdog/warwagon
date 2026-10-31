# Research plan

Milestone 0: how War Wagon's flight model gets built from public research. This file covers what we need, where it might come from, and how a plotted chart becomes numbers the code can use. When milestone 0 is done, its results live in `docs/flight-model.md` and `docs/kc135-data.md`, and this file becomes the record of how they were made.

## 1. What the model needs

Each row is a quantity the simulation can't run without, with the sources to try, best first.

| Quantity | Why it matters | Sources to try |
|---|---|---|
| Geometry: wing area, span, MAC, sweep, dihedral, tail areas and arms | Every coefficient is scaled by them | USAF fact sheet; the TP-1163 model description (it's a KC-135A wing); the winglet flight-test papers |
| Weight, fuel and CG | One fixed condition for the whole sim | Fact sheet (empty and maximum weights, fuel capacity); choose a mid-mission tanker |
| Inertias Ixx, Iyy, Izz, Ixz | The rotational equations of motion | Not published for the KC-135 as far as we know. Scale from CR-2144's CV-880M and B-747 by mass and size, and label it as an estimate |
| Lift CL(α, M), clean | Trim, stall, turn | TP-1163 (high subsonic), TP-1119 (Mach 0.30); full-scale lift-curve slope from the winglet flight test |
| Drag CD(CL, M), clean, including drag rise | Cruise speed, climb, the descent | TP-1163; the winglet flight test (baseline wing, M 0.70 to 0.82); back-solved from cruise data (section 3, use b) |
| Pitching moment Cm(α, M), elevator and stabilizer effectiveness | Static stability, trim, Mach tuck | TP-1163; the stabilizer is not on the wing-fuselage model, so the tail part comes from CR-2144-class data and DATCOM |
| Lateral-directional: Cyβ, Clβ, Cnβ, aileron, spoiler, rudder | Dutch roll, roll response, coordination | TP-1163 and TP-1119 (wing and fuselage); CR-2144 for the whole aircraft |
| Damping: Cmq, Clp, Cnr, Clr, Cnp | Mode damping | CR-2144 (CV-880M, B-747), scaled; DATCOM |
| Engine: thrust (N1, M, h), flight idle, MCT, maximum, PMC maximum N1 against altitude, spool time | Thrust, the throttle's feel | CFM56-2 and F108 public figures; a generic high-bypass lapse model; fuel flow only to back-solve drag |
| Control limits and rates: elevator, aileron, spoiler, rudder, stab trim | Actuators and the automatic trim | Public descriptions of the 707 and C-135 controls; to find |
| Yaw damper | Dutch-roll damping | Its structure from public 707-class descriptions; the gains are ours to tune |
| VSI lag | The HUD's VSI | Public instrument data for a lagged VSI; to find |
| Performance for the acceptance tests: stall speeds, cruise Mach, ceiling, maximum speed, climb | Test layer 3 | Fact sheet; public-release documents only |

## 2. Reading list

These are US Government works, public domain unless noted. NTRS (`ntrs.nasa.gov`) is blocked in Claude's cloud session, so the owner downloads each PDF and uploads it into `research/` under the file name given. The titles and numbers below come from search results and abstracts. Each one's contents is confirmed only once its PDF is in `research/` and has been read; the "Read" column records that.

| File name | Document | What we want from it | Read |
|---|---|---|---|
| `tp1163.pdf` | Jacobs, *Effect of winglets on a first-generation jet transport wing. V: Stability characteristics of a full-span wing with a generalized fuselage at high subsonic speeds*, NASA TP-1163, 1978. A 0.035-scale KC-135A wing in the Langley 8-ft transonic pressure tunnel. https://ntrs.nasa.gov/api/citations/19780012138/downloads/19780012138.pdf | The baseline wing's CL, CD and Cm against α at each Mach; the lateral-directional derivatives | |
| `tp1119.pdf` | Meyer, *… IV: Stability characteristics for a full-span model at Mach 0.30*, NASA TP-1119, 1978. https://ntrs.nasa.gov/api/citations/19780010054/downloads/19780010054.pdf | The low-speed side of the same data; aileron effectiveness | |
| `tnd8474.pdf` | Montoya, Flechner & Jacobs, *… II: Pressure and spanwise load distributions for a semispan model at high subsonic speeds*, NASA TN D-8474, 1977. https://ntrs.nasa.gov/api/citations/19780012122/downloads/19780012122.pdf | Lower priority: the model's geometry, and the spanwise lift for a check of the wing's lift | |
| `cp2211-*.pdf` | *KC-135 Winglet Program Review*, NASA CP-2211, Edwards, September 1981: the overview (Barber & Selegan), in-flight lift and drag (Lux), fuel mileage (Dodson), loads and pressures (Montoya et al.). NTRS 19840019618 to 19840019624 | Full-scale baseline-wing lift and drag at M 0.70 to 0.82, 34,000 to 39,000 ft; W/δ cruise points; stability and control notes | |
| `cr2144.pdf` | Heffley & Jewell, *Aircraft Handling Qualities Data*, NASA CR-2144, 1972. https://ntrs.nasa.gov/citations/19730003312 (also hosted at robertheffley.com) | The CV-880M and B-747 derivatives and modes: inertias, damping, lateral-directional derivatives, short-period, phugoid and dutch-roll numbers to scale and compare against | |
| `factsheet.pdf` | USAF KC-135 Stratotanker fact sheet (af.mil) | Dimensions, weights, fuel, thrust, ceiling, speed | |
| (to find) | CFM56-2 / F108 public data: type certificate data sheet for the CFM56-2 family, manufacturer brochures | Static thrust, bypass ratio, N1 limits | |
| (to find) | A public generic high-bypass turbofan thrust-lapse model. Bartel & Young, *J. Aircraft* 45(4), 2008, is the well-known one but is paywalled (AIAA): use it only if the owner has access, and cite it | Thrust against Mach and altitude | |
| (to find) | Public-release KC-135 or C-135 performance data (DTIC, declassified or historical KC-135A manuals) | Stall speeds, cruise, climb, PMC schedule for the acceptance tests and the engine | |
| (method) | USAF Stability and Control DATCOM (public, approved for release) | Estimates for whatever the reports leave out, each labelled as an estimate | |

Cross-check only, never copied: any open-source KC-135 or 707 model in JSBSim or FlightGear. As with Rage, numbers are re-keyed from primary sources.

## 3. How a chart becomes numbers

Most of the data above is plotted, not tabulated. Every chart goes through the same seven steps, so the result is checkable and the next chart is done the same way.

1. **Record the chart.** One entry in `docs/kc135-data.md` per chart: document, figure, page; the x and y quantities and their units; what distinguishes each curve (Mach, cant, flap, with or without the tail); the configuration (baseline wing, tunnel or flight, rigid or flexible); the reference area, chord and moment centre the coefficients use.
2. **Read at fixed breakpoints.** Read every curve at the same x values (α every 1° or 2°, Mach at the tested values), not wherever a symbol happens to sit. Then each curve is a row of a table with shared breakpoints, the shape of Rage's F-16 tables, and the same interpolation code reads it. Read past a curve's end only where the chart draws it.
3. **Read twice, independently.** Claude reads the chart image at its grid lines; the owner, or a second pass, reads it with WebPlotDigitizer (free, runs in the browser). Points that differ by more than about 1 % of the axis span are read again. The reading accuracy goes in the record.
4. **Overlay check.** `research/overlay.py`, a dev-only script and not part of the app, draws the digitized points over the chart image. The result goes in `research/check/`, and the owner looks at it: a point that misses the curve shows at a glance.
5. **Choose the form.** Tables with linear interpolation by default. A formula only where the physics gives the shape: a straight lift curve below stall, or a drag polar CD = CD0(M) + k(M)·CL². Record the fit's largest error against the read points.
6. **Know what the chart is for.** One of three uses:
   - **Model data**, read straight into the tables (lift, pitching moment, derivatives).
   - **Back-solved data.** In steady level cruise, thrust equals drag. A cruise chart's weight, altitude, Mach and fuel flow, with the engine's specific fuel consumption, give thrust, so drag, so CD at a known CL and Mach. That checks or corrects the drag polar.
   - **Acceptance tests**: stall speed, ceiling, climb, cruise. They become bands in test layer 3, the way Rage's performance bands were.
7. **Write down every correction.** Wind tunnel to full scale (Reynolds number, and the wing bending in flight, using the flight test's comparison); KC-135A to KC-135R (same airframe, new engines and weight); moving the coefficients to the chosen CG. Each correction says what it is, how big, and where it came from.

**The first chart** is the TP-1163 baseline wing's CL(α) at its transonic Mach numbers. It goes end to end through all seven steps before any other chart is read, so the procedure is agreed on one chart.

## 4. Decisions to make during milestone 0

- The gross weight and fuel load, and the CG they give.
- The air-start speed at 10,000 ft.
- The elevator, aileron, spoiler, rudder and stab-trim limits and rates.
- The PMC maximum-N1 schedule, and the N1 at flight idle and MCT.
- The VSI's lag time.
- Which gaps DATCOM fills, and which come from scaling the CV-880M and B-747.
