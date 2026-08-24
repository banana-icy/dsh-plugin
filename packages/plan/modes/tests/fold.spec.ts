/**
 * The modes projection unit fold: mode + pending selection + turn busy +
 * last-terminal-outcome failure, all pure replay quantities. The registry
 * drive is exercised once (mount) while the fold mathematics below covers the
 * state combinations the pet reads: green (build idle), yellow (plan), red
 * (build busy), and the stuck blink flags after a failure.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { CommandId } from '@deepseek-ai/dsh-commands/brand'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import ModesController from '../src/index.ts'
import {
  applyModesUnit, modesUnitInit, modeArg, viewModesUnit,
} from '../src/fold.ts'

const PLAN_CONFIG = {
  plan: {
    blockedTools: ['edit'],
    rejectMessage: 'read-only',
    section: 'plan policy',
  },
  build: { section: '' },
}

const command = (name: string, args: string, index: number) => ({
  type: 'command/run',
  data: { commandId: CommandId(`c-${name}-${String(index)}`), name, args, source: { kind: 'user' } },
} as const)

const commandDone = (index: number, kind: 'success' | 'error') => ({
  type: 'command/done',
  data: { commandId: CommandId(`c-done-${String(index)}`), kind },
} as const)

/** Drive the projection unit through the registry with the real plugin. */
async function mounted() {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(ModesController, PLAN_CONFIG)
  const session = ctx.sessions.create()
  ctx.agents.register({ id: session.id, session, status: 'idle', ctx } as Agent)
  return { values: () => ctx.sessionProjections.snapshot(session).values, session }
}

function runModeCommand(session: Session, name: string, args: string, index: number): void {
  session.append('command/run', {
    commandId: CommandId(`m-${name}-${String(index)}`),
    name,
    args,
    source: { kind: 'user' },
  })
  session.append('command/done', { commandId: CommandId(`m-${name}-${String(index)}`), kind: 'success' })
}

