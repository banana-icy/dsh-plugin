/** Package-owned durable modes invariants. @module @deepseek-ai/dsh-modes/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { AgentMode } from './types.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-modes'

/** Cordis companion plugin name. */
export const name = 'modes-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Validate one `modes/state` event before it reaches the durable log.
 * `modes/state` is a standalone whole-value event: an idle selection commits
 * between turns and a mid-turn selection commits at the step boundary, so no
 * turn-enclosure relation exists — only the mode payload is checkable.
 */
function validateEvent(event: SessionEvent, fail: InvariantFailure): void {
  if (event.type !== 'modes/state') return
  const mode = (event.data as { mode?: unknown }).mode
  if (mode !== 'build' && mode !== 'plan') {
    fail(`modes/state carries invalid mode ${JSON.stringify(mode)}; expected 'build' or 'plan'`)
  }
}

/** Install validation for loaded and newly appended modes state. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  const seed = (session: Session): void => {
    for (const event of session.events) validateEvent(event, fail)
  }
  for (const session of ctx.sessions.list()) seed(session)
  ctx.on('session/created', (session) => { seed(session) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [, event] = args as [Session, SessionEvent]
    validateEvent(event, fail)
  }, { global: true })
}, { inject: ['sessions'] })

/** Re-export the closed mode union for invariant consumers (one home). */
export type { AgentMode }

/**
 * Register the modes invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
