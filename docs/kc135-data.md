# KC-135 data

The numbers War Wagon's flight model runs on. `docs/flight-model.md` will say how to use them; this file only holds data, and says where each number came from and how well it is known. `docs/kc135-sources.md` is the source register (the IDs below are its), and `docs/research-plan.md` section 3 is the procedure every chart goes through.

**How a chart entry reads.** Each chart has a record (document, figure, page, axes, conditions, reference quantities), the points as read, a table at fixed breakpoints, the comparison of two independent readings, the fit if one is used, and the corrections still to apply. The machine-readable twin of each record is `research/charts/<chart>.json`, with the chart image beside it; `research/overlay.py` draws the points over the image into `research/check/`, and `research/scan.py` makes the second reading from the pixels.

**Units.** Degrees, feet and pounds where the sources use them; model dimensions in centimetres as the reports give them. Coefficients are on the full-scale reference quantities of section 1, which the model's reference quantities scale to exactly.

---

## 1. Reference geometry

From A1's model geometry table (NASA TM 73,250, table 1), a 0.035-scale KC-135A, divided by the scale. The full-scale values agree with the register (A3's geometry table and the FAA's 707-120/720 sheets):

| Quantity | Model (A1) | Full scale | Register |
|---|---|---|---|
| Wing area S | 2,768.91 cm² | 226.0 m², 2,433 ft² | 2,433 ft² |
| Span b | 139.569 cm | 39.88 m, 130.8 ft | 130.8 ft |
| Mean aerodynamic chord c̄ | 21.51 cm | 6.146 m, 242.0 in | 241.9 in |
| Moment centre | M.S. 75.27 cm, W.L. 17.98 cm | 0.25 c̄ | 0.25 MAC (A2, A3) |
| Wing sweep, 0.25 chord | 35° | | |
| Wing dihedral, incidence | 7°, 2° | | |
| Aspect ratio, taper ratio | 7.035, 0.33 | | |
| Horizontal tail area, span | 569.48 cm², 42.34 cm | 46.5 m², 500 ft²; 12.10 m | |
| Horizontal tail incidence range (model) | +0.5° to −14° | | |
| Vertical tail area | 383.68 cm² | 31.3 m², 337 ft² | |

The model's horizontal-tail area ratio is 0.206 of the wing.

---

## 2. Lift

### 2.1 CL(α), tail on, flaps up, Mach 0.28: A1 figure 8(a), data page 28

**Record.**

