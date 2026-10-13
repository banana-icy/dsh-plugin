/**
 * dsh-workspace-pin client bundle source.
 *
 * A classic-script bundle loaded through the web shell's module loader. It adds
 * one row to a workspace row's ⋯ menu — "置顶工作区" / "取消置顶" — and moves the
 * workspace to the front of the sidebar through the host's durable workspace
 * order API (`workspace.insertBefore`). Sessions are never touched.
 *
 * Why DOM injection: the workspace row's ⋯ menu is rendered by ui-workspace from
 * a local `items` array and declares no slot, so a plugin cannot contribute a
 * row declaratively. The injected row reuses the menu's own class names and the
 * app's own pin artwork, and re-injects itself if React re-renders the menu.
 *
 * Build with `node scripts/build-client.mjs`, which writes lib/client.js.
 */

window.__ModuleLoader__.load({
	id: "dsh-workspace-pin",
	factory: () => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		//#region built-in icon artwork
		// Copied verbatim from @deepseek-ai/dsh-client-ui-primitives
		// (IconPinOutlineArtwork / IconPinFillArtwork, 16x16, stroke-width 1), so
		// the menu row and the row marker render the app's own pin glyph rather
		// than a lookalike.
		const SVG_NS = "http://www.w3.org/2000/svg";
		const PIN_BODY = "M9.96976 1.70572L13.1554 3.93629L10.9019 8.12317L11.5158 11.605L10.7192 12.7427L2.52767 7.00693L3.3243 5.86922L6.80612 5.25528L9.96976 1.70572Z";
		const PIN_NEEDLE = "M6.05285 9.47511C6.27284 9.16094 6.70586 9.08458 7.02003 9.30457C7.3342 9.52455 7.41055 9.95757 7.19057 10.2717L3.98587 14.4708L3.21223 13.9291L6.05285 9.47511Z";
		const ICON_REGULAR_STROKE = 1;

		/**
		 * One pin glyph in the app's own artwork.
		 * @param {number} size - square edge in px.
		 * @param {boolean} filled - fill the pin body instead of outlining it.
		 * @returns {SVGElement} the glyph.
		 */
		function pinIcon(size, filled) {
			const svg = document.createElementNS(SVG_NS, "svg");
			svg.setAttribute("width", String(size));
			svg.setAttribute("height", String(size));
			svg.setAttribute("viewBox", "0 0 16 16");
			svg.setAttribute("fill", "none");
			svg.setAttribute("aria-hidden", "true");
			svg.setAttribute("stroke-width", String(ICON_REGULAR_STROKE));
			const body = document.createElementNS(SVG_NS, "path");
			body.setAttribute("d", PIN_BODY);
			body.setAttribute("stroke", "currentColor");
			body.setAttribute("stroke-linejoin", "round");
			if (filled) body.setAttribute("fill", "currentColor");
			const needle = document.createElementNS(SVG_NS, "path");
			needle.setAttribute("d", PIN_NEEDLE);
			needle.setAttribute("fill", "currentColor");
			svg.append(body, needle);
			return svg;
		}
		//#endregion

		//#region persisted pin records
		// Per-browser, like every other sidebar preference: the pinned workspace
		// order itself lives in the host's workspace registry, these records only
		// remember which rows this browser pinned and where they came from.
		const STORAGE_KEY = "dsh-workspace-pin.records.v1";

		/** @returns {Record<string, {beforeId?: string, afterId?: string, pinnedAt: number}>} */
		function loadRecords() {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY);
				if (raw === null) return {};
				const parsed = JSON.parse(raw);
				return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
			} catch (error) {
				console.warn("[dsh-workspace-pin] ignoring unreadable pin records:", error);
				return {};
			}
		}

		/** @param {Record<string, unknown>} records - records to persist. */
		function saveRecords(records) {
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
			} catch (error) {
				console.warn("[dsh-workspace-pin] persist failed:", error);
			}
		}
		//#endregion

		/** Client services this browser half consumes. */
		const inject = ["workspaces"];

		//#region browser half
		/** @param {any} ctx - client root context. */
		function apply(ctx) {
			const api = ctx.workspaces;
			if (typeof api?.insertBefore !== "function" || api?.list === undefined) {
				console.error("[dsh-workspace-pin] workspaces service unavailable; plugin inactive");
				return;
			}
			const ZH = /^zh/i.test(document.documentElement.lang || navigator.language || "");
			const T = {
				pin: ZH ? "置顶工作区" : "Pin workspace",
				unpin: ZH ? "取消置顶" : "Unpin workspace",
				pinned: ZH ? "已置顶" : "Pinned",
				failed: ZH ? "置顶失败，请稍后重试" : "Could not reorder the workspace; try again.",
			};

			const records = loadRecords();

			/** Live Workspace rows in the host's own order. */
			function items() {
				try {
					return api.list.getSnapshot()?.items ?? [];
				} catch (error) {
					console.warn("[dsh-workspace-pin] workspace list unreadable:", error);
					return [];
				}
			}

			/** @param {string} id - workspace id. @returns {boolean} whether this browser pinned it. */
			function isPinned(id) {
				return Object.hasOwn(records, id);
			}

			/**
			 * Move one workspace in front of every other, remembering the neighbours
			 * an unpin restores.
			 * @param {string} id - workspace id.
			 */
			async function pin(id) {
				const order = items().map((workspace) => workspace.workspaceId);
				const index = order.indexOf(id);
				const first = order.find((other) => other !== id);
				if (index === -1 || first === undefined) return;
				records[id] = {
					beforeId: index > 0 ? order[index - 1] : undefined,
					afterId: index + 1 < order.length ? order[index + 1] : undefined,
					pinnedAt: Date.now(),
				};
				saveRecords(records);
				await api.insertBefore(id, first);
			}

			/**
			 * Release one pin and put the workspace back where it was, by the nearest
			 * surviving neighbour.
			 * @param {string} id - workspace id.
			 */
			async function unpin(id) {
				const record = records[id];
				delete records[id];
				saveRecords(records);
				const order = items().map((workspace) => workspace.workspaceId).filter((other) => other !== id);
				const afterId = record?.afterId;
				if (typeof afterId === "string" && order.includes(afterId)) {
					await api.insertBefore(id, afterId);
					return;
				}
				const beforeId = record?.beforeId;
				if (typeof beforeId === "string" && order.includes(beforeId)) {
					const at = order.indexOf(beforeId);
					await api.insertBefore(id, at + 1 < order.length ? order[at + 1] : undefined);
					return;
				}
				// No surviving neighbour: the registry appends when the anchor is omitted.
				await api.insertBefore(id);
			}

			//#region workspace row lookup
			/**
			 * The workspace row owning `node`, when that row is a real workspace.
			 * @param {EventTarget | null} node - event target or element.
			 * @returns {{row: Element, id: string} | null} the row and its workspace id.
			 */
			function workspaceRowOf(node) {
				if (!(node instanceof Element)) return null;
				const row = node.closest('[data-row-key^="workspace:"]');
				if (row === null) return null;
				const id = (row.getAttribute("data-row-key") ?? "").slice("workspace:".length);
				// The ungrouped bucket renders no ⋯ menu; requiring a real row keeps
				// every later step from acting on a key that is not a workspace.
				return items().some((workspace) => workspace.workspaceId === id) ? { row, id } : null;
			}

			/** The row's ⋯ trigger: the first button its header renders. */
			function menuAnchorOf(row) {
				return row.querySelector("button");
			}
			//#endregion

			//#region ⋯ menu row
			/** The workspace whose ⋯ menu is opening; consumed by the next menu to appear. */
			let pending = null;
			let pendingTimer = 0;
			/** The open menu this plugin owns, and the workspace it belongs to. */
			let active = null;

			function armPending(id) {
				pending = id;
				clearTimeout(pendingTimer);
				pendingTimer = setTimeout(() => { pending = null; }, 1000);
			}

			function disarmPending() {
				pending = null;
				clearTimeout(pendingTimer);
			}

			// Capture phase: React's own handler runs later in the bubble phase, so
			// the workspace is known before its portaled menu is committed.
			document.addEventListener("click", (event) => {
				const target = event.target;
				if (!(target instanceof Element)) return;
				const button = target.closest("button");
				if (button === null) return;
				const found = workspaceRowOf(button);
				if (found === null || menuAnchorOf(found.row) !== button) return;
				armPending(found.id);
			}, true);

			/**
			 * One menu row built from the menu's own markup, so spacing, hover and
			 * danger styling are the primitive's rather than a copy.
			 * @param {Element} menu - the open `role="menu"` surface.
			 * @param {string} id - workspace id.
			 * @returns {Element | null} the row, or null when the menu has no row to copy.
			 */
			function buildMenuItem(menu, id) {
				const sample = menu.querySelector('button[role="menuitem"]');
				if (sample === null) return null;
				const wrap = document.createElement("div");
				wrap.className = sample.parentElement?.className ?? "";
				const button = document.createElement("button");
				button.type = "button";
				button.setAttribute("role", "menuitem");
				button.className = sample.className;
				button.dataset.dshWorkspacePin = "item";
				const icon = document.createElement("span");
				icon.className = sample.querySelector("span")?.className ?? "";
				icon.append(pinIcon(16, isPinned(id)));
				const label = document.createElement("span");
				label.className = sample.querySelectorAll("span")[1]?.className ?? "";
				label.textContent = isPinned(id) ? T.unpin : T.pin;
				button.append(icon, label);
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					void toggle(id);
				});
				wrap.append(button);
				return wrap;
			}

			/** @param {string} id - workspace id. */
			async function toggle(id) {
				try {
					if (isPinned(id)) await unpin(id);
					else await pin(id);
				} catch (error) {
					console.error("[dsh-workspace-pin] reorder failed:", error);
					notify(T.failed);
				} finally {
					closeMenu();
					sync();
				}
			}

			/**
			 * Close the open menu through the primitive's own Escape path, since a
			 * plugin cannot reach the React state that owns it.
			 */
			function closeMenu() {
				document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			}

			/**
			 * Tell the person the reorder failed. The workspace row owns no toast
			 * surface a plugin may reach, so this is a short-lived inline notice.
			 * @param {string} message - already-localized copy.
			 */
			function notify(message) {
				const el = document.createElement("div");
				el.dataset.dshWorkspacePin = "notice";
				el.textContent = message;
				el.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483000;"
					+ "padding:8px 14px;border-radius:8px;font-size:13px;line-height:18px;pointer-events:none;"
					+ "background:var(--dsw-alias-bg-elevated,#fff);color:var(--dsw-alias-state-error-primary,#d4380d);"
					+ "box-shadow:0 4px 16px rgba(0,0,0,.16)";
				document.body.appendChild(el);
				setTimeout(() => { el.remove(); }, 2600);
			}

			/**
			 * Keep our row in the workspace menu that is open. The menu element
			 * survives React re-renders while it stays open, so ownership is held
			 * until it disconnects; a removed row is re-inserted on the next pass.
			 */
			function injectMenuRow() {
				if (active !== null && !active.menu.isConnected) active = null;
				if (active === null) {
					if (pending === null) return;
					const menu = [...document.querySelectorAll('div[role="menu"]')]
						.find((candidate) => !candidate.hasAttribute("data-dsh-workspace-pin-owned"));
					if (menu === undefined) return;
					menu.setAttribute("data-dsh-workspace-pin-owned", "");
					active = { menu, id: pending };
					disarmPending();
				}
				const { menu, id } = active;
				if (menu.querySelector('[data-dsh-workspace-pin="item"]') !== null) return;
				const row = buildMenuItem(menu, id);
				if (row === null) return;
				const viewport = menu.querySelector('[role="presentation"]') ?? menu;
				viewport.insertBefore(row, viewport.firstChild);
			}
			//#endregion

			//#region pinned row marker
			// Mirrors ui-workspace's own PinnedIndicator (16x20 box, 14px filled pin,
			// caption color) so a pinned workspace reads like a pinned session.
			function marker() {
				const el = document.createElement("span");
				el.dataset.dshWorkspacePin = "marker";
				el.setAttribute("role", "img");
				el.setAttribute("aria-label", T.pinned);
				el.title = T.pinned;
				el.style.cssText = "display:inline-flex;flex:none;width:16px;height:20px;align-items:center;"
					+ "justify-content:center;margin-left:6px;color:var(--dsw-alias-label-caption)";
				el.append(pinIcon(14, true));
				return el;
			}

			/** Keep every workspace row showing, or not showing, the marker it deserves. */
			function syncMarkers() {
				for (const row of document.querySelectorAll('[data-row-key^="workspace:"]')) {
					const id = (row.getAttribute("data-row-key") ?? "").slice("workspace:".length);
					const existing = row.querySelector('[data-dsh-workspace-pin="marker"]');
					if (!isPinned(id)) {
						if (existing !== null) existing.remove();
						continue;
					}
					if (existing !== null) continue;
					const anchor = menuAnchorOf(row);
					if (anchor === null) continue;
					// The ⋯ trigger sits inside the primitive's anchor wrapper span;
					// the marker goes immediately before that wrapper.
					const slot = anchor.parentElement;
					slot?.parentElement?.insertBefore(marker(), slot);
				}
			}
			//#endregion

			//#region sync loop
			let scheduled = false;

			/** Coalesce DOM churn into one pass. */
			function sync() {
				if (scheduled) return;
				scheduled = true;
				requestAnimationFrame(() => {
					scheduled = false;
					injectMenuRow();
					syncMarkers();
				});
			}

			// Self-healing: React may re-render a row or replace the menu at any time,
			// and the injected nodes live outside its tree.
			const observer = new MutationObserver(() => { sync(); });
			observer.observe(document.body, { childList: true, subtree: true });

			sync();
			console.log("[dsh-workspace-pin] active");
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});