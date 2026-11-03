// The yoke indicator: a small, faint cross showing where the tilt is, inside
// a square for full deflection. It shows when the yoke's force has reached
// the elevator's stop, and when the controls need recentering.

export function createStickIndicator(root) {
  const dot = root.querySelector('.dot');
  const half = () => root.clientWidth / 2 - 5;
  let pulsePending = false;
  root.addEventListener('animationend', () => root.classList.remove('pulse'));
  return {
    // the controls were just recentered: glow once, the next time the indicator is drawn
    pulse() { pulsePending = true; },
    // yoke: { pitch, roll } in −1..+1; stop: the elevator is at its travel
    // limit; recenter: the tilt reading is unreliable
    update(yoke, stop, recenter) {
      const r = half();
      // pull is aft: the dot moves down the square, as the yoke would come toward the pilot
      dot.style.transform = `translate(${yoke.roll * r}px, ${yoke.pitch * r}px)`;
      root.classList.toggle('stop', stop);
      root.classList.toggle('recenter', recenter);
      if (pulsePending) { pulsePending = false; root.classList.remove('pulse'); void root.offsetWidth; root.classList.add('pulse'); }
    },
  };
}
