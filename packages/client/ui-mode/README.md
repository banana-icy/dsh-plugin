# @deepseek-ai/dsh-client-ui-mode

Client-side keyboard shortcut for the `@deepseek-ai/dsh-modes` build/plan mode switching.

## Features

- **Keyboard shortcut**: Ctrl+1 switches to build mode, Ctrl+2 switches to plan mode (configurable)
- The shortcut only activates when the composer textarea is focused (the `[data-composer]` element), so it does not interfere with browser-level shortcuts elsewhere
- The composer dock carries no widget: all visible mode indicator UX (traffic-light dot, status colors, click-to-switch) lives in `@deepseek-ai/dsh-client-ui-traffic-light`

## Configuration

The shortcut is currently hardcoded as Ctrl+1 (build) / Ctrl+2 (plan). Future versions will make it configurable via plugin config.

## Works with

`@deepseek-ai/dsh-modes` must be loaded on the host side. The client plugin issues `/mode` commands through the Remote API.

## Known Limitations

- The shortcut check uses `[data-composer]` as the focus guard; a UI that does not set this data attribute cannot receive the shortcut.
- On Windows, Ctrl+1/Ctrl+2 are also used by the browser for tab switching. The focus guard prevents interference when the user is typing, but if the browser intercepts the shortcut before the page handler, the switch may not fire. Configure a different key combination if needed.