/**
 * dsh-esc-pause client half: two plain Escape presses within
 * {@link DOUBLE_PRESS_MS} cancel the running turn of the selected Session —
 * the same operation as the composer's Stop button.
 *
 * An Escape that belongs to an open overlay (dialog, menu, listbox) is that
 * overlay's key, so it disarms the gesture instead of arming it: an impatient
 * double-tap that dismisses a dialog never cancels a turn. The listener runs
 * in the capture phase so it reads the overlay while it is still mounted —
 * the overlay's own handler removes it later in the same dispatch.
 *
 * Nothing is claimed from the event: the gesture is additive, and every
 * single-Escape behavior (closing a menu, backing out of a pane, clearing a
 * selection) stays untouched.
 */
import type { ClientContext } from './context-types.ts';
/** Plugin identity for cordis.yml rows. */
export declare const name = "dsh-esc-pause";
/** The sessions service owns the current Session and its cancel verb. */
export declare const inject: string[];
/**
 * Client plugin body: install the double-Escape listener.
 * @param ctx - client root context (sessions).
 */
export declare function apply(ctx: ClientContext): void;
