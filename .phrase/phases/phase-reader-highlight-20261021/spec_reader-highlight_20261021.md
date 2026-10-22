# Spec: Reader View 高亮 + chai 格式导出

来源：`pr-faq_reader-highlight_20261021.md`

## Summary

在 Reader View 中支持按 chai type 划线并附批注；Copy / Save 导出时，高亮按 chai 语法写入 org。type 列表在 Options 页由用户维护。

## Goals

- Reader View 内选中文字后弹浮动菜单，按 type 高亮，可选批注。
- 点击已有高亮可改 type、改批注、删除。
- Options 页维护 chai type 表（名字 + 颜色），默认 chai 的 12 个内置 type。
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

| type | 颜色（chai light 背景） |
|------|------|
| important | #FFE0B2 |
| idea | #B2DFDB |
| question | #BBDEFB |
| critical | #FFB74D |
| key | #FFE082 |
| core | #FFCCBC |
| detail | #DCEDC8 |
| example | #E3F2FD |
| hard | #EDE7F6 |
| block | #ECEFF1 |
| view | #F3E5F5 |
| outdated | #9E9E9E 前景 + 删除线 |

### 字段约束

- type 名：`[A-Za-z0-9_-]+`，Options 和自定义输入都校验，不合法时输入框标红并禁止提交。
- 批注：空白（含换行）折叠为单个空格并 trim，空批注省略。转义同 Org `org-link-escape`：`[`、`]` 前加 `\`，紧挨在括号前或位于末尾的 `\` 加倍。可以含 `:`。
- 原文：同 Org `org-link-make-string`：每个后面紧跟 `]` 的 `]` 后插入零宽空格（U+200B），末尾的 `]` 后也插入。chai 还原出的原文会带零宽空格。
- 原文首尾空白移到链接外。
- 高亮内的 `<a>` 只保留文字（org 链接不能嵌套）。
- 以上规则已用 chai.el 的 `chai--collect-highlights` 在 Emacs 中验证可无损还原（task002）。

## User Flows

### 划线
1. 用户在 Reader View 文章区选中文字（选区必须完全在文章正文内）。
2. 选区附近弹出浮动菜单：type 按钮列表（按 Options 顺序，按钮背景为该 type 颜色）、批注输入框、“自定义 type”输入框。
3. 点击 type 按钮（或在自定义输入框回车）→ 选区包成 `<mark>`，显示对应颜色；菜单关闭，选区清除。
4. 回退：Esc 或点菜单外部 → 关闭菜单，不做改动。

### 编辑已有高亮
1. 点击已有高亮 → 弹同一菜单，当前 type 处于选中态，批注框预填。
2. 点其他 type → 改 type；改批注后回车 → 更新批注；点“删除” → 去掉 `<mark>`，文字原样保留。

### 导出
1. Org 菜单 → Copy / Save / Save (with images)。
2. 导出内容来自 Reader 当前文章 DOM；高亮按 chai 语法输出。
3. 无高亮时输出与 v1.5.0 一致。

### 退出
1. 有高亮且自上次导出后有改动时，退出 Reader View（按钮或 Esc）先弹确认。
2. 取消 → 留在 Reader View；确认 → 照常刷新退出。

## Edge Cases

- 同一段落内跨 `<em>`/`<a>`/`<code>` 的选区：拆成多个 `<mark>` 片段，共享 `data-chai-id`，导出合并为一个链接。
- 跨段落（跨块级元素）选区：导出为 `#+BEGIN_CHAI` 块。
- 选区与已有高亮重叠：拒绝创建，菜单不弹出（第一版不做合并/嵌套）。
- 选区包含图片、表格、代码块：拒绝创建。
- 选区为空或仅空白：不弹菜单。
- 链接文字被高亮：org 不能在链接描述里嵌链接，只导出 chai 链接、丢弃原 URL 还是放弃高亮——task 中定，倾向丢弃内层链接并在批注为空时保留文本。

## Acceptance Criteria

- [ ] Options 页可增删改 type，刷新后保留；默认 12 个 type。
- [ ] Reader View 选中文字后弹菜单，点 type 后出现对应颜色高亮。
- [ ] 点击高亮可改 type、改批注、删除。
- [ ] Copy 结果中行内高亮为 `[[chai:TYPE(:NOTE)][TEXT]]`，跨段落为 `#+BEGIN_CHAI` 块；在 Emacs 中 chai 正确识别 type 和 note。
- [ ] Save 与 Save (with images) 结果同样包含高亮，with images 的图片仍正常下载。
- [ ] 无高亮时三种导出与 v1.5.0 输出逐字一致。
- [ ] 有未导出改动时退出 Reader View 弹确认。
