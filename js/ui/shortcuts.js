/**
 * Keyboard shortcuts. The SHORTCUTS table maps a normalised combo string to an
 * action name; `actions` supplies the implementations. Single-key shortcuts are
 * suppressed while typing in a field, but modifier combos (Ctrl+S/Z/Y) still
 * work everywhere.
 */
import { SHORTCUTS } from '../config/constants.js';

/** Build a canonical "ctrl+shift+key" string from a keyboard event. */
function comboFromEvent(e) {
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = e.key.toLowerCase();
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key);
  return parts.join('+');
}

/**
 * @param {Record<string, () => void>} actions  action name → handler
 */
export function initShortcuts(actions) {
  const map = new Map(SHORTCUTS.map((s) => [s.combo, s.action]));

  window.addEventListener('keydown', (e) => {
    const action = map.get(comboFromEvent(e));
    if (!action || !actions[action]) return;

    const el = e.target;
    const typing =
      el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
    const modified = e.ctrlKey || e.metaKey;

    // Let people type "r" / "h" / "v" in fields without rotating the image.
    if (typing && !modified) return;

    e.preventDefault();
    actions[action]();
  });
}
