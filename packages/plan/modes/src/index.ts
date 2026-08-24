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

import { Context, Service } from '@deepseek-ai/cordis'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent, UserMessage } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { UserQuestionError } from '@deepseek-ai/dsh-user-questions'
// Type-only edge: resolves `ctx.commands` for the optional command child.
import type {} from '@deepseek-ai/dsh-commands'
// Type-only: resolves ctx.sessionProjections for the optional unit child.
import type {} from '@deepseek-ai/dsh-session-projection'
import { effectiveSandboxMode, setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy'
import type { SandboxMode } from '@deepseek-ai/dsh-sandbox'
import type { AgentMode, ModesProjection } from './types.ts'
// The `modes` projection-key declaration lives in src/types.ts (its one home);
// this re-export projects the type face onto the package root AND keeps the
// module edge in the emitted index.d.ts, so aggregate programs consuming the
// declarations still receive the SessionProjectionMap merge.
export type * from './types.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Which agent mode is in force from this point on: log-only, non-surface,
     * whole-value replace. The last `modes/state` wins; a log with none folds
     * to `build` through {@link foldModesState}.
     */
    'modes/state': { mode: AgentMode }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    modes: ModesController
  }
}

/** The model-facing exit tool's default name. */
export const DEFAULT_EXIT_TOOL = 'exit_plan_mode'

/** The reserved Code Mode presentation transport, excluded from restrict() calls. */
const RUN_CODE = 'run_code'

/** Deployment-owned modes guidance. Nested mode configs keep the build/plan shape explicit. */
export interface ModesConfig {
  /** Model-facing exit tool name; stable across modes (defaults to `exit_plan_mode`). */
  exitToolName?: string
  /** Plan-mode policy. */
  plan: {
    /** Tool names removed from the plan-mode catalog and denied at execution. */
    blockedTools: string[]
    /** Denial reason returned to the executor for a blocked plan-mode call. */
    rejectMessage: string
    /** Guidance rendered while plan mode is active. */
    section: string
    /**
     * Switch the session's file sandbox to `read-only` while plan mode is in
     * force (default true): any command may run, but writes are denied at the
     * OS sandbox layer regardless of the shell string. The prior session
     * override is restored when the session leaves plan mode.
     */
    readOnlySandboxOnPlan?: boolean
  }
  /** Build-mode policy. */
  build: {
    /** Guidance rendered while build mode is active (empty string renders nothing). */
    section: string
  }
}

/** The review question's id, echoed in the answer this tool reads. */
const REVIEW_ID = 'plan-review'

/** The review question's approve option label. */
const APPROVE_LABEL = 'Approve'

/** The review question's keep-planning option label. */
const KEEP_PLANNING_LABEL = 'Keep planning'

/** The plan's first markdown heading (any level), or `undefined` when it has none. */
function firstHeading(plan: string): string | undefined {
  for (const line of plan.split('\n')) {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(line)
    if (match) return match[1]
  }
  return undefined
}

/**
 * Validate deployment-owned modes guidance. Missing, blank, non-string, and
 * unknown fields fail at plugin load rather than being ignored.
 *
 * @param config Raw plugin config (loader boundary, validated here).
 * @returns A detached validated config.
 */
