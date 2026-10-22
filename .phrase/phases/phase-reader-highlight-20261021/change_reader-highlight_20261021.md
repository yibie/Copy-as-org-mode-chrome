# Changes: phase-reader-highlight-20261021

## 2026-10-22 · task006

- Add `src/chai-types.ts`：`ChaiType { name, color }`；`DEFAULT_CHAI_TYPES`（chai 的 12 个内置 type，颜色取 chai 浅色主题 face 的背景）；`isValidChaiTypeName`（`[A-Za-z0-9_-]+`）；`chaiTypesError`（名字不合法、重复、颜色不是 `#rrggbb` 时返回原因）；`normalizeChaiTypes`（修复存储值）。
- Modify `src/options.ts`：`CopyAsOrgModeOptions` 新增 `chaiTypes`，默认值为 `DEFAULT_CHAI_TYPES` 的副本；`getData` 读取后用 `normalizeChaiTypes` 修复。老用户首次读取时自动写入默认值（沿用已有的 `needSave` 逻辑）。
- Modify `src/options_ui/options_ui.pug`、`options_ui.ts`、`style/options_ui.css`：新增 “Reader Highlights (chai)” 一节。每行是颜色选择器、type 名输入框、上移、下移、删除；下方有 “Add type” 和 “Reset types to chai defaults”。名字不合法或重复时输入框标红、显示原因，整张表不保存，其它设置照常保存。
- Add `test/chai-types.test.ts`：6 个用例。
- Modify `dist/`：重新构建。
- 决定：`outdated` 在 chai 里是灰色前景加删除线，不是背景色。表里只存背景色，默认给 `#E0E0E0`；删除线由 task007 的 Reader 样式按 type 名单独加。spec「默认 type 表」已同步。
- 验证：`npm test` 34 pass；`npm run build` 通过。用 jsdom 加载构建后的 `options_ui.html`，配内存版 `chrome.storage.sync`：默认 12 行；新增 `fact` 后保存；`bad name` 与重复的 `key` 标红且不保存；上移、删除、改色后保存，重新加载页面后表格一致；重置恢复默认。未在真实浏览器中目视检查。
- task_*：task006 勾选 [x]。

## 2026-10-21 · task005

- Modify `src/common.ts`：新增 `SavedPage`（title、content、url、author、keywords、extractedImages）；`MyMsg_SavePageAsOrg`、`MyMsg_SavePageAsOrgFolder` 增加可选字段 `page`。
- Modify `src/background.ts`：
  - `savePageAsOrg(tabId, page?)`、`savePageAsOrgFolder(tabId, page?)`：收到 `page` 时跳过注入脚本里的 Defuddle 提取与转换，直接用它生成文件；没有 `page` 时（右键菜单、非 Reader 页面）行为不变。
  - 两段提取代码只是包进 `if (!...)` 并整体缩进两格，所以普通 diff 有约 570 行；`git diff -w` 下实际改动约 30 行。
  - `savePageAsOrgFolder` 开头注入 `defuddle.js`、`content-script.js` 的步骤保留：第 3 步取图片需要页面里的 `window.html2org.fetchImagesAsBase64`。
  - 消息处理把 `message.page` 传给两个函数。
- Modify `src/reader/reader.ts`：
  - 新增 `convertArticle(saveImages)`：Copy 与 Save 共用的转换；`saveImages` 为 true 时额外传 `imagePathPrefix` 和 `extractedImages`，与 background 的 with images 参数一致；为 false 时参数与原 Copy 完全相同。
  - 新增 `saveAsOrg(withImages)`：把转换结果连同 title、url、author（Defuddle 结果，没有时取 `meta[name="author"]`）、keywords（`meta[name="keywords"]`）发给 background。
  - Save、Save (with images) 两个按钮改为调用 `saveAsOrg`。
  - `copyAsOrg` 改用 `convertArticle(false)`，输出不变。
