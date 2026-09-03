/**
 * Text overlay tool — a list of live, repositionable objects.
 *
 * Two earlier limitations shaped this. The first version committed the text
 * the instant you clicked the canvas, with no way to nudge it afterwards; the
 * second held a *single* overlay, so labelling a before/after picture was
 * impossible — every new caption overwrote the last. So state carries a list,
 * and the tool works the way every photo editor does: entering starts a
 * *session*, each overlay is drawn live, you click one to select it and drag
 * (or arrow-key) it into place, and only Done commits a history entry. Cancel
 * and Esc restore the whole list exactly as it was, so re-opening committed
 * text to move it is risk-free.
 *
 * The panel has one rule, and everything else follows from it: **it edits the
 * selection, and composes a new label when there is none.** So adding a label
 * deselects and empties the field — otherwise the next thing you type would
 * live-edit the label you just placed instead of starting the next one, which
 * is exactly how "add a second caption" turned into "overwrite the first".
 * Click a label on the canvas to select it and the panel becomes its inspector.
 *
 * Canvas pointer ownership is arbitrated through `state.activeTool`, so crop
 * and text never fight over the same gesture.
 */
import { CANVAS, TEXT_CASCADE, TEXT_DEFAULTS } from '../config/constants.js';
import { getCanvasPoint, getImageBox } from '../canvas/geometry.js';
import { getTextRect, toTextSpace } from '../canvas/renderer.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { clamp } from '../utils/helpers.js';
import { ensureImage } from './guards.js';

const GRAB_PAD = 8;   // slop around the glyphs that still counts as a grab
const NUDGE = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

let nextId = 0;
const newId = () => `t${(nextId += 1)}`;

