/**
 * Integration test for the dsh-workspace-pin client bundle.
 *
 * The bundle is loaded into a jsdom document whose sidebar markup mirrors the
 * hooks the plugin keys on (`data-row-key="workspace:<id>"`, the ⋯ trigger as
 * the row's first button, a portaled `div[role="menu"]`). The workspace service
 * is a stub that applies the same insert-before semantics as the host registry,
 * so the assertions cover ordering, restore anchors, and the injected markup.
 *
 * jsdom is resolved at runtime — install it here, or point DSH_JSDOM at an
 * existing copy, so this package can stay dependency-free:
 *
 *   DSH_JSDOM=/path/to/node_modules/jsdom/lib/api.js node --test test/client.spec.mjs
 *
 * Run: node --test test/client.spec.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/** First specifier that resolves to a usable jsdom. */
async function loadJsdom() {
	for (const specifier of [process.env.DSH_JSDOM, "jsdom"]) {
		if (!specifier) continue;
		try {
			const module = await import(specifier);
			if (typeof module.JSDOM === "function") return module.JSDOM;
		} catch {
			// Try the next candidate; the final message names what to set.
		}
	}
	throw new Error(
		"jsdom is required: install it here, or set DSH_JSDOM to a jsdom entry point "
		+ "(for example /path/to/deepseek-harness/node_modules/jsdom/lib/api.js)",
	);
}

const JSDOM = await loadJsdom();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = readFileSync(join(root, "lib", "client.js"), "utf8");

const WORKSPACES = [
	{ id: "ws-a", label: "工作区 A" },
	{ id: "ws-b", label: "工作区 B" },
	{ id: "ws-c", label: "工作区 C" },
];

/** One workspace header row, shaped like ui-workspace's project row. */
function workspaceRow({ id, label }) {
	return `
		<div class="projectRow" data-row-key="workspace:${id}" role="treeitem" aria-expanded="true">
			<span class="slot folder"></span>
			<span class="slot chevron"></span>
			<span class="projectText"><span class="title">${label}</span></span>
			<span class="rowActions">
				<span class="menuRoot"><button type="button" class="iconButton" aria-label="工作区“${label}”的操作"><svg></svg></button></span>
				<span class="tooltipRoot"><button type="button" class="iconButton" aria-label="新会话"><svg></svg></button></span>
			</span>
		</div>`;
}

/** Load the bundle and wire the workspace stub. */
function setup() {
	const html = `<!doctype html><html lang="zh"><body><div role="tree">
		${WORKSPACES.map(workspaceRow).join("")}
		<div class="projectRow" data-row-key="workspace:__ungrouped__" role="treeitem">
			<span class="rowActions"><span class="menuRoot"><button type="button" aria-label="未分组">…</button></span></span>
		</div>
	</div></body></html>`;

	const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
	const { window } = dom;
	let loaded = null;
	window.__ModuleLoader__ = { load: (spec) => { loaded = spec; } };
	window.eval(bundle);

	const state = { order: WORKSPACES.map((w) => w.id) };
	const calls = [];
	const ctx = {
		workspaces: {
			list: { getSnapshot: () => ({ items: state.order.map((id) => ({ workspaceId: id })) }) },
			// Mirrors WorkspaceRegistry.insertBefore: with an anchor it lands before
			// that workspace, without one it appends.
			insertBefore: async (id, beforeId) => {
				calls.push([id, beforeId]);
				const without = state.order.filter((other) => other !== id);
				const at = beforeId === undefined ? without.length : without.indexOf(beforeId);
				state.order = [...without.slice(0, at), id, ...without.slice(at)];
			},
		},
	};

	const module_ = loaded.factory();
	module_.apply(ctx);

	const document = window.document;
	const tick = () => new Promise((resolve) => { window.setTimeout(resolve, 40); });
	const rowOf = (id) => document.querySelector(`[data-row-key="workspace:${id}"]`);
	const anchorOf = (id) => rowOf(id).querySelector("button");
	const markerOf = (id) => rowOf(id).querySelector('[data-dsh-workspace-pin="marker"]');
	/** The injected menu row's button; its parent is the menu's own row wrapper. */
	const itemIn = (menu) => menu.querySelector('button[data-dsh-workspace-pin="item"]');

	/** The menu ui-workspace opens: portaled, with rename + delete rows. */
	function openMenu() {
		const menu = document.createElement("div");
		menu.setAttribute("role", "menu");
		const viewport = document.createElement("div");
		viewport.setAttribute("role", "presentation");
		for (const label of ["重命名", "删除"]) {
			const wrap = document.createElement("div");
			wrap.className = "itemWrap";
			const button = document.createElement("button");
			button.type = "button";
			button.setAttribute("role", "menuitem");
			button.className = "item";
			const icon = document.createElement("span");
			icon.className = "itemIcon";
			const text = document.createElement("span");
			text.className = "itemLabel";
			text.textContent = label;
			button.append(icon, text);
			wrap.append(button);
			viewport.append(wrap);
		}
		menu.append(viewport);
		document.body.append(menu);
		return menu;
	}

	const click = (element) => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
	};

	return { window, document, state, calls, tick, rowOf, anchorOf, markerOf, itemIn, openMenu, click, module: module_ };
}

