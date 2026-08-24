import type { Plugin } from '@deepseek-ai/cordis';
/** Required services: the web route registry. */
export declare const inject: readonly ["webServer"];
/**
 * Node half: serves the pet's traffic-light PNGs to the browser half. The
 * prefix is a wire contract owned by this plugin; the route registration
 * throws on a duplicate, which is a composition error by contract.
 */
export declare const apply: Plugin;
export declare const name = "@deepseek-ai/dsh-client-ui-traffic-light";
//# sourceMappingURL=index.d.ts.map