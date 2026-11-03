// Piecewise-linear table lookup. Breakpoints must be ascending; they need
// not be evenly spaced. Inputs outside the breakpoints are clamped to the end
// values (docs/flight-model.md section 4: the tables are held, never
// extrapolated).

// Index of the segment that x falls in, and the fraction along it, with x
// clamped to the breakpoints' range.
function locate(points, x) {
  const n = points.length;
  if (x <= points[0]) return { i: 0, f: 0 };
  if (x >= points[n - 1]) return { i: n - 2, f: 1 };
  let i = 0;
  while (i < n - 2 && x > points[i + 1]) i++;
  return { i, f: (x - points[i]) / (points[i + 1] - points[i]) };
}

// values[k] at points[k]
export function interp1(points, values, x) {
  const { i, f } = locate(points, x);
  return values[i] + (values[i + 1] - values[i]) * f;
}

// values[row][col] with rows at rowPoints and columns at colPoints
export function interp2(rowPoints, colPoints, values, row, col) {
  const r = locate(rowPoints, row);
  const c = locate(colPoints, col);
  const v0 = values[r.i][c.i] + (values[r.i][c.i + 1] - values[r.i][c.i]) * c.f;
  const v1 = values[r.i + 1][c.i] + (values[r.i + 1][c.i + 1] - values[r.i + 1][c.i]) * c.f;
  return v0 + (v1 - v0) * r.f;
}
