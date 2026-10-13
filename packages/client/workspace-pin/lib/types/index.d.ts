/**
 * dsh-workspace-pin host entry.
 *
 * The plugin is browser-side only: this half declares the loader entry so the
 * client-module scanner can discover the package and serve its bundle. It
 * mounts nothing and provides no service.
 *
 * @module dsh-workspace-pin
 */

/** Loader entry name. */
export declare const name: string

/**
 * No-op host half.
 * @param _ctx - host context.
 * @param _config - entry config.
 */
export declare function apply(_ctx: unknown, _config: unknown): void