| | |
|---|---|
| Document | A1, NASA TM 73,250 (Hedstrom & Whitcomb, April 1977), Ames 12-Foot Pressure Wind Tunnel |
| Figure | 8(a), *Longitudinal aerodynamic characteristics in pitch, gear up*, data page 28 (PDF page 62), top-left panel |
| Axes | α, angle of attack of the fuselage reference line, deg, −10 to 20, gridlines every 2.5°; CL, stability-axis lift coefficient, lift/q̄S, −0.75 to 1.25, gridlines every 0.25 |
| Conditions | Mach 0.28; unit Reynolds number 19.69 × 10⁶ /m (4.2 × 10⁶ on the model's c̄); β 0; flaps 0; ailerons 0; rudder 0; gear up |
| Curves read | ZHG001 (□) **WBNH0V**: basic configuration, horizontal tail at 0° incidence. ZHG004 (○) **WBNH6V**: basic configuration, horizontal tail at 6° incidence, trailing edge up |
| Curves not read | ZHG002 (◇) and ZHG003 (△): the same two tail settings with the NKC-135's radomes, pods and inlets added. They lie on top of the basic curves in lift |
| Reference | The model's S and c̄ of section 1; moment centre at 0.25 c̄ (not used for CL) |
| Corrections already in the data | Tunnel-wall interference and blockage, applied by the report (its data-reduction section). No stream-angle correction. The report's repeatability: CN ± 0.025, α ± 0.04° |
| Image | `research/charts/A1-fig8-p28-CL.png`, the panel cut from the page rendered at 400 dpi |
| Calibration | Pixel positions of the 13 vertical and 9 horizontal gridlines, fitted by straight lines: largest residual 1.9 px in α (0.04°) and 0.8 px in CL (0.002) |

**Points as read** (the plotted test points, symbol centres read by eye against a 1° / 0.1 grid drawn from the calibration; accuracy about ± 0.15° and ± 0.01 in CL, ± 0.015 on the plateau where four data sets' symbols overlap):

| α, deg | −8.82 | −6.58 | −4.27 | −2.00 | 0.37 | 2.62 | 4.87 | 7.15 | 9.38 | 11.52 | 13.67 | 15.71 | 16.66 | 17.70 | 18.73 | 19.64 | 20.40 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CL, tail 0° (WBNH0V) | −0.493 | −0.320 | −0.130 | 0.057 | 0.247 | 0.443 | 0.630 | 0.800 | 0.960 | 1.057 | 1.133 | 1.137 | 1.130 | 1.137 | 1.137 | 1.137 | 1.137 |
| CL, tail 6° TEU (WBNH6V) | −0.553 | −0.380 | −0.193 | −0.008 | 0.177 | 0.377 | 0.560 | 0.737 | 0.897 | 1.000 | 1.073 | 1.080 | 1.080 | 1.080 | 1.080 | 1.073 | 1.075 |

**At the breakpoints** (every 2°, interpolated along the plot's straight segments between test points, which is what the plot draws):

| α, deg | −8 | −6 | −4 | −2 | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CL, tail 0° | −0.430 | −0.272 | −0.108 | 0.057 | 0.217 | 0.389 | 0.558 | 0.714 | 0.861 | 0.988 | 1.074 | 1.134 | 1.135 | 1.137 | 1.137 |
| CL, tail 6° TEU | −0.490 | −0.333 | −0.171 | −0.008 | 0.148 | 0.322 | 0.489 | 0.648 | 0.798 | 0.927 | 1.016 | 1.074 | 1.080 | 1.080 | 1.074 |

**Second reading.** `research/scan.py` scans the pixel columns at each breakpoint for the thin plotted lines, symbols excluded, using the same calibration. Where it finds both lines cleanly (α −8 to 12) it differs from the table above by at most 0.011, except 0.019 at α 0 on the tail-0° curve, where a test point sits on the breakpoint and the scan catches its symbol's edge. Above 14° the symbols of four data sets overlap and the scan cannot separate the lines; the eye reading stands alone there. Tolerance from the procedure: 1 % of the axis span, 0.02 in CL. Both curves pass. The owner's WebPlotDigitizer pass, if made, is the third reading.

**Overlay.** `research/check/A1-fig8-p28-CL.png`: every cross sits on its symbol.

**Fit** (least squares over the nine points from α −8.82° to 9.38°, where the curve is straight):

| | Tail 0° | Tail 6° TEU |
|---|---|---|
| Lift-curve slope CLα | 0.0809 /deg (4.64 /rad) | 0.0807 /deg (4.62 /rad) |
| Zero-lift angle α₀ | −2.71° | −1.92° |
| Largest fit error | 0.018 | 0.015 |
| Plateau (α ≥ 13.7°), mean | 1.135 | 1.077 |

Above 9.4° the curve rounds over; the plateau from 13.7° to 20.4° is CLmax for the clean model at this Reynolds number, with no sharp stall in the α range tested. The tables, not the fit, go into the model; the fit is for checks.

**What the chart gives.**

1. **Model data:** the clean, tail-on, low-speed lift curve, used directly at Mach 0.28 and the base for the Mach correction from A8 and A3.
2. **Stabiliser effectiveness in lift.** The two curves differ by 0.064 in CL over the linear range for 6° of tail incidence: ΔCL/Δi_t = −0.0107 /deg (trailing edge up reduces lift). Check: tail area ratio 0.206 × a tail lift slope near 0.065 /deg × a tail efficiency near 0.8 gives 0.011. The moment counterpart comes from the Cm panel of the same figure (the next chart).
3. **Checks:** the slope against TP-1119 (A2, Mach 0.30, the same model family) when it is read, and against Crenshaw's flight-test CLα of 0.0715 to 0.0825 /deg (climb to cruise, elastic) if Owner decision 1 clears it. The tunnel's 0.081 for a rigid model sits at the top of that band, as a rigid wing should.

**Corrections still to apply, written down, not yet made.**

- **Reynolds number.** The test's 4.2 × 10⁶ on c̄ against about 4 × 10⁷ for the aircraft at this Mach near sea level and 1 to 2 × 10⁷ at cruise. CLα barely changes; CLmax rises with Reynolds number, so the plateau is a lower bound for the aircraft. The report's own Reynolds-number sweep (figure 15, 6.6 to 26.2 × 10⁶ /m) will size this.
- **Mach.** This is Mach 0.28. The rise in CLα with Mach (Prandtl-Glauert gives about 1.17 at Mach 0.78 for the two-dimensional factor; the swept-wing rise is less) comes from A8's wing-body data at Mach 0.30 to 0.80, scaled onto this tail-on curve.
- **Elastic wing.** A rigid model; the real wing washes out under load. Crenshaw's rigid/elastic pairs (if cleared) or the winglet flight test (A5, A6) against TN D-8473 give the size: of the order of 10 % on CLα at cruise.
- **KC-135A to R.** The R's CFM56 nacelles are larger and hang further forward. No public data; a small effect on lift, to be noted as an approximation.
- **Centre of gravity.** None for CL.
