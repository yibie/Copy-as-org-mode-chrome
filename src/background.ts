/*!
 * This file is derived from copy-selection-as-markdown by 0x6b
 * https://github.com/0x6b/copy-selection-as-markdown
 *
 * MIT License
 *
 * Copyright (c) 2021 ono ono (kuanyui)
 * Copyright (c) 2017-2019 0x6b
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { MyMsg, msgManager } from "./common";
import { exceptionSafeDecodeURI } from "./html2org/utilities";
import { CopyAsOrgModeOptions, objectAssignPerfectly, storageManager } from "./options";
import { Readability } from '@mozilla/readability';
import TurndownService from "./html2org/turndown";
import { html2org } from './html2org';


/** This can be modify */
const STORAGE: CopyAsOrgModeOptions = storageManager.getDefaultData()

// Storage
console.log('[background] first time to get config from storage')
storageManager.getData().then((obj) => {
  objectAssignPerfectly(STORAGE, obj)
})

storageManager.onDataChanged(async (changes) => {
  console.log('[background] storage changed!', changes)
  objectAssignPerfectly(STORAGE, await storageManager.getData())
})

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: "save-page-as-org",
        title: "Save Page as Org-Mode",
        contexts: ["page", "frame"],
        documentUrlPatterns: ["<all_urls>"],
      }
    );

    chrome.contextMenus.create(
      {
        id: "save-page-as-org-folder",
        title: "Save Page as Org-Mode (With Images)",
        contexts: ["page", "frame"],
        documentUrlPatterns: ["<all_urls>"],
      }
    );

    chrome.contextMenus.create({
      id: "copy-link-as-org-mode",
      title: "Copy Link as Org-Mode",
      contexts: ["link"],
      documentUrlPatterns: ["<all_urls>"],
    });

    chrome.contextMenus.create({
      id: "copy-selection-as-org-mode",
      title: "Copy Selection as Org-Mode",
      contexts: ["selection"],
      documentUrlPatterns: ["<all_urls>"],
    });

    chrome.contextMenus.create({
      id: "copy-current-page-url-as-org-mode",
      title: "Copy Page as Org-Mode Link",
      contexts: ["page"],
      documentUrlPatterns: ["<all_urls>"],
    });
  });
});

let lastTriggerMenuTimeStamp: number = Date.now()

// 添加一个辅助函数来等待标签页加载完成
async function waitForTabLoaded(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (tab.status === 'complete') {
        resolve();
      } else {
        chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
          if (updatedTabId === tabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      }
    });
  });
}

// 检查是否可以在页面上执行脚本
async function canExecuteScript(tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    // 检查 URL 是否是允许的
    const url = tab.url || '';
    return url.startsWith('http') || url.startsWith('https');
  } catch (err: unknown) {
    console.error('Error checking tab:', err);
    return false;
  }
}

