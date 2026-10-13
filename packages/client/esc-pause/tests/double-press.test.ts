import { describe, expect, it } from 'vitest'
import { DoublePressDetector } from '../src/client/double-press.ts'

/** A detector over a controllable clock. */
function createDetector(windowMs = 400): { detector: DoublePressDetector; setNow: (value: number) => void } {
  let now = 0
  return {
    detector: new DoublePressDetector({ windowMs, now: () => now }),
    setNow: (value: number) => { now = value },
  }
}

describe('DoublePressDetector', () => {
  it('fires on the second press inside the window, not on the first', () => {
    const { detector, setNow } = createDetector()
    setNow(1000)
    expect(detector.press()).toBe(false)
    setNow(1300)
    expect(detector.press()).toBe(true)
  })

  it('does not fire when the gap exceeds the window', () => {
    const { detector, setNow } = createDetector(400)
    setNow(0)
    expect(detector.press()).toBe(false)
    setNow(401)
    expect(detector.press()).toBe(false)
    setNow(402)
    expect(detector.press()).toBe(true)
  })

  it('fires on the exact window boundary', () => {
    const { detector, setNow } = createDetector(400)
    setNow(0)
    detector.press()
    setNow(400)
    expect(detector.press()).toBe(true)
  })

  it('re-arms after firing, so a third press starts a new gesture', () => {
    const { detector, setNow } = createDetector()
    setNow(0)
    detector.press()
    setNow(100)
    expect(detector.press()).toBe(true)
    setNow(150)
    expect(detector.press()).toBe(false)
    setNow(200)
    expect(detector.press()).toBe(true)
  })

  it('reset forgets an armed first press', () => {
    const { detector, setNow } = createDetector()
    setNow(0)
    detector.press()
    detector.reset()
    setNow(100)
    expect(detector.press()).toBe(false)
  })
})