- Modify `test/article-dom.test.ts`：新增 1 个用例，with images 参数下高亮导出为 chai 链接，且收集到修正后的图片 src。
- Modify `dist/background.js`、`dist/reader.js`：重新构建。
- 验证：`npm test` 28 pass；`npm run build` 通过（3 条体积警告是原有的）。
- 手动验证（2026-10-22，用户）：重新加载扩展、刷新页面后，Reader 中用 DevTools 加 `<mark>`，Save 与 Save (with images) 均按预期工作。第一次没反应，是因为没重新加载扩展。手动步骤：
  1. Reader 中手动给一段文字加 `<mark data-chai-id="h1" data-chai-type="key">`（DevTools），再点 Save → 文件含 `[[chai:key][...]]`。
  2. 同一页点 Save (with images)，选一个有图片的页面 → 保存页打开，图片正常下载，org 中图片路径正确。
  3. 非 Reader 页面右键 → 两种 Save → 与改动前一致。
- 行为变化：
  - Reader 中 Save 的正文现在与 Copy 同源。v1.5.0 是对 Reader 页面重跑 Defuddle，再用宽松规则删掉开头像标题的元素；两者输出的差异没有比对。spec「导出」第 3 条已同步改写。
  - `#+KEYWORDS` 的来源不变：旧路径里读 Defuddle `metaTags` 的代码把数组当对象用，从未生效，实际一直取 `meta[name="keywords"]`。
- Modify `src/background.ts` `toggleReaderMode`：注入列表加 `dist/content-script.js`。原因：Reader 的 Copy / Save 依赖 `window.html2org`，它通常由 manifest 注入；重新加载扩展后、在已打开的标签页里进入 Reader 时它不存在，会提示 `html2org not loaded`。v1.5.0 的 Save 自己注入脚本，不受影响，task005 后 Save 也会受影响，所以在这里补上。重复注入只是重新赋值 `window.html2org`，无副作用。
- task_*：task005 勾选 [x]。
- pr-faq_*：用户 FAQ「普通的 Copy / Save 会变吗？」改为只对 Copy 承诺与 v1.5.0 一致。

## 2026-10-21 · task004

- Add `src/reader/article-dom.ts`：
  - `decorateArticle(el)`：从 `populateArticleContent` 原样搬出的三步加工（表格包 `div.caom-table-wrapper`、`img[data-src]` 修正 src、给 h2–h6 补 id）。
  - `articleHtmlForExport(el)`：克隆当前文章 DOM，展开表格包装 div，返回 innerHTML；高亮 `<mark>` 保留，不改动原 DOM。
  - 有意保留 data-src 修正后的 src：v1.5.0 在 Reader 中 Save 是对已加工的页面重新提取，保存的图片本来就是修正后的 src；还原会让 Save (with images) 退回占位图。标题 id 不影响 html2org 输出，无需撤销。
- Modify `src/reader/reader.ts`：
  - `populateArticleContent` 改为调用 `decorateArticle`。
  - `copyAsOrg` 改为转换 `articleHtmlForExport(.caom-reader-article)`；找不到文章元素时退回 `article.contentHTML`。
- Add `test/article-dom.test.ts`：5 个用例（加工生效、无高亮时转换结果与原 HTML 一致、保留修正后的图片 src 且去掉包装 div、不修改原 DOM、保留高亮）。
- Modify `dist/reader.js`：重新构建。
- 验证：`npm test` 27 pass；`npm run build` 通过。3 个真实页面（paulgraham.com/greatwork、en.wikipedia.org/wiki/Org-mode、jvns.ca 一篇博客）在 jsdom 中用 Defuddle 提取、模拟 Reader 填充与加工后，新旧路径的 Copy 输出和 saveImages 输出逐字一致。未在真实浏览器中手动点击验证。
- 风险：Copy 现在依赖 `.caom-reader-article` 里只有正文；以后若往文章元素里插 UI 节点，需在 `articleHtmlForExport` 中剔除。
- task_*：task004 勾选 [x]。

## 2026-10-21 · task003

