/**
 * Pure fold of the modes projection unit: mode, pending selection, turn
 * busy, and last-terminal-outcome failure, all derived from session events.
 * The projection registry drives {@link applyModesUnit} over every committed
 * event; nothing here touches cordis or the agent.
 *
 * @module @deepseek-ai/dsh-modes
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { AgentMode, ModesProjection } from './types.ts'

/** Projection unit state; plain JSON (persisted-cache precondition). */
export interface ModesUnitState {
  mode: AgentMode
  /** The selection's target mode; null when no selection is outstanding. */
  wanted: AgentMode | null
  /** Whether a `turn/start` is awaiting its `turn/end` (an agent turn is executing). */
  busy: boolean
  /** Whether the last terminal outcome — turn end, tool result, or command — failed. */
  failed: boolean
}

/** Initial unit state: build mode, nothing pending, idle, no failure. */
export const modesUnitInit = (): ModesUnitState => ({ mode: 'build', wanted: null, busy: false, failed: false })

/**
 * Resolve `mode|build|plan` command args to a target mode; cyclic when empty.
 * @param current - the mode in force.
 * @param raw - the command's raw input.
 * @returns the target mode.
 */
export function modeArg(current: AgentMode, raw: string): AgentMode {
  const arg = raw.trim()
  if (arg === 'build') return 'build'
  if (arg === 'plan') return 'plan'
  return current === 'plan' ? 'build' : 'plan'
}

/**
 * Fold one session event into the unit state. `command/run` records the
 * logged /mode-family selection; `modes/state` commits it. `turn/start` and
 * `turn/end` fold the executing-turn flag; `tool/result`, `turn/end`, and
 * `command/done` fold the last terminal outcome's failure (a later success
 * clears it, matching the "next success clears" blink rule).
 * @param state - the unit state before this event.
 * @param event - the committed session event.
 * @returns the folded unit state.
 */
export function applyModesUnit(state: ModesUnitState, event: SessionEvent): ModesUnitState {
  if (event.type === 'command/run') {
    const args = event.data.args
    if (args === undefined) return state
    if (event.data.name === 'modes' || event.data.name === 'mode') {
      const wanted = modeArg(state.mode, args)
      return wanted === state.wanted ? state : { ...state, wanted }
    }
    if (event.data.name === 'plan') {
      const wanted: AgentMode = args.trim() === 'off' ? 'build' : 'plan'
      return wanted === state.wanted ? state : { ...state, wanted }
    }
    if (event.data.name === 'build') {
      return state.wanted === 'build' ? state : { ...state, wanted: 'build' }
    }
    return state
  }
  if (event.type === 'modes/state') {
    return { ...state, mode: event.data.mode, wanted: null }
  }
  if (event.type === 'turn/start') {
    return state.busy ? state : { ...state, busy: true }
  }
  if (event.type === 'turn/end') {
    return { ...state, busy: false, failed: event.data.reason.kind === 'error' }
  }
  if (event.type === 'tool/result') {
    return { ...state, failed: event.data.error !== undefined }
  }
  if (event.type === 'command/done') {
    return { ...state, failed: event.data.kind === 'error' }
  }
  return state
}

/**
 * Project the unit state to the wire value.
 * @param state - the folded unit state.
 * @returns the projection value clients read.
 */
export function viewModesUnit(state: ModesUnitState): ModesProjection {
  return {
    mode: state.mode,
    pending: state.wanted !== null && state.wanted !== state.mode,
    busy: state.busy,
    failed: state.failed,
  }
}
