# dsh-traffic-light-pet

红绿灯桌宠插件集 for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh web 端）。

一个**悬浮红绿灯桌宠**：宠物图片随 agent 模式实时变化（绿灯=空闲、黄灯=plan、红灯=build 执行中、黄闪/红闪=失败停住），支持拖动固定位置（位置持久化到 localStorage）、点击切换模式，外加 Cmd+P / Ctrl+P 快捷键全局切换 plan ↔ build。

此外还包含三个独立插件包，见文末：`dsh-workspace-pin`（工作区置顶）、`dsh-esc-pause`（双击 Esc 中断回合）、`@dsh-external/dsh-automation`（定时任务）。

## 本仓库包含的包

| 包 | 目录 | 类型 |
|---|---|---|
| `@deepseek-ai/dsh-modes` | `packages/plan/modes/` | 宿主插件 |
| `@deepseek-ai/dsh-client-ui-traffic-light` | `packages/client/ui-traffic-light/` | 客户端插件 |
| `@deepseek-ai/dsh-client-ui-mode` | `packages/client/ui-mode/` | 客户端插件 |
| `dsh-workspace-pin` | `packages/client/workspace-pin/` | 客户端插件（独立发布） |
| `dsh-esc-pause` | `packages/client/esc-pause/` | 客户端插件（独立发布） |
| `@dsh-external/dsh-automation` | `packages/schedule/automation/` | 宿主 + 客户端插件（独立发布） |

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
git clone https://github.com/banana-icy/dsh-plugin.git
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

## dsh-workspace-pin（工作区置顶）

侧边栏的**工作区置顶**，独立于上面三个包，从 npm 单独安装。

- 工作区行 `⋯` 菜单的第一项是「**置顶工作区**」，已置顶的显示「**取消置顶**」
- 置顶 = 把该工作区移到工作区列表最前，走宿主自己的持久顺序 API（`workspace.insertBefore`），所有客户端共享同一顺序，重启后仍在
- 已置顶的工作区行显示实心图钉标记，样式与应用给已置顶**会话**用的标记一致
- 取消置顶按记录的邻居还原位置（后邻优先，其次前邻，都没有就追加）
- **完全不碰会话**——没有任何会话置顶逻辑

图标用的是应用自带 `@deepseek-ai/dsh-client-ui-primitives` 里 `IconPinOutlineArtwork` / `IconPinFillArtwork` 的原始路径数据（16×16、描边 1px），未置顶空心、已置顶实心。

工作区行的 `⋯` 菜单由 `ui-workspace` 用本地数组渲染、**没有声明 slot**，所以本插件在菜单打开时把一行注入进去，复用菜单自己的 class，并用 `MutationObserver` 在 React 重渲染后自愈。定位靠 `data-row-key="workspace:<id>"` 和"行内第一个 button 就是 `⋯`"，不依赖界面文案。

```sh
# 装进桌面端 profile
dsh plugin --profile desktop add dsh-workspace-pin
```

桌面端也可以在侧边栏「插件」页点「添加插件」粘同一个包名，装完点「Enable now」并重启应用。

| 目录 | 说明 |
|---|---|
| `packages/client/workspace-pin/` | 包源码 + 预构建 `lib/` |

开发（该包刻意不带依赖）：

```sh
cd packages/client/workspace-pin
node scripts/build-client.mjs          # 由 src/client-src.js 生成 lib/client.js
node --test test/client.spec.mjs       # jsdom 集成测试，7 例
```

`npm publish` 在该包目录执行；`prepack` 会自动重建 `lib/client.js`。

## dsh-esc-pause（双击 Esc 中断回合）

给 Web 界面加一个键盘手势：**连按两次 Esc** 中断当前正在生成的回合，等同于输入框右下角的停止按钮（`session.cancel()`）。

- 只读取事件、不 `preventDefault`——关闭菜单、退出面板、清空选择等既有单次 Esc 行为全部不变
- 有对话框 / 菜单 / 下拉打开时，这次 Esc 归弹层，插件把它当「作废」而不是「第一次」
- 没有选中会话、或会话没有运行中的回合时不发任何请求
- 忽略长按自动重复、带修饰键的 Esc、输入法组字中的 Esc
- 判定窗口固定 400ms（客户端行不携带 `cordis.yml` 的 `config`，所以不可配置）

```sh
dsh plugin --profile desktop add dsh-esc-pause
```

| 目录 | 说明 |
|---|---|
| `packages/client/esc-pause/` | 包源码 + 预构建 `lib/` |

## @dsh-external/dsh-automation（定时任务）

按计划在全新的 Agent 会话里跑编码任务，并从 Web 或 Agent 侧管理它们。宿主半 + 客户端半双面插件。

```sh
dsh plugin --profile desktop add @dsh-external/dsh-automation
```

| 目录 | 说明 |
|---|---|
| `packages/schedule/automation/` | 包源码 + 预构建 `lib/` + `docs/` 截图与设计文档 |

## License

MIT