import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { PropsRuntime, HostObservable, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { AgentMode } from '@deepseek-ai/dsh-modes/client'
import { PET_IMAGES } from '../assets.ts'
import type { PetView } from './traffic-view.ts'
import styles from './ModePet.module.css'

/** Injected face of the pet entry: the traffic view hook source and the mode-switch verb. */
export interface ModePetInjected {
  hooks: {
    /** The current session's traffic view (undefined = no session/projection yet). */
    traffic: HostObservable<PetView | undefined>
  }
  /** @returns null on success, or the failure message. */
  navigate: (next: AgentMode) => Promise<string | null>
}

export type ModePetProps = PropsRuntime<'shell.overlay'> & InjectFace<ModePetInjected>

/** Tracker for one pointer-drag gesture (component-local interaction state). */
interface DragState {
  lastX: number
  lastY: number
  deltaX: number
  deltaY: number
  moved: boolean
}

/** The pet's anchor offset (persisted across drags) and its in-gesture delta. */
interface PetOffset {
  x: number
  y: number
}

/** localStorage key for the persisted pet anchor. */
const ANCHOR_KEY = 'dsh:mode-pet:anchor'

/** Clamp one anchor axis so a corrupted stored value cannot park the pet off-screen. */
const CLAMP = 4000

/** Load the persisted anchor; corrupt or absent storage falls back to the default. */
function loadAnchor(): PetOffset {
  try {
    const raw = window.localStorage.getItem(ANCHOR_KEY)
    if (raw === null) return { x: 0, y: 0 }
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return { x: 0, y: 0 }
    const { x, y } = parsed as { x?: unknown; y?: unknown }
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 }
    return { x: Math.min(Math.max(x, -CLAMP), CLAMP), y: Math.min(Math.max(y, -CLAMP), CLAMP) }
  } catch {
    // Storage unavailable (private mode, denied access): default anchor.
    return { x: 0, y: 0 }
  }
}

/** Persist the anchor so the pet stays where the user left it across reloads. */
function saveAnchor(anchor: PetOffset): void {
  try {
    window.localStorage.setItem(ANCHOR_KEY, JSON.stringify(anchor))
  } catch {
    // Storage unavailable (private mode, quota): the position still holds for this session.
  }
}

/**
 * Traffic-light display state over the traffic view:
 * - failed + plan → yellow blink (stuck)
 * - failed + build → red blink (stuck)
 * - plan → yellow
 * - build + busy → red (automatic, only while a turn executes)
 * - build + idle → green
 */
export function petFace(projection: { mode: AgentMode; busy: boolean; failed: boolean }): {
  src: string
  blink: boolean
} {
  const failed = projection.failed
  if (failed && projection.mode === 'plan') return { src: PET_IMAGES.yellowBlink, blink: true }
  if (failed && projection.mode === 'build') return { src: PET_IMAGES.redBlink, blink: true }
  if (projection.mode === 'plan') return { src: PET_IMAGES.yellow, blink: false }
  if (projection.busy) return { src: PET_IMAGES.red, blink: false }
  return { src: PET_IMAGES.green, blink: false }
}

/** The traffic-light desktop pet: frame-wide, draggable, click to switch. */
export const ModePet = ({ useTraffic, navigate }: ModePetProps) => {
  const projection = useTraffic(view => view)
  const drag = useRef<DragState | null>(null)
  // Anchor: the accumulated offset persisted across drags and reloads; released
  // drags fold their gesture delta into it, a release without movement is a click.
  const [anchor, setAnchor] = useState<PetOffset>(loadAnchor)
  const [gestureDelta, setGestureDelta] = useState<PetOffset | null>(null)

  // No session or no projection yet: idle green keeps the pet mounted.
  const view = projection ?? { mode: 'build' as const, busy: false, failed: false }
  const face = petFace(view)

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    drag.current = { lastX: event.clientX, lastY: event.clientY, deltaX: 0, deltaY: 0, moved: false }
    setGestureDelta({ x: 0, y: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    const gesture = drag.current
    if (gesture === null) return
    gesture.deltaX += event.clientX - gesture.lastX
    gesture.deltaY += event.clientY - gesture.lastY
    gesture.lastX = event.clientX
    gesture.lastY = event.clientY
    if (Math.abs(gesture.deltaX) > 3 || Math.abs(gesture.deltaY) > 3) gesture.moved = true
    setGestureDelta({ x: gesture.deltaX, y: gesture.deltaY })
  }

  const onPointerUp = (): void => {
    const gesture = drag.current
    drag.current = null
    if (gesture === null) return
    if (gesture.moved) {
      // Fixed position: commit the gesture's delta into the anchor and persist it.
      const next = { x: anchor.x + gesture.deltaX, y: anchor.y + gesture.deltaY }
      setAnchor(next)
      saveAnchor(next)
    } else {
      // Same rule as the shortcut: a stuck failure exits to green; otherwise
      // toggle between green (build idle) and yellow (plan).
      void navigate(view.failed ? 'build' : view.mode === 'plan' ? 'build' : 'plan')
    }
    setGestureDelta(null)
  }

  const delta = gestureDelta ?? { x: 0, y: 0 }
  const transform = `translate(${String(anchor.x + delta.x)}px, ${String(anchor.y + delta.y)}px)`
  const stateText = face.blink ? `${view.mode} failed` : view.mode === 'plan' ? 'plan' : view.busy ? 'build' : 'idle'
  const label = `mode pet: ${stateText}`
  return (
    <button
      type="button"
      className={`${styles.pet} ${face.blink ? styles.blink : ''}`}
      style={{ transform }}
      aria-label={label}
      title={label}
      aria-pressed={view.mode === 'plan'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <img src={face.src} alt="" draggable={false} />
    </button>
  )
}
