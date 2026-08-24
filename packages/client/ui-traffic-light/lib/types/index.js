import { readFile } from 'node:fs/promises';
import { join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_ROUTE_PREFIX } from "./assets.js";
/** Content types for the asset file names this half serves. */
const CONTENT_TYPES = {
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
};
/**
 * Package assets directory (`<package>/../assets` from both the bundled
 * `lib/index.js` and the tsx-run `src/index.ts` module locations).
 */
const ASSETS_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '../assets');
/**
 * Resolve a request pathname inside the assets directory without traversal.
 * @param pathname - decoded request pathname.
 * @returns the absolute asset path, or null when the request escapes the assets directory.
 */
function resolveAsset(pathname) {
    if (!pathname.startsWith(`${ASSET_ROUTE_PREFIX}/`))
        return null;
    const rel = pathname.slice(ASSET_ROUTE_PREFIX.length + 1);
    if (rel === '' || rel.includes('..') || rel.includes('\0'))
        return null;
    const root = normalize(ASSETS_DIR);
    const target = normalize(join(root, rel));
    if (relative(root, target).startsWith(`..${sep}`))
        return null;
    return target;
}
/** Serve one asset file with its content type, or an error status. */
async function serveAsset(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        res.end();
        return;
    }
    let path;
    try {
        path = resolveAsset(decodeURIComponent(new URL(req.url ?? '/', 'http://dsh.internal').pathname));
    }
    catch {
        res.writeHead(400);
        res.end();
        return;
    }
    if (path === null) {
        res.writeHead(403);
        res.end();
        return;
    }
    const contentType = CONTENT_TYPES[path.slice(path.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';
    try {
        const body = await readFile(path);
        res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-cache' });
        res.end(body);
    }
    catch {
        res.writeHead(404);
        res.end();
    }
}
/** Required services: the web route registry. */
export const inject = ['webServer'];
/**
 * Node half: serves the pet's traffic-light PNGs to the browser half. The
 * prefix is a wire contract owned by this plugin; the route registration
 * throws on a duplicate, which is a composition error by contract.
 */
export const apply = (ctx) => {
    const dispose = ctx.webServer.register({
        kind: 'prefix',
        path: ASSET_ROUTE_PREFIX,
        handler: serveAsset,
    });
    ctx.effect(() => {
        return () => { dispose(); };
    }, 'ui-traffic-light: asset routes');
};
export const name = '@deepseek-ai/dsh-client-ui-traffic-light';
//# sourceMappingURL=index.js.map