export function inPageNotify(title: string, msg: string) {
    console.log('inPageNotify', title, msg)
    const oriEl = document.getElementById('copyAsOrgModeNotify')
    if (oriEl) {
        oriEl.remove()
    }
    const rootEl = document.createElement('div')
    rootEl.id = 'copyAsOrgModeNotify'
    rootEl.style.cssText = `
        display: block;
        position: fixed;
        z-index: 99999999999999999;
        top: 16px;
        right: 16px;
        width: 500px;
        max-height: 120px;
        padding: 8px 12px;
        background-color: rgba(195, 240, 225, 0.95);
        color: #2d4f28;
        border: 1px solid #2d4f28;
        border-radius: 4px;
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        font-family: system-ui, -apple-system, sans-serif;
    `
    rootEl.title = 'Click to close'

    function close() { rootEl.remove() }
    rootEl.onclick = close
    window.setTimeout(close, 1500)

    // 标题栏
    const titleEl = document.createElement('div')
    titleEl.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 4px;
    `

    // 图标
    const imgEl = document.createElement('img')
    imgEl.src = chrome.runtime.getURL('img/icon.png')
    imgEl.width = 16
    imgEl.height = 16
    titleEl.prepend(imgEl)
    titleEl.appendChild(document.createTextNode(title))

    // 内容
    const contentEl = document.createElement('div')
    contentEl.style.cssText = `
        font-family: ui-monospace, monospace;
        font-size: 14px;
        line-height: 1.4;
        white-space: pre-wrap;
        overflow-wrap: break-word;
    `
    contentEl.innerText = msg

    rootEl.appendChild(titleEl)
    rootEl.appendChild(contentEl)
    document.body.appendChild(rootEl)
}