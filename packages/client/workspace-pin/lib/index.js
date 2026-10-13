/**
 * dsh-workspace-pin host entry: the plugin is browser-side only. Nothing is
 * mounted on the host; the entry exists so the package is a loader entry the
 * client-module scanner (dsh-client-modules) can discover and serve under
 * /plugins.
 *
 * @module dsh-workspace-pin
 */

export const name = 'dsh-workspace-pin'

/** No-op host half. @param _ctx - host context. @param _config - entry config. */
export function apply(_ctx, _config) {}