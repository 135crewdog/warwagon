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

### 2.2 CL at the plateau against Reynolds number: A1 figure 15, data page 66

**Record.** A1, figure 15 (*Effect of unit Reynolds number, basic configuration*), data page 66 (PDF page 100), top panel. Run AHG001, WBNH0V (tail 0°), Mach 0.28, flaps 0, β 0, gear up. Axes: unit Reynolds number RN/L, 6 to 27 million per metre, gridlines every 1; CL 1.075 to 1.150, gridlines every 0.025. Three curves, α 16°, 17°, 18°, each with test points at RN/L 6.6, 13.1, 19.7 and 26.2. Image `research/charts/A1-fig15-p66-CL.png`; calibration residuals 4.2 px in RN/L (0.03) and 3.4 px in CL (0.0004). Read by eye against the panel grid; the scan finds the same lines within 0.003. Overlay `research/check/A1-fig15-p66-CL.png`.

| RN/L, million/m | 6.6 | 13.1 | 19.7 | 26.2 |
|---|---|---|---|---|
| CL at α 16° | 1.090 | 1.121 | 1.134 | 1.135 |
| CL at α 17° | 1.084 | 1.121 | 1.134 | 1.126 |
| CL at α 18° | 1.075 | 1.107 | 1.128 | 1.126 |

**What it gives.** The plateau CL rises about 0.045 as the Reynolds number on c̄ goes from 1.4 × 10⁶ to 5.6 × 10⁶, and flattens above 4 × 10⁶: the curve is near its asymptote at the 19.7 million/m of 2.1. So the Reynolds correction to 2.1's plateau for the aircraft (1 to 4 × 10⁷ on c̄) is small and positive, of the order of 0.01 to 0.02, and is the first correction sized: **the model's CLmax of 1.14 is used as the aircraft's at this Mach, with that note.** The report's own repeatability is CN ± 0.025.

---

## 3. Pitching moment

### 3.1 Cm(α), tail on, flaps up, Mach 0.28: A1 figure 8(a), data page 28

**Record.** The same page, runs and conditions as 2.1; the top-right panel. Axes: α as in 2.1; Cm, pitching-moment coefficient about the moment centre at 0.25 c̄, −0.3 to 0.4, gridlines every 0.1. Image `research/charts/A1-fig8-p28-Cm.png`; calibration residuals 2.3 px in α (0.05°) and 1.0 px in Cm (0.0007). Curves read: the two basic runs, tail at 0° (□) and 6° trailing edge up (○); the modified configurations lie on them to 13.7° and then fall away nose-down less steeply (the radomes delay the pitch-down).

