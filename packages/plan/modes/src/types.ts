/**
 * Pure types of the modes domain: the ONE home of the `modes` projection-key
 * declaration, free of this package's host-side value imports (cordis
 * service, dsh-tools, dsh-agent). Two namespace projections serve it —
 * `./types` for host consumers, `./client` for client aggregates — with zero
 * content duplication.
 *
 * @module @deepseek-ai/dsh-modes/types
 */

/**
 * The closed set of agent collaboration modes. `build` is the default and
 * carries no restrictions; `plan` is read-only research guided toward a
 * reviewed plan exit.
 */
export type AgentMode = 'build' | 'plan'

/**
 * The modes projection's wire value. `mode` is the logged state in force
 * (the last `modes/state`, `build` before the first); `pending` is true while
 * a logged `/mode`-family selection (`command/run` named `mode`, `plan`, or
 * `build`) targets a state other than `mode` and no later `modes/state` event
 * has recorded that state. `busy` is true while the log holds an opened turn
 * without its closing `turn/end` (an agent turn is executing). `failed` is
 * true when the most recent terminal step or command settlement was an
 * error and no later success or interaction has cleared it. Capability
 * absence (modes not composed) is the key's absence, never a value.
 */
export interface ModesProjection {
  mode: AgentMode
  pending: boolean
  /** Whether the agent turn is currently executing (a finished `turn/start` awaits its `turn/end`). */
  busy: boolean
  /** Whether the last terminal step or command failed; cleared by the next success. */
  failed: boolean
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Agent collaboration mode folded from `command/run` (names `mode`/`plan`/`build`) and `modes/state` events. */
    modes: ModesProjection
  }
}
