# Research plan

Milestone 0: how War Wagon's flight model gets built from public research. `docs/kc135-sources.md` is the source register: every source, what it holds, and whether it may be used. This file covers the order of work, and how a plotted chart becomes numbers the code can use. When milestone 0 is done, its results live in `docs/flight-model.md` and `docs/kc135-data.md`, and this file becomes the record of how they were made.

Source IDs (A1, R2, E3 …) are the register's.

## 1. What the model needs, and where it comes from

| Quantity | Sources (register IDs) | Public? |
|---|---|---|
| Geometry: wing, tails, chords, sweep, dihedral, incidence, stabiliser travel | A3's geometry table, cross-checked by A4, R4, A9 (G1); fact sheet A10 | Yes, one stabiliser value to read on the scan |
| Lift, drag and pitching moment, low speed, tail on, flaps | A1 (Mach 0.28), A2 (Mach 0.30) | Yes, plots |
| Lift and pitching moment through cruise Mach (wing-body) | A8 (Mach 0.30–0.80), A3 (Mach 0.50–0.95: drag rise, drag divergence, buffet onset, Mach tuck) | Yes, plots |
| Full-scale cruise lift and drag | A5 (Mach 0.78 polar), A6 (Lux: Mach 0.70–0.80) | Yes, plots; A5's NTRS record to confirm |
| Lateral-directional static derivatives | A1, A2 (tail on, low speed); A7 (wing-body, Mach 0.50–0.95) | Yes, plots |
| Ground effect | A4 | Yes; for landing, later |
| Rate derivatives (Cmq, Clp, Cnr …), inertias, modes | G6 Crenshaw (cleared 31 October 2026): flight-test and FLEXSTAB values at cruise, climb and approach; R1 (707-320B tables) and R2 (Dash 80) as cross-checks | Yes, from a 1973 Boeing summary via the thesis |
| Control effectiveness (elevator, aileron, spoiler, rudder) | G6's rudder derivatives; A1, A2 (aileron and rudder settings, tail incidence); G2's inflight-manual passages for the rudder system; otherwise DATCOM | Partly |
| Engine: ratings, limits | E1 (take-off 22,000 lbf, MCT 21,579 lbf, max N1 102 %) | Yes |
| Engine: thrust with Mach and altitude | E3 (Bartel & Young constants from the open OpenAP paper), E4 to cross-check | Yes; cruise reference thrust is an estimate |
| Engine: spool-up | E5 (5 s from flight idle to 95 % at most; about 1 s time constant above 20 % thrust) | Yes, as a bound and a shape |
| Engine: flight idle N1, the PMC's maximum-N1 schedule | Not public | **Gap**: modelled, see section 4 |
| Surface sizes, travel and rates; stabiliser trim rate | Not public | **Gap**: estimated from three-views and generic transport ratios |
| VSI lag | Not public for the KC-135 | **Gap**: a generic instrument value, stated as such |
| Dutch roll, measured | G2 (Shell 77 board findings: period about 5 s) | Yes, board findings only |
| Validation points | A10 (530 mph at 30,000 ft, 50,000 ft ceiling); G5 (about 240,000 lb, 21,000 ft, 622 ft/s, 2.5° pitch); G4 (zero-g parabolas); A5/A6 cruise polars | Yes |
| Stall speed, Vmca | G6 quotes the 1974 C-135A manuals: stall 107 kt, Vmca 116 kt with rudder boost (conditions to read from the scan); A3 quotes D6-5599's take-off, touchdown and buffet CL by flap setting | Yes, 1960s–70s KC-135A figures, usable under the revised rule; the R's own are not public |
| CG limits, Vmo/Mmo | Not public outside the current T.O.s | **Gap**: 707/720 FAA values (R4) for comparison only |

**The owner's own documents and memory stay out.** The owner flies the jet and holds its current manuals; nothing from them is supplied, quoted or recalled. What is already published with a public-release statement is fair game, old flight-manual-derived figures included, each logged with its provenance. Where the data has a gap, the owner's judgement tunes the feel on the phone, by saying what feels wrong, not by supplying a number.

## 2. The documents

`research/README.md` has the distribution log, and `sh research/fetch.sh` copies the archived PDFs out of the `research-archive` branch. Every scan is read page by page before any number is used: the original research saw these reports only through a text tool that garbled scans and stopped after about 100 pages. In priority order:

