# Spec: Reader View 高亮 + chai 格式导出

来源：`pr-faq_reader-highlight_20261021.md`

## Summary

在 Reader View 中支持按 chai type 划线并附批注；Copy / Save 导出时，高亮按 chai 语法写入 org。type 列表在 Options 页由用户维护。

## Goals

- Reader View 内选中文字后弹浮动菜单，按 type 高亮，可选批注。
- 点击已有高亮可改 type、改批注、删除。
- Options 页维护 chai type 表（名字 + 颜色），默认取用户 chai 配置的 4 个 type。
- 菜单提供“自定义 type”输入，临时使用表外 type。
- Copy as Org-Mode、Save as Org-Mode、Save as Org-Mode (with images) 三个导出都带上高亮。
- 输出与 chai（`~/Documents/emacs/package/org-zettel-ref-mode/chai/chai.el`）自身生成的语法一致。

## Non-goals

- 高亮持久化（按 URL 存储、重开恢复）。
- 从 chai 配置导入 type。
- 普通页面（非 Reader View）高亮。
- 在扩展里校验 type 是否被 chai 识别。

## chai 语法（以 chai.el 为准）

- 行内：`[[chai:TYPE][TEXT]]`，有批注时 `[[chai:TYPE:NOTE][TEXT]]`（`chai--insert-highlight-link`）。
  chai 解析时第一个 `:` 前为 type，之后全部为 note（`chai-parse-link-path`）。
- 块：选区含换行时
  ```
  #+BEGIN_CHAI :type TYPE :note "NOTE"
  TEXT
  #+END_CHAI
  ```
  无批注时省略 `:note`（`chai--block-header-line`，note 用 `%S` 格式化）。
- 未知 type：chai 退回 `org-link` face，不报错。

### 默认 type 表

默认值取用户 chai 配置（`~/.config/nova-emacs/modules/nova-org.el` 的 `chai-highlight-types`），顺序一致：

| type | 颜色（chai light 背景） |
|------|------|
| key | #FFE082 |
| idea | #B2DFDB |
| question | #BBDEFB |
| fact | #BBDEFB（nova-emacs 的 `chai-highlight-fact` 继承 question 的蓝色） |

Reader 对 `outdated` 仍加删除线，用户自己加这个 type 时生效。

存储：`chaiTypes: { name, color }[]`（`color` 为高亮背景，`#rrggbb`），按菜单顺序保存在 extension storage。读取时修复：不是数组则用默认值；丢弃名字不合法、重复或颜色不合法的条目；允许空列表（只剩自定义输入）。

### 字段约束

- type 名：`[A-Za-z0-9_-]+`，Options 和自定义输入都校验，不合法时输入框标红并禁止提交。
- 批注：空白（含换行）折叠为单个空格并 trim，空批注省略。转义同 Org `org-link-escape`：`[`、`]` 前加 `\`，紧挨在括号前或位于末尾的 `\` 加倍。可以含 `:`。
- 原文：同 Org `org-link-make-string`：每个后面紧跟 `]` 的 `]` 后插入零宽空格（U+200B），末尾的 `]` 后也插入。chai 还原出的原文会带零宽空格。
- 原文首尾空白移到链接外。
- 高亮内的 `<a>` 只保留文字（org 链接不能嵌套）。
- 块：转换后的内容含换行时输出 `#+BEGIN_CHAI` 块（与 chai 的 `chai--insert-highlight` 判断一致）。批注按 Emacs `%S` 规则加引号（`\` 与 `"` 前加 `\`）。块内不做括号转义，链接保留。块内的标题（h1–h6）转为普通段落，否则标题行会截断块。块前后未高亮的文字成为块外的独立段落。
- 以上规则已用 chai.el 的 `chai--collect-highlights` 在 Emacs 中验证可无损还原（task002）。

## User Flows

