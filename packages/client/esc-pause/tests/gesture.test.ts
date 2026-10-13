// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject, name } from '../src/client/index.ts'
import type { ClientContext } from '../src/client/context-types.ts'

/** One mounted plugin under test. */
interface Harness {
  readonly ctx: ClientContext
  readonly cancel: ReturnType<typeof vi.fn>
  readonly dispose: () => void
  setRunning(running: boolean): void
  setCurrent(id: string | null): void
}

/** Every harness mounted by the running spec, disposed after it. */
const mounted: Harness[] = []

/** Mount the client half against a stub sessions service. */
function mount(options: { running?: boolean; current?: string | null; binding?: boolean } = {}): Harness {
  let running = options.running ?? true
  let current: string | null = options.current === undefined ? 'session-1' : options.current
  const bindingPresent = options.binding ?? true
  const cancel = vi.fn(() => Promise.resolve({ ok: true }))
  const cleanups: (() => void)[] = []
  const ctx = {
    sessions: {
      list: { getSnapshot: () => ({ current }) },
      binding: (id: string) => (bindingPresent && id === current
        ? { session: { getSnapshot: () => ({ running }), cancel } }
        : undefined),
    },
    effect: (factory: () => unknown) => { cleanups.push(factory() as () => void) },
  } as unknown as ClientContext
  apply(ctx)
  const harness: Harness = {
    ctx,
    cancel,
    dispose: () => { for (const cleanup of cleanups) cleanup() },
    setRunning: (value) => { running = value },
    setCurrent: (value) => { current = value },
  }
  mounted.push(harness)
  return harness
}

/** Dispatch one keydown on the document body, where the app's own handlers sit. */
function press(init: KeyboardEventInit = {}): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, ...init }))
}

/** Let the gesture's async cancel settle. */
const flush = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0) })

afterEach(() => {
  for (const harness of mounted.splice(0)) harness.dispose()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('dsh-esc-pause client half', () => {
  it('exposes the cordis row contract', () => {
    expect(name).toBe('dsh-esc-pause')
    expect(inject).toEqual(['sessions'])
  })

  it('cancels the running turn on two Escape presses inside the window', async () => {
    const harness = mount()
    press()
    expect(harness.cancel).not.toHaveBeenCalled()
    press()
    await flush()
    expect(harness.cancel).toHaveBeenCalledTimes(1)
  })

  it('ignores a single Escape', async () => {
    const harness = mount()
    press()
    await flush()
    expect(harness.cancel).not.toHaveBeenCalled()
  })

  it('ignores Escape held down by auto-repeat', async () => {
    const harness = mount()
    press({ repeat: true })
    press({ repeat: true })
    await flush()
    expect(harness.cancel).not.toHaveBeenCalled()
  })

  it('ignores Escape carrying a modifier or an IME composition', async () => {
    const harness = mount()
    press({ ctrlKey: true })
    press({ ctrlKey: true })
    press({ metaKey: true })
    press({ metaKey: true })
    press({ altKey: true })
    press({ altKey: true })
    press({ shiftKey: true })
    press({ shiftKey: true })
    press({ isComposing: true })
    press({ isComposing: true })
    await flush()
    expect(harness.cancel).not.toHaveBeenCalled()
  })

  it('ignores keys that are not Escape', async () => {
    const harness = mount()
    press({ key: 'a' })
    press({ key: 'a' })
    await flush()
    expect(harness.cancel).not.toHaveBeenCalled()
  })

  it('does nothing without a running turn', async () => {
    const harness = mount({ running: false })
    press()
    press()
    await flush()
    expect(harness.cancel).not.toHaveBeenCalled()

    harness.setRunning(true)
    press()
    press()
    await flush()
    expect(harness.cancel).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a current session or a resolvable binding', async () => {
    const withoutCurrent = mount({ current: null })
    press()
    press()
    await flush()
    expect(withoutCurrent.cancel).not.toHaveBeenCalled()

    const withoutBinding = mount({ binding: false })
    press()
    press()
    await flush()
    expect(withoutBinding.cancel).not.toHaveBeenCalled()
  })

  it('lets an open overlay own Escape, even when a later handler unmounts it', async () => {
    const harness = mount()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    // The overlay's own handler runs after the capture-phase listener and
    // removes the dialog; the gesture must still count the press as the
    // overlay's, not as its own first press.
    const removeDialog = (): void => { dialog.remove() }
    document.addEventListener('keydown', removeDialog)
    press()
    press()
    await flush()
    expect(harness.cancel).not.toHaveBeenCalled()

    document.removeEventListener('keydown', removeDialog)
    press()
    press()
    await flush()
    expect(harness.cancel).toHaveBeenCalledTimes(1)
  })

  it('ignores a hidden overlay', async () => {
    const harness = mount()
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    menu.style.display = 'none'
    document.body.append(menu)
    press()
    press()
    await flush()
    expect(harness.cancel).toHaveBeenCalledTimes(1)
  })

  it('survives a refused cancel without an unhandled rejection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const harness = mount()
    harness.cancel.mockImplementation(() => Promise.reject(new Error('transport down')))
    press()
    press()
    await flush()
    expect(warn).toHaveBeenCalledWith('[dsh-esc-pause] cancel failed:', expect.any(Error))
  })

  it('removes the listener when the plugin fiber disposes', async () => {
    const harness = mount()
    harness.dispose()
    press()
    press()
    await flush()
    expect(harness.cancel).not.toHaveBeenCalled()
  })
})