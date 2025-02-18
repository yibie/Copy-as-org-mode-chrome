import { Readability } from '@mozilla/readability';

// 先声明 Readability 类型
type ReadabilityType = typeof Readability;

// 扩展 globalThis 接口
declare global {
    interface Window {
        Readability: ReadabilityType;
    }
    interface ServiceWorkerGlobalScope {
        Readability: ReadabilityType;
    }
}

// 将 Readability 暴露到全局
if (typeof window !== 'undefined') {
    (window as any).Readability = Readability;
} else {
    // Service Worker 环境
    (self as any).Readability = Readability;
}

export { Readability }; 