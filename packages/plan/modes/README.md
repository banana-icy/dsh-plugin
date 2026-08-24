# @deepseek-ai/dsh-modes

Self-contained build/plan agent modes for the DeepSeek Harness, modeled after the opencode CLI mode loop. `build` is the default unrestricted mode; `plan` narrows the model to a read-only tool set, renders a guidance section, and exits only through a user-reviewed `exit_plan_mode` submission.

## Why this package instead of `dsh-plan-mode`

`@deepseek-ai/dsh-plan-mode` is a **soft-guidance** plan mode: it adds a prompt section and a `/plan` command but does not restrict tool access. `dsh-modes` is a full replacement that **enforces** the plan-mode contract by filtering the model-visible tool catalog and denying mutation calls at execution time. It is self-contained (no dependency on dsh-plan-mode) and can be loaded as a drop-in alternative.

> **Mutual exclusion:** `dsh-modes` registers the `exit_plan_mode` tool under the same name as dsh-plan-mode. Loading both packages in the same deployment causes a tool-registration conflict. Disable one when enabling the other.

## Durable state

`modes/state` (`{ mode: 'build' | 'plan' }`) is a log-only, whole-value-replace `SessionEventMap` member. `foldModesState(events)` returns the last logged value or `'build'`, so resume, fork, and compaction recover mode state directly from the session log. UIs observe committed flips through `session/event`.

`ctx.modes.select(agent, mode)` appends the standalone `modes/state` event immediately when the agent is idle. While the agent is running, it holds a pending selection for the next accepted in-turn pre-step. It returns which happened (`committed`/`queued`), a `cancelled` reversal, or a `noop`. `get(agent)` returns `{ mode, pending? }`, separating the logged state from a user's mid-turn selection.

## Model and human interactions

### Mode guidance

`modes:policy` renders the configured `plan.section` while plan mode is active, and `build.section` (empty by default) while build mode is active. The exit tool stays registered across both modes for request-cache stability.

### Tool filtering (enforcement)

In plan mode, the plugin applies a **two-layer enforcement**:

1. **`ctx.tools.restrict({ deny })`** on the agent scope — removes blocked tools from presentation, lookup, and execution. The model sees only its configured read-only tool set.
2. **`ctx.tools.guard()`** — monotonic final denial that catches any direct call to a blocked tool name, including the reserved `run_code` transport (which `restrict` cannot name).

Both layers register on the agent's scoped context and lift automatically when the mode switches back to build. The disposer pattern ensures HMR safety.

### Exit tool

The `exit_plan_mode` tool (configurable via `exitToolName`) accepts a complete markdown plan, presents it for user review over the `user-questions` seam with a `plan-review` presentation intent, and on approval schedules the transition back to build mode. Dismissed or rejected reviews keep the model in plan mode.

### Slash commands

When `ctx.commands` is composed, the package registers:

- `/mode [build|plan]` — cycle or set the mode
- `/plan [message]` — enter plan mode (optionally with a message steered to the next step)
- `/build [message]` — leave plan mode for build mode (optionally with a message)

## Session projection

When `ctx.sessionProjections` is composed, the package registers the `modes` projection unit. The unit folds `command/run` (names `mode`, `plan`, `build`) and `modes/state` events into `{ mode: 'build' | 'plan', pending: boolean }`. The key merges into `SessionProjectionMap` from `src/types.ts`.

## Configuration

```yaml
- id: modes
  name: '@deepseek-ai/dsh-modes'
  config:
    exitToolName: exit_plan_mode
    plan:
      # Pin the session's file sandbox to read-only while plan mode is in
      # force (default true): every command may run, writes fail at the OS
      # sandbox layer. Leave bash/pwsh out of blockedTools to let read-only
      # commands (ls, cat, grep, git log, curl, ...) execute.
      readOnlySandboxOnPlan: true
      blockedTools: [edit, write, str_replace_editor, schedule_create, todo_write]
      rejectMessage: 'Plan mode is read-only; switch to build mode to modify files.'
      section: |
        You are in plan mode. Explore and design before presenting the
        complete plan through exit_plan_mode.
    build:
      section: ''
```

`section` is required and non-empty for plan mode. `blockedTools` is required and must be a non-empty array of tool-name strings. Unknown keys fail at load.

### Read-only file sandbox

When `readOnlySandboxOnPlan` is true (default) and `@deepseek-ai/dsh-sandbox-policy` is composed, entering plan mode writes a `sandbox/mode: 'read-only'` session event; leaving plan restores the session's prior override (an explicit earlier switch) or the deployment default (`workspace-write`). The event is durable and replayable, so a resumed plan session stays read-only. Writes denied by the sandbox surface as `[sandbox: file access denied under <mode> mode]`; the sandbox operates at the OS layer, so shell-string tricks cannot bypass it. Tools outside the sandbox (edit/write-style file mutators, todo, schedule) remain denied by `blockedTools` regardless.

## Model Experience

### Mode policy system prompt

#### What the model sees

While plan mode is active, the model sees the deployment's exact `plan.section` text at prompt order 50; build mode renders `build.section` (empty = nothing).

#### Token effect

Inactive mode adds no tokens; active mode adds the configured section to every request.

### Slash commands

`/mode`, `/plan`, `/build` and their terminal results stay outside model history. A non-empty message suffix steers the text as a user message after the mode switch.

### Exit tool schema and review exchange

The `exit_plan_mode` schema remains available in both modes; execution outside plan mode fails. An approved review returns `{ approved: true }` and renders the existing confirmation text.

## Known Limitations and Deferred Work

- `blockedTools` names that are not yet registered at mode-entry time are silently skipped (the execution guard still covers them). This accommodates preset-dependent tool sets.
- The `run_code` reserved transport cannot be named in `blockedTools` for `restrict()`; it is always denied by the execution guard when plan mode is active.
- Forked agents inherit logged mode state, while newly spawned agents begin in build mode; there is no creation-time mode option.
- A live child owned by another agent cannot open the `exit_plan_mode` review.
- Only the Web UI has a specialized `plan-review` renderer; another interaction provider may present the same request through its generic option flow.