export function initText({ store, history, dom, panels }) {
  const { canvas } = dom;
  const ctx = canvas.getContext('2d'); // measuring only — always save/restore

  /** Live session, or null when idle. Holds the list Cancel restores. */
  let session = null;
  /** Active pointer gesture, null when idle. */
  let drag = null;

  const isArmed = () => store.getState().activeTool === 'text';

  /** The overlay currently under the panel's controls, or null. */
  const active = () => {
    const s = store.getState();
    return s.texts.find((t) => t.id === s.activeTextId) ?? null;
  };

  // ------------------------------------------------------------------ panel

  const readPanel = () => ({
    content: dom.textContent.value.trim(),
    color: dom.textColor.value,
    size: Number(dom.textSize.value),
  });

  const writePanel = (text) => {
    dom.textContent.value = text.content;
    dom.textColor.value = text.color;
    dom.textSize.value = String(text.size);
    dom.textSizeValue.textContent = String(text.size);
  };

  // ---------------------------------------------------------------- writing

  /** Replace one overlay in the list; the array itself is never mutated. */
  const patchText = (id, patch) => {
    const s = store.getState();
    store.setState({ texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  };

  const patchActive = (patch) => {
    const t = active();
    if (t) patchText(t.id, patch);
  };

  const select = (id) => {
    store.setState({ activeTextId: id });
    const t = active();
    if (t) writePanel(t);
  };

  // --------------------------------------------------------------- geometry

  /** One overlay's box on the live canvas, or null when it draws nothing. */
  const rectOf = (text) => getTextRect(ctx, store.getState(), canvas.width, canvas.height, text);

  /** Reference-space position that centres `draft`, cascaded past existing ones. */
  const placementFor = (draft) => {
    const s = store.getState();
    const probe = getTextRect(
      ctx, s, CANVAS.width, CANVAS.height, { ...draft, x: 0, y: 0 },
    );
    const box = getImageBox(s.image.width, s.image.height, s.rotation, CANVAS.width, CANVAS.height);
    // Step each new overlay down-right so a second one isn't hidden by the first.
    const step = TEXT_CASCADE * s.texts.length;
    return {
      x: clamp(box.x + (box.width - (probe?.width ?? 0)) / 2 + step, box.x, box.x + box.width),
      y: clamp(box.y + (box.height - (probe?.height ?? 0)) / 2 + step, box.y, box.y + box.height),
    };
  };

  /** Move the selected overlay so its top-left sits at `point`, kept in frame. */
  const moveTo = (point) => {
    const t = active();
    const r = t && rectOf(t);
    if (!r) return;
    const { box } = r;
    const p = toTextSpace(
      {
        x: clamp(point.x, box.x, Math.max(box.x, box.x + box.width - r.width)),
        y: clamp(point.y, box.y, Math.max(box.y, box.y + box.height - r.height)),
      },
      store.getState(), canvas.width, canvas.height,
    );
    patchText(t.id, p);
  };

  // ---------------------------------------------------------------- session

  /** Begin a session with nothing selected — the field composes a new label. */
  const enter = () => {
    if (session || !ensureImage(store)) return false;
    const s = store.getState();
    session = { prev: s.texts.map((t) => ({ ...t })) };
    store.setState({ activeTool: 'text', activeTextId: null, crop: { rect: null } });
    canvas.classList.add('canvas--text');
    dom.textBar.hidden = false;
    return true;
  };

  /** Panel's primary action: drop another overlay onto the picture. */
  const addText = () => {
    if (!ensureImage(store)) return;
    const draft = readPanel();
    if (!draft.content) {
      bus.emit(EVENTS.TOAST, { type: 'error', message: 'Type some text first.' });
      dom.textContent.focus();
      return;
    }
    enter();

    const text = { id: newId(), ...TEXT_DEFAULTS, ...draft, ...placementFor(draft) };
    const s = store.getState();
    // Deselect: the field goes back to composing the *next* label rather than
    // staying wired to the one just placed. Colour and size carry over.
    store.setState({ texts: [...s.texts, text], activeTextId: null });

    dom.textContent.value = '';
    dom.textContent.focus();
    bus.emit(EVENTS.TOAST, {
      type: 'info',
      message: `Added “${text.content}”. Type another label, or click one to move it.`,
    });
  };

  const changedFromPrev = (prev) => {
    const { texts } = store.getState();
    if (texts.length !== prev.length) return true;
    return texts.some((t, i) => ['id', 'content', 'color', 'size', 'x', 'y']
      .some((k) => t[k] !== prev[i][k]));
  };

  /** Commit the session, dropping any overlay left empty. */
  const apply = () => {
    if (!session) return;
    const { prev } = session;
    session = null;

    const kept = store.getState().texts
      .map((t) => ({ ...t, content: t.content.trim() }))
      .filter((t) => t.content);
    store.setState({ texts: kept, activeTool: null, activeTextId: null });

    if (!changedFromPrev(prev)) return; // nothing worth an undo step
    history.record();
    bus.emit(EVENTS.TOAST, {
      type: 'info',
      message: kept.length > prev.length ? 'Text added.' : 'Text updated.',
    });
  };

  const cancel = () => {
    if (!session) return;
    const { prev } = session;
    session = null;
    store.setState({ texts: prev, activeTool: null, activeTextId: null });
  };

  /** Delete just the selected overlay; the rest of the session carries on. */
  const removeActive = () => {
    const t = active();
    if (!t) return;
    const s = store.getState();
    store.setState({
      texts: s.texts.filter((x) => x.id !== t.id),
      activeTextId: null,
    });
    dom.textContent.value = '';
    bus.emit(EVENTS.TOAST, { type: 'info', message: 'Overlay removed.' });
  };

  // ----------------------------------------------------------- interactions

  /** Topmost overlay under a canvas point — last painted wins, as drawn. */
  const hitTest = (p) => {
    const { texts } = store.getState();
    for (let i = texts.length - 1; i >= 0; i -= 1) {
      const r = rectOf(texts[i]);
      if (r
        && p.x >= r.x - GRAB_PAD && p.x <= r.x + r.width + GRAB_PAD
        && p.y >= r.y - GRAB_PAD && p.y <= r.y + r.height + GRAB_PAD) {
        return { text: texts[i], rect: r };
      }
    }
    return null;
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (!isArmed() || e.button !== 0) return;
    const p = getCanvasPoint(canvas, e);
    const hit = hitTest(p);

    if (!hit) {
      // Empty space deselects — with several overlays, "move whatever is
      // selected to wherever I tapped" would be a trap, not a shortcut.
      store.setState({ activeTextId: null });
      return;
    }
    if (hit.text.id !== store.getState().activeTextId) select(hit.text.id);
    // Grab it where you touched it, so the text doesn't jump under the cursor.
    drag = { dx: p.x - hit.rect.x, dy: p.y - hit.rect.y };
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isArmed()) return;
    const p = getCanvasPoint(canvas, e);
    if (!drag) {
      canvas.style.cursor = hitTest(p) ? 'move' : 'default';
      return;
    }
    moveTo({ x: p.x - drag.dx, y: p.y - drag.dy });
  });

  const endDrag = (e) => {
    if (!drag) return;
    canvas.releasePointerCapture?.(e.pointerId);
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Enter commits, arrows nudge (Shift = ×10) — same keys as the crop tool.
  window.addEventListener('keydown', (e) => {
    if (!isArmed()) return;
    const el = e.target;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      panels.closeText({ commit: true });
      return;
    }
    const nudge = NUDGE[e.key];
    const t = active();
    const r = t && rectOf(t);
    if (!nudge || !r) return;
    e.preventDefault();
    const step = (e.shiftKey ? 10 : 1) * (canvas.width / CANVAS.width);
    moveTo({ x: r.x + nudge[0] * step, y: r.y + nudge[1] * step });
  });

  // ----------------------------------------------------------------- wiring

  // Live preview: the controls edit the overlay you have selected.
  const syncFromPanel = () => {
    dom.textSizeValue.textContent = dom.textSize.value;
    if (isArmed()) patchActive(readPanel());
  };
  dom.textContent.addEventListener('input', syncFromPanel);
  dom.textColor.addEventListener('input', syncFromPanel);
  dom.textSize.addEventListener('input', syncFromPanel);
  syncFromPanel();

  dom.addTextButton.addEventListener('click', addText);
  dom.textRemoveButton.disabled = true;

  // Enter in the field is type-and-go: place a new label, or finish editing
  // the selected one (which hands the field back to composing).
  dom.textContent.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (active()) store.setState({ activeTextId: null });
    else addText();
  });

  dom.textApplyButton.addEventListener('click', () => panels.closeText({ commit: true }));
  dom.textCancelButton.addEventListener('click', () => panels.closeText({ commit: false }));
  dom.textRemoveButton.addEventListener('click', removeActive);

  // The panel *is* the session: opening it with overlays already on the image
  // re-enters editing so they can be moved; closing it settles the result.
  bus.on(EVENTS.TEXT_PANEL, ({ open, commit }) => {
    if (open) {
      // Re-opening starts composing, not editing: a third label shouldn't
      // arrive by clobbering the second. Click one on the canvas to edit it.
      if (store.getState().texts.length) enter();
      return;
    }
    if (commit) apply();
    else cancel();
    // Every close lands here — including one where nothing was ever added, so
    // no session existed to tear down. The next open starts from a blank
    // field rather than the label typed last time.
    dom.textContent.value = '';
  });

  // Single teardown path: whenever the tool deactivates — Done, Cancel, Esc,
  // undo/redo, or another tool taking over — tidy every bit of text UI.
  store.subscribe((s, prev) => {
    if (s.activeTextId !== prev.activeTextId) {
      dom.textRemoveButton.disabled = !s.activeTextId;
      // Nothing selected → the field is a blank composer for the next label.
      // (Programmatic value changes don't fire `input`, so this can't patch.)
      if (!s.activeTextId && s.activeTool === 'text') dom.textContent.value = '';
    }

    if (prev.activeTool === 'text' && s.activeTool !== 'text') {
      // Pre-empted by another tool: keep what's on screen rather than silently
      // dropping the edit the user can see. A history rewind is the exception —
      // the snapshot it just restored *is* the intended state, and recording it
      // again would push the undone edit straight back onto the stack.
      if (session) {
        const { prev: before } = session;
        session = null;
        if (!history.isRestoring() && changedFromPrev(before)) history.record();
        panels.closeText();
      }
      canvas.classList.remove('canvas--text');
      canvas.style.cursor = '';
      dom.textBar.hidden = true;
      drag = null;
      bus.emit(EVENTS.TOAST, { type: 'dismiss' });
    }

    // A transform moves the picture under the overlays — pull any that now sit
    // outside the new image box back into frame rather than stranding them.
    if (s.activeTool === 'text'
      && (s.rotation !== prev.rotation || s.flipH !== prev.flipH || s.flipV !== prev.flipV)) {
      const box = getImageBox(
        s.image.width, s.image.height, s.rotation, CANVAS.width, CANVAS.height,
      );
      store.setState({
        texts: s.texts.map((t) => ({
          ...t,
          x: clamp(t.x, box.x, box.x + box.width),
          y: clamp(t.y, box.y, box.y + box.height),
        })),
      });
    }
  });

  return { addText, isArmed };
}
