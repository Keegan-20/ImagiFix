/**
 * Slider fill — paints the filled portion of a `.range` by writing a 0–100%
 * length into the `--range-fill` custom property the CSS gradient reads.
 *
 * Live drags are handled by a single delegated `input` listener; programmatic
 * value changes (undo / redo / reset / load) call `setRangeFill` directly from
 * the feature that set the value.
 */

/** Update one slider's fill from its current value. */
export function setRangeFill(input) {
  const min = Number(input.min) || 0;
  const max = Number(input.max);
  const span = max - min;
  const pct = span > 0 ? ((Number(input.value) - min) / span) * 100 : 0;
  input.style.setProperty('--range-fill', `${pct}%`);
}

/** Wire live fill updates for every current and future `.range` under `root`. */
export function initRangeFills(root = document) {
  root.addEventListener('input', (e) => {
    if (e.target.classList?.contains('range')) setRangeFill(e.target);
  });
  root.querySelectorAll('.range').forEach(setRangeFill);
}
