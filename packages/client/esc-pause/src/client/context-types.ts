/**
 * Structural faces of the client runtime this plugin uses. An external plugin
 * carries no harness type dependency, so each face names exactly the members
 * the gesture reads.
 */

/** The client root context slice the plugin mounts on. */
export interface ClientContext {
  /** The sessions service owning the current selection and its cancel verb. */
  readonly sessions: SessionsService
  /** Register a disposable contribution on the plugin fiber. */
  effect<T>(factory: () => T, label?: string): void
}

/** The `ctx.sessions` slice: current selection plus scope-addressed bindings. */
export interface SessionsService {
  /** The session list read face; `current` is the selected Session id. */
  readonly list: { getSnapshot(): { readonly current?: string | null } }
  /**
   * Resolve one session's binding.
   * @param id - session id.
   * @returns the binding, or undefined when the id is neither listed nor scoped.
   */
  binding(id: string): SessionBinding | undefined
}

/** One resolved session binding. */
export interface SessionBinding {
  /** The outward session face. */
  readonly session: SessionFace
}

/** The session face slice: lifecycle snapshot plus the cancel verb. */
export interface SessionFace {
  /** The live lifecycle snapshot. */
  getSnapshot(): { readonly running: boolean }
  /**
   * Cancel the running turn; pending queued work resumes in FIFO order after
   * the Host reaches cancellation quiescence.
   */
  cancel(): Promise<unknown>
}