# dsh-traffic-light-pet

红绿灯桌宠插件集 for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh web 端）。

一个**悬浮红绿灯桌宠**：宠物图片随 agent 模式实时变化（绿灯=空闲、黄灯=plan、红灯=build 执行中、黄闪/红闪=失败停住），支持拖动固定位置（位置持久化到 localStorage）、点击切换模式，外加 Cmd+P / Ctrl+P 快捷键全局切换 plan ↔ build。

## 三个包

| 包 | 目录 | 职责 |
|---|---|---|
| `@deepseek-ai/dsh-modes` | `packages/plan/modes/` | **宿主插件**（必须）：build/plan 模式命令、`modes` 会话投影（mode/pending/busy/failed）、plan 只读沙箱联动、exit_plan_mode 审核工具 |
| `@deepseek-ai/dsh-client-ui-traffic-light` | `packages/client/ui-traffic-light/` | **红绿灯桌宠**：悬浮宠物（shell.overlay 常驻层、可拖动、点击切换）、Cmd+P/Ctrl+P 快捷键、node half 伺服透明 PNG |
| `@deepseek-ai/dsh-client-ui-mode` | `packages/client/ui-mode/` | 附加快捷键（可选）：Ctrl+1 切 build、Ctrl+2 切 plan（无 UI 组件） |

## 红绿灯状态

| 显示 | 条件 | 进入方式 |
|---|---|---|
| 🟢 绿灯（空闲） | build 且无任务执行、无失败 | 初始 / 任务完成 / 闪烁时按快捷键 |
| 🟡 黄灯（plan） | plan 模式、无失败 | 快捷键从绿灯切来 |
| 🔴 红灯（build 中） | build 且 turn 正在执行 | 自动（仅任务运行时出现） |
| 🟡 黄灯闪烁（停住） | plan 模式 + 失败 | step 出错 或 `/mode` 切换失败 |
| 🔴 红灯闪烁（停住） | build 模式 + 失败 | 同上 |

- 快捷键（Cmd+P/Ctrl+P）与宠物点击只在 绿 ↔ 黄 间切换；红灯永不进快捷键目标，任务完成自动回绿
- 失败 = `tool/result` 带错误 / `turn/end` error / `command/done` error → 当前色改闪烁图并停住（1.5s 透明度呼吸动画），按快捷键或点宠物直接回绿
- 宠物挂载在 `shell.overlay`（app 级悬浮层），**无会话也常驻**（显示绿灯空闲）；拖动后位置固定并持久化（localStorage `dsh:mode-pet:anchor`）

## Plan 模式的命令策略（dsh-modes）

plan 模式下 **bash/pwsh 不再整体封锁**：只读命令（`ls/cat/grep/find/git log/git diff/curl/...`）可执行；文件**写操作由 OS 级只读沙箱拒绝**（macOS Seatbelt `sandbox-exec`，shell 字符串技巧无法绕过）。进入 plan 时写入 `sandbox/mode: read-only` 会话事件（可持久化重放），退出时恢复原 override 或 `workspace-write`。仍封锁的工具：`edit/write/str_replace_editor/schedule_create/todo_write`。

## 环境要求

- DeepSeek Harness ≥ 0.1.0-rc.5（`dsh web` 运行环境）
- 三个包的运行时依赖（`@deepseek-ai/dsh-*`、`@deepseek-ai/cordis` 等）由 Harness 环境提供，本仓库**不需要独立安装 node_modules**

## 接入 dsh profile

本仓库是**源码 + 预构建产物（`lib/`）**一体的插件包，接入方式为 `link:` 依赖 + profile patch：

### 1. 把本仓库 clone 到本地

```sh
git clone https://github.com/<你的账号>/dsh-traffic-light-pet.git
```

### 2. 在 profile 的 package.json 声明 link 依赖

编辑 `~/.dsh/profiles/web/package.json` 的 `dependencies`：

```json
"dependencies": {
  "@deepseek-ai/dsh-client-ui-traffic-light": "link:/path/to/dsh-traffic-light-pet/packages/client/ui-traffic-light",
  "@deepseek-ai/dsh-client-ui-mode": "link:/path/to/dsh-traffic-light-pet/packages/client/ui-mode",
  "@deepseek-ai/dsh-modes": "link:/path/to/dsh-traffic-light-pet/packages/plan/modes"
}
```

然后在该目录执行 `pnpm install`。

### 3. 在 profile 的 cordis.patch.yml 装配插件

编辑 `~/.dsh/profiles/web/cordis.patch.yml`（追加/合并）：

```yaml
# 禁用官方旧版 plan-mode 宿主（dsh-modes 取代它）
- id: plan-mode
  disabled: true

- insert:
    - id: modes
      name: '@deepseek-ai/dsh-modes'
      config:
        plan:
          # plan 模式下文件沙箱切只读：命令随便跑，写操作被 OS 层拒
          readOnlySandboxOnPlan: true
          blockedTools: [edit, write, str_replace_editor, schedule_create, todo_write]
          rejectMessage: 'Plan mode is read-only; switch to build mode to modify files.'
          section: |
            You are in plan mode. Explore and design before presenting the
            complete plan through exit_plan_mode.
        build:
          section: ''

- insert:
    - id: ui-traffic-light
      name: '@deepseek-ai/dsh-client-ui-traffic-light'

- insert:
    - id: ui-mode
      name: '@deepseek-ai/dsh-client-ui-mode'
```

### 4. 启动

```sh
pnpm dsh web
```

浏览器**硬刷新**（Cmd+Shift+R）后，左下角出现红绿灯桌宠。

## 从源码重新构建（可选）

预构建的 `lib/` 已包含在当前仓库中，开箱即用。若要修改源码后重新构建，需要把三个包放进官方 DeepSeek Harness monorepo（`packages/plan/modes`、`packages/client/ui-traffic-light`、`packages/client/ui-mode`）并在其工作区构建：

```sh
# 在 deepseek-harness 仓库根目录
npx tsc -b packages/plan/modes packages/client/ui-traffic-light packages/client/ui-mode
pnpm --filter @deepseek-ai/dsh-modes run bundle   # 若该包无 bundle 脚本则用根 tsdown
pnpm --filter @deepseek-ai/dsh-client-ui-traffic-light bundle
pnpm --filter @deepseek-ai/dsh-client-ui-mode bundle
```

构建产物复制回本仓库对应包的 `lib/`（若作为自制 npm 包发布，`files` 已含 `lib/*` 与 `assets/*.png`）。

## 换图

红绿灯图片在 `packages/client/ui-traffic-light/assets/`（透明底 PNG，128×128 参考尺寸）：

- `pet-green.png` — 绿灯（build 空闲）
- `pet-yellow.png` — 黄灯（plan）
- `pet-red.png` — 红灯（build 执行中）
- `pet-yellow-blink.png` / `pet-red-blink.png` — 失败闪烁图

node half 实时读盘伺服（`no-cache`），**替换文件即生效，无需重启**。

## License

MIT