export function resolveConfig(config: unknown): Required<ModesConfig> {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error('ModesConfig must be an object')
  }
  const unknown = Object.keys(config).filter(key => key !== 'exitToolName' && key !== 'plan' && key !== 'build')
  if (unknown.length > 0) {
    throw new Error(`ModesConfig has unknown key(s) ${unknown.join(', ')} — config is { exitToolName?, plan, build }`)
  }
  const plan = (config as { plan?: unknown }).plan
  if (typeof plan !== 'object' || plan === null) {
    throw new Error('ModesConfig needs a `plan` object')
  }
  const planShape = plan as { blockedTools?: unknown; rejectMessage?: unknown; section?: unknown; readOnlySandboxOnPlan?: unknown }
  const planKeys = Object.keys(planShape).filter(key =>
    key !== 'blockedTools' && key !== 'rejectMessage' && key !== 'section' && key !== 'readOnlySandboxOnPlan')
  if (planKeys.length > 0) {
    throw new Error(`ModesConfig.plan has unknown key(s) ${planKeys.join(', ')} — plan is { blockedTools, rejectMessage, section, readOnlySandboxOnPlan? }`)
  }
  const blockedTools = planShape.blockedTools
  if (!Array.isArray(blockedTools) || blockedTools.some(name => typeof name !== 'string' || name.trim() === '')) {
    throw new Error('ModesConfig.plan.blockedTools must be a non-empty array of tool-name strings')
  }
  const blockedToolNames = blockedTools as string[]
  const rejectMessage = planShape.rejectMessage
  if (typeof rejectMessage !== 'string' || rejectMessage.trim() === '') {
    throw new Error('ModesConfig.plan.rejectMessage needs a non-empty string')
  }
  const planSection = planShape.section
  if (typeof planSection !== 'string' || planSection.trim() === '') {
    throw new Error('ModesConfig.plan.section needs a non-empty string')
  }
  const readOnlySandboxOnPlan = planShape.readOnlySandboxOnPlan
  if (readOnlySandboxOnPlan !== undefined && typeof readOnlySandboxOnPlan !== 'boolean') {
    throw new Error('ModesConfig.plan.readOnlySandboxOnPlan needs a boolean when present')
  }
  const build = (config as { build?: unknown }).build
  if (typeof build !== 'object' || build === null) {
    throw new Error('ModesConfig needs a `build` object')
  }
  const buildKeys = Object.keys(build).filter(key => key !== 'section')
  if (buildKeys.length > 0) {
    throw new Error(`ModesConfig.build has unknown key(s) ${buildKeys.join(', ')} — build is { section }`)
  }
  const buildSection = (build as { section?: unknown }).section
  if (typeof buildSection !== 'string') {
    throw new Error('ModesConfig.build.section needs a string')
  }
  const exitToolName = (config as Partial<ModesConfig>).exitToolName
  if (exitToolName !== undefined && (typeof exitToolName !== 'string' || exitToolName.trim() === '')) {
    throw new Error('ModesConfig.exitToolName needs a non-empty string when present')
  }
  return {
    exitToolName: exitToolName ?? DEFAULT_EXIT_TOOL,
    plan: {
      blockedTools: [...blockedToolNames],
      rejectMessage,
      section: planSection,
      readOnlySandboxOnPlan: readOnlySandboxOnPlan ?? true,
    },
    build: { section: buildSection },
  }
}

/**
 * Whether the log names `plan` mode after the first `end` events. The last
 * `modes/state` wins; a prefix with none is `build`.
 *
 * @param events The session log or any prefix of it.
 * @param end Fold `events[0, end)`; defaults to the whole log.
 * @returns The mode in force at that prefix.
 */
export function foldModesState(events: readonly SessionEvent[], end = events.length): AgentMode {
  let mode: AgentMode = 'build'
  let index = 0
  for (const event of events) {
    if (index >= end) break
    index++
    if (event.type === 'modes/state') mode = event.data.mode
  }
  return mode
}

/**
 * Projection unit state: the logged mode plus the latest logged mode-family
 * selection (`command/run`) not yet resolved by a `modes/state` commit, and
 * the folded turn-busy / last-terminal-outcome failure flags. Plain JSON
 * (persisted-cache precondition). The fold lives in `src/fold.ts`.
 */
interface ModesUnitState {
  mode: AgentMode
  /** The selection's target mode; null when no selection is outstanding. */
  wanted: AgentMode | null
  /** Whether a `turn/start` is awaiting its `turn/end` (an agent turn is executing). */
  busy: boolean
  /** Whether the last terminal outcome — turn end, tool result, or command — failed. */
  failed: boolean
}

// Pure fold reused by the projection unit below (single home in src/fold.ts).
import { applyModesUnit, modesUnitInit, modeArg, viewModesUnit } from './fold.ts'

