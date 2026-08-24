/**
 * Mode-switcher client plugin. Registers a keydown listener for Ctrl+1
 * (build mode) / Ctrl+2 (plan mode). The composer dock carries no widget:
 * the floating traffic-light pet (@deepseek-ai/dsh-client-ui-traffic-light)
 * owns all visible mode indicator UX.
 *
 * @module @deepseek-ai/dsh-client-ui-mode/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services: the commands Remote and the session list. */
export declare const inject: string[];
/**
 * Client plugin body: register the mode-switch keydown listener only.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map