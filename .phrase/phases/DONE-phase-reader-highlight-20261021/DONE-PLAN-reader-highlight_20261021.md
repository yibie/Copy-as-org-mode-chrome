# Plan: Reader View 高亮 + chai 格式导出

依据：`DONE-SPEC-reader-highlight_20261021.md`
目标版本：v1.6.0

## Milestones

1. **M1 导出管线**：html2org 支持 `mark[data-chai-type]` → chai 语法（行内 + 块），有最小测试入口。（task001–task003）
2. **M2 导出源切换**：Reader 的 Copy / Save / Save (with images) 改为基于 Reader 当前 DOM。（task004–task005）
3. **M3 type 配置**：Options 页 chai type 表。（task006）
4. **M4 交互**：选区浮动菜单、编辑已有高亮、退出确认。（task007–task009）
5. **M5 发布**：README、版本号、全量回归。（task010）
6. **M6 Reader 覆盖层**：Reader 改为扩展 iframe 覆盖层，原网页不改动，退出不刷新，进出有动画。（task014，见 `DONE-ADR-reader-iframe-overlay_20261024.md`）

先做 M1/M2：导出是本期风险最大的部分，交互可以在管线验证后再接上。

## Scope

- 改动：`src/html2org/`（新规则）、`src/reader/reader.ts`、`src/reader/reader.css`、`src/background.ts`（Save 消息）、`src/options.ts` + `src/options_ui/`。
- 不改：普通页面的 Copy / Save 流程、Defuddle 提取逻辑。

## Priorities

P0：M1、M2、M3、M4 中的划线与导出。
P1：编辑已有高亮、退出确认。
P2：README 截图。

## Risks & Dependencies

- task014：网页的 CSP `frame-src` 是否会拦扩展 iframe 未实测（Chromium 对扩展 scheme 有 CSP 豁免，按此设计）；加载失败时 5 秒超时提示。需在 github.com 等严格 CSP 的网站上手动验证。

- Save 路径目前在 background 中重新注入脚本、重新提取；改为 reader 提供内容后，with images 的图片下载流程依赖 HTML 中的图片 URL，需回归。
- `<mark>` 包裹跨元素选区可能破坏 Defuddle 输出的嵌套结构；用 `Range` 按文本节点切分包裹，不跨块级元素包裹。
- 仓库无测试框架：task001 补最小测试入口（倾向 Node 内置 `node --test` + 现有 TS 编译链路），记录于此。
- chai 转义行为需在 Emacs 中实测（依赖本机 chai 源码）。

## Rollback

功能集中在 reader 与 html2org 新规则；无高亮时输出不变。回滚即 revert 本 phase 提交。
