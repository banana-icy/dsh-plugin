import { ModePet } from "./ModePet.js";
import { TrafficView } from "./traffic-view.js";
export const inject = ['slots', 'remote', 'remote.commands', 'sessions'];
/** Run one /mode command against the given session; null on success. */
async function navigateMode(ctx, sessionId, next) {
    if (sessionId === undefined)
        return null;
    const result = await ctx.remote.commands.execute(sessionId, `/mode ${next}`);
    if (!result.ok)
        return `mode switch failed: ${result.error.message} (${result.error.code})`;
    if (result.value === undefined)
        return 'unknown command';
    return null;
}
/** The shortcut's target from the live projection: a stuck failure exits to green. */
function currentSessionId(ctx) {
    return ctx.sessions.list.getSnapshot().current;
}
export const apply = (ctx) => {
    // The frame-wide pet on the shell overlay layer: mounted regardless of the
    // current session, so it stays put while the user browses the session list.
    // The slot is declared by ui-layout, whose activation order is independent
    // of this plugin — wait for the declaration instead of registering bare.
    const traffic = new TrafficView(ctx.sessions);
    ctx.effect(() => () => { traffic.dispose(); }, 'ui-traffic-light: traffic view');
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'mode-pet',
        order: 30,
        inject: () => ({
            hooks: { traffic },
            navigate: next => navigateMode(ctx, currentSessionId(ctx), next),
        }),
    }, ModePet));
    // Handle Ctrl+P/Cmd+P shortcut: green<->yellow toggle, stuck failure exits to green.
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            e.stopPropagation();
            const id = currentSessionId(ctx);
            if (id === undefined)
                return;
            const projection = ctx.sessions.binding(id)?.session.projections.faceOf('modes').getSnapshot();
            void navigateMode(ctx, id, projection?.failed === true ? 'build' : projection?.mode === 'plan' ? 'build' : 'plan');
        }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    ctx.effect(() => {
        return () => { window.removeEventListener('keydown', handleKeyDown, { capture: true }); };
    });
};
export const name = '@deepseek-ai/dsh-client-ui-traffic-light';
//# sourceMappingURL=index.js.map