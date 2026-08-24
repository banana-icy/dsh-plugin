/**
 * Mode-switcher client plugin. Registers a keydown listener for Ctrl+1
 * (build mode) / Ctrl+2 (plan mode). The composer dock carries no widget:
 * the floating traffic-light pet (@deepseek-ai/dsh-client-ui-traffic-light)
 * owns all visible mode indicator UX.
 *
 * @module @deepseek-ai/dsh-client-ui-mode/client
 */
const DEFAULT_SHORTCUT = {
    build: { key: '1', ctrlKey: true },
    plan: { key: '2', ctrlKey: true },
};
/** Resolve whether the event matches a shortcut spec. */
function matchShortcut(event, spec) {
    if (event.key !== spec.key)
        return false;
    if (spec.ctrlKey !== undefined && event.ctrlKey !== spec.ctrlKey)
        return false;
    if (spec.metaKey !== undefined && event.metaKey !== spec.metaKey)
        return false;
    if (spec.shiftKey !== undefined && event.shiftKey !== spec.shiftKey)
        return false;
    return true;
}
/** Required services: the commands Remote and the session list. */
export const inject = ['remote', 'remote.commands', 'sessions'];
/**
 * Client plugin body: register the mode-switch keydown listener only.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    // Global keydown listener for Ctrl+1/Ctrl+2.
    // Active only when the composer textarea is focused (to avoid intercepting
    // browser-level shortcuts when the user is not typing).
    const onKeyDown = (event) => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement))
            return;
        if (!active.closest('[data-composer]'))
            return;
        if (matchShortcut(event, DEFAULT_SHORTCUT.build)) {
            event.preventDefault();
            const sessionId = currentSessionId(ctx);
            if (sessionId === null)
                return;
            void ctx.remote.commands.execute(sessionId, '/mode build');
        }
        else if (matchShortcut(event, DEFAULT_SHORTCUT.plan)) {
            event.preventDefault();
            const sessionId = currentSessionId(ctx);
            if (sessionId === null)
                return;
            void ctx.remote.commands.execute(sessionId, '/mode plan');
        }
    };
    window.addEventListener('keydown', onKeyDown, true);
    ctx.effect(() => () => { window.removeEventListener('keydown', onKeyDown, true); }, 'ui-mode: keydown listener');
}
/** Resolve the current session id from the session list. */
function currentSessionId(ctx) {
    return ctx.sessions.list.getSnapshot().current ?? null;
}
//# sourceMappingURL=index.js.map