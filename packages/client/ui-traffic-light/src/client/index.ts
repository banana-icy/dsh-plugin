import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the generated Remote API and ctx.remote merge
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the ui-layout SlotMap merge (the shell.overlay entry)
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: the `modes` SessionProjectionMap merge
import type {} from '@deepseek-ai/dsh-modes/client'
import { ModePet, type ModePetInjected } from './ModePet.tsx'
import { TrafficView } from './traffic-view.ts'

export const inject = ['slots', 'remote', 'remote.commands', 'sessions'] as const

/** Run one /mode command against the given session; null on success. */
async function navigateMode(ctx: ClientContext, sessionId: SessionId | undefined, next: 'build' | 'plan'): Promise<string | null> {
  if (sessionId === undefined) return null
  const result = await ctx.remote.commands.execute(sessionId, `/mode ${next}`)
  if (!result.ok) return `mode switch failed: ${result.error.message} (${result.error.code})`
  if (result.value === undefined) return 'unknown command'
  return null
}

/** The shortcut's target from the live projection: a stuck failure exits to green. */
function currentSessionId(ctx: ClientContext): SessionId | undefined {
  return ctx.sessions.list.getSnapshot().current
}

export const apply = (ctx: ClientContext): void => {
  // The frame-wide pet on the shell overlay layer: mounted regardless of the
  // current session, so it stays put while the user browses the session list.
  // The slot is declared by ui-layout, whose activation order is independent
  // of this plugin — wait for the declaration instead of registering bare.
  const traffic = new TrafficView(ctx.sessions)
  ctx.effect(() => () => { traffic.dispose() }, 'ui-traffic-light: traffic view')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'mode-pet',
    order: 30,
    inject: (): ModePetInjected => ({
      hooks: { traffic },
      navigate: next => navigateMode(ctx, currentSessionId(ctx), next),
    }),
  }, ModePet))

  // Handle Ctrl+P/Cmd+P shortcut: green<->yellow toggle, stuck failure exits to green.
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault()
      e.stopPropagation()
      const id = currentSessionId(ctx)
      if (id === undefined) return
      const projection = ctx.sessions.binding(id)?.session.projections.faceOf('modes').getSnapshot() as
        { mode: 'build' | 'plan'; failed: boolean } | undefined
      void navigateMode(ctx, id, projection?.failed === true ? 'build' : projection?.mode === 'plan' ? 'build' : 'plan')
    }
  }

  window.addEventListener('keydown', handleKeyDown, { capture: true })

  ctx.effect(() => {
    return () => { window.removeEventListener('keydown', handleKeyDown, { capture: true }) }
  })
}

export const name = '@deepseek-ai/dsh-client-ui-traffic-light'
