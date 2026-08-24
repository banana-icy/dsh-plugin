window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-traffic-light",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/assets.ts
		/**
		* Pet asset contract shared by both halves. The node half serves these files
		* on the wire path below; the browser half builds image URLs from the same
		* constants, so the path and file names live here only.
		*/
		/** Fixed route prefix owning every pet asset (wire protocol, not user tunable). */
		const ASSET_ROUTE_PREFIX = "/ui-traffic-light/assets";
		/** Pet image per traffic-light state; blink images show while a failure is stuck. */
		const PET_IMAGES = {
			green: `${ASSET_ROUTE_PREFIX}/pet-green.png`,
			yellow: `${ASSET_ROUTE_PREFIX}/pet-yellow.png`,
			red: `${ASSET_ROUTE_PREFIX}/pet-red.png`,
			yellowBlink: `${ASSET_ROUTE_PREFIX}/pet-yellow-blink.png`,
			redBlink: `${ASSET_ROUTE_PREFIX}/pet-red-blink.png`
		};
		//#endregion
		//#region \0dsh-css:/Users/test/Desktop/github/deepseek-harness/packages/client/ui-traffic-light/src/client/ModePet.module.css.mjs
		const css = ".Dr2E_W_pet{z-index:2147483001;cursor:grab;user-select:none;touch-action:none;-webkit-user-drag:none;background:0 0;border:none;padding:0;position:fixed;bottom:16px;left:16px}.Dr2E_W_pet:active{cursor:grabbing}.Dr2E_W_pet img{pointer-events:none;width:96px;height:96px;display:block}.Dr2E_W_blink{animation:1.5s ease-in-out infinite Dr2E_W_pet-blink}@keyframes Dr2E_W_pet-blink{0%,to{opacity:1}50%{opacity:.3}}";
		const tagId = "@deepseek-ai/dsh-client-ui-traffic-light/ModePet.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-traffic-light";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ModePet_module_css_default = {
			"pet-blink": "Dr2E_W_pet-blink",
			"pet": "Dr2E_W_pet",
			"blink": "Dr2E_W_blink"
		};
		//#endregion
		//#region src/client/ModePet.tsx
		/** localStorage key for the persisted pet anchor. */
		const ANCHOR_KEY = "dsh:mode-pet:anchor";
		/** Clamp one anchor axis so a corrupted stored value cannot park the pet off-screen. */
		const CLAMP = 4e3;
		/** Load the persisted anchor; corrupt or absent storage falls back to the default. */
		function loadAnchor() {
			try {
				const raw = window.localStorage.getItem(ANCHOR_KEY);
				if (raw === null) return {
					x: 0,
					y: 0
				};
				const parsed = JSON.parse(raw);
				if (typeof parsed !== "object" || parsed === null) return {
					x: 0,
					y: 0
				};
				const { x, y } = parsed;
				if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return {
					x: 0,
					y: 0
				};
				return {
					x: Math.min(Math.max(x, -4e3), CLAMP),
					y: Math.min(Math.max(y, -4e3), CLAMP)
				};
			} catch {
				return {
					x: 0,
					y: 0
				};
			}
		}
		/** Persist the anchor so the pet stays where the user left it across reloads. */
		function saveAnchor(anchor) {
			try {
				window.localStorage.setItem(ANCHOR_KEY, JSON.stringify(anchor));
			} catch {}
		}
		/**
		* Traffic-light display state over the traffic view:
		* - failed + plan → yellow blink (stuck)
		* - failed + build → red blink (stuck)
		* - plan → yellow
		* - build + busy → red (automatic, only while a turn executes)
		* - build + idle → green
		*/
		function petFace(projection) {
			const failed = projection.failed;
			if (failed && projection.mode === "plan") return {
				src: PET_IMAGES.yellowBlink,
				blink: true
			};
			if (failed && projection.mode === "build") return {
				src: PET_IMAGES.redBlink,
				blink: true
			};
			if (projection.mode === "plan") return {
				src: PET_IMAGES.yellow,
				blink: false
			};
			if (projection.busy) return {
				src: PET_IMAGES.red,
				blink: false
			};
			return {
				src: PET_IMAGES.green,
				blink: false
			};
		}
		/** The traffic-light desktop pet: frame-wide, draggable, click to switch. */
		const ModePet = ({ useTraffic, navigate }) => {
			const projection = useTraffic((view) => view);
			const drag = (0, react.useRef)(null);
			const [anchor, setAnchor] = (0, react.useState)(loadAnchor);
			const [gestureDelta, setGestureDelta] = (0, react.useState)(null);
			const view = projection ?? {
				mode: "build",
				busy: false,
				failed: false
			};
			const face = petFace(view);
			const onPointerDown = (event) => {
				drag.current = {
					lastX: event.clientX,
					lastY: event.clientY,
					deltaX: 0,
					deltaY: 0,
					moved: false
				};
				setGestureDelta({
					x: 0,
					y: 0
				});
				event.currentTarget.setPointerCapture(event.pointerId);
			};
			const onPointerMove = (event) => {
				const gesture = drag.current;
				if (gesture === null) return;
				gesture.deltaX += event.clientX - gesture.lastX;
				gesture.deltaY += event.clientY - gesture.lastY;
				gesture.lastX = event.clientX;
				gesture.lastY = event.clientY;
				if (Math.abs(gesture.deltaX) > 3 || Math.abs(gesture.deltaY) > 3) gesture.moved = true;
				setGestureDelta({
					x: gesture.deltaX,
					y: gesture.deltaY
				});
			};
			const onPointerUp = () => {
				const gesture = drag.current;
				drag.current = null;
				if (gesture === null) return;
				if (gesture.moved) {
					const next = {
						x: anchor.x + gesture.deltaX,
						y: anchor.y + gesture.deltaY
					};
					setAnchor(next);
					saveAnchor(next);
				} else navigate(view.failed ? "build" : view.mode === "plan" ? "build" : "plan");
				setGestureDelta(null);
			};
			const delta = gestureDelta ?? {
				x: 0,
				y: 0
			};
			const transform = `translate(${String(anchor.x + delta.x)}px, ${String(anchor.y + delta.y)}px)`;
			const label = `mode pet: ${face.blink ? `${view.mode} failed` : view.mode === "plan" ? "plan" : view.busy ? "build" : "idle"}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: `${ModePet_module_css_default.pet} ${face.blink ? ModePet_module_css_default.blink : ""}`,
				style: { transform },
				"aria-label": label,
				title: label,
				"aria-pressed": view.mode === "plan",
				onPointerDown,
				onPointerMove,
				onPointerUp,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
					src: face.src,
					alt: "",
					draggable: false
				})
			});
		};
		//#endregion
		//#region src/client/traffic-view.ts
		/**
		* Registrant hooks source for the pet: republishes the current session's
		* modes projection slice on session switches and on projection pushes. The
		* value is undefined before any projection materializes (the pet renders as
		* idle green then) — never a missing channel — so the component stays mounted
		* across session selection changes while the shell.overlay seat is frame-wide.
		*/
		var TrafficView = class {
			sessions;
			listeners = /* @__PURE__ */ new Set();
			detachList;
			detachFace;
			current;
			value;
			constructor(sessions) {
				this.sessions = sessions;
			}
			getSnapshot() {
				return this.value;
			}
			subscribe(listener) {
				this.listeners.add(listener);
				if (this.listeners.size === 1) this.attach();
				return () => {
					this.listeners.delete(listener);
					if (this.listeners.size === 0) this.detach();
				};
			}
			/** Stop every subscription; the source is dead after this. */
			dispose() {
				this.detach();
				this.listeners.clear();
			}
			attach() {
				this.detachList = this.sessions.list.subscribe(() => {
					this.resync();
				});
				this.resync();
			}
			detach() {
				this.detachList?.();
				this.detachList = void 0;
				this.detachFace?.();
				this.detachFace = void 0;
			}
			/** Follow the current session id; when it moves, retarget the modes face. */
			resync() {
				const id = this.sessions.list.getSnapshot().current;
				if (id !== this.current) {
					this.detachFace?.();
					this.detachFace = void 0;
					this.current = id;
					if (id !== void 0) {
						const face = this.sessions.binding(id)?.session.projections.faceOf("modes");
						if (face !== void 0) this.detachFace = face.subscribe(() => {
							this.resyncValue();
						});
					}
				}
				this.resyncValue();
			}
			resyncValue() {
				const id = this.current;
				const next = id === void 0 ? void 0 : this.sessions.binding(id)?.session.projections.faceOf("modes").getSnapshot();
				const view = next === void 0 ? void 0 : {
					mode: next.mode,
					busy: next.busy,
					failed: next.failed
				};
				if (view !== this.value) {
					this.value = view;
					for (const listener of this.listeners) listener();
				}
			}
		};
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"remote",
			"remote.commands",
			"sessions"
		];
		/** Run one /mode command against the given session; null on success. */
		async function navigateMode(ctx, sessionId, next) {
			if (sessionId === void 0) return null;
			const result = await ctx.remote.commands.execute(sessionId, `/mode ${next}`);
			if (!result.ok) return `mode switch failed: ${result.error.message} (${result.error.code})`;
			if (result.value === void 0) return "unknown command";
			return null;
		}
		/** The shortcut's target from the live projection: a stuck failure exits to green. */
		function currentSessionId(ctx) {
			return ctx.sessions.list.getSnapshot().current;
		}
		const apply = (ctx) => {
			const traffic = new TrafficView(ctx.sessions);
			ctx.effect(() => () => {
				traffic.dispose();
			}, "ui-traffic-light: traffic view");
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "mode-pet",
				order: 30,
				inject: () => ({
					hooks: { traffic },
					navigate: (next) => navigateMode(ctx, currentSessionId(ctx), next)
				})
			}, ModePet));
			const handleKeyDown = (e) => {
				if ((e.ctrlKey || e.metaKey) && e.key === "p") {
					e.preventDefault();
					e.stopPropagation();
					const id = currentSessionId(ctx);
					if (id === void 0) return;
					const projection = ctx.sessions.binding(id)?.session.projections.faceOf("modes").getSnapshot();
					navigateMode(ctx, id, projection?.failed === true ? "build" : projection?.mode === "plan" ? "build" : "plan");
				}
			};
			window.addEventListener("keydown", handleKeyDown, { capture: true });
			ctx.effect(() => {
				return () => {
					window.removeEventListener("keydown", handleKeyDown, { capture: true });
				};
			});
		};
		const name = "@deepseek-ai/dsh-client-ui-traffic-light";
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map