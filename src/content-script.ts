import TurndownService from "./html2org/turndown";

// 创建全局转换函数
window.html2org = {
    convert: (html: string, options: any) => {
        const turndownService = new TurndownService(options);
        return turndownService.turndown(html);
    }
};

// 声明全局类型
declare global {
    interface Window {
        html2org: {
            convert: (html: string, options: any) => string;
        }
    }
} 