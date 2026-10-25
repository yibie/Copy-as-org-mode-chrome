# Changes: phase-reader-highlight-20261021

## 2026-10-24 · task008

- Add `src/reader/highlight.ts`：`highlightPieces(root, id)`；`updateHighlight(root, id, { type, note })`（所有片段改属性，空批注删属性，旧气泡删掉、在最后一段重建）；`removeHighlight(root, id)`（删气泡，展开所有片段，父节点 `normalize()`）。
- Modify `src/reader/reader.ts`：在文章里单击高亮（无选区）打开同一菜单的编辑模式：当前 type 加外框，批注框预填，显示 “Remove highlight”。点 type 改 type 并保存批注；批注框回车只保存批注；自定义 type 回车改为该 type。`setMenuMode`、`showEditMenu`、`editingId`。
- Modify `src/reader/reader.css`：`.caom-hl-current`、`.caom-hl-delete`；高亮显示手形光标。
- spec User Flows「编辑高亮」细化。
- 验证：新增 3 个测试（改 type 和批注后导出为新 type/批注；清空批注后无气泡、导出无批注；删除后 HTML 与原文逐字相同，含行内代码和斜体）。`npm test` 69 pass；`npm run build` 通过。未在浏览器中验证。

## 2026-10-24 · task013

- Add `src/extractors/google-ai-mode.ts`：`GOOGLE_AI_MODE_PATTERNS`（`google.<tld>/search` 且 `udm=50`）；`cleanAiModeAnswer`（删除 `script`/`button`/`svg`、`[role=dialog]`、`[role=button]`、`[aria-live]`、`[aria-hidden=true]`、内联 `display:none`、`h3[data-ignore-copy]`、`.DHPVt` 引用、`.DBd2Wb` 免责声明和反馈、`.ofHStc` Shared 面板、注释；展开 Google 自己的 `<mark>`；`[role=heading]` 改为 `h3`–`h6`；只含行内内容的 `div` 改为 `p`，其它 `div` 和 `span` 展开；只保留 `href`/`src`/`alt`/`colspan`/`rowspan`；删空段落）；`extractGoogleAiMode`（每个 `[data-scope-id=turn]` 输出 `h2` 问题 + 回答；问题取自 `h3[data-ignore-copy]` 去掉 “AI Mode reply for ”；标题取 `h1` 去掉 “AI Mode Conversation: ”；站点 “Google AI Mode”）。
- Modify `src/extractors/index.ts`：注册 Google AI Mode。
- Add `test/google-ai-mode.test.ts`：4 个用例，样本取自真实页面的标记。
- 验证：`npm test` 66 pass；`npm run build` 通过，`dist/defuddle.js` 327 KB。在真实 AI Mode 页面（单轮对话）注入构建后的 `dist/defuddle.js`，`parse()` 和 `parseAsync()` 输出不含 Shared、0 files、Show all、账号信息、免责声明、`jsaction`、`class=`。
- 限制：只依赖 Google 混淆后的 class 名（`.DHPVt`、`.DBd2Wb`、`.ofHStc`）和 `data-scope-id`/`data-subtree` 属性，Google 改版后可能失效，届时退回 Defuddle 的通用结果。多轮对话的结构按单轮推断，未实测。引用来源链接没有保留（页面上是按钮，没有 URL）。
- 用户反馈中的 Reader 页脚重复出现两次，未排查。

## 2026-10-23 · task012

- Add `src/extractors/zhihu.ts`：`ZHIHU_PATTERNS`（仅 `zhuanlan.zhihu.com/p/ID`）；`cleanZhihuBody`（去掉搜索链接的星形 `svg` 并把 `a.RichContent-EntityWord` 还原为文字；`link.zhihu.com/?target=` 还原为目标 URL；删 `a span.invisible`，展开 `span.visible`/`span.ellipsis`；`img` 用 `data-original`；展开 `.RichText-ConditionalImagePortal`；删 `p.ztext-empty-paragraph`）；`extractZhihu`（正文、标题 `h1.Post-Title`、作者 `.AuthorInfo-name .UserLink-link`、站点“知乎专栏”、发布日期取自 `.ContentItem-time`）。
- Add `src/extractors/index.ts`：`extractSite(doc, url)` 按 URL 选站点提取；`applySiteExtraction` 用非空字段覆盖 Defuddle 结果。
- Modify `src/defuddle.ts`：导出给页面的 `window.Defuddle` 换成子类 `DefuddleWithSites`，`parse()`/`parseAsync()` 先跑 Defuddle 再叠加站点提取。所有提取路径（Copy、两种 Save、Reader）都经过它。
- 决定：没用 Defuddle 的 `ExtractorRegistry.register`。Defuddle 的浏览器入口 `dist/index.js` 是自带一份注册表的打包文件，往未打包模块里注册不生效；改用未打包入口可以共享注册表（已实测生效），但会带进 temml、mathml-to-latex、@xmldom，`dist/defuddle.js` 从 323 KB 涨到 674 KB。包一层子类没有这个代价，最终 325 KB。
- Add `test/zhihu.test.ts`：5 个用例。
- 验证：`npm test` 60 pass；`npm run build` 通过。在 https://zhuanlan.zhihu.com/p/2079219486700344366 上注入构建后的 `dist/defuddle.js`，`parse()` 和 `parseAsync()` 都得到：作者 `腾讯技术工程`（无 U+200B）、发布 `2026-09-04`、正文不含“人赞同”、`zhida.zhihu`、`link.zhihu.com`、`_1440w`、`<svg`，13 张图。未在扩展里实际 Copy / Save。
- 范围：知乎问答页（`/question/…/answer/…`）结构不同，未覆盖。