| Priority | ID | Source | Why | Status |
|---|---|---|---|---|
| 1 | A1 | NASA TM 73,250 | The only complete tail-on C-135 test: the low-speed model's backbone | Archived |
| 1 | A2 | NASA TP-1119 | Tail on and off, stabiliser settings, aileron effectiveness | Archived |
| 1 | A3 | AFFDL-TR-77-23 | Geometry table, drag rise, buffet, Mach tuck | Archived |
| 1 | G6 | Crenshaw 1976 | **Only its bibliography**, for Owner decision 1. Nothing else from it is used until the owner decides | Archived; bibliography read (section 5) |
| 2 | A8 | NASA TN D-8473 | CL-α and Cm through cruise Mach | Archived |
| 2 | A5, A6 | Montoya; NASA CP-2211 (Lux and Dodson papers) | Full-scale cruise polars | Archived |
| 2 | R1 | Boeing D6-20659 Appendix C (CR-73276) and summary (CR-73277) | Tabulated 707-320B derivatives, Mach 0.1–1.0 | Archived |
| 2 | R2, R3 | NASA TN D-3971, TN D-4804 | Tabulated Dash 80 derivatives, inertias; flight-measured modes | Archived |
| 2 | E3 | Sun et al., *Aerospace* 2020 (CC BY) | The thrust-lapse constants | Archived |
| 3 | A4, A7 | NASA TM-85920, TP-1163 | Ground effect; transonic lateral data | Archived |
| 3 | G2, G5 | Shell 77 report; J. Smith 2007 (AFIT) | The dutch-roll and trim checks | Archived |
| 3 | F2 | Mortensen 1997 (AFIT) | Its bibliography, for Owner decision 1; the boom, later | Archived |
| 3 | E1 | EASA TCDS E.066 | Engine ratings | Read from EASA; not archived (EASA copyright) |
| 3 | E2 | ICAO emissions databank spreadsheet, v32 | Fuel flows, re-keyed from ICAO, not OpenAP | Read; not archived (no licence stated). Its CFM56-2B-1 row matches the register: 97.86 kN, pressure ratio 23.5, fuel flow 0.985 / 0.819 / 0.311 / 0.128 kg/s at take-off, climb-out, approach and idle |

The URLs are in the register and the log.

## 3. How a chart becomes numbers

Most of the data above is plotted, not tabulated. Every chart goes through the same seven steps, so the result is checkable and the next chart is done the same way.

1. **Record the chart.** One entry in `docs/kc135-data.md` per chart: document, figure, page; the x and y quantities and their units; what distinguishes each curve (Mach, flap, stabiliser, tail on or off); the configuration (tunnel or flight, rigid or flexible); the reference area, chord and moment centre the coefficients use.
2. **Read at fixed breakpoints.** Read every curve at the same x values (α every 1° or 2°, Mach at the tested values), not wherever a symbol happens to sit. Then each curve is a row of a table with shared breakpoints, the shape of Rage's F-16 tables, and the same interpolation code reads it. Read past a curve's end only where the chart draws it.
3. **Read twice, independently.** For a chart that matters on its own (the clean data), Claude reads the symbol centres by eye against a fine grid drawn from the calibration (`scan.py --zoom`), from crops no wider than about 12° (or the equivalent) so that a grid step is large on the screen: wider crops read 0.01–0.02 high on the first Cm chart. For the bulk of the plotted pages (the flaps and gear runs) `scan.py --symbols` finds the symbols by their white interiors and takes their centroids, and the eye checks the overlay instead; where several data sets' symbols diverge the automatic curve is marked as not to be trusted and read by eye if it is needed. The second reading is `scan.py`'s pixel scan of the plotted lines at the breakpoints, where the curve is shallow enough for a column scan to find it; the owner's WebPlotDigitizer pass, if made, is a third. Points that differ by more than 1 % of the axis span are read again. The reading accuracy goes in the record.
4. **Overlay check.** `research/overlay.py`, a dev-only script and not part of the app, draws the digitized points over the chart image. The result goes in `research/check/`, and the owner looks at it: a point that misses the curve shows at a glance. Where the document plots the same runs against each other (a CL–Cm panel beside CL(α) and Cm(α)), the derived points are drawn over that panel too: it is a check of all three readings at once, and it caught the first Cm misreading. The overlay also catches a calibration that chose the wrong run of gridlines (the frame can sit one grid step outside the labelled lines, equally spaced): the calibrator now takes that choice explicitly.
5. **Choose the form.** Tables with linear interpolation by default. A formula only where the physics gives the shape: a straight lift curve below stall, or a drag polar CD = CD0(M) + k(M)·CL². Record the fit's largest error against the read points.
6. **Know what the chart is for.** One of three uses:
   - **Model data**, read straight into the tables.
   - **Back-solved data.** In steady level flight thrust equals drag, so a cruise point's weight, altitude, Mach and thrust give CD at a known CL and Mach. The full-scale polars (A5, A6) check or correct the tunnel drag this way.
   - **Acceptance tests.** They become bands in the test layers, the way Rage's performance bands were.
