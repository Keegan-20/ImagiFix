/**
 * The adjustment panel. Controls are generated from the FILTERS catalogue,
 * so the markup never duplicates config and new filters appear automatically.
 *
 * `input` updates state live (rAF-batched repaint happens via the store
 * subscription in main.js); `change` (slider released) commits one history
 * entry, giving clean undo granularity instead of one per pixel of drag.
 */
import { FILTERS } from '../config/constants.js';
import { ensureImage } from './guards.js';
import { setRangeFill } from '../ui/range.js';

const formatValue = (filter, value) =>
  filter.format ? filter.format(value) : String(value);

export function initFiltersPanel({ store, history, dom }) {
  const inputs = {};
  const outputs = {};

  FILTERS.forEach((filter) => {
    const item = document.createElement('div');
    item.className = 'toolbar__item';

    const label = document.createElement('label');
    label.className = 'toolbar__label';
    label.htmlFor = filter.id;
    label.textContent = filter.label;

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'range';
    input.id = filter.id;
    input.min = String(filter.min);
    input.max = String(filter.max);
    input.value = String(filter.default);
    input.setAttribute('aria-describedby', `${filter.id}Value`);

    const output = document.createElement('output');
    output.id = `${filter.id}Value`;
    output.htmlFor = filter.id;
    output.textContent = formatValue(filter, filter.default);

    input.addEventListener('input', () => {
      if (!ensureImage(store)) {
        input.value = String(store.getState().filters[filter.id]);
        return;
      }
      const value = Number(input.value);
      store.update((s) => { s.filters = { ...s.filters, [filter.id]: value }; });
      output.textContent = formatValue(filter, value);
    });

    // Commit a single history entry when the gesture ends.
    input.addEventListener('change', () => {
      if (store.getState().image) history.record();
    });

    item.append(label, input, output);
    dom.filterControls.appendChild(item);
    inputs[filter.id] = input;
    outputs[filter.id] = output;
  });

  // Reflect external state changes (undo/redo/reset/load) back into the UI.
  store.subscribe((s, prev) => {
    if (s.filters === prev.filters) return;
    FILTERS.forEach((filter) => {
      const value = s.filters[filter.id];
      if (inputs[filter.id].value !== String(value)) {
        inputs[filter.id].value = String(value);
      }
      setRangeFill(inputs[filter.id]);
      outputs[filter.id].textContent = formatValue(filter, value);
    });
  });

  return { inputs, outputs };
}
