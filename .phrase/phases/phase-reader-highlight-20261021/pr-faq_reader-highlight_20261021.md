# PR/FAQ: Reader View 高亮 + chai 格式导出

状态：已定稿（2026-10-21，用户确认）

---

# Copy as Org-Mode 1.6：在 Reader View 里划线，导出的就是 chai 笔记

**副标题**：在阅读模式下边读边按语义划线，复制或保存时高亮直接变成 chai 链接，Emacs 打开就能看到高亮。

**发布日期**：待定（目标版本 v1.6.0）

**简介**
Copy as Org-Mode 的 Reader View 新增划线功能。用户在浏览器里读文章时，选中一段文字，点一下就能标成 `key`、`important`、`question` 等语义高亮，还可以附一句批注。导出 org 时，这些高亮按 chai 的格式写出，在 Emacs 里由 chai 直接识别、上色、汇总。目标用户是用 Emacs 加 chai 做阅读笔记、平时又大量在网页上阅读的人。

**问题**
1. 现在的流程是“浏览器读一遍，存成 org，再在 Emacs 里重读一遍补高亮”。同一篇文章要读两遍，第一遍读到的重点没法带走。
2. 浏览器里的高亮工具（Hypothesis、Obsidian 等）各有自己的格式，进不了 chai 体系，`chai-export`、汇总这些功能都用不上。
3. 每个人的 chai type 都不一样，比如自己加了 `fact`。通用工具只有固定几种颜色，表达不了这些语义。

**解决方案**
在 Reader View 里选中文字，会弹出一个浮动菜单，里面列出用户自己配置的 chai type，可以选填批注。导出时，高亮原地替换成 chai 的语法：选区不跨段落时写成 `[[chai:type:批注][原文]]`，跨段落时写成 `#+BEGIN_CHAI :type ... :note "..."` 块，和 chai 在 Emacs 里自己生成的结果完全一样。type 列表在 Options 页维护，默认带 chai 的 12 个内置 type 和对应颜色。

**负责人引言**
“chai 解决了 Emacs 里的拆读问题，但大部分阅读发生在浏览器里。这一版把划线这一步前移到阅读当下：读到哪划到哪，存下来就已经是拆好的笔记。”

**怎么用**
1. 打开文章，右键菜单或快捷键进入 Reader View。
2. 选中一段文字，浮动菜单弹出。点一个 type，文字立即按该 type 的颜色高亮。也可以先在批注框里写一句再点。
3. 点已有的高亮，可以改 type、改批注或删除。
4. 读完后，在 Org 菜单里选 Copy 或 Save，导出的 org 中高亮都已是 chai 语法。
5. 自定义 type：Options 页的 chai type 表可以增、删、改 type 名和颜色。菜单里另有“自定义 type”输入框，临时用一个表里没有的 type 时不用先去改设置。

**用户引言**
“以前在网页上读完要再去 Emacs 里划一遍。现在读的时候顺手就划了，存下来的文件 `chai-export` 直接就能汇总，我的 `fact` 类型也一起带过去了。”

**如何开始**
升级到 v1.6.0，进入任意文章的 Reader View，选中文字即可。

---

## FAQ

### 内部 FAQ

**Q：高亮怎么进入导出结果？**
现在的 Copy 是转换 `article.contentHTML`（`src/reader/reader.ts` 的 `copyAsOrg`），用的是 Defuddle 提取出的原始 HTML，不是页面上的 DOM。Save 的两条路径则由 background 重新注入脚本、重新提取（`src/background.ts` 的 `savePageAsOrg` / `savePageAsOrgFolder`），同样看不到高亮。方案是：高亮在 Reader DOM 里包成 `<mark data-chai-id data-chai-type data-chai-note>`，导出时改为转换 Reader 当前的文章 DOM，并在 html2org 里加一条规则，把 `mark[data-chai-type]` 输出成 chai 语法。Save 的两个按钮要改成由 reader 把转换好的 org 或 HTML 交给 background，不再重新提取。这是本期最大的改动点。

**Q：跨元素选区怎么处理？**
选区可能跨越 `<em>`、`<a>` 或多个段落。同一段落内的选区，拆成多个连续的 `<mark>` 片段，共用一个 highlight id，导出时合并成一个链接。跨段落的选区导出成 `#+BEGIN_CHAI` 块。块内保留原段落结构，行内格式是否保留，等 spec 阶段确认 chai 块内对 org 标记的处理后再定。

**Q：转义怎么做？**
原文里出现 `]]`、`[[` 会截断链接，需要做和 org 一致的转义；最终方案要用 chai 解析器验证。type 名限制为 `[A-Za-z0-9_-]`。批注里可以有 `:`（chai 把第一个 `:` 之后的内容全部算作批注），但要去掉 `]` 和换行。块形式的批注按 Emacs `%S` 风格加引号转义。

**Q：为什么不持久化？**
第一版只在本次阅读会话内保留高亮。按 URL 持久化需要在页面变化后重新定位文本锚点，复杂度高，收益要等第一版验证后再评估。退出 Reader View 会刷新页面，高亮随之丢失：如果有未导出的高亮，退出前要确认一次。

**Q：为什么不做从 chai 导入 type？**
`chai-highlight-types` 存的是 face 名而不是颜色，导入后颜色还得手填，第一版收益低。先做手动维护的 type 表。

**Q：风险**
- Save 路径改造会影响现有的“with images”流程，需要回归测试。
- 一些网站的 Defuddle 提取结果嵌套很深，`<mark>` 包裹可能破坏结构。需要准备若干真实文章页面做回归。
- 仓库目前没有测试框架，html2org 规则的测试需要补一个最小测试入口。

### 用户 FAQ

**Q：type 和 Emacs 里不一致怎么办？**
扩展不做校验，写什么就导出什么。chai 遇到不认识的 type 不会报错，只是用普通链接样式显示。在 Emacs 的 `chai-highlight-types` 里加上同名 type 就会有颜色。

**Q：只在 Reader View 里能用吗？**
是的，第一版只在 Reader View 里提供。普通页面的“复制选区”不受影响。

**Q：普通的 Copy / Save 会变吗？**
没有高亮时，Copy 的输出和 v1.5.0 完全一致。在 Reader View 里 Save 的正文改为和 Copy 同源，可能和 v1.5.0 略有不同；普通页面的右键 Save 不变。

**Q：关掉页面高亮还在吗？**
不在。请在关闭页面前完成导出。
