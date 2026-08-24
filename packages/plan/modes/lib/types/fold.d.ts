/**
 * Pure fold of the modes projection unit: mode, pending selection, turn
 * busy, and last-terminal-outcome failure, all derived from session events.
 * The projection registry drives {@link applyModesUnit} over every committed
 * event; nothing here touches cordis or the agent.
 *
 * @module @deepseek-ai/dsh-modes
 */
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { AgentMode, ModesProjection } from './types.ts';
/** Projection unit state; plain JSON (persisted-cache precondition). */
export interface ModesUnitState {
    mode: AgentMode;
    /** The selection's target mode; null when no selection is outstanding. */
    wanted: AgentMode | null;
    /** Whether a `turn/start` is awaiting its `turn/end` (an agent turn is executing). */
    busy: boolean;
    /** Whether the last terminal outcome — turn end, tool result, or command — failed. */
    failed: boolean;
}
/** Initial unit state: build mode, nothing pending, idle, no failure. */
export declare const modesUnitInit: () => ModesUnitState;
/**
 * Resolve `mode|build|plan` command args to a target mode; cyclic when empty.
 * @param current - the mode in force.
 * @param raw - the command's raw input.
 * @returns the target mode.
 */
export declare function modeArg(current: AgentMode, raw: string): AgentMode;
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
export declare function applyModesUnit(state: ModesUnitState, event: SessionEvent): ModesUnitState;
/**
 * Project the unit state to the wire value.
 * @param state - the folded unit state.
 * @returns the projection value clients read.
 */
export declare function viewModesUnit(state: ModesUnitState): ModesProjection;
//# sourceMappingURL=fold.d.ts.map