7. **Write down every correction.** Tunnel to full scale (Reynolds number, and the wing bending in flight, using the flight-test comparison); KC-135A to KC-135R (CFM56 nacelles, the larger stabiliser, weight and inertia); moving the coefficients to the chosen CG. Each says what it is, how big, and where it came from.

**The first chart** is A1's basic-configuration CL(α) at flaps 0. It goes end to end through all seven steps before any other chart is read, so the procedure is agreed on one chart.

## 4. Modelling the gaps

Where the data has nothing, the model says so and does something defensible:

- **The PMC's maximum N1.** The PMC holds the engine to its rated thrust. War Wagon caps the thrust at the rated take-off (or MCT, below the detent) thrust lapsed with Mach and altitude by E3, and shows the N1 that gives that thrust. So the maximum N1 changes with altitude as the owner described, without a schedule from a manual. The N1-to-thrust map is a stated approximation.
- **Flight idle.** A thrust fraction a little above the 5–7 % ground idle in E5's notes, stated as an assumption, with its N1 from the same map.
- **Surface travel and rates, stabiliser trim rate.** Estimated from three-views and generic transport ratios, then tuned to feel by the owner on the phone.
- **VSI lag.** A generic instrument lag, stated as such.

## 5. Owner decisions

The register's section 7 lists six. Two matter for milestones 0 and 1:

1. **Crenshaw's thesis** (decision 1). Its bibliography (thesis page 104, PDF page 117, one page, eleven entries) was read from the scan on 31 October 2026. The entries that matter:
   - **Ref 7**, the source of the inertias and the flight-test derivatives: *"Summary of the Stability, Control and Flying Qualities Information for All the -135 Series."* Seattle: The Boeing Commercial Airplane Company, October 1973. A Boeing engineering summary. By its title it is not a T.O., not a flight manual, and not the flight-manual substantiation report (that is D6-5599, 1964, a different document).
   - **Ref 9**: T.O. 1C-135A-1, *Flight Manual USAF Series C-135A and B Aircraft*, September 1974. **Ref 10**: T.O. 1C-135B-1-1, *Flight Manual … Performance Data*, October 1974. Both are flight manuals, so the register was right to strike the stall speed (Ref 9) and the minimum control speed (Ref 10). Nothing else in the thesis cites them.
   - Ref 2 is Boeing's Phase I winglet report (February 1976), Ref 3 is NASA TN D-8267, Ref 4 the FLEXSTAB manual, Ref 6 Roskam, Ref 8 MIL-F-8785B.

   **Mortensen 1997** (F2), whose tanker condition and inertias repeat Crenshaw's, does not cite Crenshaw or any Boeing document. Its bibliography (thesis page 142) has Russell's 1984 AFIT thesis on KC-135 controllers, Locken's 1993 thesis (excluded by the register as T.O.-based), Campbell 1989 on the boom, and telephone interviews with two Boeing Wichita engineers. So Mortensen's numbers don't add provenance to Crenshaw's; they stand or fall with it.

   **Decided, 31 October 2026: use it.** The thesis's inertias, flight-test and FLEXSTAB derivatives and modes go into `docs/kc135-data.md`, each labelled with its lineage (the 1973 Boeing summary, via Crenshaw). The same day the owner revised the data rule (CLAUDE.md): their own Air Force documents stay out, but published public-release material is fair game even where it quotes an old T.O., so the two speeds Crenshaw quotes from the 1974 manuals are usable too, as 1970s KC-135A figures.
2. **D6-5599's two items in AFFDL-TR-77-23** (decision 2): usable under the revised rule, as checks on the tunnel data. **CR-66125/66126** (decision 3): the register's advice stands, not needed unless the Dash 80 reports prove insufficient.

Decisions 4 to 6 are about the boom and refuelling, which is parked.

## 6. Other decisions during milestone 0

- The gross weight and fuel load, and the CG they give, from public figures only. G5's 240,000 lb flight-test point is a candidate.
- The air-start speed at 10,000 ft.
- Which gaps DATCOM fills, and which come from re-referencing the 707-320B (R1) or the Dash 80 (R2).
