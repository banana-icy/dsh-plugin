import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client';
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client';
import type { AgentMode } from '@deepseek-ai/dsh-modes/client';
/** Pet-relevant slice of the modes projection value. */
export interface PetView {
    mode: AgentMode;
    busy: boolean;
    failed: boolean;
}
/**
 * Registrant hooks source for the pet: republishes the current session's
 * modes projection slice on session switches and on projection pushes. The
 * value is undefined before any projection materializes (the pet renders as
 * idle green then) — never a missing channel — so the component stays mounted
 * across session selection changes while the shell.overlay seat is frame-wide.
 */
export declare class TrafficView implements ObservableSnapshot<PetView | undefined> {
    private readonly sessions;
    private readonly listeners;
    private detachList;
    private detachFace;
    private current;
    private value;
    constructor(sessions: ISessions);
    getSnapshot(): PetView | undefined;
    subscribe(listener: () => void): () => void;
    /** Stop every subscription; the source is dead after this. */
    dispose(): void;
    private attach;
    private detach;
    /** Follow the current session id; when it moves, retarget the modes face. */
    private resync;
    private resyncValue;
}
//# sourceMappingURL=traffic-view.d.ts.map