**Points as read** (at the test points' α from 2.1; symbol centres by eye against a 1° / 0.02 grid; accuracy about 0.005):

| α, deg | −8.82 | −6.58 | −4.27 | −2.00 | 0.37 | 2.62 | 4.87 | 7.15 | 9.38 | 11.52 | 13.67 | 15.71 | 16.66 | 17.70 | 18.73 | 19.64 | 20.40 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cm, tail 0° | 0.190 | 0.133 | 0.090 | 0.052 | 0.018 | −0.026 | −0.056 | −0.087 | −0.109 | −0.110 | −0.109 | −0.138 | — | −0.186 | −0.210 | −0.240 | −0.243 |
| Cm, tail 6° TEU | 0.354 | 0.304 | 0.268 | 0.230 | 0.191 | 0.150 | 0.111 | 0.078 | 0.051 | 0.047 | 0.048 | 0.029 | 0.024 | 0.028 | −0.027 | −0.040 | −0.069 |

**At the breakpoints:**

| α, deg | −8 | −6 | −4 | −2 | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cm, tail 0° | 0.169 | 0.122 | 0.085 | 0.052 | 0.023 | −0.014 | −0.044 | −0.071 | −0.095 | −0.109 | −0.110 | −0.114 | −0.145 | −0.193 | −0.241 |
| Cm, tail 6° TEU | 0.336 | 0.295 | 0.263 | 0.230 | 0.197 | 0.161 | 0.126 | 0.095 | 0.068 | 0.050 | 0.047 | 0.045 | 0.027 | 0.012 | −0.054 |

**Second reading and what it caught.** A first eye reading from crops 15° wide came out 0.012–0.022 high on the tail-0° curve between −6.6° and 4.9° (and 0.003–0.013 high on the other). The scan showed it, and so did the CL–Cm cross-check below: the derived points sat 0.02 to the right of the plotted ones. Those twelve points were re-read from a crop 12° wide at three times the scale, and now agree with the scan within 0.008 at every breakpoint from −8° to 12° where the scan finds the lines (at α 0 the scan's figure on the tail-6° curve is 0.017 low, but there a test point sits on the breakpoint and the scan catches its symbol). Tolerance 0.007 (1 % of the 0.7 span): met after the re-read. The procedure now says crops are to be no wider than about 12°.

**Overlay.** `research/check/A1-fig8-p28-Cm.png`.

**Cross-check: the CL–Cm panel.** The page's bottom-right panel plots CL against Cm for the same runs. It was not read; instead the CL of 2.1 and the Cm above, at the same test α, were drawn over it (`research/charts/A1-fig8-p28-CLCm.json`, `research/check/A1-fig8-p28-CLCm.png`). Every derived point lies on its plotted symbol, so the three readings are consistent with one another.

**Fit** (least squares, the eight points to 7.15°, the straight part):

| | Tail 0° | Tail 6° TEU |
|---|---|---|
| Cm = Cm₀ + Cmα·α | 0.025 − 0.0170·α (max error 0.015) | 0.197 − 0.0171·α (max error 0.006) |
| Cm = a + (dCm/dCL)·CL | 0.071 − 0.208·CL (max error 0.016) | 0.230 − 0.211·CL (max error 0.008) |
| Neutral point (0.25 c̄ − dCm/dCL) | 0.458 c̄ | 0.460 c̄ |

The tail-0° curve is not quite straight: its −8.82° point sits 0.015 above the line, so its fit errors are larger. Between 9° and 14° both curves go flat (the swept wing's pitch-up as the tips stall; Cm stops falling while CL still rises), then the basic tail-0° run drops nose-down from 15°. The tables, not the fit, go into the model.

**What the chart gives.**

1. **Static stability**, rigid, tail on, Mach 0.28: the neutral point at 0.46 c̄, so the static margin is 21 % c̄ at the 0.25 c̄ reference, and about 20 % at Crenshaw's 0.242 c̄ cruise CG (his rigid FLEXSTAB static margins, PR 4, are the cross-check).
2. **Stabiliser effectiveness in moment.** The two curves differ by 0.170 in Cm (0.160 to 0.178 over the first nine points) for 6° of tail incidence: ΔCm/Δi_t = 0.0284 per degree trailing edge up. With the lift effectiveness of 2.1 (0.064), ΔCm/ΔCL = 2.66 c̄: the tail's moment arm about 0.25 c̄, 53.6 ft full scale, which is where a KC-135's tail is. These two numbers, with the elevator's share from Crenshaw or DATCOM, are the trim model.
3. **The pitch-up** between 9° and 14° is real swept-wing behaviour the sim will show: the nose wants to keep rising as the limit is approached.

**Corrections still to apply:** as 2.1 (Mach, the elastic wing, the R's nacelles), plus the **CG transfer**: the data are about 0.25 c̄; the sim's CG, chosen in PR 6, moves Cm by (x_cg − 0.25)·CL. Reynolds number: none, by 3.2.

### 3.2 Cm against Reynolds number: A1 figure 15, data page 64

**Record.** The same figure, data page 64 (PDF page 98), bottom panel: Cm against RN/L at α −6°, −4°, −2°, 0°, 2° and 4°, run AHG001 (tail 0°). Axes: RN/L as 2.2; Cm 0.15 to −0.10, gridlines every 0.05. Image `research/charts/A1-fig15-p64-Cm.png`; calibration residuals 3.4 px in RN/L and 1.6 px in Cm (0.0007). The six curves are flat: one value each, read by eye, the scan agreeing within 0.005. Overlay `research/check/A1-fig15-p64-Cm.png`.

| α, deg | −6 | −4 | −2 | 0 | 2 | 4 |
|---|---|---|---|---|---|---|
| Cm, all four Reynolds numbers | 0.119 | 0.079 | 0.043 | 0.012 | −0.023 | −0.054 |

**What it gives.** No Reynolds-number effect on the pitching moment or the static margin at low α: Cmα from these six points is −0.0173 /deg, as 3.1. These values sit 0.005 to 0.010 below 3.1's at the same α, from a different run of the same model: that is the report's stated repeatability for Cm, ± 0.010, and is larger than the reading error. **The data's scatter, not the reading, now limits the accuracy of Cm**, and the sim's trim will be tuned on the phone within it.

---

## 4. Drag

### 4.1 CD(α), tail on, flaps up, Mach 0.28: A1 figure 8(a), data page 28

**Record.** The same page, runs and conditions as 2.1; the bottom-left panel. Axes: α as in 2.1; CD, stability-axis drag coefficient, drag/q̄S, 0 to 0.45, gridlines every 0.05. Image `research/charts/A1-fig8-p28-CD.png`; calibration residuals 1.7 px in α (0.04°) and 1.8 px in CD (0.0008). Curves read: tail at 0° (□) and 6° trailing edge up (○).

**Points as read** (symbol centres against a 1° / 0.02 grid from crops 6° wide; accuracy about 0.003 below 10° and 0.01 above, where the four data sets' symbols overlap; the separation of the two curves is at the reading accuracy):

| α, deg | −8.82 | −6.58 | −4.27 | −2.00 | 0.37 | 2.62 | 4.87 | 7.15 | 9.38 | 11.52 | 13.67 | 15.71 | 16.66 | 17.70 | 18.73 | 19.64 | 20.40 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CD, tail 0° | 0.067 | 0.036 | 0.0215 | 0.0205 | 0.0212 | 0.0273 | 0.0356 | 0.052 | 0.083 | 0.143 | 0.213 | 0.279 | 0.310 | 0.339 | 0.367 | 0.393 | 0.400 |
| CD, tail 6° TEU | 0.074 | 0.0457 | 0.0331 | 0.0288 | 0.0295 | 0.037 | 0.0446 | 0.0605 | 0.074 | 0.132 | 0.200 | 0.268 | 0.303 | 0.325 | 0.357 | 0.379 | 0.393 |

**At the breakpoints:**

| α, deg | −8 | −6 | −4 | −2 | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CD, tail 0° | 0.056 | 0.032 | 0.021 | 0.021 | 0.021 | 0.026 | 0.032 | 0.044 | 0.064 | 0.100 | 0.159 | 0.224 | 0.289 | 0.347 | 0.396 |
| CD, tail 6° TEU | 0.064 | 0.043 | 0.033 | 0.029 | 0.029 | 0.035 | 0.042 | 0.053 | 0.066 | 0.091 | 0.147 | 0.211 | 0.279 | 0.334 | 0.386 |

**Second reading.** The scan finds the plotted lines from −8° to 8° and agrees within 0.004 (tolerance 0.0045, 1 % of the span); above 10° the curve is too steep for a column scan and the eye reading stands alone. The first calibration of this panel had picked the wrong run of vertical gridlines (the frame sits a grid step beyond α 20°, equally spaced), which shifted every α by 2.5°; the page overview showed it before any point was recorded, and the calibrator now takes the gridline choice explicitly and the overlay is the check.

**Overlay.** `research/check/A1-fig8-p28-CD.png`.

**Fit** (least squares over α −4.27° to 7.15°, six points, where the polar is parabolic):

| | Tail 0° | Tail 6° TEU |
|---|---|---|
| CD = CD₀ + k·CL² | 0.0191 + 0.0481·CL² (max error 0.0026) | 0.0289 + 0.0563·CL² (max error 0.0021) |
| With a linear term | 0.0198 − 0.0110·CL + 0.0623·CL² (max error 0.0020; minimum at CL 0.09) | 0.0290 − 0.0076·CL + 0.0676·CL² (max error 0.0013) |

Checks: 1/(π·AR·e) with AR 7.035 gives k = 0.048 at e = 0.94, high for a complete aircraft (0.8 would give 0.057); the tunnel's k is at the low end of plausible, which suits a clean wing-body-tail at this Reynolds number. The tail at 6° adds about 0.009 everywhere at low CL (its own drag at incidence) and, at high CL, loses about 0.009 (less lift, less induced drag): the two curves cross near 8°. Below −6° and above 9° the drag rises faster than the parabola as the flow separates.

**What the chart gives.**

1. **The low-speed clean polar**, as a table in α (or in CL through 2.1). The model uses the table; the fit is for checks and for the Mach correction's shape.
2. **The tail's drag**, 0.009 per 6° at low CL, is the start of a trim-drag model.
3. **A number to correct:** CD₀ = 0.019 on the 0.035-scale model at Re 4.2 × 10⁶ is high for the aircraft. Full-scale skin friction at Re 1 to 4 × 10⁷ is about two-thirds of the model's, so the aircraft's CD₀ at this Mach will be near 0.015 to 0.017 before the flight-test polars (A5, A6) settle it. Until then the model's value is used and labelled.

**Corrections still to apply:** Reynolds number (4.2 sizes it: small on this model, because its transition was fixed), Mach (the drag rise from A8 and A3), the R's nacelles and the elastic wing (small), and no CG transfer.

### 4.2 CD against Reynolds number: A1 figure 15, data page 64

**Record.** The same figure and page as 3.2, middle panel: CD against RN/L at α −6° to 4°. Axes: RN/L as 2.2; CD 0.015 to 0.04, gridlines every 0.005. Image `research/charts/A1-fig15-p64-CD.png`; calibration residuals 2.7 px in RN/L and 2.8 px in CD (0.0001). Read by eye; the scan agrees within 0.001. Overlay `research/check/A1-fig15-p64-CD.png`.

| RN/L, million/m | 6.6 | 13.1 | 19.7 | 26.2 |
|---|---|---|---|---|
| CD at α −6° | 0.0365 | 0.034 | 0.031 | 0.0295 |
| CD at α −4° | 0.0228 | 0.0221 | 0.0211 | 0.0205 |
| CD at α −2° | 0.0193 | 0.0195 | 0.0188 | 0.0185 |
| CD at α 0° | 0.0215 | 0.021 | 0.0205 | 0.0203 |
| CD at α 2° | 0.0275 | 0.0272 | 0.0265 | 0.026 |
| CD at α 4° | 0.0355 | 0.0352 | 0.0345 | 0.0345 |

**What it gives.** Near zero lift the drag falls only 0.0008 over a fourfold Reynolds-number range, because the model's boundary layer was tripped turbulent (the report's transition strips), so the skin friction already behaves as the aircraft's does and the Reynolds effect left is the turbulent one, Cf ∝ Re^−0.2, about 0.0015 to 0.002 more from the test's 4.2 × 10⁶ to the aircraft's 2 × 10⁷. At α −6° the fall is 0.007: a separation on the lower surface that the higher Reynolds number delays, irrelevant to flight. **So the model's polar is used with CD₀ lowered by 0.002**, labelled an estimate, until the flight-test polars (A5, A6) settle it; 4.1's guess of 0.015 to 0.017 was too low. The values at 19.7 million/m agree with 4.1's at the same α within 0.001.

---

## 5. Cross-checks from the second model (A2, TP-1119)

TP-1119 tested a second 0.035-scale KC-135A model, with winglets on and off, at Mach 0.30, but only in its take-off and landing configurations (flaps 30° and 50°); its longitudinal and lateral figures are read in the flaps part of this file. One figure bears on the clean aircraft:

### 5.1 Horizontal-tail effectiveness at flaps 30: A2 figure 14

**Record.** A2, figure 14 (*Effect of winglets on horizontal-tail effectiveness*), PDF page 48: Cm per degree of stabiliser, Cm_δh, against CL, flaps 30°, ailerons 0, β 0; the solid curve is winglets off and the dashed, not read, winglets on. Axes: CL 0 to 1.2, gridlines every 0.05; Cm_δh 0 to −0.04, gridlines every 0.005. Image `research/charts/A2-fig14-Cmdh.png`. Four values read by eye against the grid (accuracy 0.0005); overlay `research/check/A2-fig14-Cmdh.png`.

| CL | 0.3 | 0.6 | 0.9 | 1.2 |
|---|---|---|---|---|
| Cm_δh, per deg, winglets off | −0.0326 | −0.0324 | −0.0326 | −0.0349 |

**What it gives.** Cm per degree of stabiliser trailing edge *down* is −0.0325 at flaps 30 on this model, against −0.0284 from A1's two tail settings at flaps 0 (3.1; A1's 0.0284 per degree trailing edge *up* is the same number with the opposite sign convention). The 14 % difference is the flaps' extra downwash and dynamic pressure at the tail, and the two models' differences; the two reports agree on the tail's effectiveness to that level, and the clean value stays A1's.
