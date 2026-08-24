# @deepseek-ai/dsh-client-ui-traffic-light

Build/plan mode awareness in the web GUI, two surfaces in one web profile bundle:

- **Mode pet** — a floating draggable pet on the `shell.overlay` frame-wide layer (rendered regardless of the current session), showing a mode-colored traffic-light face image with a breathing blink while a failure is stuck. Dragging moves the pet; the released position is kept (accumulated into a persistent anchor) and survives reloads via `localStorage` (`dsh:mode-pet:anchor`, clamped and validated on read) — click without dragging toggles the mode, and the anchor survives mode switches and re-renders.
- **Ctrl+P / Cmd+P shortcut** — toggles between build idle (green) and plan (yellow); a stuck failure exits to green. The browser's print dialog is intercepted.

Mode switching itself is owned by the `@deepseek-ai/dsh-modes` host plugin: the pet issues `/mode plan` / `/mode build` through the commands remote, and the `modes` projection (built from `command/run`, `modes/state`, `turn/start`, `turn/end`, `tool/result`, and `command/done` events) drives the indicator. The pet reads the projection through its own `TrafficView` hooks source (session-list subscription + per-key projection face), so no session selection leaves it mounted on idle green.

## Traffic-light states

| Display | Condition | Entered by |
|---|---|---|
| 🟢 Green (idle) | build mode, no turn executing, no failure | initial state / build completes / shortcut while a failure is stuck |
| 🟡 Yellow (plan) | plan mode, no failure | shortcut from green |
| 🔴 Red (build) | build mode with an executing turn | automatic, while a turn runs |
| 🟡 Yellow blink (stuck) | plan mode with a failure | failed step or failed `/mode` command |
| 🔴 Red blink (stuck) | build mode with a failure | failed step or failed `/mode` command |

- The shortcut and pet click only ever switch green ↔ yellow (and exit a stuck failure to green); red is never a shortcut target — it appears automatically while a build turn executes and returns to green when the turn completes.
- While red (executing build), the shortcut interrupts back to yellow (plan).
- A failure (a `tool/result` carrying an error, an errored `turn/end`, or an errored `command/done`) sticks the current state at its blink image with a 1.5 s opacity-breathing animation. It clears on the next successful step or command, or immediately via the shortcut (issues `/mode build`).
- The pet stays mounted app-wide: without a selected session it reads no projection and renders idle green (`shell.overlay` is a root-scope frame-wide seat, not a session slot).

## Node half

Serves the pet images to the browser on the fixed wire prefix `/ui-traffic-light/assets` (content types for png/gif/webp/svg/jpg; `no-cache`). The prefix and file names are a wire contract shared with the browser half through `src/assets.ts`; the route is a duplicate-prefix composition error if another plugin claims the same path. Path traversal (`..`, `%2e%2e`, null bytes) returns 403.

Assets live in `assets/` at the package root and are read relative to the bundled module (`lib/index.js`) and the tsx-run module (`src/index.ts`). Replacing an image file is live — the next request serves the new bytes.

## Configuration

```yaml
- id: ui-traffic-light
  name: '@deepseek-ai/dsh-client-ui-traffic-light'
```

No configuration keys.

## Model Experience

The pet and dot are pure status affordances over the modes domain and add no model-visible input: mode switching records normal `command/run` lifecycle events. No additional token, KV-cache, or prompt effects.