### 划线
1. 用户在 Reader View 文章区用鼠标选中文字（选区必须完全在文章正文内；在文章区内松开鼠标才弹菜单）。第一版不支持纯键盘选区（Shift+方向键）。
2. 选区附近弹出浮动菜单：type 按钮列表（按 Options 顺序，按钮背景为该 type 颜色）、批注输入框、“自定义 type”输入框。
3. 点击 type 按钮（或在自定义输入框回车）→ 选区包成 `<mark>`，显示对应颜色；菜单关闭，选区清除。
4. 回退：Esc 或点菜单外部 → 关闭菜单，不做改动。
5. 有批注的高亮：批注以深色气泡一直浮在高亮最后一段的上方（带朝下的小三角，最宽 280px，可换行）；气泡所在的那一行会加高，留出放气泡的空间，不盖住上一行，其它行行距不变；气泡不响应鼠标，下面的文字照常可选。气泡是不含文字的显示元素，选区和导出都看不到它。

### 编辑已有高亮
1. 点击已有高亮 → 弹同一菜单，当前 type 处于选中态，批注框预填。
2. 点任一 type → 改 type（同时保存批注框里的内容）；改批注后回车 → 只更新批注，type 不变；批注清空后保存 → 去掉批注和气泡；点 “Remove highlight” → 去掉 `<mark>` 和气泡，文字和原有标记原样恢复。
3. 跨段高亮的所有片段一起修改或删除；气泡始终在最后一段。

### 导出
1. Org 菜单 → Copy / Save / Save (with images)。
2. 导出内容来自 Reader 当前文章 DOM；高亮按 chai 语法输出。
3. 无高亮时，Copy 的输出与 v1.5.0 一致。Save / Save (with images) 的正文与 Copy 同源（Reader 当前文章 DOM），不再由 background 重新提取；与 v1.5.0 在 Reader 中 Save 的输出可能不同（v1.5.0 是对 Reader 页面重跑 Defuddle，再做宽松的标题去重）。

### 退出
1. 有高亮且自上次导出后有改动时，退出 Reader View（按钮或 Esc）先弹确认。
2. 取消 → 留在 Reader View；确认 → 退出。
3. 退出（按钮、Esc、再次按快捷键或右键菜单）不刷新网页：Reader 淡出并下移，覆盖层移除，网页原样保留（滚动位置、表单、播放状态）。进入时 Reader 淡入并上移。系统开启“减少动态效果”时不做动画。
4. Reader 中文章链接在新标签页打开；`#…` 链接（脚注、目录）在 Reader 内滚动。Reader 里右键不提供 Copy / Save 菜单，用工具栏。

## Edge Cases

- 同一段落内跨 `<em>`/`<a>`/`<code>` 的选区：拆成多个 `<mark>` 片段，共享 `data-chai-id`，导出合并为一个链接。
- 跨段落（跨块级元素）选区：导出为 `#+BEGIN_CHAI` 块。
- 选区与已有高亮重叠：拒绝创建，菜单不弹出（第一版不做合并/嵌套）。
- 选区包含或位于图片、表格、代码块（`pre`）及其它媒体（`picture`、`svg`、`video`、`audio`、`iframe`、`canvas`）中：拒绝创建。行内 `<code>` 允许。
- 选区跨越列表项边界（从段落进入列表项，或跨两个列表项）：拒绝创建，否则导出的块会把列表拆开。同一列表项内允许。
- 选区为空或仅空白：不弹菜单。
- 选区先收紧到实际覆盖的非空白文字再检查（Chrome 三击选段时终点落在下一块开头）。
- 菜单弹出后页面滚动：菜单关闭。
- 链接文字被高亮：行内链接中丢弃内层链接、保留文字（org 链接不能嵌套）；`#+BEGIN_CHAI` 块中保留链接。

## Acceptance Criteria

- [ ] Options 页可增删改 type，刷新后保留；默认 4 个 type（key/idea/question/fact）。
- [ ] Reader View 选中文字后弹菜单，点 type 后出现对应颜色高亮。
- [ ] 点击高亮可改 type、改批注、删除。
- [ ] Copy 结果中行内高亮为 `[[chai:TYPE(:NOTE)][TEXT]]`，跨段落为 `#+BEGIN_CHAI` 块；在 Emacs 中 chai 正确识别 type 和 note。
- [ ] Save 与 Save (with images) 结果同样包含高亮，with images 的图片仍正常下载。
- [ ] 无高亮时三种导出与 v1.5.0 输出逐字一致。
- [ ] 有未导出改动时退出 Reader View 弹确认。
