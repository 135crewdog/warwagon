# Flight model

How War Wagon's KC-135R flies: the physics, the flight controls and their automatic systems, the pilot's input, and the tests that prove it. The numbers live in `docs/kc135-data.md` (cited below by section, as "data 9.1"); this file says how to use them.

Read this file before touching anything in the simulation. When this file and your own knowledge disagree, this file wins. When this file is wrong, say so and propose a fix; don't quietly work around it.

## 0. The goal in one paragraph

A real KC-135R, as far as public data allows, flown by tilting an iPhone. The pilot's tilt is a force on the yoke. The yoke moves the elevator and the ailerons through cables and tabs, as it does in the jet; nothing shapes the command on the way. The surfaces move the jet through aerodynamic data read from public wind-tunnel reports, flight tests and a thesis, and every behaviour the pilot feels comes out of that chain: the static stability that returns the nose, the phugoid, the dutch roll, the Mach tuck, the buffet at the high-altitude corner, the slow roll of a 130-foot wing. Two things the real pilot does with a thumb and feet are done for them, at the real rates: the stabiliser trim and the rudder (section 8). Nothing in the game points the jet where the player wants it to go. If the jet does something unrealistic, the fix belongs in the model, the flight controls or the input mapping, never in a shortcut around them.

What the pilot should feel: a big, stable, conventionally controlled jet. A pull takes effort and the nose answers slowly; let go and the jet settles back to 1 g on its own, after the stabiliser has had a few seconds to catch up with any change of speed. Too slow and it shakes before it stalls; too fast at altitude and the nose wants to drop. Turns need a held pull. Rolls are slow and the ball stays centred without pedals. Thrust comes on over seconds, not instantly, and there is less of it high up.

## 1. Concepts in one page

- **Body axes.** x out the nose, y out the right wing, z out the belly. Roll rate p, pitch rate q and yaw rate r about those axes, positive right wing down, nose up, nose right.
- **Angle of attack (α)** is the angle between the nose (body x) and the oncoming air, in the jet's plane of symmetry; **sideslip (β)** is the sideways angle. Almost every aerodynamic number depends on α.
- **Dynamic pressure (q̄ = ½ρV²)** is how hard the air pushes. Force = q̄ × wing area × a coefficient. The coefficient comes from the tables; q̄ scales it.
- **Stability axes.** The data give lift CL, drag CD, side force CY and the moments Cl, Cm, Cn with lift and drag along and across the oncoming air, not along the body. The model rotates them into body axes each step (section 5.1).
- **Static stability.** The KC-135's neutral point is at 0.46 of the mean chord and its centre of gravity at 0.25, so a nose-up disturbance makes a nose-down moment and the nose returns. The pilot feels that as a yoke that gets heavier the further it is pulled, and as a jet that comes back to its trimmed condition when released. There is no fly-by-wire to hide it; the derivatives have to be right.
- **Stick force per g.** With reversible controls the pilot's force moves the surface against its own hinge moment, which grows with q̄ exactly as the surface's power does, so a given force gives about the same g at any speed. The tilt is the force (section 8.2).
- **Trim** is the stabiliser setting at which the elevator is centred in steady flight. Change speed and the setting changes, which is why a pilot's thumb is on the trim switch after every power change. War Wagon's thumb is automatic (8.3).
- **Phugoid.** The slow exchange of speed for height: a minute-long, lightly damped porpoise. **Short period**: the quick nose bob after a pull, over in a few seconds. **Dutch roll**: the yawing-rolling wallow of a swept-wing jet, about 4.5 s a cycle and barely damped on its own; the yaw damper's job. **Spiral**: whether a small bank grows or decays when left alone. **Roll mode**: how fast a roll rate builds after the wheel is turned.
- **Mach effects.** At Mach 0.78 to 0.80 the shocks on the wing start costing drag (drag rise), and the wing's lift moves aft and pitches the nose down (Mach tuck). Both are in the data (5.6).
- **Elastic wing.** The real wing bends and washes out under load, and the fuselage bends, so the flying aircraft is less stable than the rigid tunnel model by about a quarter at cruise dynamic pressure (5.7).
- **Load factor (n_z)** is what an accelerometer reads: 1 in level flight. n_z = −(body-axis normal force)/W.
- **Buffet** is the shake of separated flow before the stall, or at high Mach and high lift; on this jet it is the warning there is, and the data have its boundary (10).

## 2. Conventions

### 2.1 Units

- **Inside the simulation: imperial.** ft, slug, lbf, ft/s, psf; degrees in the tables, radians and rad/s in the state. Every public KC-135 number is in these units, so the code stays comparable with its sources. Never mix in metres inside `sim/`.
- **Rendering: 1 world unit = 1 metre**, converted once at the boundary.
- **On screen: knots, feet, feet per minute, degrees, Mach, per cent N1.**

### 2.2 Frames

As Rage: NED earth frame, flat and non-rotating, h = 0 at the ground, gravity 32.17 ft/s²; body frame as section 1; three.js world x east, y up, z south; one module owns every conversion and tests prove it. The reference quantities are the data's: S = 2,433 ft², b = 130.83 ft, c̄ = 20.16 ft (data 1, 10.1).

### 2.3 Signs

| Quantity | Positive means | Note |
|---|---|---|
| α | nose above the velocity vector | |
| β | air arriving from the right | |
| Stabiliser i_s | leading edge **up** (trailing edge down) → **nose-down** moment | In the aircraft's datum, travel +0.5° to −14° (data 10.1). The tunnel's tail datum sits 2.4° from it (5.3): the tunnel's "6° trailing edge up" is i_s = −8.4°. Cm_δs = −0.0284 /deg |
| Elevator δe | trailing edge down → nose-down moment | A pull is a **negative** elevator. Cm_δe = −0.015 /deg |
| Roll control δa | moment that rolls **left** (Cl < 0) | So a right roll needs negative δa. Rage's convention, kept so Rage's code reads |
| Rudder δr | moment that yaws the nose **left** (Cn < 0), side force +y | |
| n_z | accelerometer reading, +1 in level flight | n_z = −(q̄·S·CZ)/(m·g) |
| n_y | lateral accelerometer | n_y = q̄·S·CY/(m·g) |

The data's own signs are in data 7 (β positive wind from the right; CY right; Cl right wing down; Cn nose right), and the tunnel's "ailerons −10°" rolled the model left, which is our positive δa. **Every sign in this table and every sign in section 8 must be proved by a unit test** that steps one input and checks the response's direction.

### 2.4 Time

As Rage: physics at a fixed 120 Hz with a fourth-order Runge-Kutta step; the render loop's accumulator takes at most 8 steps a frame and drops the rest; rendering interpolates between the last two states; the simulation is deterministic. The automatic systems (8.3, 8.5) run every physics step.

## 3. Structure of the simulation

Plain JavaScript with no DOM, no three.js and no browser APIs, so all of it runs in Node. The renderer only reads state. Rage's modules are the pattern and, where the table says so, the code:

