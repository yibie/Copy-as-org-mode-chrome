# issue005 [ ] 点击工具栏图标没有任何选项

## Summary
用户反馈：点击浏览器工具栏上的扩展图标后什么都不出现。应该弹出菜单，列出可用的操作。

## Environment
copy-as-org-mode 1.6.1，Chrome。

## Repro
1. 打开任意网页
2. 点击工具栏上的 Copy as Org-Mode 图标
3. 没有菜单，也没有复制

## Expected vs Actual
- Expected：弹出菜单，可选择 Copy Selection、Copy Page Link、Save、Save (with images)、Reader View、Options
- Actual：没有任何反应

## Investigation
- `manifest.json` 的 `action` 没有 `default_popup`。
- `src/background.ts` 的 `chrome.action.onClicked` 只注入 `dist/copy.js`，没有调用 `window.main()`；`copy.js` 本身也是内容脚本，已经在页面上，注入后没有任何效果。

## Root Cause
图标点击没有绑定任何可见的行为。

## Fix
新增工具栏弹出菜单 `src/popup/`，manifest 设 `action.default_popup`；background 把右键菜单、快捷键、弹出菜单统一到 `runPageAction`。关联 task017。

## Verification
- `npm run build` 通过，`npm test` 72 pass。
- 待用户在浏览器中手动确认（见 task017 的手动步骤）。

## User Confirmation
待确认。

## Resolved At/By/Commit
—
