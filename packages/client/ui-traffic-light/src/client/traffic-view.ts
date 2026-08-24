import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { ISessions, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { AgentMode, ModesProjection } from '@deepseek-ai/dsh-modes/client'

/** Pet-relevant slice of the modes projection value. */
export interface PetView {
  mode: AgentMode
  busy: boolean
  failed: boolean
}

/**
 * Registrant hooks source for the pet: republishes the current session's
 * modes projection slice on session switches and on projection pushes. The
 * value is undefined before any projection materializes (the pet renders as
 * idle green then) — never a missing channel — so the component stays mounted
 * across session selection changes while the shell.overlay seat is frame-wide.
 */
export class TrafficView implements ObservableSnapshot<PetView | undefined> {
  private readonly listeners = new Set<() => void>()
  private detachList: (() => void) | undefined
  private detachFace: (() => void) | undefined
  private current: SessionId | undefined
  private value: PetView | undefined

  constructor(private readonly sessions: ISessions) {}

  getSnapshot(): PetView | undefined {
    return this.value
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.attach()
    return (): void => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.detach()
    }
  }

  /** Stop every subscription; the source is dead after this. */
  dispose(): void {
    this.detach()
    this.listeners.clear()
  }

  private attach(): void {
    this.detachList = this.sessions.list.subscribe(() => { this.resync() })
    this.resync()
  }

  private detach(): void {
    this.detachList?.()
    this.detachList = undefined
    this.detachFace?.()
    this.detachFace = undefined
  }

  /** Follow the current session id; when it moves, retarget the modes face. */
  private resync(): void {
    const id = this.sessions.list.getSnapshot().current
    if (id !== this.current) {
      this.detachFace?.()
      this.detachFace = undefined
      this.current = id
      if (id !== undefined) {
        const face = this.sessions.binding(id)?.session.projections.faceOf('modes')
        if (face !== undefined) this.detachFace = face.subscribe(() => { this.resyncValue() })
      }
    }
    this.resyncValue()
  }

  private resyncValue(): void {
    const id = this.current
    const next = id === undefined
      ? undefined
      : (this.sessions.binding(id)?.session.projections.faceOf('modes').getSnapshot() as ModesProjection | undefined)
    const view = next === undefined ? undefined : { mode: next.mode, busy: next.busy, failed: next.failed }
    if (view !== this.value) {
      this.value = view
      for (const listener of this.listeners) listener()
    }
  }
}
