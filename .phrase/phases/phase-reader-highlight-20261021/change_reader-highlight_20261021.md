# Changes: phase-reader-highlight-20261021

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