// 修改处理函数
chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  if (!tab?.id) return;
  const tabId = tab.id;

  // 检查是否可以执行脚本
  if (!await canExecuteScript(tabId)) {
    showBgNotification('Error', 'Cannot execute script on this page');
    return;
  }

  if (info.menuItemId === "save-page-as-org") {
    try {
      await savePageAsOrg(tabId);
    } catch (err: unknown) {
      console.error('Failed to execute script:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showBgNotification('Error', `Failed to process page content: ${errorMessage}`);
    }
  } else if (info.menuItemId === "save-page-as-org-folder") {
    try {
      await savePageAsOrgFolder(tabId);
    } catch (err: unknown) {
      console.error('Failed to execute script:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showBgNotification('Error', `Failed to process page content: ${errorMessage}`);
    }
  } else if (info.menuItemId === "copy-current-page-url-as-org-mode") {
    try {
      // 获取当前页面信息
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || !tab.title) {
        throw new Error('Cannot get page information');
      }

      // 构建 org-mode 链接
      const orgLink = `[[${tab.url}][${tab.title}]]`;

      // 复制到剪贴板
      await bgCopyToClipboard(orgLink, `<a href="${tab.url}">${tab.title}</a>`);
    } catch (err) {
      console.error('Failed to copy page link:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showBgNotification('Error', `Failed to copy page link: ${errorMessage}`);
    }
  } else if (info.menuItemId === "copy-selection-as-org-mode") {
    try {
      // 先注入脚本
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["dist/copy.js"]
      });
      // 执行复制函数
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // @ts-ignore (main 会在 copy.js 中定义)
          return window.main();  // 直接调用 main 函数
        }
      });
    } catch (err) {
      console.error('Failed to copy selection:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showBgNotification('Error', `Failed to copy selection: ${errorMessage}`);
    }
  } else if (info.menuItemId === "copy-link-as-org-mode") {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["dist/copy-link.js"]
      });

      const linkInfo = info as chrome.contextMenus.OnClickData & {
        linkText: string;
        linkUrl: string;
      };

      if (!linkInfo.linkText || !linkInfo.linkUrl) {
        throw new TypeError('Missing link information');
      }

      const linkText = linkInfo.linkText.replace(/([\\`*_[\]<>])/g, "\\$1")
      let linkUrl = linkInfo.linkUrl

      console.log('Options ===>', STORAGE)
      if (STORAGE.decodeUri) {
        linkUrl = exceptionSafeDecodeURI(linkUrl)
      }
      bgCopyToClipboard(`[[${linkUrl}][${linkText}]]`, `<a href="${linkUrl}">${linkText}</a>`)
    } catch (err: unknown) {
      console.error('Failed to process link:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showBgNotification('Error', `Failed to copy link: ${errorMessage}`);
    }
  }
})

chrome.action.onClicked.addListener((tab) => {
  console.log('[DEBUG] browserAction.onclicked', tab)
  chrome.scripting.executeScript({
    target: { tabId: tab.id ?? -1 },
    files: ["dist/copy.js"]
  })
})


chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
  const message = msg as MyMsg;

  switch (message.type) {
    case 'showBgNotification': {
      showBgNotification(message.title, message.message);
      break;
    }
    case 'copyStringToClipboard': {
      console.log('listener: copy request', Date.now());
      // Return true to indicate we'll send a response asynchronously
      bgCopyToClipboard(message.org, message.html).then((success) => {
        sendResponse({ success });
      });
      return true; // Keep the message channel open for the async response
    }
  }
});

function getDigest(str: string, maxLen: number): string {
  let final = str.substr(0, maxLen)
  if (str.length > maxLen) {
    final += '...'
  }
  return final
}
function showBgNotification(title: string, message: string) {
  console.log('showBgNotification(), method =', STORAGE.notificationMethod, Date.now(), title, message)
  if (STORAGE.notificationMethod === 'inPagePopup') {
    const safeTitle = title.replace(/[\n\r<>\\]/gi, '').replace(/["'`]/gi, "'")
    const safeMsg = message.replace(/[\n\r<>\\]/gi, '').replace(/["'`]/gi, "'")
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      for (const tab of tabs) {
        if (tab.id === undefined) { return }
        msgManager.sendToTab(tab.id, {
          type: 'showInPageNotification',
          title: title,
          message: getDigest(message, 100),
          duration: 800
        })
      }
    })
    return
  }
  if (STORAGE.notificationMethod === 'notificationApi') {
    console.log('showBgNotification...')
    chrome.notifications.create('default', {
      title: title,
      type: 'basic',
      iconUrl: chrome.runtime.getURL("img/icon.png"),
      message: getDigest(message, 80),
    }, (notificationId) => {
      setTimeout(() => {
        chrome.notifications.clear(notificationId);
      }, 800);
    })
    console.log('showBgNotification finished.')
  }
}

/** This function is for background script only */
async function bgCopyToClipboard(text: string, html?: string): Promise<boolean> {
  console.log('bgCopyToClipboard() start', Date.now(), 'text ===', text);

  if (!text) {
    console.warn('text is empty, skip.', text);
    showBgNotification('Oops...', 'Got nothing to copy...');
    return false;
  }

  try {
    // Get the active tab
    console.log('Getting active tab...');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('No active tab found');
    console.log('Active tab found:', tab.id);

    // Execute copy in the active tab
    console.log('Executing copy script...');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (textToCopy: string) => {
        return new Promise((resolve) => {
          console.log('Creating textarea...');
          const textarea = document.createElement('textarea');
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          textarea.value = textToCopy;
          document.body.appendChild(textarea);

          try {
            console.log('Selecting text...');
            textarea.select();
            console.log('Executing copy command...');
            const success = document.execCommand('copy');
            console.log('Copy command result:', success);
            resolve(success);
          } catch (err) {
            console.error('Copy failed:', err);
            resolve(false);
          } finally {
            document.body.removeChild(textarea);
          }
        });
      },
      args: [text]
    });

    console.log('Script execution results:', results);
    const success = results && results[0] && results[0].result === true;
    if (success) {
      console.log('Copy successful, showing notification...');
      showBgNotification('Org-Mode Text Copied Successfully!', text);
      return true;
    } else {
      throw new Error('Copy operation failed');
    }
  } catch (err) {
    console.error('Failed to copy text:', err);
    showBgNotification('Copy Failed', 'Failed to copy text to clipboard');
    return false;
  }
}

