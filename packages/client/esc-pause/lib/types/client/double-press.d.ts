/**
 * Double-press detection for one key gesture.
 *
 * The detector counts only the presses the caller hands it: eligibility
 * (plain Escape, no overlay owning the key, no IME composition) is decided
 * outside, and every ineligible press must call {@link DoublePressDetector.reset}.
 * That split is what keeps a dialog dismissal from arming the gesture — the
 * press that closes a dialog is reported as a reset, not as a first press.
 */
export declare class DoublePressDetector {
    private readonly options;
    private lastPressAt;
    /**
     * @param options.windowMs - maximum gap between the two presses.
     * @param options.now - monotonic clock reading in milliseconds.
     */
    constructor(options: {
        readonly windowMs: number;
        readonly now: () => number;
    });
    /**
     * Record one eligible press.
     * @returns true when this press completes the gesture; the detector then
     *   disarms, so a third press starts a new gesture instead of firing again.
     */
    press(): boolean;
    /** Forget any armed first press. */
    reset(): void;
}
