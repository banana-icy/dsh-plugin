window.__ModuleLoader__.load({ id: "dsh-esc-pause", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/double-press.ts
var DoublePressDetector = class {
  /**
   * @param options.windowMs - maximum gap between the two presses.
   * @param options.now - monotonic clock reading in milliseconds.
   */
  constructor(options) {
    this.options = options;
    __publicField(this, "lastPressAt", null);
  }
  /**
   * Record one eligible press.
   * @returns true when this press completes the gesture; the detector then
   *   disarms, so a third press starts a new gesture instead of firing again.
   */
  press() {
    const at = this.options.now();
    const previous = this.lastPressAt;
    this.lastPressAt = at;
    if (previous === null || at - previous > this.options.windowMs) return false;
    this.lastPressAt = null;
    return true;
  }
  /** Forget any armed first press. */
  reset() {
    this.lastPressAt = null;
  }
};

// src/client/index.ts
var name = "dsh-esc-pause";
var inject = ["sessions"];
var DOUBLE_PRESS_MS = 400;
var OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
function apply(ctx) {
  ctx.effect(() => {
    const detector = new DoublePressDetector({ windowMs: DOUBLE_PRESS_MS, now: () => performance.now() });
    const onKeyDown = (event) => {
      if (!isPlainEscape(event)) return;
      if (hasOpenOverlay(document)) {
        detector.reset();
        return;
      }
      if (!detector.press()) return;
      void cancelRunningTurn(ctx);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, "dsh-esc-pause: double-escape listener");
}
function isPlainEscape(event) {
  if (event.key !== "Escape") return false;
  if (event.repeat) return false;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
  if (event.isComposing) return false;
  if (event.keyCode === 229) return false;
  return true;
}
function hasOpenOverlay(doc) {
  for (const element of doc.querySelectorAll(OVERLAY_SELECTOR)) {
    if (isRendered(element)) return true;
  }
  return false;
}
function isRendered(element) {
  if (element.hasAttribute("hidden")) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (style === void 0) return true;
  return style.display !== "none" && style.visibility !== "hidden";
}
async function cancelRunningTurn(ctx) {
  try {
    const current = ctx.sessions.list.getSnapshot().current;
    if (current === void 0 || current === null) return;
    const binding = ctx.sessions.binding(current);
    if (binding === void 0) return;
    if (!binding.session.getSnapshot().running) return;
    await binding.session.cancel();
  } catch (error) {
    console.warn("[dsh-esc-pause] cancel failed:", error);
  }
}

return module.exports; } });
