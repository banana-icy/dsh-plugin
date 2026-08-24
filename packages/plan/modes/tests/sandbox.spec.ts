/**
 * The plan-mode sandbox linkage: entering plan pins the session's file
 * sandbox to `read-only` (any command may run; writes fail at the OS layer),
 * leaving plan restores the pre-plan override or the deployment default.
 * Both the immediate (idle-session) and queued (open-turn) selection paths
 * write the `sandbox/mode` event beside `modes/state`.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { agentEvents } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import SandboxPolicyService, { effectiveSandboxMode, setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy'
import ModesController from '../src/index.ts'

const PLAN_CONFIG = {
  plan: {
    blockedTools: ['edit'],
    rejectMessage: 'read-only',
    section: 'plan policy',
  },
  build: { section: '' },
}

/** The fold of `sandbox/mode` events; undefined when the session never switched. */
const sandboxMode = (session: Session) => effectiveSandboxMode(session.events)

/** Mount the real controller beside real services, with one agent+session. */
async function mounted(config = PLAN_CONFIG) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(SandboxPolicyService, { defaultMode: 'workspace-write', workspaceRoot: '/tmp' })
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(ModesController, config)
  const session = ctx.sessions.create()
  const agent = { id: session.id, session, status: 'idle', ctx } as Agent & { session: Session }
  ctx.agents.register(agent)
  return { ctx, session, agent }
}

/** Run the real agent/pre-step waterfall so a queued selection commits at the boundary. */
async function boundary(ctx: Context, agent: Agent & { session: Session }): Promise<void> {
  const message = createUserMessage({ content: [{ type: 'text', text: 'boundary probe' }], source: { kind: 'user' } })
  await agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { messages: [message], turn: 1, step: 1, signal: new AbortController().signal },
    () => Promise.resolve({ kind: 'enter' as const, messages: [message] }),
  )
}

describe('plan-mode sandbox linkage', () => {
  it('pins read-only on entering plan and restores workspace-write on leaving', async () => {
    const { session, agent } = await mounted()
    // Idle session: the selection commits immediately.
    controllerSelect(agent, 'plan')
    expect(sandboxMode(session)).toBe('read-only')
    controllerSelect(agent, 'build')
    expect(sandboxMode(session)).toBe('workspace-write')

  })

  it('queued selections write the sandbox event at the pre-step boundary', async () => {
    const { ctx, session, agent } = await mounted()
    session.append('turn/start', { turn: 0 })
    controllerSelect(agent, 'plan')
    // Open turn: pending until the next accepted pre-step.
    expect(sandboxMode(session)).toBeUndefined()
    await boundary(ctx, agent)
    expect(sandboxMode(session)).toBe('read-only')
    session.append('turn/end', { turn: 0, reason: { kind: 'completed' } })
    controllerSelect(agent, 'build')
    expect(sandboxMode(session)).toBe('workspace-write')

  })

  it('restores a pre-existing session override after leaving plan', async () => {
    const { session, agent } = await mounted()
    setSandboxMode(session, 'danger-full-access')
    controllerSelect(agent, 'plan')
    expect(sandboxMode(session)).toBe('read-only')
    controllerSelect(agent, 'build')
    expect(sandboxMode(session)).toBe('danger-full-access')

  })

  it('skips the sandbox linkage when readOnlySandboxOnPlan is false', async () => {
    const { session, agent } = await mounted({
      plan: { ...PLAN_CONFIG.plan, readOnlySandboxOnPlan: false },
      build: { section: '' },
    })
    controllerSelect(agent, 'plan')
    expect(sandboxMode(session)).toBeUndefined()

  })
})

function controllerSelect(agent: Agent & { session: Session }, mode: 'build' | 'plan'): void {
  // Reaching the plugin's select through the service face: the controller is
  // a service named `modes`, so the test drives the same path commands use.
  ;(agent as { ctx: Context }).ctx.modes.select(agent, mode)
}
