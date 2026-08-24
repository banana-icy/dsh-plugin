//#region lib/types/invariant.js
/** Package-owned durable modes invariants. @module @deepseek-ai/dsh-modes/invariant */
const PACKAGE_NAME = "@deepseek-ai/dsh-modes";
/** Cordis companion plugin name. */
const name = "modes-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/**
* Validate one `modes/state` event before it reaches the durable log.
* `modes/state` is a standalone whole-value event: an idle selection commits
* between turns and a mid-turn selection commits at the step boundary, so no
* turn-enclosure relation exists — only the mode payload is checkable.
*/
function validateEvent(event, fail) {
	if (event.type !== "modes/state") return;
	const mode = event.data.mode;
	if (mode !== "build" && mode !== "plan") fail(`modes/state carries invalid mode ${JSON.stringify(mode)}; expected 'build' or 'plan'`);
}
/** Install validation for loaded and newly appended modes state. */
const install = Object.assign((ctx, fail) => {
	const seed = (session) => {
		for (const event of session.events) validateEvent(event, fail);
	};
	for (const session of ctx.sessions.list()) seed(session);
	ctx.on("session/created", (session) => {
		seed(session);
	}, { global: true });
	ctx.on("internal/dispatch", (_mode, eventName, args) => {
		if (eventName !== "session/event") return;
		const [, event] = args;
		validateEvent(event, fail);
	}, { global: true });
}, { inject: ["sessions"] });
/**
* Register the modes invariant companion.
* @param ctx - Cordis context carrying the invariant service.
* @returns the installed registration's disposer after setup succeeds.
*/
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
