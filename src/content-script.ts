import TurndownService from "./html2org/turndown";

// 创建全局转换函数
window.html2org = {
    convert: (html: string, options: any) => {
        const turndownService = new TurndownService(options);
        return turndownService.turndown(html);
    },
    fetchImagesAsBase64: async (imageUrls: string[]) => {
        const results = await Promise.all(imageUrls.map(async (url) => {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                return new Promise<{ filename: string, base64: string } | null>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = reader.result as string;
                        // Basic filename extraction, can be improved or passed from outside
                        let filename = url.split('/').pop()?.split(/[?#]/)[0] || 'image.png';
                        if (!filename.includes('.')) filename += '.png';

                        resolve({
                            filename: filename, // Note: The caller might overwrite this with better naming
                            base64: base64
                        });
                    };
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.error('Failed to fetch image', url, e);
                return null;
            }
        }));
        return results.filter((item): item is { filename: string, base64: string } => item !== null);
    }
};

