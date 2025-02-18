import TurndownService from "./html2org/turndown";

// 导出转换函数到全局对象
const html2org = {
    convert: (html: string, options: any) => {
        const turndownService = new TurndownService(options);
        return turndownService.turndown(html);
    }
};

// 声明类型
declare global {
    interface Window {
        html2org: {
            convert: (html: string, options: any) => string;
        }
    }
}

// 在页面上下文中执行的代码
function injectHtml2Org() {
    window.html2org = html2org;
}

// 导出供 background script 使用
export { html2org, injectHtml2Org }; 