window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-mode",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/index.ts
		const DEFAULT_SHORTCUT = {
			build: {
				key: "1",
				ctrlKey: true
			},
			plan: {
				key: "2",
				ctrlKey: true
			}
		};
		/** Resolve whether the event matches a shortcut spec. */
		function matchShortcut(event, spec) {
			if (event.key !== spec.key) return false;
			if (spec.ctrlKey !== void 0 && event.ctrlKey !== spec.ctrlKey) return false;
			if (spec.metaKey !== void 0 && event.metaKey !== spec.metaKey) return false;
			if (spec.shiftKey !== void 0 && event.shiftKey !== spec.shiftKey) return false;
			return true;
		}
		/** Required services: the commands Remote and the session list. */
		const inject = [
			"remote",
			"remote.commands",
			"sessions"
		];
		/**
		* Client plugin body: register the mode-switch keydown listener only.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const onKeyDown = (event) => {
				const active = document.activeElement;
				if (!(active instanceof HTMLElement)) return;
				if (!active.closest("[data-composer]")) return;
				if (matchShortcut(event, DEFAULT_SHORTCUT.build)) {
					event.preventDefault();
					const sessionId = currentSessionId(ctx);
					if (sessionId === null) return;
					ctx.remote.commands.execute(sessionId, "/mode build");
				} else if (matchShortcut(event, DEFAULT_SHORTCUT.plan)) {
					event.preventDefault();
					const sessionId = currentSessionId(ctx);
					if (sessionId === null) return;
					ctx.remote.commands.execute(sessionId, "/mode plan");
				}
			};
			window.addEventListener("keydown", onKeyDown, true);
			ctx.effect(() => () => {
				window.removeEventListener("keydown", onKeyDown, true);
			}, "ui-mode: keydown listener");
		}
		/** Resolve the current session id from the session list. */
		function currentSessionId(ctx) {
			return ctx.sessions.list.getSnapshot().current ?? null;
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map