- Modify `src/html2org/chai.ts`：
  - `normalizeChaiMarks`：去掉“同一块级祖先”的限制，跨段落的片段同样用 Range 合并成一个 `<mark>`。合并后含块级元素的 mark 把 h1–h6 改为 `<p>`，并保留内部链接；不含块级元素的仍展开 `<a>`。
  - `chaiHighlightRule`：转换后的内容含换行时输出 `#+BEGIN_CHAI :type T [:note "N"]` 块，否则输出行内链接。
  - 新增 `quoteElispString`（`%S` 风格）、`chaiBlock`、`chaiLink`；删除 `blockAncestor`。
  - `ZWSP` 常量改用 `\u200b` 转义（之前是不可见的字面字符）；`test/chai.test.ts` 同步。
- Modify `test/chai.test.ts`：新增 5 个块用例（跨两段、批注含引号和反斜杠、中间整段、块内链接与 `]]`、块内标题）。
- Modify `dist/content-script.js`、`dist/copy.js`、`dist/html2org.js`：重新构建。
- 验证：`npm test` 22 pass；输出在 Emacs 中经 `chai--collect-highlights` 解析，type/note/text 全部正确；`npm run build` 通过。
- 风险：高亮跨越不同父级的块（如从段落跨进列表项）时，块插在两者的公共祖先下，可能把列表拆开。Reader 侧划线（task007）可以考虑限制这种选区。
- spec_*：补充块输出规则、更新“链接文字被高亮”的结论。task_*：task003 勾选 [x]。

## 2026-10-21 · task002

- Add `src/html2org/chai.ts`：
  - `normalizeChaiMarks(root)`：同一 `data-chai-id`、同一块级祖先的多个 `<mark>` 片段用 Range 合并成一个 `<mark>`；展开高亮内嵌套的 chai mark 与 `<a>`。跨块级的高亮暂不处理（task003）。
  - `chaiHighlightRule`：`mark[data-chai-type]` → `[[chai:TYPE(:NOTE)][TEXT]]`；type 不符合 `[A-Za-z0-9_-]+` 时退回普通文本。
  - `escapeLinkPath` / `escapeLinkDescription`：复刻 Org `org-link-escape` / `org-link-make-string` 的转义。
- Modify `src/html2org/root-node.ts`：`RootNode` 解析后调用 `normalizeChaiMarks`。
- Modify `src/html2org/commonmark-rules.ts`：注册 `chaiHighlight` 规则。
- Add `test/chai.test.ts`：16 个用例（无/有批注、自定义 type、批注含 `:`/括号/反斜杠/换行、原文含 `]]`/以 `]` 结尾、首尾空白、跨 `<em>` 合并、内嵌链接、多个 id、非法 type、无 chai 属性的 `<mark>`）。
- Modify `dist/content-script.js`、`dist/copy.js`：重新构建。
- 验证：`npm test` 17 pass；转换结果在 Emacs 中经 `chai--collect-highlights` 解析，type/note/text 全部正确还原；`npm run build` 通过。
- 风险：不含 chai 属性的 HTML 输出不变（预处理只匹配 `mark[data-chai-type]`）。
- 发现既有问题 issue001（行内标记后多一个空格），未在本任务修改。
- spec_*：更新“字段约束”的转义规则。task_*：task002 勾选 [x]。

## 2026-10-21 · task001

- Add `test/setup-dom.ts`：用 jsdom 注入 `window`/`document`/`DOMParser`/`Node`，供 html2org 在 Node 中加载。
- Add `test/html2org.test.ts`：`html2org.convert` 基线用例（段落 + 粗体 + 链接）。
- Modify `package.json`：新增 `test` 脚本（`node --test` + `ts-node/register`，transpile-only，CommonJS）。
- 验证：`npm test` 1 pass；`npm run build` 通过，`dist/` 无变化。
- 风险：无运行时影响；仅新增 dev 流程。
- task_*：task001 勾选 [x]。

## 2026-10-21

- Add `.phrase/phases/phase-reader-highlight-20261021/`：`pr-faq_*`、`spec_*`、`plan_*`、`task_*`、`change_*`。
  - PR/FAQ 经用户确认定稿；spec/plan 由其拆出。
  - 新增 task001–task010（均未开始）。
  - 无代码改动，无行为影响。