/** Whether the log holds an opened turn without its closing `turn/end`. */
function hasOpenTurn(events: readonly SessionEvent[]): boolean {
  let open = false
  for (const event of events) {
    if (event.type === 'turn/start') open = true
    else if (event.type === 'turn/end') open = false
  }
  return open
}

/** The mode at the last logged request header, or `undefined` before the first header. */
function modeAtLastHeader(events: readonly SessionEvent[]): AgentMode | undefined {
  let lastHeader = -1
  let index = 0
  for (const event of events) {
    if (event.type === 'request/header') lastHeader = index
    index++
  }
  if (lastHeader < 0) return undefined
  return foldModesState(events, lastHeader + 1)
}

/**
 * `ctx.modes`: owns logged modes state, applies and narrates selected modes
 * at step start, enforces the plan tool filter, the guidance section, the
 * `/mode`/`/plan`/`/build` commands, and the reviewed exit tool. UIs observe
 * committed flips through `session/event`; there is no live mirror.
 */
export class ModesController extends Service {
  static inject = ['tools', 'systemPrompt']

  /** Validated deployment-owned configuration. */
  private readonly config: Required<ModesConfig>

  /**
   * Latest selection per session awaiting the next accepted in-turn pre-step.
   * `narrate` is true for user selections and false for the exit tool, whose
   * result already narrates the transition.
   */
  private readonly pendingIntents = new WeakMap<Session, { mode: AgentMode; narrate: boolean }>()

  /** Per-agent plan filter + guard disposers, keyed by the agent in force. */
  private readonly planFilters = new Map<Agent, () => void>()

  /**
   * The sandbox mode in force before this session entered plan mode (an
   * explicit `sandbox/mode` override, or undefined for the deployment
   * default). Restored when the session leaves plan mode.
   */
  private readonly priorSandbox = new WeakMap<Session, SandboxMode | undefined>()

