/**
 * Self-contained build/plan agent modes. `build` is the default unrestricted
 * mode; `plan` narrows the model to a deployment-owned read-only tool set
 * (via `tools.restrict` on the agent scope, backed by a monotonic execution
 * guard), renders a guidance section, and exits only through a user-reviewed
 * `exit_plan_mode` submission — the opencode CLI mode loop, as a plugin.
 *
 * The state in force is folded from the session log (`modes/state`, last one
 * wins), so resume and fork restore it without a live mirror. User selections
 * remain pending until the next accepted in-turn pre-step. The service
 * includes the selected mode in the proposed step assembly, then appends
 * `modes/state` from `agent/pre-step` only when the step is accepted.
 * Same-step request retries reuse their assembly; the tool filter is applied
 * and lifted on the same boundary, so presentation, lookup, and execution
 * stay aligned with the mode the request header describes.
 *
 * Agent Note: `.agents/notes/implemented/feature/<dsh-modes>`
 *
 * @module @deepseek-ai/dsh-modes
 */
import { Context, Service } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { AgentMode } from './types.ts';
export type * from './types.ts';
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        /**
         * Which agent mode is in force from this point on: log-only, non-surface,
         * whole-value replace. The last `modes/state` wins; a log with none folds
         * to `build` through {@link foldModesState}.
         */
        'modes/state': {
            mode: AgentMode;
        };
    }
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        modes: ModesController;
    }
}
/** The model-facing exit tool's default name. */
export declare const DEFAULT_EXIT_TOOL = "exit_plan_mode";
/** Deployment-owned modes guidance. Nested mode configs keep the build/plan shape explicit. */
export interface ModesConfig {
    /** Model-facing exit tool name; stable across modes (defaults to `exit_plan_mode`). */
    exitToolName?: string;
    /** Plan-mode policy. */
    plan: {
        /** Tool names removed from the plan-mode catalog and denied at execution. */
        blockedTools: string[];
        /** Denial reason returned to the executor for a blocked plan-mode call. */
        rejectMessage: string;
        /** Guidance rendered while plan mode is active. */
        section: string;
        /**
         * Switch the session's file sandbox to `read-only` while plan mode is in
         * force (default true): any command may run, but writes are denied at the
         * OS sandbox layer regardless of the shell string. The prior session
         * override is restored when the session leaves plan mode.
         */
        readOnlySandboxOnPlan?: boolean;
    };
    /** Build-mode policy. */
    build: {
        /** Guidance rendered while build mode is active (empty string renders nothing). */
        section: string;
    };
}
/**
 * Validate deployment-owned modes guidance. Missing, blank, non-string, and
 * unknown fields fail at plugin load rather than being ignored.
 *
 * @param config Raw plugin config (loader boundary, validated here).
 * @returns A detached validated config.
 */
export declare function resolveConfig(config: unknown): Required<ModesConfig>;
/**
 * Whether the log names `plan` mode after the first `end` events. The last
 * `modes/state` wins; a prefix with none is `build`.
 *
 * @param events The session log or any prefix of it.
 * @param end Fold `events[0, end)`; defaults to the whole log.
 * @returns The mode in force at that prefix.
 */
export declare function foldModesState(events: readonly SessionEvent[], end?: number): AgentMode;
/**
 * `ctx.modes`: owns logged modes state, applies and narrates selected modes
 * at step start, enforces the plan tool filter, the guidance section, the
 * `/mode`/`/plan`/`/build` commands, and the reviewed exit tool. UIs observe
 * committed flips through `session/event`; there is no live mirror.
 */
export declare class ModesController extends Service {
    static inject: string[];
    /** Validated deployment-owned configuration. */
    private readonly config;
    /**
     * Latest selection per session awaiting the next accepted in-turn pre-step.
     * `narrate` is true for user selections and false for the exit tool, whose
     * result already narrates the transition.
     */
    private readonly pendingIntents;
    /** Per-agent plan filter + guard disposers, keyed by the agent in force. */
    private readonly planFilters;
    /**
     * The sandbox mode in force before this session entered plan mode (an
     * explicit `sandbox/mode` override, or undefined for the deployment
     * default). Restored when the session leaves plan mode.
     */
    private readonly priorSandbox;
    constructor(ctx: Context, config?: ModesConfig);
    /**
     * Read the logged mode and any selected mode awaiting the next accepted
     * in-turn pre-step.
     *
     * @param agent The agent to read.
     * @returns Current logged mode plus a pending selection, when present.
     */
    get(agent: Agent): {
        mode: AgentMode;
        pending?: AgentMode;
    };
    /**
     * Select which mode should be in force. Between turns the method appends
     * the change immediately because no in-turn pre-step will run until another
     * prompt starts a turn. During an open turn the selection remains pending
     * until the next accepted in-turn pre-step. Repeated selection of the
     * current or already-pending mode is a no-op.
     *
     * @param agent The agent to switch.
     * @param mode The mode to select.
     * @returns what happened: `committed` (logged now), `queued` (awaiting the
     * next accepted in-turn pre-step), `cancelled` (an opposite pending selection
     * was cleared; the logged state already matches), or `noop` (already in that
     * state).
     */
    select(agent: Agent, mode: AgentMode): 'committed' | 'queued' | 'cancelled' | 'noop';
    /** Apply one pending selection before the next request assembly. */
    private onBoundary;
    /**
     * Keep the session's file sandbox in step with the mode: plan pins it to
     * `read-only` (any command may run; writes fail at the OS layer), build
     * restores the pre-plan override or the deployment default. Only writes a
     * `sandbox/mode` event when the read-only plan policy is enabled.
     */
    private switchSandboxMode;
    /**
     * Apply or lift the plan tool filter for one agent to match the target
     * mode. Idempotent: a filter for the same mode is left untouched, so the
     * pre-step call is cheap on every subsequent step.
     */
    private syncPlanFilter;
    /**
     * Install the plan-mode filter on the agent scope: a `tools.restrict` that
     * removes blocked tools from presentation/lookup/execution, plus a monotonic
     * `tools.guard` that denies any direct call to a blocked name (including the
     * reserved Code Mode transport, which restrict cannot name). Each returns a
     * disposer; both are combined into one.
     */
    private installPlanFilter;
    /** Build a user-switch notice when the last logged header described the other mode. */
    private narration;
}
export default ModesController;
//# sourceMappingURL=index.d.ts.map