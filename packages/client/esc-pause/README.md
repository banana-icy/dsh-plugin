# dsh-esc-pause — 连按两次 Esc 中断当前回合

给 DSH Web 加上一个键盘手势：**连按两次 Esc** 中断当前正在生成的回合，等同于输入框右下角的停止按钮（`session.cancel()`）。

English version follows.

## 功能

- **双击 Esc 暂停**：在当前会话有回合正在生成时，两次 Esc（间隔 ≤ 400ms）取消该回合，效果与点击 Stop 完全一致。
- **不抢单次 Esc**：插件只读取事件、不 `preventDefault`，关闭菜单、退出面板、清空选择等既有单次 Esc 行为全部保持不变。
- **弹层优先**：当有对话框 / 菜单 / 下拉列表处于打开状态时，Esc 属于该弹层——插件会把这次按键当作「作废」而不是「第一次」，因此连按两下关对话框不会误停对话。
- **只在有事可做时动作**：没有选中会话、会话没有运行中的回合时不发任何请求。
- **忽略干扰按键**：长按自动重复、带 Ctrl/Cmd/Alt/Shift 的 Esc、输入法组字中的 Esc 都不计入。

## 限制

- 只取消**当前正在生成的回合**。已经排队的消息按 FIFO 在取消完成后继续发送——这是 Host 的既有语义，插件不越权改动队列。
- 判定窗口固定为 400ms：浏览器半的客户端行不携带 `cordis.yml` 的 `config`（客户端花名册不上传行配置），所以窗口不可配置。
- 手势作用于**当前选中的会话**，包括从子代理视图选中的子会话。

## 安装

标准安装（推荐，需要 `dsh` CLI）：

```sh
dsh plugin --profile web add dsh-esc-pause
```

本地开发用 `link:` 手动安装：

```jsonc
// ~/.dsh/profiles/web/package.json
{
  "dependencies": {
    "dsh-esc-pause": "link:/Users/test/Desktop/github/dsh-esc-pause"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ... 其余 bundle
        "dsh-esc-pause"
      ]
    }
  }
}
```

```sh
cd ~/.dsh/profiles/web && pnpm install
```

随后重启 web host（重启后刷新页面）。把包名加进 `dsh.profile.bundles` 即会应用本包 `cordis.patch.yml` 里的插入行；若不加进 bundles，则需要把同样的 `insert` 行手写进 `~/.dsh/profiles/web/cordis.patch.yml`。

## 开发

```sh
npm install
npm run check     # typecheck + vitest + esbuild 产物
```

- `lib/index.js` —— host 半，空 `apply`，只为让插件在 profile 树里有一个合法行。
- `lib/client.js` —— 浏览器半，按 `window.__ModuleLoader__.load({ id, factory })` 包装的 CJS 产物。

改完客户端代码后重新 `npm run build` 即可；host 只在**花名册**变化（新增/删除插件行）时才需要重启。

## 架构

```
src/index.ts                host 半：空 apply（无宿主侧行为）
src/client/index.ts         浏览器半：监听 window 捕获阶段 keydown，判定手势后调用 session.cancel()
src/client/double-press.ts  纯逻辑：双击判定状态机（可注入时钟）
src/client/context-types.ts 结构类型：只声明用到的 ctx.sessions / Session 成员
```

浏览器半通过 Cordis 服务 `inject: ['sessions']` 拿到会话域，读取 `list.getSnapshot().current` 作为目标会话，再经 `binding(id).session` 读 `running` 并调用 `cancel()`。取消失败由会话自身的 `promptError` 呈现，插件不另开反馈通道。

## English

`dsh-esc-pause` adds one keyboard gesture to the DSH Web GUI: **two Escape presses within 400 ms** cancel the running turn of the selected Session — the same operation as the composer's Stop button.

- The listener runs in the capture phase and claims nothing: single-Escape behaviors (closing menus, backing out of panes, clearing selections) are untouched.
- While a dialog, menu, or listbox is open, Escape belongs to that overlay; such a press *disarms* the gesture instead of arming it, so double-tapping a dialog closed never cancels a turn.
- Held-down auto-repeat, modified Escape (Ctrl/Cmd/Alt/Shift), and IME-composing Escape are ignored, as is any press while no turn is running.
- Only the running turn is cancelled; queued messages still resume in FIFO order afterwards, per Host semantics.