test("loads through the module loader and declares the workspaces service", () => {
	const { module: mod } = setup();
	assert.equal(typeof mod.apply, "function");
	assert.deepEqual([...mod.inject], ["workspaces"]);
});

test("injects a pin row into the workspace ⋯ menu, above the built-in rows", async () => {
	const { tick, anchorOf, openMenu, itemIn, click } = setup();
	click(anchorOf("ws-c"));
	const menu = openMenu();
	await tick();

	const item = itemIn(menu);
	assert.notEqual(item, null, "the pin row is injected");
	assert.equal(menu.querySelector('[role="presentation"]').firstElementChild, item.parentElement, "it is the first row");
	const button = item;
	assert.equal(button.querySelector(".itemLabel").textContent, "置顶工作区");
	assert.equal(button.querySelector(".itemIcon").querySelector("svg").getAttribute("viewBox"), "0 0 16 16");
	assert.equal(button.querySelector(".itemIcon").querySelector("path").hasAttribute("fill"), false, "outline pin while unpinned");
});

test("pinning moves the workspace to the front and marks the row", async () => {
	const { tick, anchorOf, openMenu, itemIn, click, state, calls, markerOf } = setup();
	click(anchorOf("ws-c"));
	const menu = openMenu();
	await tick();
	click(itemIn(menu));
	await tick();

	assert.deepEqual(calls, [["ws-c", "ws-a"]], "moved in front of the first other workspace");
	assert.deepEqual(state.order, ["ws-c", "ws-a", "ws-b"]);
	assert.notEqual(markerOf("ws-c"), null, "the pinned row carries the marker");
	assert.equal(markerOf("ws-a"), null);
});

test("unpinning restores the recorded position and clears the marker", async () => {
	const { tick, anchorOf, openMenu, itemIn, click, state, markerOf } = setup();
	click(anchorOf("ws-b"));
	let menu = openMenu();
	await tick();
	click(itemIn(menu));
	await tick();
	assert.deepEqual(state.order, ["ws-b", "ws-a", "ws-c"]);

	// The menu closes after the action; a fresh one reports the pinned state.
	menu.remove();
	await tick();
	click(anchorOf("ws-b"));
	menu = openMenu();
	await tick();
	const button = itemIn(menu);
	assert.equal(button.querySelector(".itemLabel").textContent, "取消置顶");
	assert.equal(button.querySelector(".itemIcon").querySelector("path").hasAttribute("fill"), true, "filled pin while pinned");

	click(button);
	await tick();
	assert.deepEqual(state.order, ["ws-a", "ws-b", "ws-c"], "restored before its recorded neighbour");
	assert.equal(markerOf("ws-b"), null);
});

test("the ungrouped bucket gets no pin row", async () => {
	const { tick, openMenu, itemIn, click, document } = setup();
	click(document.querySelector('[data-row-key="workspace:__ungrouped__"] button'));
	const menu = openMenu();
	await tick();
	assert.equal(itemIn(menu), null);
});

test("a re-rendered menu regains the row after it is removed", async () => {
	const { tick, anchorOf, openMenu, itemIn, click } = setup();
	click(anchorOf("ws-a"));
	const menu = openMenu();
	await tick();
	assert.notEqual(itemIn(menu), null);

	itemIn(menu).parentElement.remove();
	await tick();
	assert.notEqual(itemIn(menu), null, "self-heals while the menu stays open");
});

test("a menu opened without a workspace trigger is left alone", async () => {
	const { tick, openMenu, itemIn } = setup();
	const menu = openMenu();
	await tick();
	assert.equal(itemIn(menu), null);
});