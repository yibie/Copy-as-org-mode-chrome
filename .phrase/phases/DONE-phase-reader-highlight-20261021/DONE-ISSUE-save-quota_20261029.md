# issue004 [ ] Save (with images) 报 `kQuotaBytes quota exceeded`

## Summary
保存图片多的网页时，弹出通知 `Failed to prepare data (likely too large): Resource::kQuotaBytes quota exceeded`，保存页没有打开。

## Environment
copy-as-org-mode 1.6.0，Chrome。

## Repro
1. 对图片多（base64 合计接近 10 MB）的网页执行 Save (with images)
2. 弹出上述错误通知

## Expected vs Actual
- Expected：打开保存页
- Actual：`chrome.storage.local.set` 失败

## Investigation
- `savePageAsOrgFolder` 把正文和所有图片的 base64 写进 `chrome.storage.local`，再由 `save_folder.html` 读取。
- manifest 没有 `unlimitedStorage`，`chrome.storage.local` 上限 10 MB（`QUOTA_BYTES`）。
- 保存页只在保存成功后删除自己的条目；保存前关掉标签页时，条目一直留着，逐渐占满配额，之后较小的网页也可能失败。

## Root Cause
存储配额上限 10 MB，加上未清理的残留条目。

## Fix
manifest 加 `unlimitedStorage`；写入前清理超过 1 小时的 `save_folder_*`。关联 task016。

## Verification
- `npm run build` 通过，`npm test` 72 pass。
- 待用户在浏览器中确认：重新加载扩展后，对报错的网页再次 Save (with images) 成功。

## User Confirmation
待确认。

## Resolved At/By/Commit
—
