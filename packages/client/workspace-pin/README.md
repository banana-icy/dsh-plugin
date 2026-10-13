# dsh-workspace-pin

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 侧边栏的工作区加「置顶」——入口在工作区行的 `⋯` 菜单里。

## 安装

```sh
# 从 npm（推荐）
dsh plugin --profile desktop add dsh-workspace-pin

# 或从本地目录
dsh plugin --profile desktop add /path/to/dsh-workspace-pin
```

桌面端也可以在侧边栏「插件」页点「添加插件」，粘同样的包名或绝对路径，装完点「Enable now」并重启应用。

## 它做什么

- 工作区行 `⋯` 菜单的第一项是 **置顶工作区**；已置顶的工作区显示 **取消置顶**。
- 置顶 = 把该工作区移到工作区列表最前，走宿主自己的持久顺序 API（`workspace.insertBefore`），所以所有客户端、所有浏览器看到的是同一个顺序，重启后仍在。
- 已置顶的工作区行显示一个实心图钉标记，位置和样式跟应用给已置顶会话用的标记一致。
- 取消置顶会把工作区放回置顶前的位置：优先用当时的后邻，后邻没了就用前邻，都没有就追加到末尾。
- **只作用于工作区**。会话的置顶/取消置顶一概不碰。

## 图标

菜单项和行标记用的是应用自带图钉图标的原始路径数据（`@deepseek-ai/dsh-client-ui-primitives` 的 `IconPinOutlineArtwork` / `IconPinFillArtwork`，16×16、描边 1px），不是另画的近似图标。未置顶用空心、已置顶用实心，与应用自带的会话置顶一致。

## 为什么是 DOM 注入

工作区行的 `⋯` 菜单由 `ui-workspace` 用一个本地数组渲染，**没有声明 slot**，插件无法声明式地往里加行。所以本插件在菜单打开时把一行注入进去：

- 复用菜单自己的 class（从同菜单里已有的行上取），所以间距、悬停态、危险色都跟自带行一致；
- 工作区行有稳定的 `data-row-key="workspace:<workspaceId>"`，`⋯` 是行内第一个 `button`，用它定位；
- `MutationObserver` 自愈：React 重渲染把注入的节点冲掉后会重新插回。

## 配置

无。置顶记录存在浏览器 `localStorage` 的 `dsh-workspace-pin.records.v1`，只记「这个浏览器钉了谁、钉之前在哪」；顺序本身在宿主的工作区注册表里。

## 兼容性

面向 DSH `0.2.0-rc.2` 的 Web GUI 编写，依赖：

| 扩展点 | 用途 |
|---|---|
| 客户端服务 `workspaces` | `list` 读顺序、`insertBefore` 改顺序 |
| `workspace/insertBefore` Remote | 持久化工作区顺序 |
| `data-row-key="workspace:…"`、`div[role="menu"]` | 定位工作区行与它打开的菜单 |

菜单 DOM 结构变化会让注入失效——届时菜单项不出现，其余功能不受影响（不抛错、不改顺序）。

## 开发

```sh
node scripts/build-client.mjs          # 由 src/client-src.js 生成 lib/client.js
node scripts/build-client.mjs --check  # 校验 lib/client.js 未漂移
node --test test/client.spec.mjs       # jsdom 集成测试（7 例）
```

测试用 jsdom 搭出侧边栏的工作区行与 `⋯` 菜单，按宿主注册表的 insert-before 语义打桩 `workspaces` 服务，覆盖：菜单行的注入位置与文案、置顶/取消置顶的实际顺序、行标记、未分组桶被跳过、菜单被 React 重渲染后的自愈、无关菜单不被污染。本包刻意不带依赖，jsdom 按需解析——装一个，或用 `DSH_JSDOM` 指向已有的那份：

```sh
DSH_JSDOM=/path/to/node_modules/jsdom/lib/api.js node --test test/client.spec.mjs
```

客户端半边是单个 classic script，由 Web 宿主在 `/plugins/dsh-workspace-pin/client.js` 下提供；宿主半边（`lib/index.js`）是空实现。