  constructor(ctx: Context, config: ModesConfig = {
    plan: { blockedTools: [], rejectMessage: '', section: '' },
    build: { section: '' },
  }) {
    super(ctx, 'modes')
    this.config = resolveConfig(config)
    const sectionName = 'modes:policy'
    let disposed = false
    // Pre-step is outside Session.append publication, so it can append the
    // log-only mode event inside an open turn without re-entering the session.
    // A failed append remains pending for a later accepted in-turn pre-step,
    // and policy cannot block the step.
    ctx.on('agent/pre-step', async (
      { agent, signal },
      next,
    ): Promise<PreStepDecision> => {
      const decision = await next()
      if (decision.kind === 'reject' || signal.aborted) return decision
      const pending = this.pendingIntents.get(agent.session)
      const mode = pending?.mode ?? foldModesState(agent.session.events)
      // Apply/lift the plan filter on the same boundary the request header
      // will describe, so catalog and execution never disagree with the mode.
      this.syncPlanFilter(agent, mode)
      if (pending === undefined) return decision
      const narration = this.narration(agent.session, pending.mode, pending.narrate)
      try {
        this.onBoundary(agent.session)
      } catch (error) {
        ctx.logger.warn('dsh-modes: failed to append selected mode at step start: %o', error)
        return decision
      }
      return narration === undefined
        ? decision
        : { ...decision, messages: [...decision.messages, narration] }
    })
    ctx.effect(() => () => { disposed = true }, 'dsh-modes: close service lifetime')
    // Unload must also lift every live plan filter (HMR safety). A Map (not a
    // WeakMap) is iterable, so the sweep reaches every filter installed by
    // this fiber; agent disposal that never passes through `syncPlanFilter`
    // after unload is covered because the disposers guard the tool layers,
    // which unload with their scoped contexts anyway.
    ctx.effect(() => () => {
      for (const dispose of this.planFilters.values()) dispose()
      this.planFilters.clear()
    }, 'dsh-modes: lift plan filters on unload')

    // Mode guidance: build/plan sections at the same prompt order, one of
    // which renders per the mode in force. The exit tool stays registered in
    // both modes so the request tool catalog is stable across transitions.
    ctx.systemPrompt.section({
      name: sectionName,
      order: 50,
      text: (context) => {
        if (context.agent === undefined) return ''
        const pending = this.pendingIntents.get(context.agent.session)
        const mode = pending?.mode ?? foldModesState(context.agent.session.events)
        return mode === 'plan' ? this.config.plan.section : this.config.build.section
      },
    })

    // The modes projection unit (session-projection RFC): a pure double-event
    // fold serving clients the whole {mode, pending, busy, failed} value.
    // `command/run` records the user's logged /mode-family selection;
    // `modes/state` records that selection and clears it. `turn/start` and
    // `turn/end` fold the executing-turn flag; `tool/result`, `turn/end`, and
    // `command/done` fold the last terminal outcome's failure. Pending, busy,
    // and failed are thereby pure replay quantities.
    // The unit child activates only when a projection registry is composed.
    const modesProjectionSchema: ZodType<ModesProjection> = zod.object({
      mode: zod.enum(['build', 'plan']),
      pending: zod.boolean(),
      busy: zod.boolean(),
      failed: zod.boolean(),
    })
    ctx.inject(['sessionProjections'], (projectionCtx) => {
      projectionCtx.sessionProjections.register<'modes', ModesUnitState>({
        key: 'modes',
        schema: modesProjectionSchema,
        init: modesUnitInit,
        apply: applyModesUnit,
        view: viewModesUnit,
        stateVersion: 2,
      })
    })

    // The command child activates only when a command registry is composed.
    ctx.inject(['commands'], (commandCtx) => {
      const register = (
        name: string,
        description: string,
        hint: string | undefined,
        handler: (agent: Agent, raw: string) => string,
      ): void => {
        commandCtx.commands.register({
          name,
          description,
          ...(hint !== undefined ? { input: { hint } } : {}),
          handler: ({ agent, rawInput }) => {
            try {
              return { kind: 'success', text: handler(agent, rawInput) }
            } catch (error) {
              return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
            }
          },
        })
      }

      /** Map a selection outcome to its human-readable command text. */
      const outcomeText = (mode: AgentMode, outcome: 'committed' | 'queued' | 'cancelled' | 'noop'): string => {
        switch (outcome) {
          case 'committed':
            return mode === 'plan' ? 'Plan mode on. Use /build to return.' : 'Build mode on.'
          case 'queued':
            return `${mode === 'plan' ? 'Entering plan' : 'Returning to build'} mode (applies from the next step).`
          case 'cancelled':
            return `Already in ${mode} mode (pending selection cleared).`
          case 'noop':
            return `Already in ${mode} mode.`
        }
      }

      register('mode', 'Show or cycle the agent mode (build/plan)', '[build|plan]', (agent, raw) => {
        const current = foldModesState(agent.session.events)
        const target = modeArg(current, raw)
        return outcomeText(target, this.select(agent, target))
      })
      register('plan', 'Enter plan mode (read-only research)', '[message]', (agent, raw) => {
        const trimmed = raw.trim()
        if (trimmed === 'off') {
          return outcomeText('build', this.select(agent, 'build'))
        }
        const outcome = this.select(agent, 'plan')
        if (trimmed !== '') {
          agent.steer(createUserMessage({ content: [{ type: 'text', text: trimmed }], source: { kind: 'user' } }))
        }
        return outcomeText('plan', outcome)
      })
      register('build', 'Leave plan mode and return to the default build mode', '[message]', (agent, raw) => {
        const trimmed = raw.trim()
        const outcome = this.select(agent, 'build')
        if (trimmed !== '') {
          agent.steer(createUserMessage({ content: [{ type: 'text', text: trimmed }], source: { kind: 'user' } }))
        }
        return outcomeText('build', outcome)
      })
    })

    const exitTool = this.config.exitToolName
    const exitDescription
      = 'Use only in plan mode. Present your plan for the user\'s review and, on approval, leave plan mode. '
      + 'Send the COMPLETE plan as markdown, starting with a # heading that names it. '
      + 'The user may approve (carry out the plan from your next step) or keep '
      + 'planning — their feedback comes back in the tool result; revise and present again.'

    ctx.tools.register(defineTool({
      name: exitTool,
      description: exitDescription,
      parameters: {
        plan: { type: 'string', required: true, description: 'The complete plan, as markdown, starting with a # heading that names it.' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            approved: { type: 'boolean', const: true, required: true },
          },
        },
        render: () => [{ type: 'text', text: 'Plan approved — plan mode exited; carry out the plan starting with your next step.' }],
      },
      execute: async (args, exec) => {
        const agent = exec.agent
        if (agent === undefined) throw new Error(`${exitTool} requires a calling agent (no session to switch)`)
        if (foldModesState(agent.session.events) !== 'plan') {
          throw new Error(`${exitTool} is only available in plan mode`)
        }
        if (!/^#\s+\S/.test(args.plan.trim())) {
          throw new Error(`${exitTool} requires a non-empty markdown plan starting with a # heading`)
        }
        const interaction = ctx.get('userQuestions')
        if (interaction === undefined) {
          throw new Error('no user-questions channel is available to review the plan; ask the user to switch the session mode instead')
        }
        const answer = await interaction.ask({
          questions: [{
            id: REVIEW_ID,
            header: 'Plan review',
            question: 'Approve this plan and leave plan mode?',
            detail: args.plan,
            options: [
              { label: APPROVE_LABEL, description: 'Leave plan mode; the plan is carried out from the next step.' },
              { label: KEEP_PLANNING_LABEL, description: 'Stay in plan mode; feedback goes back to the model.' },
            ],
            intent: { kind: 'plan-review', approve: APPROVE_LABEL },
          }],
          agent,
          signal: exec.signal,
        }).catch((cause: unknown) => {
          if (cause instanceof UserQuestionError && cause.code === 'ASK_CANCELLED') {
            throw new Error('The user dismissed the plan review to speak instead; '
              + 'stay in plan mode, stop here, and wait for their message.')
          }
          throw cause
        })
        if (disposed) {
          throw new Error('the modes service was reloaded while the plan was under review; present the plan again')
        }
        const reviewItems = answer.answers.filter(entry => entry.id === REVIEW_ID)
        const item = reviewItems.length === 1 ? reviewItems[0] : undefined
        if (item?.selected.length !== 1 || item.selected[0] !== APPROVE_LABEL || item.custom !== undefined) {
          const feedback = item?.custom ?? ''
          throw new Error(feedback === ''
            ? 'The user chose to keep planning; revise the plan and present it again.'
            : `The user chose to keep planning; their feedback: ${feedback}`)
        }
        // Keep plan guidance for the rest of this assistant tool batch. The
        // silent selection is appended at the next accepted in-turn pre-step,
        // before its request assembly.
        this.pendingIntents.set(agent.session, { mode: 'build', narrate: false })
        return { approved: true }
      },
      presentCall: args => ({
        card: 'generic',
        title: firstHeading(args.plan) ?? 'Plan',
        kind: 'other',
        content: [{ type: 'text', text: args.plan }],
      }),
      presentResult: (_args, result) => ({
        card: 'generic',
        title: 'Plan review',
        content: result.content,
      }),
    }))
  }

  /**
   * Read the logged mode and any selected mode awaiting the next accepted
   * in-turn pre-step.
   *
   * @param agent The agent to read.
   * @returns Current logged mode plus a pending selection, when present.
   */
  get(agent: Agent): { mode: AgentMode; pending?: AgentMode } {
    const mode = foldModesState(agent.session.events)
    const pending = this.pendingIntents.get(agent.session)
    return pending === undefined ? { mode } : { mode, pending: pending.mode }
  }

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
  select(agent: Agent, mode: AgentMode): 'committed' | 'queued' | 'cancelled' | 'noop' {
    const session = agent.session
    const pending = this.pendingIntents.get(session)
    const target = pending?.mode ?? foldModesState(session.events)
    if (mode === target) return 'noop'
    if (hasOpenTurn(session.events)) {
      this.pendingIntents.set(session, { mode, narrate: true })
      return foldModesState(session.events) === mode ? 'cancelled' : 'queued'
    }
    if (mode === foldModesState(session.events)) {
      this.pendingIntents.delete(session)
      return 'cancelled'
    }
    this.switchSandboxMode(session, mode)
    session.append('modes/state', { mode })
    this.pendingIntents.delete(session)
    this.syncPlanFilter(agent, mode)
    const narration = this.narration(session, mode, true)
    if (narration !== undefined) agent.inject(narration)
    return 'committed'
  }

  /** Apply one pending selection before the next request assembly. */
  private onBoundary(session: Session): void {
    const pending = this.pendingIntents.get(session)
    if (pending === undefined) return
    const target = pending.mode
    if (target === foldModesState(session.events)) {
      this.pendingIntents.delete(session)
      return
    }
    this.switchSandboxMode(session, target)
    session.append('modes/state', { mode: target })
    this.pendingIntents.delete(session)
  }

  /**
   * Keep the session's file sandbox in step with the mode: plan pins it to
   * `read-only` (any command may run; writes fail at the OS layer), build
   * restores the pre-plan override or the deployment default. Only writes a
   * `sandbox/mode` event when the read-only plan policy is enabled.
   */
  private switchSandboxMode(session: Session, target: AgentMode): void {
    if (!this.config.plan.readOnlySandboxOnPlan) return
    if (target === 'plan') {
      if (!this.priorSandbox.has(session)) {
        this.priorSandbox.set(session, effectiveSandboxMode(session.events))
      }
      setSandboxMode(session, 'read-only')
      return
    }
    const prior = this.priorSandbox.get(session)
    setSandboxMode(session, prior ?? 'workspace-write')
    this.priorSandbox.delete(session)
  }

  /**
   * Apply or lift the plan tool filter for one agent to match the target
   * mode. Idempotent: a filter for the same mode is left untouched, so the
   * pre-step call is cheap on every subsequent step.
   */
  private syncPlanFilter(agent: Agent, mode: AgentMode): void {
    const current = this.planFilters.get(agent)
    if (mode === 'plan') {
      if (current !== undefined) return
      this.planFilters.set(agent, this.installPlanFilter(agent))
      return
    }
    if (current === undefined) return
    current()
    this.planFilters.delete(agent)
  }

  /**
   * Install the plan-mode filter on the agent scope: a `tools.restrict` that
   * removes blocked tools from presentation/lookup/execution, plus a monotonic
   * `tools.guard` that denies any direct call to a blocked name (including the
   * reserved Code Mode transport, which restrict cannot name). Each returns a
   * disposer; both are combined into one.
   */
  private installPlanFilter(agent: Agent): () => void {
    const disposers: Array<() => void> = []
    const deny = this.config.plan.blockedTools.filter(name => name !== RUN_CODE)
    if (deny.length > 0) {
      try {
        disposers.push(agent.ctx.tools.restrict({ deny }))
      } catch (error) {
        this.ctx.logger.warn('dsh-modes: cannot restrict plan-mode tools %o (%o); the execution guard remains', deny, error)
      }
    }
    const blocked = new Set(this.config.plan.blockedTools)
    const reason = this.config.plan.rejectMessage
    disposers.push(agent.ctx.tools.guard(exec => blocked.has(exec.name) ? reason : undefined))
    return () => { for (const dispose of disposers) dispose() }
  }

  /** Build a user-switch notice when the last logged header described the other mode. */
  private narration(session: Session, target: AgentMode, narrate: boolean): UserMessage | undefined {
    if (!narrate) return undefined
    const told = modeAtLastHeader(session.events)
    if (told === undefined || told === target) return undefined
    const text = target === 'plan'
      ? 'The user switched this session to plan mode.'
      : 'The user switched this session back to the default build mode.'
    return createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'plugin', plugin: 'modes', form: 'notice', summary: text },
    })
  }
}

export default ModesController