describe('modes projection unit fold', () => {
  it('starts green: build mode, idle, no failure', () => {
    expect(viewModesUnit(modesUnitInit())).toEqual({ mode: 'build', pending: false, busy: false, failed: false })
  })

  it('a /mode plan selection reads pending until modes/state commits it', () => {
    let state = applyModesUnit(modesUnitInit(), command('mode', 'plan', 0))
    expect(viewModesUnit(state)).toEqual({ mode: 'build', pending: true, busy: false, failed: false })
    state = applyModesUnit(state, commandDone(0, 'success'))
    expect(viewModesUnit(state).pending).toBe(true)
    state = applyModesUnit(state, { type: 'modes/state', data: { mode: 'plan' } })
    expect(viewModesUnit(state)).toEqual({ mode: 'plan', pending: false, busy: false, failed: false })
  })

  it('cycle: /mode with no args from plan targets build', () => {
    const state = applyModesUnit({ ...modesUnitInit(), mode: 'plan' }, command('mode', '', 0))
    expect(viewModesUnit(state).pending).toBe(true)
    expect(state.wanted).toBe('build')
  })

  it('red while a turn executes, green again at turn/end', () => {
    let state = applyModesUnit(modesUnitInit(), { type: 'turn/start', data: { turn: 0 } })
    expect(viewModesUnit(state).busy).toBe(true)
    state = applyModesUnit(state, { type: 'turn/end', data: { turn: 0, reason: { kind: 'completed' } } })
    expect(viewModesUnit(state)).toMatchObject({ busy: false, failed: false })
  })

  it('a tool error fails; the next successful tool result clears it', () => {
    let state = applyModesUnit(modesUnitInit(), {
      type: 'tool/result',
      data: { turn: 0, step: 0, message: { role: 'tool', content: [{ type: 'text', text: '' }] }, error: { name: 'boom', code: 'E_BOOM' } },
    })
    expect(viewModesUnit(state).failed).toBe(true)
    state = applyModesUnit(state, {
      type: 'tool/result',
      data: { turn: 0, step: 0, message: { role: 'tool', content: [{ type: 'text', text: 'ok' }] } },
    })
    expect(viewModesUnit(state).failed).toBe(false)
  })

  it('a failed turn end fails; a completed turn end clears', () => {
    let state = applyModesUnit(modesUnitInit(), { type: 'turn/start', data: { turn: 0 } })
    state = applyModesUnit(state, { type: 'turn/end', data: { turn: 0, reason: { kind: 'error', error: { message: 'llm down', code: 'X' } } } })
    expect(viewModesUnit(state)).toMatchObject({ busy: false, failed: true })
    state = applyModesUnit(state, { type: 'turn/start', data: { turn: 1 } })
    state = applyModesUnit(state, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
    expect(viewModesUnit(state).failed).toBe(false)
  })

  it('a failed command fails; the next successful command clears', () => {
    let state = applyModesUnit(modesUnitInit(), commandDone(0, 'error'))
    expect(viewModesUnit(state).failed).toBe(true)
    state = applyModesUnit(state, commandDone(1, 'success'))
    expect(viewModesUnit(state).failed).toBe(false)
  })

  it('serves green/yellow through the mounted registry', async () => {
    const bench = await mounted()
    expect(bench.values().modes).toEqual({ mode: 'build', pending: false, busy: false, failed: false })
    runModeCommand(bench.session, 'mode', 'plan', 0)
    expect(bench.values().modes).toEqual({ mode: 'build', pending: true, busy: false, failed: false })
    bench.session.append('turn/start', { turn: 0 })
    bench.session.append('modes/state', { mode: 'plan' })
    bench.session.append('turn/end', { turn: 0, reason: { kind: 'completed' } })
    expect(bench.values().modes).toEqual({ mode: 'plan', pending: false, busy: false, failed: false })
  })

  it('keeps state reference stable when nothing changed', () => {
    const init = modesUnitInit()
    const state = applyModesUnit(init, { type: 'user/message', data: { content: [{ type: 'text', text: 'x' }], source: { kind: 'user' } } })
    expect(state).toBe(init)
  })

  it('covers the command-family branches: modes/plan/build, recordless, repeated selection', () => {
    // `modes` alias and `plan`/`build` names all fold a wanted target.
    let state = applyModesUnit(modesUnitInit(), command('modes', 'plan', 0))
    expect(state.wanted).toBe('plan')
    state = applyModesUnit(state, command('plan', 'off', 1))
    expect(state.wanted).toBe('build')
    state = applyModesUnit(state, command('build', '', 2))
    expect(state.wanted).toBe('build')
    // A recorded-input-less command/run leaves the selection untouched (no ref change).
    const frozen = state
    state = applyModesUnit(state, { type: 'command/run', data: { commandId: CommandId('c-other'), name: 'todo', source: { kind: 'user' } } })
    expect(state).toBe(frozen)
    // A repeated identical selection returns the same reference.
    state = applyModesUnit(state, command('build', '', 3))
    expect(state).toBe(frozen)
    // No-arg cycle from build targets plan.
    state = applyModesUnit(state, command('mode', '', 4))
    expect(state.wanted).toBe('plan')
    // turn/start while already busy keeps the reference.
    state = applyModesUnit(state, { type: 'turn/start', data: { turn: 0 } })
    const busy = applyModesUnit(state, { type: 'turn/start', data: { turn: 1 } })
    expect(busy).toBe(state)
    // modeArg direct coverage: explicit 'build'/'plan' targets.
    expect(modeArg('plan', 'build')).toBe('build')
    expect(modeArg('build', 'plan')).toBe('plan')
    // A repeated modes-family selection whose target equals the current wanted
    // keeps the reference (cond-expr true path).
    state = applyModesUnit(state, command('mode', 'plan', 5))
    expect(applyModesUnit(state, command('mode', 'plan', 6))).toBe(state)
    // plan with a non-'off' message targets plan (non-'off' cond path).
    state = applyModesUnit(state, command('plan', 'investigate', 7))
    expect(state.wanted).toBe('plan')
    // plan off when the wanted is already build keeps the reference.
    state = applyModesUnit(state, command('plan', 'off', 8))
    expect(state.wanted).toBe('build')
    expect(applyModesUnit(state, command('plan', 'off', 9))).toBe(state)
    // build targeting a different wanted moves (false branch of build's cond).
    state = applyModesUnit(modesUnitInit(), command('mode', 'plan', 10))
    const afterBuild = applyModesUnit(state, command('build', '', 11))
    expect(afterBuild.wanted).toBe('build')
    expect(afterBuild).not.toBe(state)
    // A non-mode-family command with recorded input leaves the state untouched.
    const other = applyModesUnit(state, { type: 'command/run', data: { commandId: CommandId('c-other'), name: 'todo_write', args: 'x', source: { kind: 'user' } } })
    expect(other).toBe(state)
  })
})