// 将 Turndown 相关代码移到一个单独的内容脚本中
async function savePageAsOrg(tabId: number) {
  try {
    // 先注入内容脚本
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['dist/content-script.js']
    });

    // 然后执行转换
    const extractedImages: { src: string, filename: string }[] = [];
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (options) => {
        try {
          // 获取页面内容
          const article = document.querySelector('article') || document.body;
          const content = article.innerHTML;

          // 创建一个临时的 div 来解析内容
          const div = document.createElement('div');
          div.innerHTML = content;

          // 使用注入的转换器
          // @ts-ignore
          // @ts-ignore
          const conversionOptions = {
            ...options,
            extractedImages: options.saveImages ? [] : undefined
          };

          const orgContent = window.html2org.convert(div.innerHTML, conversionOptions);

          return {
            title: document.title,
            content: orgContent,
            extractedImages: conversionOptions.extractedImages || [],
            url: document.URL,
            author: document.querySelector('meta[name="author"]')?.getAttribute('content') || '',
            description: document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
          };
        } catch (err) {
          console.error('Error in content script:', err);
          return null;
        }
      },
      args: [{
        unorderedListMarker: STORAGE.ulBulletChar,
        orderedListMarker: STORAGE.olBulletChar,
        codeDelimiter: STORAGE.codeChar,
        listIndentSize: STORAGE.listIndentSize,
        codeBlockStyle: STORAGE.codeBlockStyle,
        decodeUri: STORAGE.decodeUri,
        squareBracketsInLink: STORAGE.squareBracketsInLink,
        ruby: STORAGE.rubyHandleMethod,
        saveImages: STORAGE.saveImages,
        imagePathPrefix: STORAGE.imagePathPrefix,
        imageSaveSubfolder: STORAGE.imageSaveSubfolder,
        extractedImages: [] // Initial empty array, will be populated by side-effect in commonmark-rules if we could... 
        // WAIT, we can't pass reference across context. 
        // We need to rely on the return value from the function execution in the context.
        // The `extractedImages` passed here in `args` is serialized and passed to the page context.
        // The page context code modifies IT.
        // We need to make sure the modified array is returned back.
      }]
    });

    if (!results?.[0]?.result) {
      throw new Error('Failed to get page content');
    }

    const { title, content, url, author, description, extractedImages: resultImages } = results[0].result as {
      title: string,
      content: string,
      url: string,
      author: string,
      description: string,
      extractedImages: { src: string, filename: string }[]
    };

    // 构建最终的 org 文件内容
    let finalContent = `#+TITLE: ${title}\n`;
    finalContent += `#+DATE: ${new Date().toISOString()}\n`;
    if (author) finalContent += `#+AUTHOR: ${author}\n`;
    finalContent += `#+SOURCE_URL: ${url}\n\n`;

    if (description) {
      finalContent += `* Abstract\n\n${description}\n\n`;
    }

    finalContent += `* Content\n\n${content}`;

    // 使用 data URL
    const dataUrl = 'data:text/org;charset=utf-8;base64,' + btoa(unescape(encodeURIComponent(finalContent)));

    const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').trim();
    // const folderName = safeTitle; // Removed folder wrapper

    await chrome.downloads.download({
      url: dataUrl,
      filename: `${safeTitle}.org`,
      saveAs: true // Let user pick location
    });

    if (STORAGE.saveImages && resultImages && resultImages.length > 0) {
      const imageSubfolder = STORAGE.imageSaveSubfolder || 'images';
      for (const img of resultImages) {
        try {
          // Determine absolute URL if src is relative
          const absoluteUrl = new URL(img.src, url).href;

          await chrome.downloads.download({
            url: absoluteUrl,
            filename: `${imageSubfolder}/${img.filename}`,
            saveAs: false
          });
        } catch (e) {
          console.error(`Failed to download image ${img.src}`, e);
        }
      }
    }

  } catch (err: unknown) {
    console.error('Failed to save page:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    showBgNotification('Error', `Failed to save page: ${errorMessage}`);
  }
}

