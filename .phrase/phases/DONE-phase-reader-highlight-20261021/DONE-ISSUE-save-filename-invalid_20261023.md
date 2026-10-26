# issue002 [ ] 保存知乎文章时报 `Name is not allowed`

## Summary
Save / Save (with images) 在部分页面失败，保存页显示 `Error: Failed to execute 'getFileHandle' on 'FileSystemDirectoryHandle': Name is not allowed.`

## Environment
copy-as-org-mode main（task007 工作区），Chrome，保存到文件夹（File System Access API）。

## Repro
1. 打开 https://zhuanlan.zhihu.com/p/2079219486700344366
2. Save as Org-Mode（Reader 内或右键均可）
3. 保存页选择文件夹 → 报错

## Expected vs Actual
- Expected：保存为 `腾讯技术工程__DeepSeek Harness背后的“心脏”：Cordis 到底是什么.org`
- Actual：`getFileHandle` 抛出 `Name is not allowed`

## Investigation
- 在页面上直接运行 Defuddle：正文、标题、作者都能取到，提取本身没有失败。
- 作者为 `腾讯技术工程` + U+200B（知乎页面自带的零宽空格）。文件名由作者拼成，U+200B 进入文件名。
- Chrome 拒绝含不可见格式字符（Unicode Cf 类）、首尾为 `.` 或空格等的文件名。`src/background.ts` 两处文件名清理只去掉 `<>:"/\|?*#` 和 C0 控制字符。
- 同时发现：图片文件名的扩展名取自 URL 最后一个 `.` 之后，URL 形如 `a.jpg/w=800` 时会带 `/`，单张图片保存失败（已被逐张 catch，只记日志）。

## Root Cause
文件名清理没有覆盖不可见格式字符。

## Fix
- 新增 `src/org-filename.ts`：`cleanMetaText`（去掉 Cc/Cf、U+2028/2029，合并空白）和 `orgFilename(title, author, keywords)`（沿用 `AUTHOR__TITLE==KW.org` 结构；去掉首部 `.`、`~` 和尾部 `.`、空格；超过 200 字节先丢关键词再按字符截断标题；空名用 `captured_content`；Windows 保留名前加 `_`）。
- `src/background.ts` 两条保存路径改用 `orgFilename`；`#+TITLE`、`#+AUTHOR`、`#+KEYWORDS` 也经过 `cleanMetaText`。
- `src/save_folder/save_folder.ts` 的兜底文件名改用 `orgFilename`。
- `src/html2org/commonmark-rules.ts`：图片扩展名先去掉查询串，只接受 `[a-z0-9]{1,5}`，否则用 `png`。
- 关联 task011。知乎正文噪音另由 task012 处理。

## Verification
- `test/org-filename.test.ts` 6 个用例，含 `腾讯技术工程​` → `腾讯技术工程__…`。
- 待用户在浏览器中确认：重新加载扩展后保存上述知乎文章成功。

## User Confirmation
待确认。

## Resolved At/By/Commit
—
