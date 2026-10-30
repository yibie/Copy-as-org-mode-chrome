# issue003 [ ] Save (with images) 不记住上次保存的文件夹

## Summary
保存带图片的网页时，每次都要从头选文件夹；不带图片的 Save 能记住上次的位置。

## Environment
copy-as-org-mode 1.6.0，Chrome，保存到文件夹（File System Access API）。

## Repro
1. 对任意带图片的网页执行 Save (with images)，选择文件夹 A
2. 再对另一个网页执行 Save (with images)
3. 文件夹选择器没有打开在 A

## Expected vs Actual
- Expected：选择器打开在上次的文件夹 A
- Actual：选择器打开在浏览器默认位置

## Investigation
- 不带图片的 Save 走 `chrome.downloads.download({ saveAs: true })`，由 Chrome 下载设置记住目录。
- 带图片的 Save 打开 `save_folder.html`，调用无参数的 `window.showDirectoryPicker()`：没有 `id`、没有 `startIn`，选中的 `dirHandle` 也没有保存，标签页关闭后丢失。

## Root Cause
选中的文件夹没有持久化，也没有作为 `startIn` 传给选择器。

## Fix
`src/save_folder/save_folder.ts`：把 `dirHandle` 存进 IndexedDB，下次以 `startIn` 传给 `showDirectoryPicker`，并加 `id: 'caom-save'`；上次的文件夹不可用时去掉 `startIn` 重试。关联 task015。

## Verification
- `npm run build` 通过，`npm test` 72 pass。
- 待用户在浏览器中确认：连续两次 Save (with images)，第二次选择器打开在上次的文件夹。

## User Confirmation
待确认。

## Resolved At/By/Commit
—