async function savePageAsOrgFolder(tabId: number) {
  try {
    // 1. Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['dist/content-script.js']
    });

    // 2. Convert and Extract URLs
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (options) => {
        try {
          const article = document.querySelector('article') || document.body;
          const div = document.createElement('div');
          div.innerHTML = article.innerHTML;

          // @ts-ignore
          const conversionOptions = {
            ...options,
            extractedImages: [] // Enable extraction
          };

          const orgContent = window.html2org.convert(div.innerHTML, conversionOptions);

          return {
            title: document.title,
            content: orgContent,
            extractedImages: conversionOptions.extractedImages || [],
            url: document.URL,
          };
        } catch (err) {
          console.error('Error in content script:', err);
          return null;
        }
      },
      args: [{
        unorderedListMarker: STORAGE.ulBulletChar,
        orderedListMarker: STORAGE.olBulletChar,
        codeDelimiter: STORAGE.codeChar,
        listIndentSize: STORAGE.listIndentSize,
        codeBlockStyle: STORAGE.codeBlockStyle,
        decodeUri: STORAGE.decodeUri,
        squareBracketsInLink: STORAGE.squareBracketsInLink,
        ruby: STORAGE.rubyHandleMethod,
        saveImages: true, // Always save images for this mode
        imagePathPrefix: STORAGE.imagePathPrefix,
        // Note: For this mode, imagePathPrefix might usually be ./images/ but user still decides linking style. 
        // The physical folder structure is fixed to ./images/ by save_folder.ts logic unless we pass it.
        // Let's assume standard behavior: images in ./images, links use prefix.
      }]
    });

    if (!results?.[0]?.result) throw new Error('Failed to get page content');

    const result = results[0].result as any;
    console.log('[savePageAsOrgFolder] Extracted images:', result.extractedImages);

    // Convert relative URLs to absolute using the page URL
    const imageUrls = result.extractedImages.map((img: any) => {
      try {
        return new URL(img.src, result.url).href;
      } catch (e) {
        return img.src; // fallback to original if URL parsing fails
      }
    });

    // 3. Fetch Image Blobs (in content script context)
    let imagesData: { filename: string, base64: string }[] = [];
    if (imageUrls.length > 0) {
      showBgNotification('Processing', `Downloading ${imageUrls.length} images...`);
      const imageResults = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: async (urls) => {
          if (window.html2org.fetchImagesAsBase64) {
            return await window.html2org.fetchImagesAsBase64(urls);
          }
          return [];
        },
        args: [imageUrls]
      });

      if (imageResults?.[0]?.result) {
        const fetchedData = imageResults[0].result as { filename: string, base64: string }[];
        console.log('[savePageAsOrgFolder] Fetched image data:', fetchedData);

        // Use filenames from extractedImages (matches Org file links), 
        // but base64 from fetchedData
        imagesData = result.extractedImages.map((img: any, index: number) => ({
          filename: img.filename, // Use the filename that matches the Org link
          base64: fetchedData[index]?.base64 || ''
        })).filter((img: any) => img.base64); // Filter out failed fetches

        console.log('[savePageAsOrgFolder] Final image data with correct filenames:', imagesData);
      }
    }

    // 4. Store Data
    const dataId = `save_folder_${Date.now()}`;
    await chrome.storage.local.set({
      [dataId]: {
        title: result.title,
        content: result.content,
        images: imagesData
      }
    });

    // 5. Open Helper Page
    chrome.tabs.create({ url: `dist/save_folder.html?id=${dataId}` });

  } catch (err: unknown) {
    console.error('Failed to save page:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    showBgNotification('Error', `Failed to save page: ${errorMessage}`);
  }
}


function createDebounceFn(fn: () => any, debounceDurationMs: number): () => void {
  let timeoutId: number
  return () => {
    window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      fn()
    }, debounceDurationMs)
  }
}

