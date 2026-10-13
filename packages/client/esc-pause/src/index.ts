/**
 * dsh-esc-pause host half. The gesture is browser-only: this half exists so
 * the plugin has a valid cordis row in the profile tree, and it registers no
 * host-side behavior.
 */

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-esc-pause'

/** Host plugin body — no host-side behavior for this browser gesture. */
export function apply(): void {}