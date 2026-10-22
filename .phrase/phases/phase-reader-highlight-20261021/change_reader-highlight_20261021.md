# Changes: phase-reader-highlight-20261021

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
