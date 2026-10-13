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
import type { ClientContext } from './context-types.ts'
import { DoublePressDetector } from './double-press.ts'

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-esc-pause'

/** The sessions service owns the current Session and its cancel verb. */
export const inject = ['sessions']

/** Maximum gap between the two Escape presses, in milliseconds. */
const DOUBLE_PRESS_MS = 400

/** Overlay roles whose own Escape handling owns the keypress. */
const OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'

/**
 * Client plugin body: install the double-Escape listener.
 * @param ctx - client root context (sessions).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const detector = new DoublePressDetector({ windowMs: DOUBLE_PRESS_MS, now: () => performance.now() })
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isPlainEscape(event)) return
      if (hasOpenOverlay(document)) {
        detector.reset()
        return
      }
      if (!detector.press()) return
      void cancelRunningTurn(ctx)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('keydown', onKeyDown, true) }
  }, 'dsh-esc-pause: double-escape listener')
}

/**
 * Whether one keydown is an eligible half of the gesture.
 * @param event - the keydown.
 * @returns true for a plain, non-repeat, non-IME Escape.
 */
function isPlainEscape(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape') return false
  if (event.repeat) return false
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false
  if (event.isComposing) return false
  // keyCode 229 is the legacy IME-composition signal engines emit without
  // isComposing (the same guard the composer keymap carries).
  // oxlint-disable-next-line typescript/no-deprecated
  if (event.keyCode === 229) return false
  return true
}

/**
 * Whether an overlay that handles Escape itself is currently mounted.
 * @param doc - the document to scan.
 * @returns true when a rendered overlay owns the next Escape.
 */
function hasOpenOverlay(doc: Document): boolean {
  for (const element of doc.querySelectorAll(OVERLAY_SELECTOR)) {
    if (isRendered(element)) return true
  }
  return false
}

/**
 * Whether one overlay element is actually on screen. Closed overlays are
 * unmounted in this UI; the check covers a hidden-but-mounted one.
 * @param element - candidate overlay element.
 * @returns true when the element is neither hidden nor display/visibility suppressed.
 */
function isRendered(element: Element): boolean {
  if (element.hasAttribute('hidden')) return false
  const style = element.ownerDocument.defaultView?.getComputedStyle(element)
  if (style === undefined) return true
  return style.display !== 'none' && style.visibility !== 'hidden'
}

/**
 * Cancel the selected Session's running turn.
 * @param ctx - client root context.
 */
async function cancelRunningTurn(ctx: ClientContext): Promise<void> {
  try {
    const current = ctx.sessions.list.getSnapshot().current
    if (current === undefined || current === null) return
    const binding = ctx.sessions.binding(current)
    if (binding === undefined) return
    if (!binding.session.getSnapshot().running) return
    // A refused cancel surfaces through the Session's own promptError; there
    // is no second channel this gesture could report it on.
    await binding.session.cancel()
  } catch (error: unknown) {
    console.warn('[dsh-esc-pause] cancel failed:', error)
  }
}