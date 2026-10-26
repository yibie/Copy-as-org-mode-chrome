# ADR: Reader View 改为扩展 iframe 覆盖层（2026-10-24）

## Context

v1.5.0 的 Reader View 在原网页里原地重建：`cleanupPage()` 清掉所有定时器、删掉 `<script>`、用克隆替换 `<body>`（丢掉事件监听）、插入 `script-src 'none'` 的 CSP meta、删掉网页样式表。这些改动不可逆，所以退出只能 `location.reload()`：

- 退出时整页重新加载，有闪烁，滚动位置、表单、视频进度丢失。
- 进出无法做对称的动画（用户希望像 Safari Reader 一样平滑）。
- Reader 和网页共用一个文档：网页 CSP 会拦插入的 `<style>`（task007 为此改用 `insertCSS`），网页 class 名和样式可能漏进 Reader。

## Decision

Reader 改为一个全屏覆盖层，里面是扩展自己的页面 `chrome-extension://<id>/dist/reader.html`，原网页不做任何改动。

- 宿主脚本 `reader-host.ts`（注入网页顶层 frame）：在文档克隆上跑 Defuddle（Shadow DOM 内容复制到克隆里，不碰原网页），把相对 URL 补成绝对 URL，再创建覆盖层：宿主元素挂 closed shadow root，内含 `iframe`；用 `popover="manual"` 放进 top layer；样式用 `adoptedStyleSheets`（不受网页 CSP 管）。网页滚动用 `documentElement.style.overflow` 锁住，退出时还原原值。
- 数据：iframe 通过 `chrome.runtime.sendMessage` 向 background 要文章，background 用 `chrome.tabs.sendMessage(tabId, …, { frameId: 0 })` 转给宿主脚本。网页脚本进不了这条通道。
- 就绪 / 关闭：iframe 用 `window.parent.postMessage` 通知宿主，宿主只接受 `event.source === iframe.contentWindow` 的消息（网页脚本伪造不了 `source`）。
- 动画：遮罩变暗，Reader 淡入并上移 16px，220ms；退出反向；`prefers-reduced-motion` 时不做动画。
- iframe 里的 Reader 直接引入转换器（不再依赖网页里的 `window.html2org`），高亮颜色用页面内 `<style>`。

## Alternatives

1. **View Transitions + 保留刷新退出**：改动最小，但退出仍是整页刷新，动画不对称。
2. **Shadow DOM 覆盖层**：不刷新，但 Reader 的样式和划线代码都写在 `document` 上，要大面积改成在 shadow root 里工作；网页 CSP 仍会拦 shadow 内的 `<style>`。
3. **扩展 iframe 覆盖层（采用）**：独立文档、独立来源，最接近 Safari 的独立视图；现有 Reader 代码在 iframe 文档里基本原样运行。

## Consequences

- 原网页的脚本在后台继续运行（Safari 也一样）；退出瞬间恢复，不再刷新。
- 图片在扩展页面里加载，请求不带网页的 Referer，做了防盗链的网站可能显示不出图片；`http://` 图片在扩展页面里是混合内容，可能被升级或拦截。Save (with images) 仍在原网页里取图，不受影响。
- 文章里的链接改为在新标签页打开；`#…` 锚点在 Reader 内滚动。
- 退出不再刷新，但高亮仍然只存在于本次 Reader 会话，退出即丢失（退出确认见 task009）。
- `insertReaderCss` 消息不再需要，删除。
- `dist/reader.html` 加入 `web_accessible_resources`（`dist/reader.css` 移出，不再注入网页），网页可以探测到它的存在。
- 右键菜单的 `documentUrlPatterns` 改为 `http://*/*`、`https://*/*`、`file:///*`：在 Reader 里右键不出现 Copy / Save 菜单项，用工具栏按钮。否则这些菜单作用在下面的网页上，保存的内容不带高亮。
- Reader 的 Copy 在 iframe 里直接写剪贴板；background 的复制会在网页里选中文本框，把焦点从 Reader 抢走。

## Rollback

revert task014 的提交即回到原地重建 + 刷新退出。宿主脚本也可以在 iframe 加载失败时退回旧路径（本次未做，只做 5 秒超时提示）。