| Module | Job | From Rage |
|---|---|---|
| `atmosphere` | The 1976 standard atmosphere: T = 518.67 − 0.0035662·h °R to 36,089 ft, then 389.97 °R to 65,617 ft; p from the hydrostatic relations (2,116.22 psf at sea level; 472.68·exp(−(h − 36,089)/20,806) above the tropopause); ρ = p/(1716.56·T); a = √(1.4·1716.56·T). Within 0.1 % of the tables to 50,000 ft. | Replaced: Rage's book routine freezes above 36,000 ft without the tropopause's pressure law, and a tanker lives at FL300 to FL400 |
| `table` | Linear interpolation in one and two dimensions, inputs clamped to the table's range | Reused |
| `aero` | The coefficient build-up of section 5 | New |
| `engine` | Four F108s: the thrust cap, the throttle, the spool lag, the N1 shown (section 6) | New |
| `actuators` | Surface lags, rate limits, position limits (section 7) | Reused, with these limits |
| `dynamics` | The equations of motion and the RK4 step (section 4) | Reused: the inertia constants are computed from the data's inertias instead of printed, and the engine momentum term is zero |
| `quaternion` | Attitude | Reused |
| `controls` | The yoke to the surfaces, the automatic trim, the yaw damper and coordination (section 8) | New (Rage's `fcs` is the shape; the laws are different) |
| `trim` | The trim solver: finds α, i_s and thrust for steady flight at a given weight, altitude and speed (δe = 0, wings level or in a steady turn) | Reused in form; the unknowns change |
| `airdata` | KIAS, Mach, altitude, VSI, heading, N1 for the HUD (section 9) | Extended |
| `input` | Tilt to yoke force, the throttle (section 11); outside `sim/` | Reused |

### 3.1 State

| Symbol | Meaning | Units |
|---|---|---|
| u, v, w | velocity in body axes | ft/s |
| Q | attitude quaternion, body relative to NED, renormalised each step | |
| p, q, r | body rates | rad/s |
| north, east, h | position; h above the ground (0 in milestone 1; the terrain's height later) | ft |
| T_i | thrust of each engine after the spool lag (four values; one command) | lbf |
| δe, δa, δr, i_s | surface positions after the actuators | deg |
| control memory | the yaw damper's washout state, the trim's deadband timer, the VSI's lag | |

VT, α and β from u, v, w as Rage: VT = √(u² + v² + w²), α = atan2(w, u), β = asin(v/VT), VT guarded against zero. Euler angles are computed for the HUD and the tests, never integrated.

## 4. Equations of motion

Rigid body, six degrees of freedom, constant mass, flat non-rotating earth, as Rage section 4 with these differences:

1. **Mass and inertia** (data 10.2, 10.3): W = 240,000 lb, m = 7,460 slug; Ixx = 2.76, Iyy = 4.11, Izz = 6.74, Ixz = 0.25 × 10⁶ slug·ft². The constants c1..c9 of the rotational equations are computed from these at start-up by the standard formulas (Γ = Ixx·Izz − Ixz²; c1 = ((Iyy − Izz)·Izz − Ixz²)/Γ; c2 = (Ixx − Iyy + Izz)·Ixz/Γ; c3 = Izz/Γ; c4 = Ixz/Γ; c5 = (Izz − Ixx)/Iyy; c6 = Ixz/Iyy; c7 = 1/Iyy; c8 = (Ixx·(Ixx − Iyy) + Ixz²)/Γ; c9 = Ixx/Γ), and a test checks them against values worked by hand.
2. **No engine angular momentum.** The four fans' momentum is a few hundred slug·ft²/s against inertias of millions; the gyroscopic coupling is below anything measurable. Hx = 0.
3. **Thrust** acts along body x (the engines' toe-in and droop are ignored) through a point **z_T = 7 ft below the CG**, an estimate from the three-view of the pods under the wing, so thrust pitches the nose up: ΔCm_T = T·z_T/(q̄·S·c̄), about +0.008 at cruise, a quarter-degree of stabiliser. Power changes therefore pitch the jet, as they do in the aircraft, and the automatic trim follows them.
4. **Forces** in body axes from the stability-axis coefficients of section 5, rotated by α and β (5.1), plus gravity rotated by Q, plus thrust.

**Centre of gravity** 0.25 c̄, the data's reference: no CG transfer anywhere (data 10.2).

**Outside the data.** The lookup angles are clamped to the tables' ranges (α −8° to 20°, β ±18°, Mach to 0.90) and the end values held, never extrapolated; beyond α −10° or 24°, |β| 20° or Mach 0.92 an `outOfEnvelope` flag is set for the debug overlay. The model must stay numerically stable there and never produce NaN; it is not asked to be right.

**Ground.** When the jet is below the ground the flight ends in a crash state, `crashed(x, groundFt)`, as Rage. No landing gear in this milestone.

## 5. Aerodynamics

### 5.1 The build-up

Each step, in stability axes. The rate derivatives are stability-axis derivatives (data 8), so the body rates are rotated first: p_s = p·cosα + r·sinα, r_s = r·cosα − p·sinα, and q̂ = q·c̄/(2V), p̂ = p_s·b/(2V), r̂ = r_s·b/(2V) (rates in rad/s); δ in degrees:

```
CL = f_M(M)·k_e(q̄)·CL_tab(α) + CL_δs·(i_s + 2.4°) + CL_δe·δe + CL_q·q̂
CD = CD_pol(CL) + ΔCD_stall(α) + ΔCD_M(M, CL)
Cm = f_M(M)·k_e(q̄)·Cm_tab(α) + s_e(q̄)·CL + ΔCm_M(M) + k_s(q̄)·Cm_δs·(i_s + 2.4°) + Cm_δe·δe + k_q(q̄)·Cm_q*·q̂ + ΔCm_T
CY = CY_tab(β) + CY_δr·δr + CY_p·p̂ + CY_r·r̂
Cl = Cl_tab(β) + Cl_δa·δa + Cl_δr·δr + Cl_p·p̂ + Cl_r·r̂
Cn = Cn_tab(β) + Cn_δa·δa + Cn_δr·δr + Cn_p·p̂ + Cn_r·r̂
```

then into body axes, treating CL, CD and CY as wind-axis coefficients (the same as the tunnel's stability-axis ones at β = 0, and differing only at second order in β): CX = −CD·cosα·cosβ + CL·sinα − CY·cosα·sinβ, CZ = −CD·sinα·cosβ − CL·cosα − CY·sinα·sinβ, CY_body = −CD·sinβ + CY·cosβ. The moments Cl and Cn are in stability axes and rotate by α about y: Cl_body = Cl·cosα − Cn·sinα, Cn_body = Cl·sinα + Cn·cosα; Cm is the same in both. The terms are set out below; every one has its source in the data file and the table in `src/sim/data/` is re-keyed from there.

### 5.2 Lift

- **CL_tab(α)**: the tail-on, tail-0°, flaps-up table at Mach 0.28 (data 2.1, the breakpoint row), α −8° to 20° every 2°, with its plateau of 1.14 from 14°. Used as the aircraft's: the Reynolds-number correction is +0.01 to +0.02 on the plateau and nothing on the slope (data 2.2), inside the data's own scatter.
- **CL_δs = +0.0107 /deg** of stabiliser leading edge up (data 2.1); **CL_δe = +0.0055 /deg** of elevator trailing edge down (data 11.1, an estimate); **CL_q = 11 /rad** (data 8.4, FLEXSTAB cruise).
- **f_M(M)**: the rise of the lift slope with Mach, from the tail-off tunnel (data 5.0 at Mach 0.30: 0.082 /deg; data 9.2 at Mach 0.50 to 0.90: 0.095 /deg): 1.00 to Mach 0.30, rising linearly to **1.16 at Mach 0.50**, flat to 0.90. It scales the whole table (the zero-lift angle stays).
- **k_e(q̄)** is the elastic correction (5.7).

Check: the model's lift slope at cruise comes out 0.081 × 1.16 × 0.89 = 0.084 /deg, between Crenshaw's flight-test 0.0825 and Lux's flight 0.094 (data 8.3, 9.4).

### 5.3 Pitching moment

- **Cm_tab(α)**: the tail-on, tail-0° table at Mach 0.28 about 0.25 c̄ (data 3.1), including the flattening from 9° to 14° (the swept wing's pitch-up) and the drop beyond. Cmα = −0.017 /deg, neutral point 0.46 c̄.
- **f_M(M)·k_e(q̄)** scale it as they scale the lift, so the Mach rise and the elastic loss act on the moment slope as on the lift slope (a tail-on Cmα is a lift slope times an arm): the neutral point does not move with Mach below 0.85 (FLEXSTAB has it at 0.454–0.458 c̄ from Mach 0.21 to 0.77, data 8.4; A3's tail-off Cm against CL stays vertical to 0.85, data 9.2), so the moment slope rises in step with the lift slope.
- **s_e(q̄)·CL** is the elastic forward shift of the neutral point (5.7).
- **ΔCm_M(M)**: Mach tuck (5.6).
- **Cm_δs = −0.0284 /deg** of stabiliser leading edge up (data 3.1; FLEXSTAB −0.028 to −0.0325 agrees); **Cm_δe = −0.015 /deg** (data 11.1, an estimate from the stabiliser by the elevator's chord ratio; the one longitudinal number with no measurement behind it). k_s(q̄) is the stabiliser's elastic factor (5.7).
- **Cm_q\* = −21 /rad**: the flight-test cruise Cmq −14.65 plus Cmα̇ −6.57 (data 8.3), folded together as the short-period approximation does (q ≈ α̇ there), so no α̇ is computed. k_q(q̄): 5.7.
- **ΔCm_T**: the thrust line (section 4).

**The stabiliser datum.** The tunnel's "tail at 0°" is a geometric angle on a model; the aircraft's trim scale, whose stops are +0.5° and −14° and in which FLEXSTAB's trims are given (data 8.1), has its own zero. They are not the same angle, and the model can only be trimmed against the aircraft's stops in the aircraft's datum. The offset comes from FLEXSTAB's trimmed cruises: with **tunnel angle = i_s + 2.4°**, the build-up trims cruise 1 (284,000 lb) at −1.9° against FLEXSTAB's −2.28°, cruise 2A (130,000 lb) at −0.6° against −0.83°, and cruise 2 (130,000 lb, 45,600 ft) at −2.4° against −1.87°, with the thrusts within 1 % of Crenshaw's (`tests/trim.test.js`). The 2.4° is a derived constant, not a reading, and 12.1 holds it to the ±1.5° band. (It was first found as 1.6° with the tunnel's full Mach tuck in the build-up; the tuck's calibration in 1b (5.6) took 0.02 of nose-down out of the cruise trims, and the offset was re-derived: the mean of the three FLEXSTAB differences is now zero.)

Check: at cruise (240,000 lb, FL300, Mach 0.78, CL 0.37) the terms sum to i_s = −1.7°: the table's −0.006, the elastic shift +0.019, Mach tuck −0.002 and the thrust line +0.008 against the stabiliser's 0.026 per degree. At the air start, also −1.7°.

### 5.4 Drag

Drag is indexed by lift, not by angle of attack: induced drag goes with CL², and the α at which the aircraft makes a given CL is not the tunnel's once the lift slope is scaled for Mach and the elastic wing (5.2). The tunnel's polar is read as pairs (CL_tab(α), CD_tab(α)) from data 2.1 and 4.1.

- **CD_pol(CL) = 0.0155 + 0.047·CL²**, the clean polar below the drag rise, a formula because the physics gives the shape (`docs/research-plan.md` 3, step 5). Its curvature k is Lux's flight-measured 0.047 (CD 0.0230 to 0.0272 from CL 0.40 to 0.50 at Mach 0.70, data 9.4), which is also the tunnel's 0.048 (data 4.1): tunnel and flight agree on the shape. Its level is flight's: 0.0155 at zero lift, against the tunnel's 0.0191, the full-scale correction being the skin friction at a twelfth of the Reynolds number (data 4.2's −0.002 was too small, and data 4.1's first guess of 0.015–0.017 right). Lux's polars are of the trimmed aircraft, so the cruise trim drag is inside this level and no separate trim-drag term is carried; the few counts by which trim drag varies with stabiliser angle are left out. The polar is evaluated at the total CL of 5.2.
- **ΔCD_stall(α) = max(0, CD_tab(α) − (0.0191 + 0.0481·CL_tab(α)²))**: the tunnel's separation drag beyond its own parabola, zero on the straight part of the lift curve by construction and climbing from about 8° (0.005 at 8°, 0.05 at 12°, 0.16 at 16°). At Mach 0.28 the two terms together reproduce the tunnel's CD(α) table less a near-constant 0.0036–0.0045, so the tunnel still sets the shape of the stall.
- **ΔCD_M(M, CL)**: the drag rise. To Mach 0.80 the flight data (data 9.4), as Lux's increments over his Mach 0.70 polar: at CL 0.40, +0.0003 at 0.75, +0.0004 at 0.78, +0.0005 at 0.80; at CL 0.50 three times that, +0.0007 at 0.75 and +0.0012 at 0.78 (his 0.80 point there is unread; +0.0017 extrapolated): the full-scale rise grows with lift, as the tunnel's does. The CL 0.40 column is held below it and the CL 0.60 column is twice the 0.50, the tunnel's shape. Above 0.80 the tunnel's increments relative to its own 0.80 curve, by CL (the owner's trace, data 9.1 and `research/charts/A3-fig43-CD.json`), added to the 0.80 row:

  | CL | 0.75 | 0.78 | 0.80 | 0.82 | 0.85 | 0.90 |
  |---|---|---|---|---|---|---|
  | 0.2, 0.3, 0.4 | +0.0003 | +0.0004 | +0.0005 | +0.0011, +0.0015, +0.0024 | +0.0041, +0.0065, +0.0109 | +0.0188, +0.0244, +0.0311 |
  | 0.5 | +0.0007 | +0.0012 | +0.0017 | +0.0063 | +0.0180 | +0.0408 |
  | 0.6 | +0.0014 | +0.0024 | +0.0034 | +0.0116 | +0.0256 | +0.051 (the trace ends at CL 0.58; extrapolated) |

  Zero at and below Mach 0.70. Below CL 0.2 and above 0.6 the end rows are held; above Mach 0.90 the 0.90 column is held and the flag of section 4 is set. The joint at 0.80 is the decision of data 9.4: the flight polars say the full-scale rise starts later than the tunnel's, and the tunnel alone says how steeply it then climbs.

Check: at Mach 0.70 the polar gives 0.0230, 0.0250 and 0.0272 at CL 0.40, 0.45 and 0.50 (Lux: 0.0230, 0.0255, 0.0272); at Mach 0.78 and CL 0.42 the build-up gives 0.0242, and the flight-measured drag of the complete aircraft is 0.024 (Lux, and Crenshaw's flight-test point: data 9.4, 8.3).

### 5.5 Lateral-directional

- **CY_tab, Cn_tab, Cl_tab(β)**: the clean β sweep at α 6° (data 7.1), −18° to +8° every 2°. The aircraft is symmetric, so the lookup is by |β| with sign(β), using the negative-β half, which reaches 18°; the positive half agrees with it to 8°, where it ends. The tables carry what a single slope would not: Cn flattens beyond −10° as the fin loses its grip, CY and Cl beyond −8°. The derivatives near zero: Cnβ 0.0032, Clβ −0.0032, Cyβ −0.0108 /deg. **Their dependence on α and Mach is not modelled**: one point in α, from a Mach 0.28 tunnel; Crenshaw's three flight conditions bracket it within 20 % (data 7.1, 8.7).
- **Rudder**: Cn_δr = −0.0016, CY_δr = +0.0030, Cl_δr = +0.0004 /deg (the tunnel, data 7.2, magnitudes; signs per 2.3). FLEXSTAB's rudder is twice as powerful (data 8.7); the tunnel's is used because it was measured, and the yaw damper is tuned to it. If the damper cannot reach its target within the rudder's authority (8.5), the rudder's power is raised toward FLEXSTAB's and the change recorded.
- **Roll control**: Cl_δa = **−0.00095 /deg** over ±20° of δa, a tuning value with a stated range: the inboard aileron alone is −0.0006 /deg (FLEXSTAB, data 8.4; the outboard ailerons are locked out with the flaps up on this family of aircraft, and the tunnel's 0.006 is the outboard pair at flaps 50, data 7.2), and the spoilers, which do the rest of the flaps-up rolling on the real jet, are in no public data. The value was set in 1b against the roll test (12.2): −0.00095 gives 43°/s at cruise and 31°/s at the air start, and 30° of bank in 1.8 and 2.0 s; −0.0008 missed the air start's 2 s by 0.15 s and −0.0010 took cruise to 46°/s. Cn_δa = −0.0002 /deg (adverse, a tenth of the roll, the sign and size of FLEXSTAB's inboard aileron). CY_δa = 0.
- **Rate derivatives**, per radian, constants: Cl_p = −0.345 and Cn_r = −0.194 from **flight test** (data 8.3, cruise 1: FLEXSTAB over-damps the dutch roll by a factor of two, data 8.5, so the flight-test values are the ones); Cl_r = +0.25, Cn_p = +0.019, CY_p = −0.185, CY_r = +0.71 from FLEXSTAB (data 8.4, cruise 1), which has no flight-test counterpart. The β̇ terms are left out.

### 5.6 Mach

- **ΔCD_M**: 5.4.
- **ΔCm_M(M)**, Mach tuck, at constant lift. The tail-off tunnel's curve at CL 0.4 relative to Mach 0.50 (data 9.2; the CL 0.5 row is within 0.004 of it, so one curve serves) is 0 to Mach 0.50; −0.011 at 0.70; −0.017 at 0.75; −0.021 at 0.78; −0.028 at 0.80; −0.036 at 0.82; −0.044 at 0.85 and 0.90. **The aircraft's curve is a tenth of that to Mach 0.82, and the tunnel's increments in full above it**: 0, −0.0011, −0.0017, −0.0021, −0.0028, −0.0036, −0.0116, −0.0116 at the same Mach numbers, linear between, held above 0.90. The tenth is calibrated to the flight test (owner decision, 1b): Crenshaw's flight-measured phugoid at Mach 0.77 has a period of 110 s (data 8.5), which means the real aircraft is speed-stable there; the tunnel's curve in full gave the model a 331 s phugoid at that condition and, at Mach 0.78, no phugoid at all but a tuck-under doubling in 18 s (8.7), and a tenth gives 113 s. The missing tail is the likely reason: its lift and the downwash on it change with Mach and offset most of the wing-body's shift. Above 0.82, past the drag-divergence Mach of 0.81 (data 9.3), the shocks the drag rise proves are the tuck's cause, and the tunnel's increments are taken as read: the tuck-under returns there (doubling in 58 s at 0.82) for the trim to hold, as a Mach trim compensator did on the 707. In level flight at FL300 the trimmed stabiliser moves only 0.2° between Mach 0.78 and 0.86 (−1.67° to −1.43°, nose-down): the tuck's 0.4° of nose-up above 0.82 is offset by the elastic nose-up shift as q̄ rises (5.7) and the thrust line's as the thrust rises, so the tuck shows in the bare airframe's roots above 0.82, not in the trim. Same pattern as the drag (5.4): flight sets the level to the divergence Mach, the tunnel the shape beyond.
- **f_M(M)** on the lift and moment slopes: 5.2.
- Nothing else changes with Mach: the lateral derivatives, the control powers and the dampings are their low-speed or cruise values throughout.

### 5.7 The elastic wing

FLEXSTAB's rigid-to-elastic pairs at two dynamic pressures (data 8.6) are linear in q̄ to within their reading, so the corrections are straight lines in q̄, with q̄ in psf:

- **Neutral point**: s_e(q̄) = +1.9 × 10⁻⁴ · q̄ (per unit CL, as a Cm increment s_e·CL): the washout moves the neutral point forward by 0.034 c̄ at 181 psf and 0.053 c̄ at 280 psf, FLEXSTAB's two points. At cruise the static margin goes from 0.21 c̄ to 0.16 c̄.
- **Lift slope**: k_e(q̄) = 1 − 0.0004·q̄ (0.93 at 181, 0.89 at 280).
- **Stabiliser**: k_s(q̄) = 1 − 0.0003·q̄ (the tail bends too; −8 % at cruise).
- **Pitch damping**: k_q(q̄) = 1 − 0.0004·q̄.
- **Held above 500 psf** (about 390 KEAS): FLEXSTAB's points stop at 280 psf and the aircraft's clearance not far beyond; extrapolated to 1,100 psf the line put the neutral point on the CG, and a random-input flight that dived to 574 KIAS pulled 4.8 g on a degree of elevator.

Check: with k_e on the moment table as on the lift (5.3), the correction takes the same share that FLEXSTAB's does: applied to FLEXSTAB's own rigid slopes, 0.888 × (−0.0220) + 0.053 × 0.0876 = −0.0149 /deg against its elastic −0.0150 (data 8.6). The model's own rigid slopes at Mach 0.77 are the tunnel's scaled by f_M, 12 % below FLEXSTAB's (Cmα −0.0194 against −0.0220, CLα 0.094 against 0.0986), so its elastic Cmα comes out at −0.0126 /deg against FLEXSTAB's −0.0150 and the flight test's −0.015, and its static margin 0.196 → 0.143 c̄ against FLEXSTAB's 0.224 → 0.171: the same forward shift of 0.053 c̄ on a slightly smaller margin (measured by `tests/aero.test.js`, which checks the ratio and the shift).

The lateral derivatives get no elastic correction: the flight-test values used for the dampings already include it, and the static ones are inside Crenshaw's bracket (5.5). These corrections are what makes the jet handle like a flexible 707-class transport rather than a stiff tunnel model; they are labelled as FLEXSTAB's, not measured.

### 5.8 The stall

There is no limiter: the pilot can stall the jet. What the tables do past 14°: lift stops at 1.14 (a 1 g clean stall at 160 KEAS at this weight), drag climbs, and from 15° the tail-0° Cm drops nose-down (data 3.1), so the nose falls through on its own once past the plateau; between 9° and 14° the moment goes flat, the real pitch-up, and the nose keeps rising for little extra pull. At 20° the tables end and are held (section 4). There is no roll-off, no asymmetry and no post-stall data; the buffet cue (10) is the warning. Not a certified stall model: an air-start jet flown within the buffet never gets there, and the behaviour past the plateau is "the nose drops, the wing is still flying at 1.14".

## 6. Engines

Four F108-CF-100 (CFM56-2B-1), one command (data 12).

- **The maximum available**, per engine, at the present altitude and Mach: the take-off rating, T₀ = 22,000 lbf sea-level static, lapsed with Mach and altitude by the Bartel and Young equations as printed in OpenAP (E3, data 12), with λ = 6.0 and the reference cruise thrust 4,600 lbf at Mach 0.78 and 35,000 ft. OpenAP's take-off equation (its 17–21, pressure ratio and Mach) is used to 10,000 ft and its en-route equation (22–23, pressure and Mach) from 30,000 ft up, blended linearly in pressure between; its two climb segments (24–28) take a trajectory tool's vertical speed and calibrated-airspeed ratio and are not used. The en-route equation is kept above 40,000 ft, where it tracks the pressure within 1 %. T_max(h, M) is a function in `engine`, with a table of spot values in its test (22,000 static; 5,309 at FL300, Mach 0.78; 3,045 at Crenshaw's cruise 2). This cap is the stand-in for the PMC: it is the certified rating lapsed, not a schedule from a manual.
- **MCT** is 0.981 of take-off (21,579 lbf static, data 12), lapsed the same way. **Flight idle** is 0.07·T₀ lapsed the same way, an assumption (the ICAO idle point, data 12).
- **The throttle** s (0..1) asks for a fraction of what is available now: T_cmd = T_idle + (T_MCT − T_idle)·s/0.85 up to the detent at s = 0.85; above it, T_MCT + (T_TO − T_MCT)·(s − 0.85)/0.15. Above the detent there is only 2 % more thrust, as in the jet; the detent is there so the thumb knows it is asking for take-off power.
- **Spool lag**: each engine's thrust follows T_cmd through a first-order lag whose time constant depends on where the engine is: τ = 1.0 s at or above 20 % of T₀, rising linearly to 3.0 s at idle. A test checks flight idle to 95 % thrust in under 5 s at sea level, the certification ceiling (14 CFR 33.73), and about 4 s is the target. All four engines get the same command and have the same lag, so they stay matched; the state holds four values so an engine-out can be added later without changing the equations.
- **N1 shown**, per cent, a cue and not data (data 12). The PMC caps the fan's *corrected* speed, so the physical speed at the cap falls with the square root of the temperature ratio: N1_max(h) = 102 · √θ, which is 102 % at sea level, 98 % at 10,000 ft, 91 % at FL300 and 88 % above the tropopause. The N1 shown for a thrust is N1_max · √(T / T_max(h, M)), the square law standing in for the fan's thrust against speed. So the maximum N1 falls with altitude, which is what the owner sees in the jet, from the cap's physics alone; the figures are tuned to the owner's memory of the real numbers on the phone, not to data. Flight idle shows about 27 % at sea level. (A corrected-flow law using OpenAP's sea-level Mach lapse was tried first and gave 108 % at FL300: OpenAP's two thrust equations disagree on the Mach effect by 40 %, so that algebra does not close.)

## 7. Actuators

| Surface | Position limit | Rate limit | Lag | Why |
|---|---|---|---|---|
| Elevator δe | ±20° | none (the pilot's hand) | first order, τ = 0.1 s | Manual, cable and tab; the lag is the cable run and the tab. Travel an estimate (data 11.1) |
| Stabiliser i_s | +0.5° to −14° | **0.5°/s** | none | The trim motor. Rate an estimate, tuned so a big speed change needs the yoke for a few seconds (data 11.1) |
| Roll control δa | ±20° | 40°/s | τ = 0.1 s | Aileron plus spoiler as one surface (5.5) |
| Rudder δr | ±δr_max(KCAS) | 50°/s | τ = 0.1 s | The rudder power unit's authority: δr_max = min(25°, 7° · (320/KCAS)²), from the 7° at 320 kt the Shell 77 board quotes (data 11.1), falling as the square of speed as a force-limited unit does. 25° is the structural travel, an estimate |

The trim solver and the layer-1 tests bypass the actuators and set surface positions directly.

## 8. Flight controls

### 8.1 What's real and what isn't

The KC-135 has reversible, tab-driven elevator and ailerons, hydraulic spoilers for roll assist, a powered rudder, an electric stabiliser trim and a series yaw damper (data 11). The structure below follows that. **Real:** the yoke moves the surfaces and nothing shapes it; the stabiliser is the trim and moves at a slow, fixed rate; the yaw damper exists and is on all the time. **Ours, by the owner's decision (CLAUDE.md, Departures):** the trim switch and the rudder pedals are automatic; the trim's logic, the damper's gains and the coordination are tuning values with no public source. **Estimated:** the elevator's power and travel, the roll control's power, the rudder's authority law, the trim rate.

Input arrives as x_pitch and x_roll, each −1..+1 (section 11), and the throttle s. Positive x_pitch is a pull; positive x_roll is right.

### 8.2 Pitch: the yoke is a force

The tilt is a force on the yoke, and the elevator moves as far as that force can push it against the air:

```
δe = −clamp(x_pitch · K_e / q̄, −20, 20)      // deg; K_e in deg·psf; then the actuator
```

This is the physics of a reversible control, not a gain schedule: a surface's hinge moment grows with q̄ as its pitching power does, so a given force gives about the same g at every speed above the stall, the stick-force-per-g a transport pilot feels, and at low speed the same force reaches the stops. **K_e = 1,500 deg·psf**: full tilt at cruise (q̄ 268 psf) gives 5.6° of elevator and a peak of 2.7 g (the short period overshoots a steady 2.1 g pull), a transport's limit-load pull. The 2,100 first estimated gave 8° and took the jet to 3.1 g and 18° of α, through the lift plateau: an accelerated stall from a full tilt. The push side is symmetric, which overstates a real yoke's forward travel a little and is accepted. Tuned in 1b against test 10 of 12.2; to be felt on the phone.

There is no g limiter, no AoA limiter and no stall protection: the jet's own stability and the buffet are the protection, as in the aircraft.

### 8.3 Automatic trim: the stabiliser does what the pilot's thumb does

The real pilot holds the trim switch until the yoke force is gone, at whatever speed they have settled on. War Wagon's rule: **with the yoke released, the stabiliser runs toward 1 g.**

```
e        = (1 − n_z) − K_q · washout(q_deg, 5 s)   // the g error, less the g the changing pitch rate is about to deliver
released = |x_pitch| < 0.05
i_s_rate = released and |e| > 0.005 ? −clamp(K_t · e, −0.5, +0.5) : 0    // deg/s; e > 0 → leading edge down (nose up)
i_s      = clamp(i_s + i_s_rate · dt, −14, +0.5)
```

with q_deg the pitch rate in deg/s, **K_q = 0.15 g per deg/s** and **K_t = 2 deg/s per g**, so the stabiliser runs at its full 0.5°/s whenever the error is over a quarter of a g and slows as it closes. The pitch-rate term is the thumb's judgement: a nose already rising toward 1 g needs no more nose-up trim. It is washed out (a 5 s high-pass) so that a steady turn's steady pitch rate does not count as a change coming: without the washout the jet settled at 0.95 g in a released 30° bank. The deadband is small (0.005 g) because any error inside it is a slow flight-path drift the trim will not correct: at 0.02 g the jet lost 1,700 ft in two minutes of hands-off acceleration, at 0.005 g 600 ft. The trim holds 1 g, not altitude; that is the design (8.6). Without it the loop limit-cycles (a three-degree-of-freedom check of a throttle-to-idle step at cruise: n_z 0.84 to 1.17 g with a 15 s period, for as long as it ran, because the stabiliser keeps running while the jet's slow response is still developing and then reverses after the overshoot); with it the same step settles to n_z 0.95–1.00 within 20 s and 1 ± 0.01 after, at cruise and at the air start. K_q and K_t are tuning values; the 0.5°/s is the datum.

- **While the yoke is held the trim is frozen.** A brief pull-up is not trimmed into; a long turn is flown with a held pull, as in the jet when the pilot leaves the trim alone. (The real pilot would trim a sustained turn; the automatic trim doesn't guess.)
- **The rate limit is the realism.** After a throttle change the jet is out of trim: the released yoke gives δe = 0, the nose moves, and the stabiliser takes seconds to catch up, during which the pilot holds the nose with the yoke. The slow rate means the phugoid is only partly damped by the trim; the trim-frozen tests measure the bare airframe.
- **What it implies, stated plainly:** the jet holds 1 g at whatever speed it has, so with the throttle at idle and the yoke released it flies level, slows, and trims its way toward the stall; the buffet is the warning. The trim stops at its travel (−14°). In a bank it still trims to 1 g, so the nose drops: holding altitude in a turn needs a pull, as in the jet (no bank compensation).
- **Starting state.** At an air start the trim solver sets i_s so that δe = 0 at 1 g; the trim has nothing to do until the pilot changes something.

### 8.4 Roll: the wheel is a position

```
δa = −x_roll · 20      // deg; then the actuator
```

The wheel's angle sets the surfaces' angle through a fixed linkage, as the spoiler mixer does, so the roll rate per wheel angle rises with speed: a heavy jet is slow to roll at approach speed and brisker at cruise. Released, the surfaces centre and the jet holds its bank (less the spiral mode's slow drift). Target: 30° of bank from wings level within 2 s of full wheel at cruise and at the air start, the MIL-F-8785C Class III Category B Level 1 figure, met by tuning Cl_δa within its range (5.5), never by adding a rate command. As tuned: 1.8 s and 43°/s at cruise, 2.0 s and 32°/s at the air start.

### 8.5 Yaw: the yaw damper, and coordination on top of it

No pedals. Two terms drive the rudder:

```
rdr = K_yd · washout(r_s, τ_w) · 57.3      // yaw damper: opposes yaw rate, washed out so steady turns are not fought
    + K_ny · n_y                          // coordination: centres the ball (ours)
rdr = clamp(rdr, −δr_max, δr_max)
```

with r_s = r·cosα − p·sinα the stability-axis yaw rate. The damper is real (the KC-135R's series yaw damper, data 11.2) and its structure is the classic one; the gains are ours. As tuned in 1b: **K_yd = 0.7 deg per deg/s, τ_w = 4 s, K_ny = 70 deg/g.** The damper's target was a dutch roll damping ratio of 0.3–0.5 at the three tuning conditions, from the bare airframe's 0.05–0.09 (data 8.5), within the rudder's authority (7): K_yd 1.0 gave 0.48–0.54, 0.5 gave 0.24–0.29, 0.7 gives 0.32–0.38 with the period 4.9–5.2 s. The coordination's target was sideslip within ±2° through a full-wheel roll to 60° and back: the rudder was nowhere near its authority (under 3° of 8°), so the gain was simply raised, from 10 (2.9° of sideslip) through 50 (1.9°) to 70 (1.5° at cruise, 1.9° at the air start). The two did not pull against each other. A 5° sideslip released at cruise takes the rudder to its authority for a moment and is gone in 20 s. No gain schedule was needed; if the n_y loop misbehaves at high q̄ on the phone, the Rage fix (a 1/q̄ schedule on K_ny) is the first thing to try.

### 8.6 What not to add

- No g command, rate command, limiter, stall protection, or bank or climb compensation. The jet is conventional.
- No altitude, heading or bank hold (parked: the two-axis autopilot).
- No stick shaker or pusher: the KC-135 has none; the buffet is the cue.
- No trim while the yoke is held.

### 8.7 Tuning targets

Tune in 1b at the air start (10,000 ft, 280 KIAS), at cruise (FL300, Mach 0.78) and at FL350, Mach 0.80, all at 240,000 lb, with the trim solver plus finite-difference linearisation for the open-loop modes and the full simulation for the closed-loop checks. The numbers in 12.2 are the pass bands; the flight-test modes of data 8.5 are the centre of them. Explain every tuning decision in plain words in the pull request.

**Measured in 1b** (`tests/flight/modes.test.js`, bare airframe unless stated; `node tests/flight/fly.js modes` prints them):

| | Air start | Cruise | FL350, Mach 0.80 | Flight test (data 8.5) |
|---|---|---|---|---|
| Short period | 1.84 rad/s, ζ 0.50 | 1.75, ζ 0.38 | 1.46, ζ 0.39 | 1.39–1.67, ζ 0.39–0.68 |
| Phugoid | 84 s, ζ 0.033 | 120 s, ζ 0.042 | 128 s, ζ 0.094 | 40–110 s, ζ 0.03–0.06 |
| Dutch roll | 4.37 s, ζ 0.089 | 4.34 s, ζ 0.059 | 4.71 s, ζ 0.054 | 4.4–4.8 s, ζ 0.056–0.063 |
| Dutch roll, damper on | 4.97 s, ζ 0.38 | 4.88 s, ζ 0.36 | 5.24 s, ζ 0.32 | |
| Roll mode τ | 0.73 s | 1.01 s | 1.20 s | 0.74–1.0 s |
| Spiral | T₂ 183 s | T₂ 260 s | T₂ 268 s | stable, T½ 45–85 s |

Nothing in the lift, moment, drag or sideslip tables was tuned: these are what the data give, with one calibration. The dutch roll at cruise, 4.34 s at ζ 0.059 against the flight test's 4.4 s at 0.056, is the clearest sign the lateral data are right. The spiral is weakly unstable where the flight test found it weakly stable (FLEXSTAB also had it unstable); at four minutes to double it is inside the handling band and the pilot will not notice it. **The calibration: Mach tuck.** With the tail-off tunnel's tuck applied in full, the bare airframe at cruise and above had no phugoid: its two slow roots were real and one unstable, doubling in 18 s at Mach 0.78 and 11 s at 0.80, and with the tuck zeroed the pair returned (111 s). The flight test measured a 110 s phugoid at Mach 0.77 (data 8.5), so the real aircraft is speed-stable there and the tail-off curve overstates the tail-on aircraft's tuck below the drag-divergence Mach by about ten times; FLEXSTAB's Cm_u (data 8.4) says the same. The owner chose to calibrate to the flight test (5.6): a tenth of the tunnel's curve to Mach 0.82, the tunnel's increments in full above. The phugoids in the table are the result; at Crenshaw's cruise 1 the model gives 113 s. Above 0.82 the tuck-under is still there, doubling in 58 s at 0.82, which the automatic trim holds as a Mach trim compensator would and the pilot meets only with the yoke held at high Mach.

## 9. Air data for the HUD

- **Mach** = VT/a.
- **KIAS**: the calibrated airspeed from impact pressure as Rage section 9 (subsonic only; a KC-135 never sees the Rayleigh branch). No position-error correction is public, so **KIAS is shown equal to KCAS**, stated.
- **Altitude**: h in feet (pressure altitude equals geometric altitude in the standard atmosphere).
- **VSI**: the vertical speed ḣ in ft/min through a first-order lag, **τ = 4 s**, a generic instrument value (data: none; stated). Shown signed, + climbing, − descending, rounded to 50 ft/min.
- **Heading**: degrees true, 0–359, from the Euler angles.
- **N1**: section 6, from the engines' thrust, not the slider, so the spool lag shows. One number: the four engines are matched.
- **Flight path marker** (the velocity vector) and **waterline** (the nose), as Rage.

## 10. Cues: what the pilot feels without sound

Each cue is driven by the model, never by a timer or a script. Starting values; tune on the phone.

- **Buffet**: a small, high-frequency camera shake, the one cue the data document. Its onset is the buffet boundary of data 9.3, CL against Mach (0.71 at Mach 0.50, 0.76 at 0.70, 0.63 at 0.78, 0.58 at 0.80, 0.50 at 0.82; held at 0.71 below Mach 0.50, where the boundary is the low-speed stall's approach). The shake starts at 90 % of the boundary's CL and reaches full amplitude on it, scaled by q̄. At cruise weight and FL350 the boundary is close: that corner is the cue's purpose. Below Mach 0.5 the same rule reads the stall's approach, since the buffet CL of 0.71 is where the tunnel's lift curve starts to round over.
- **Load**: the chase camera rises as g builds and drops under negative g, as Rage (0.35 m per g). The range here is 0 to 2.5 g; it reads the same way.
- **Trim**: the stabiliser is visible on the model, moving at its slow rate, and the nose's drift while it catches up is the cue that the jet is out of trim.
- **Mach**: the nose settling lower at the same stabiliser as the Mach number climbs, and the airspeed stopping its rise as the drag rise bites, both from the tables.
- **Energy**: speed bleeds in a hard turn and the buffet comes earlier at altitude; both on the HUD.

## 11. Pilot input: tilt to yoke

### 11.1 Reading the phone

Rage's section 11.1, unchanged: the screen-up vector, the neutral attitude captured at Fly and at Recenter, pitch and roll measured against it, confidence from the screen's attitude. The signs are confirmed on the iPhone with the debug overlay.

### 11.2 Mapping

- **Pitch:** tilting the top edge toward you is a pull. Full force at 25° of tilt from neutral. The tilt is a force (8.2), so the same tilt gives about the same g at any speed.
- **Roll:** turning the phone like a yoke. Clockwise rolls right. Full wheel at 30°.
- **Deadband** 2° in pitch and 1.5° in roll, standing in for the yoke's breakout. Beyond it, tilt maps linearly to −1..+1.
- **Smoothing:** a first-order filter, τ ≈ 20 ms, as Rage. The jet's own slowness does the rest; no further shaping.
- **Confidence** and **Recenter** as Rage.

### 11.3 Throttle

The slider on the left edge, as Rage, mapped to s = 0..1 with the detent at 0.85 (section 6): the thumb has to cross a small gap to go above MCT. It starts at the trim setting.

## 12. Acceptance tests

Three layers, all headless in Node with nothing installed, and each flight test prints what it measured.

### 12.1 The model is the data

- **Every table is its chart.** For each table in `src/sim/data/`, the test reads the chart's JSON record in `research/charts/` and checks every breakpoint value is equal to the data file's row (exact, since both are typed from the same record), and that the derived constants (Cm_δs from the two tail runs, the polar's 0.0155 and 0.047 from Lux's points, the drag-rise table from the trace) are what sections 5.2–5.6 say; and that at Mach 0.28 the model's CD(α) from −4° to 8° is the tunnel's table less a near-constant, within ±0.0025 (the tunnel's own CD reading accuracy, data 4.1: the tunnel's points scatter that much about their parabola).
- **The trim solver reproduces the flight points** (δe = 0, wings level):

  | Point | Condition | Pass when |
  |---|---|---|
  | Crenshaw cruise 1 (data 8.1, 8.3) | 284,000 lb, 28,500 ft, Mach 0.77 | θ 2.4 ± 1.0°; thrust 16,352 ± 15 %; i_s −2.3 ± 1.5° |
  | Crenshaw cruise 2 | 130,000 lb, 45,600 ft, Mach 0.77 | θ 1.6 ± 1.0°; thrust 7,510 ± 15 %, and within the maximum available |
  | Crenshaw climb 3 | 297,000 lb, sea level, Mach 0.422, γ 4.01° | θ 7.0 ± 1.0°; thrust 38,800 ± 20 % (flight test; FLEXSTAB had 45,910). Its stabiliser is not checked: FLEXSTAB's climb model has CD 0.039 against the flight test's 0.025 and its thrust 18 % high, so its −3.84° is not a reference |
  | G5's 1998 trim point (data 13) | 240,000 lb, 21,000 ft, 622 ft/s | θ 2.5 ± 1.0° |
  | Lux's polar (data 9.4) | 240,000 lb at the altitude giving CL 0.40, 0.45, 0.50 at Mach 0.70, 0.75, 0.78, 0.80 (where read) | CD within 0.0006 of the table's: his reading accuracy (0.0004) plus the 0.0005 by which his CL 0.45 points sit off a parabola (the polar reproduces two of the Mach 0.70 points by construction; the others are the check) |

  The solver takes the weight as an argument for these; the game's weight is fixed.
- **Atmosphere**: p, ρ, T and a at 0, 10,000, 20,000, 30,000, 36,089, 40,000 and 50,000 ft within 0.2 % of the 1976 standard tables.
- **Engine**: T_max at the spot values of its table; N1 shows 102 % at sea-level static take-off power; the spool from flight idle to 95 % in under 5 s and over 3 s at sea level.
- **Inertia constants**, **frames**, **signs** (each surface, the thrust line, β), **ground**: as Rage 12.1.

### 12.2 It handles like a 707-class jet

The modes are measured with the trim frozen and the yaw damper off unless stated ("bare"), by linearising about the trim at 240,000 lb at the three conditions of 8.7, and compared with the flight-test modes of data 8.5 (the Boeing 1973 summary via Crenshaw, at other weights and conditions, which is why the bands are wide) and with MIL-F-8785C Class III, Category B, Level 1. Then the closed-loop checks fly the full simulation from a trimmed air start with scripted inputs.

| # | What | Pass when |
|---|---|---|
| 1 | Short period, bare, three conditions | ωn 1.2–2.2 rad/s, ζ 0.3–0.7 (flight test: 1.39–1.67 rad/s, 0.39–0.68; 8785C: ζ 0.3–2.0) |
| 2 | Phugoid, bare, three conditions, plus Crenshaw's cruise 1 | period 50–130 s; ζ ≥ 0 (flight test 40–110 s, ζ 0.03–0.06; 8785C Level 1 wants ζ ≥ 0.04, which the real jet barely meets, so Level 2's ζ ≥ 0 is the band); at cruise 1 (284,000 lb, 28,500 ft, Mach 0.77) within 25 % of the flight test's 110 s, the tuck calibration's anchor (5.6). Reported, not a band: at Mach 0.82 the bare airframe tucks under, and 60 s hands-off at cruise with the trim on holds n_z 1 ± 0.05 with the Mach and altitude unchanged |
| 3 | Dutch roll, bare | period 3.8–5.5 s (flight test 4.4–4.8 s at cruise and climb; the Shell 77 board about 5 s), ζ 0.03–0.15 |
| 4 | Dutch roll, yaw damper on | ζ 0.3–0.5, and the rudder within δr_max throughout a 5° sideslip release |
| 5 | Roll mode, bare | τ 0.6–1.4 s (flight test T½ 0.51–0.70 s → τ 0.74–1.0 s; 8785C ≤ 1.4 s) |
| 6 | Spiral, bare | stable, or doubling time ≥ 20 s (flight test stable, T½ 45–85 s; 8785C T₂ ≥ 20 s) |
| 7 | Full wheel, 1 g, cruise and air start | 30° of bank within 2.0 s; steady roll rate 25–45°/s; |β| ≤ 2° throughout a roll to 60° and back (damper and coordination on) |
| 8 | Throttle to idle from cruise, yoke released, 60 s | n_z within 1 ± 0.15 throughout and 1 ± 0.05 after 20 s; i_s moves at 0.5°/s and no faster; speed falls; no pitch divergence |
| 9 | Throttle to full from the air start, yoke released, 60 s | as 8, climbing |
| 10 | Full pull at cruise, 5 s | n_z reaches 2.2–2.8 within 4 s (K_e sets it); no divergence |
| 11 | Yoke released in a 30° bank at cruise, 20 s | bank holds within 10°; altitude falls (no compensation) |
| 12 | Idle, level, a scripted pilot holds altitude until α reaches 15°, then releases the yoke, air start | the buffet cue starts before α reaches the plateau; with the yoke released the nose drops within 3 s and α is back under 12° within 10 s; no NaN. (A pilot who keeps pulling can hold the nose up past 20° with 9° of elevator: the pitch-down is the airframe's, not a pusher's) |
| 13 | Full throttle from cruise at FL300, yoke released, trim on, 3 min | the Mach settles between 0.82 and 0.88 (ΔCD_M: it tops out near 0.84, where the drag rise meets the thrust; the 1 g trim lets it climb 1,500 ft on the way). ΔCm_M shows in the bare airframe's tuck-under above 0.82 (test 2's report), not in the level trim (5.6) |
| 14 | VSI | a step in ḣ reads 63 % at 4 s |
| 15 | Thrust cap | T_max at sea level static = 22,000; at FL200 and FL350 at Mach 0.6 and 0.8 equal to the table of spot values; N1 shown at full throttle falls from 102 % at sea level to 85–98 % at FL350 |
| 16 | Random inputs, sixteen 60 s flights from 160 to 350 KIAS and 5,000 to 40,000 ft | no NaN; nothing outside the envelope flag that the inputs did not ask for |

When a band can't be met, stop and report the numbers.

### 12.3 It performs like a KC-135R

Computed with the trim solver on the model, clean, from public figures only (data 13):

| Check | Public figure | Pass when |
|---|---|---|
| Cruise speed | 530 mph at 30,000 ft (the fact sheet) | level flight at 240,000 lb, 30,000 ft, 460 KTAS (Mach 0.78) with thrust at or below MCT, and the rate of climb there ≥ 500 ft/min at take-off power |
| Ceiling | 50,000 ft (the fact sheet, weight unstated); Crenshaw's cruise 2 at 45,600 ft and 130,000 lb | at 130,000 lb the service ceiling (100 ft/min at MCT, Mach 0.78) is 47,000–56,000 ft and the jet is below its buffet boundary there; at 240,000 lb it is 38,000–44,000 ft, reported |
| The 1998 trim point | 12.1 | as 12.1 |
| Cruise drag | CD 0.024 at Mach 0.77–0.78, CL 0.42 | 12.1's Lux rows |
| Zero-g parabola | 20–25 s of zero g from a 350 KIAS entry, about 1.8 g in the pull-up (NASA) | a scripted pilot at 24,000 ft, 350 KIAS, pulls 1.8 g to a 45° climb then holds n_z = 0 ± 0.1 with the yoke and matches drag with the throttle: zero g held for ≥ 20 s within the elevator's travel, speed never below 150 KIAS |
| Stall, Vmo, Mmo, CG limits | Not public outside the T.O.s | reported against the 707/720 FAA values, not tested (CLAUDE.md) |

### 12.4 On the phone

No test above can check the feel. Milestone 1c ends with the owner flying it, with the debug overlay showing the raw angles, pitch and roll, n_z, α, β, i_s, δe, N1 and fps.

## 13. Out of scope for now

| Item | Why |
|---|---|
| Fuel burn, weight and CG change | One weight, fixed (CLAUDE.md) |
| Flaps, gear, speed brakes, brakes, takeoff and landing | Later milestones; the flap and gear data are read (data 6, 7.3) |
| Rudder pedals, engine-out, asymmetric thrust | Parked; needs the rudder off automatic |
| Trim drag varying with stabiliser angle; aileron, spoiler and rudder drag | A few counts; inside the drag data's scatter |
| α and Mach dependence of the lateral derivatives; β̇ terms | One tunnel point and FLEXSTAB's bracket; the modes land in their bands without them |
| Post-stall, roll-off, spins | No data past α 20°; the stall is "nose drops, lift held" (5.8) |
| Above Mach 0.90 | The data end; values held |
| Vmo/Mmo and the overspeed, structural limits, g-limits | Not public; nothing happens beyond the aerodynamics |
| Ground effect | A4 has the data; with landing |
| Autopilot, air refuelling, the boom's aerodynamics | Parked |
| Sound | A later milestone |

## 14. Sources

Every number's source is in `docs/kc135-data.md`, section by section, and the documents are logged in `research/README.md` and registered in `docs/kc135-sources.md`. The ones this file leans on: NASA TM 73,250 (the low-speed tables), AFFDL-TR-77-23 (Mach), NASA CP-2211 (Lux's flight polars), Crenshaw's AFIT thesis (inertias, rate derivatives, the elastic correction, the flight-test modes), EASA's type certificate and the OpenAP paper (the engines), the Shell 77 board (the rudder's authority, the dutch roll's period), MIL-F-8785C (the handling bands), and the fact sheet. The KC-135 flight manuals and other T.O.s were not used, per the owner's rule.
