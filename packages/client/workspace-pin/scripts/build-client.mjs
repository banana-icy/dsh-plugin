/**
 * dsh-workspace-pin client bundle builder.
 *
 * The client half ships as one classic script the web host serves under
 * /plugins/dsh-workspace-pin/client.js. This script is the only build step: it
 * checks src/client-src.js parses and writes it to lib/client.js, which is what
 * the package's `./client` export points at.
 *
 * Usage:
 *   node scripts/build-client.mjs          # (re)write lib/client.js
 *   node scripts/build-client.mjs --check  # fail if lib/client.js drifted
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const target = join(root, "lib", "client.js");

const source = readFileSync(join(root, "src", "client-src.js"), "utf8");

try {
	new vm.Script(source, { filename: "client.js" });
} catch (error) {
	console.error("build-client: src/client-src.js has a syntax error:", error.message);
	process.exit(1);
}

if (process.argv.includes("--check")) {
	let current = "";
	try {
		current = readFileSync(target, "utf8");
	} catch {
		console.error("build-client --check: lib/client.js is missing. Run `npm run build`.");
		process.exit(1);
	}
	if (current !== source) {
		console.error("build-client --check: lib/client.js is stale. Run `npm run build`.");
		process.exit(1);
	}
	console.log("build-client: lib/client.js is in sync with src/client-src.js");
} else {
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, source);
	console.log(`build-client: wrote ${target} (${source.length} bytes)`);
}