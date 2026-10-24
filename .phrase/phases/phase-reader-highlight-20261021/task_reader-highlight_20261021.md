# Tasks: Reader View 高亮 + chai 格式导出

依据：`spec_reader-highlight_20261021.md`、`plan_reader-highlight_20261021.md`

## M1 导出管线

- task001 [x] 补最小测试入口（`npm test`），能对 `html2org.convert` 做输入 HTML → 输出 org 的断言。验证：`npm test` 跑通一个现有行为的用例。影响：`package.json`、新增测试目录。
- task002 [x] html2org 新规则：`mark[data-chai-type]` → `[[chai:TYPE(:NOTE)][TEXT]]`；同 `data-chai-id` 的相邻片段合并；批注清洗；原文 `[[`/`]]` 转义（先在 Emacs 中用 chai 实测转义写法）。验证：单元测试覆盖无批注、有批注、批注含 `:`、跨 `<em>` 片段合并、原文含 `]]`；样例在 Emacs 中 chai 正确识别。影响：`src/html2org/`。
- task003 [x] html2org 新规则：跨块级元素的同 id 高亮 → `#+BEGIN_CHAI :type TYPE :note "NOTE"` 块。验证：单元测试覆盖两段落高亮、带批注、批注含引号；Emacs 中 chai 识别为块。影响：`src/html2org/`。

## M2 导出源切换

- task004 [x] Reader 的 Copy 改为转换 Reader 当前文章 DOM（而非 `article.contentHTML`），转换前去掉 reader 自身的 UI 节点。验证：无高亮时输出与 v1.5.0 逐字一致（对 3 个真实文章页对比）；手动加 `<mark>` 后 Copy 含 chai 链接。影响：`src/reader/reader.ts`。
- task005 [x] Save / Save (with images) 在 Reader View 中改为由 reader 提供 HTML/元数据给 background，不再重新提取。验证：两种 Save 在有/无高亮时输出正确，with images 图片正常下载；非 Reader 页面 Save 行为不变。影响：`src/reader/reader.ts`、`src/background.ts`。（2026-10-22：单元测试与构建通过；用户在浏览器中手动验证 Reader 中两种 Save 正常）

## M3 type 配置

- task006 [x] Options 页 chai type 表：默认 type 和颜色（2026-10-22 改为用户 chai 配置的 4 个，见 task007 change），可增删改、排序，type 名校验 `[A-Za-z0-9_-]+`，存 extension storage。验证：增删改后刷新保留；非法名字禁止保存。影响：`src/options.ts`、`src/options_ui/`。

## M4 交互

- task007 [x] 选区浮动菜单：type 按钮（按配置顺序、配置颜色）、批注框、自定义 type 输入；点击后按文本节点切分包裹 `<mark data-chai-id data-chai-type data-chai-note>`；拒绝空选区、重叠已有高亮、含图片/表格/代码块的选区；Esc/点外部关闭。验证：手动在 3 个真实文章页上划线，含跨 `<em>`、跨段落。影响：`src/reader/reader.ts`、`src/reader/reader.css`。
- task008 [ ] 点击已有高亮：同一菜单，改 type、改批注、删除（解包 `<mark>` 并 `normalize()`）。验证：手动操作后 Copy 结果对应变化。影响：`src/reader/reader.ts`。
- task009 [ ] 退出确认：有自上次导出以来的高亮改动时，退出（按钮/Esc）弹确认。验证：手动——无高亮直接退出；有改动弹确认；导出后再退出不弹。影响：`src/reader/reader.ts`。

## M5 发布

- task010 [ ] README 增加高亮说明；版本号升到 1.6.0（`package.json`、`manifest.json`）；按 spec Acceptance Criteria 全量回归。验证：逐条勾选 Acceptance Criteria。影响：`README*`、`package.json`、`manifest.json`。

## 插入任务（issue / 站点适配）

- task011 [x] 修 issue002：保存文件名去掉不可见格式字符、首尾 `.`/空格，限制 200 字节；`#+TITLE`/`#+AUTHOR`/`#+KEYWORDS` 同步清理；图片扩展名只接受字母数字。验证：`test/org-filename.test.ts`；手动保存 https://zhuanlan.zhihu.com/p/2079219486700344366 成功（待用户确认）。影响：`src/org-filename.ts`、`src/background.ts`、`src/save_folder/save_folder.ts`、`src/html2org/commonmark-rules.ts`。
- task012 [x] 知乎专栏文章站点提取：只取 `.Post-RichText`，去掉赞同数和发布信息，搜索链接还原为文字，`link.zhihu.com` 跳转还原，用原图。验证：`test/zhihu.test.ts`；在该知乎页面上运行构建后的 `dist/defuddle.js` 检查结果（已做）；用户在浏览器 Copy / Save（待确认）。影响：`src/extractors/`、`src/defuddle.ts`。
- task013 [x] Google AI Mode（`google.*/search?…udm=50`）站点提取：每轮对话输出为“问题标题 + 回答”，去掉引用按钮、免责声明和反馈表单、Shared 面板、状态提示、隐藏节点和 Google 的属性。验证：`test/google-ai-mode.test.ts`；在真实 AI Mode 页面上运行构建后的 `dist/defuddle.js`（已做，单轮）；多轮对话和 Reader 显示待用户确认。影响：`src/extractors/`。
