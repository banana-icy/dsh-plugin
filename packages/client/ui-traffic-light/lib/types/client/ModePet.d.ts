import type { PropsRuntime, HostObservable, InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import type { AgentMode } from '@deepseek-ai/dsh-modes/client';
import type { PetView } from './traffic-view.ts';
/** Injected face of the pet entry: the traffic view hook source and the mode-switch verb. */
export interface ModePetInjected {
    hooks: {
        /** The current session's traffic view (undefined = no session/projection yet). */
        traffic: HostObservable<PetView | undefined>;
    };
    /** @returns null on success, or the failure message. */
    navigate: (next: AgentMode) => Promise<string | null>;
}
export type ModePetProps = PropsRuntime<'shell.overlay'> & InjectFace<ModePetInjected>;
/**
 * Traffic-light display state over the traffic view:
 * - failed + plan → yellow blink (stuck)
 * - failed + build → red blink (stuck)
 * - plan → yellow
 * - build + busy → red (automatic, only while a turn executes)
 * - build + idle → green
 */
export declare function petFace(projection: {
    mode: AgentMode;
    busy: boolean;
    failed: boolean;
}): {
    src: string;
    blink: boolean;
};
/** The traffic-light desktop pet: frame-wide, draggable, click to switch. */
export declare const ModePet: ({ useTraffic, navigate }: ModePetProps) => import("react").JSX.Element;
//# sourceMappingURL=ModePet.d.ts.map