## 2026-10-23 · task011（issue002）

- Add `src/org-filename.ts`：`cleanMetaText`、`orgFilename`，规则见 issue002 详情。
- Modify `src/background.ts`：`savePageAsOrg` 和 `savePageAsOrgFolder` 的文件名改用 `orgFilename`，删掉两份重复的 `sanitize`/`cleanComponent`；`#+TITLE`/`#+AUTHOR` 和关键词列表经过 `cleanMetaText`，作者清理后为空时不写 `#+AUTHOR`。
- Modify `src/save_folder/save_folder.ts`：`data.filename` 缺失时用 `orgFilename(data.title)`。
- Modify `src/html2org/commonmark-rules.ts`：图片扩展名先去掉 `?`/`#` 后的部分，只接受 `[a-z0-9]{1,5}`，否则 `png`。
- Add `test/org-filename.test.ts`：6 个用例。
- 行为变化：以前合法的文件名基本不变；含不可见字符、首尾点、超长的名字现在会被清理或截断。`#+AUTHOR` 等不再带零宽字符。
- 验证：`npm test` 55 pass（task011 完成时）；`npm run build` 通过。未在浏览器中保存验证。

## 2026-10-22 · task007

- 2026-10-23 Modify `src/reader/highlight.ts` `wrapRange`：用户反馈选区跨行内代码时高亮在代码两侧断开。原因：只包文本节点、跳过纯空白节点，`<code>` 的内边距和前后空格露出底色。改为：同一块内的纯空白节点也包；完全被覆盖的行内元素（`code`、`em`、`a` 等）整个包进 mark；相邻兄弟合并成一个 mark。块结构仍不改动。`reader.css` 中 mark 里的 `code` 背景设为透明。新增 2 个测试；`npm test` 62 pass。未在浏览器中验证。
- Add `src/reader/highlight.ts`：
  - `checkHighlightRange(range, articleEl)`：返回拒绝原因或 null。`empty`（空或仅空白）、`outside`（不在文章内）、`overlap`（与已有高亮相交或在其内）、`unsupported`（包含或位于 `img`、`picture`、`svg`、`video`、`audio`、`iframe`、`canvas`、`table`、`pre` 中）、`crossesListItem`（起点和终点所在的列表项不同）。
  - `tightenRange(range)`：把选区收紧到实际覆盖的非空白文字。Chrome 三击选段时终点落在下一块的偏移 0，不收紧会按下一块误判。
  - `wrapRange(range, { type, note })`：只包文本节点，部分覆盖的两端先 `splitText`，纯空白节点不包；所有片段共用一个新 `data-chai-id`；批注折叠空白，空批注不写属性。
