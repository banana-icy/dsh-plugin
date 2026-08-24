/** Package-owned durable modes invariants. @module @deepseek-ai/dsh-modes/invariant */
import type { Context } from '@deepseek-ai/cordis';
import type { AgentMode } from './types.ts';
/** Cordis companion plugin name. */
export declare const name = "modes-invariant";
/** Service required before the companion can reserve package ownership. */
export declare const inject: string[];
/** Re-export the closed mode union for invariant consumers (one home). */
export type { AgentMode };
/**
 * Register the modes invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export declare const apply: (ctx: Context) => Promise<() => void>;
//# sourceMappingURL=invariant.d.ts.map