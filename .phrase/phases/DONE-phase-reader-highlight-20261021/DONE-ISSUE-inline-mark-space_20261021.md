# issue001 [ ] 行内标记后面多出一个空格

## Summary
html2org 转换 `<em>`、`<strong>` 等行内标记时，如果后面紧跟以空格开头的文本，输出里会出现两个空格。

## Environment
copy-as-org-mode v1.5.0（commit 96a1560），`src/html2org/utilities.ts` 的 `wrapInlineMarkWithSpace`。

## Repro
`html2org.convert('<p>one <em>two</em> three</p>', {})`

## Expected vs Actual
- Expected：`one /two/ three`
- Actual：`one /two/  three`

## Investigation
`wrapInlineMarkWithSpace` 判断右侧是否要补空格时，检查的是 `next.textContent.endsWith(' ')`，应为 `startsWith(' ')`（`src/html2org/utilities.ts:120`）。左侧检查 `previous.textContent.endsWith(' ')` 是正确的。

## Fix
未修复。在 task002 中发现，不属于该任务范围。修复会改变所有现有用户的输出，需要单独的 task 并补回归测试；修复后同时更新 `test/chai.test.ts` 中两处注明 issue001 的期望值。

## Verification
—

## User Confirmation
—

## Resolved At/By/Commit
—
