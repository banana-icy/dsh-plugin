/**
 * Registrant hooks source for the pet: republishes the current session's
 * modes projection slice on session switches and on projection pushes. The
 * value is undefined before any projection materializes (the pet renders as
 * idle green then) — never a missing channel — so the component stays mounted
 * across session selection changes while the shell.overlay seat is frame-wide.
 */
export class TrafficView {
    sessions;
    listeners = new Set();
    detachList;
    detachFace;
    current;
    value;
    constructor(sessions) {
        this.sessions = sessions;
    }
    getSnapshot() {
        return this.value;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        if (this.listeners.size === 1)
            this.attach();
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0)
                this.detach();
        };
    }
    /** Stop every subscription; the source is dead after this. */
    dispose() {
        this.detach();
        this.listeners.clear();
    }
    attach() {
        this.detachList = this.sessions.list.subscribe(() => { this.resync(); });
        this.resync();
    }
    detach() {
        this.detachList?.();
        this.detachList = undefined;
        this.detachFace?.();
        this.detachFace = undefined;
    }
    /** Follow the current session id; when it moves, retarget the modes face. */
    resync() {
        const id = this.sessions.list.getSnapshot().current;
        if (id !== this.current) {
            this.detachFace?.();
            this.detachFace = undefined;
            this.current = id;
            if (id !== undefined) {
                const face = this.sessions.binding(id)?.session.projections.faceOf('modes');
                if (face !== undefined)
                    this.detachFace = face.subscribe(() => { this.resyncValue(); });
            }
        }
        this.resyncValue();
    }
    resyncValue() {
        const id = this.current;
        const next = id === undefined
            ? undefined
            : this.sessions.binding(id)?.session.projections.faceOf('modes').getSnapshot();
        const view = next === undefined ? undefined : { mode: next.mode, busy: next.busy, failed: next.failed };
        if (view !== this.value) {
            this.value = view;
            for (const listener of this.listeners)
                listener();
        }
    }
}
//# sourceMappingURL=traffic-view.js.map