- Modify `src/reader/reader.ts`：新增 `installHighlighting` 等函数。在文章区内松开鼠标，选区收紧并通过检查后，在选区下方（放不下时在上方）弹出浮动菜单：type 按钮（Options 顺序和颜色）、批注输入框、自定义 type 输入框（不合法时标红，回车应用）。点 type 后包裹选区、清除选区、关菜单。Esc（捕获阶段拦截，不会顺带退出 Reader）、在菜单外按下鼠标、页面滚动都会关菜单。
- 默认 type 改为用户 chai 配置（用户 2026-10-22 要求“和 chai 的用户配置保持统一”）：`DEFAULT_CHAI_TYPES` 从 chai 内置 12 个改为 nova-emacs `chai-highlight-types` 的 `key`/`idea`/`question`/`fact`，`fact` 用 question 的 `#BBDEFB`。`test/chai-types.test.ts` 同步。已装过 task006 版本的用户存储里仍是 12 个，需在 Options 点 “Reset types to chai defaults”。spec/PR-FAQ/task006 描述已同步。
- 气泡只撑高自己那一行（用户 2026-10-22 要求）：`reader.css` 给含气泡的 mark 加 `::after` 占位（`inline-block`、宽 0、高 `var(--caom-note-h) + 12px + 1em`、`vertical-align: baseline`），只有该行行框变高，气泡落在多出的空间里。`--caom-note-h` 由 `applyHighlight` 在插入气泡后用 `offsetHeight` 量出；气泡字号和最大宽度固定，调 Reader 字号不影响。“盖住上一行”的限制就此解除。
- 批注气泡改为一直显示（用户 2026-10-22 要求“不隐藏”）：去掉 `caom-note-shown`、`mouseover`/`mouseout` 监听、点状下划线；气泡常驻高亮上方。`noteBubbleOf` 保留给 task008 改批注用。已知限制：气泡盖住上一行文字；高亮在页面左右边缘时气泡可能超出视口。
- 批注气泡改为悬停浮在上方（已被常驻气泡取代）（用户 2026-10-22 贴来 tooltip 方案）：气泡移进最后一个片段内部（`mark.appendChild`），`mark[data-chai-note]` 设 `position: relative` 并加点状下划线提示；气泡 `position: absolute; bottom: 100%; left: 50%`，深色底、朝下小三角，默认隐藏。悬停任一片段显示：`highlight.ts` 新增 `noteBubbleOf(node)` 按 `data-chai-note-for` 找气泡，`reader.ts` 在文章上监听 `mouseover`/`mouseout` 切换 `caom-note-shown`。气泡 `pointer-events: none`，不挡选区。测试同步（气泡在 mark 内、`noteBubbleOf` 能找到）。`npm test` 49 pass。已知限制：高亮在页面最左或最右时，气泡可能部分超出视口；高亮最后一段折行时，气泡对齐最后一段的盒子。
- 批注改为气泡（已被悬停气泡取代；用户 2026-10-22 要求）：伪元素画在 `<mark>` 内部，高亮底色总会露在周围，所以改为真实元素。`highlight.ts` 新增 `addNoteBubble`：在最后一个片段后插入空的 `span.caom-chai-note`（`data-note`、`data-chai-note-for`、`contenteditable=false`），文字由 `::after { content: attr(data-note) }` 画，尾巴由 `::before` 画；元素不含文本节点，选区检查和 `wrapRange` 不受影响。`articleHtmlForExport` 删除气泡。去掉 `caom-hl-end` class。`test/highlight.test.ts`：原“class 不影响导出”用例换成 2 个（气泡不加文字且不进入导出；无批注不建气泡）。`npm test` 49 pass。task008 改批注时要同步改气泡的 `data-note`，删批注时删气泡。
- 批注样式第二版（已被气泡取代）（用户反馈第一版“很诡异”：标题里继承粗大字重，高亮底色延伸到标签下）：`::after` 改为页面底色 + `box-shadow` 盖住间距、左侧 2px 强调色竖线、固定 0.8rem 无衬线常规字重、`text-decoration: none`，去掉圆角边框。
- 批注显示（用户 2026-10-22 选定“高亮后面的行内小字”）：`applyHighlight` 给最后一个片段加 `caom-hl-end` class；`reader.css` 用 `::after { content: attr(data-chai-note) }` 显示灰色圆角标签。生成内容不在 DOM 里，导出看不到；class 也不影响 html2org 输出（有测试）。task008 改批注时只改属性，标签自动更新。spec「划线」第 5 条已补。
- Modify `src/reader/reader.css`：高亮默认样式（`#fff59d` 背景，用于表外的自定义 type；文字固定深色，深色主题下也能读）；`outdated` 加删除线；菜单样式。
- 各 type 的颜色由 reader 拼成 CSS，发 `insertReaderCss` 消息给 background，用 `chrome.scripting.insertCSS` 注入。没有往页面里插 `<style>`，因为页面自己的 CSP 可能禁止内联样式。颜色按 `data-chai-type` 选择器生效，task008 改 type 时只改属性即可。
- Modify `src/common.ts`、`src/background.ts`：新增 `insertReaderCss` 消息及处理。
- Add `test/highlight.test.ts`：14 个用例（单节点、批注、跨 `<em>`/`<a>`、跨段落导出为块、id 唯一、各类拒绝、三击收紧、空白选区、显示用 class 不影响导出）。`test/setup-dom.ts` 补 `NodeFilter`。
- Modify `dist/`：重新构建。
- 验证：`npm test` 48 pass；`npm run build` 通过。未在真实浏览器中验证。手动步骤：
  1. 在 3 个真实文章页进入 Reader，选中一段中间的文字，点 `key` → 出现对应颜色；Copy 结果含 `[[chai:key][...]]`。
  2. 跨 `<em>` 或链接选中 → 一个链接；跨两段 → `#+BEGIN_CHAI` 块。
  3. 三击选中列表或代码块前的最后一段 → 菜单照常弹出。
  4. 填批注后点 type → 高亮末尾出现批注标签；跨段高亮只在最后一段末尾出现；链接带批注。自定义输入 `fact` 回车 → 用默认黄色；输入 `a b` → 标红，回车无效。
  5. 选 `outdated` → 删除线。深色主题下高亮文字可读。
  6. 菜单打开时：光标在批注框内按 Esc → 只关菜单，不退出 Reader；点菜单外 → 关闭；滚动 → 关闭。
  7. 选区与已有高亮重叠、包含图片、从段落拖进列表项 → 不弹菜单。
- 已知限制：拖选结束时鼠标落在文章区外（如页边空白）不弹菜单；不支持纯键盘选区；拒绝时没有提示。
- task_*：task007 勾选 [x]（附未在真实浏览器中验证的说明）。

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
- 风险：高亮跨越不同父级的块（如从段落跨进列表项）时，块插在两者的公共祖先下，可能把列表拆开。Reader 侧划线（task007）可以考虑限制这种选区。（已在 task007 处理：这类选区返回 `crossesListItem`，不弹菜单。）
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
