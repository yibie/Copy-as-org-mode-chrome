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
    console.log('[savePageAsOrg] Injecting scripts...');
    // 先注入内容脚本
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['dist/defuddle.js', 'dist/content-script.js']
    });
    console.log('[savePageAsOrg] Scripts injected.');

    // 然后执行转换
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (options) => {
        try {
          console.log('[content-script] Starting conversion...');
          // Use Defuddle to extract content
          let content = "";
          let title = document.title;
          let author = document.querySelector('meta[name="author"]')?.getAttribute('content') || '';
          let description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
          let site = '';
          let domain = window.location.hostname;
          let published = '';
          let keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
          
          if (window.Defuddle) {
              console.log('[content-script] Defuddle found, attempting parse...');
              try {
                  const defuddle = new window.Defuddle(document);
                  const article = defuddle.parse();
                  if (article) {
                      console.log('[content-script] Defuddle success:', article);
                      if (article.content) content = article.content;
                      if (article.title) title = article.title;
                      if (article.author) author = article.author;
                      if (article.description) description = article.description;
                      if (article.site) site = article.site;
                      if (article.domain) domain = article.domain;
                      if (article.published) published = article.published;
                      
                      if (article.metaTags) {
                          const meta: any = article.metaTags;
                          const tags = meta.keywords || meta.news_keywords || meta.tags;
                          if (tags) {
                              keywords = Array.isArray(tags) ? tags.join(',') : tags;
                          }
                      }
                  } else {
                      console.warn('[content-script] Defuddle returned null article');
                  }
              } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  console.error("[content-script] Defuddle failed:", e);
              }
          } else {
              console.warn('[content-script] window.Defuddle is undefined!');
          }

          if (!content) {
              console.log('[content-script] Fallback to simple extraction');
              // Fallback to simple selection
              const article = document.querySelector('article') || document.body;
              content = article.innerHTML;
          }

          // 创建一个临时的 div 来解析内容
          const div = document.createElement('div');
          div.innerHTML = content;

          // Aggressively remove title-like headers from the beginning
          const titleText = title.trim().toLowerCase();
          // Use live collection or loop carefully. Let's just check the first element repeatedly up to a limit.
          // Or strictly check first few children.
          let attempts = 0;
          while (div.firstElementChild && attempts < 3) {
              const el = div.firstElementChild;
              if (/^H[1-6]$/.test(el.tagName) || el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'HEADER') {
                   const elText = el.textContent?.trim().toLowerCase() || '';
                   if (elText.length > 5 && (titleText.includes(elText) || elText.includes(titleText))) {
                       el.remove();
                       attempts++;
                       continue; // Check the next first element
                   }
              }
              break; // Stop if the first element doesn't match
          }

          // 使用注入的转换器
          // @ts-ignore
          // @ts-ignore
          const conversionOptions = {
            ...options,
            saveImages: false, // Force disable images for single file mode
            extractedImages: undefined
          };

          let orgContent = "";
          try {
              console.log('[content-script] Converting to Org...');
              orgContent = window.html2org.convert(div.innerHTML, conversionOptions);
              console.log('[content-script] Conversion success.');
          } catch (e) {
              console.error('[content-script] Conversion failed:', e);
              // If Defuddle content failed, try fallback to raw content
              console.log('[content-script] Retrying with raw body content...');
              const rawArticle = document.querySelector('article') || document.body;
              div.innerHTML = rawArticle.innerHTML;
              orgContent = window.html2org.convert(div.innerHTML, conversionOptions);
          }

          return {
            title,
            content: orgContent,
            extractedImages: [],
            url: document.URL,
            author,
            description,
            site,
            domain,
            published,
            keywords
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
        saveImages: false, // Force false here too
        imagePathPrefix: STORAGE.imagePathPrefix,
        imageSaveSubfolder: STORAGE.imageSaveSubfolder,
        extractedImages: [] 
      }]
    });

    if (!results?.[0]?.result) {
      throw new Error('Failed to get page content');
    }

    const { 
        title, content, url, author, description, 
        site, domain, published, keywords,
        extractedImages: resultImages 
    } = results[0].result as {
      title: string,
      content: string,
      url: string,
      author: string,
      description: string,
      site: string,
      domain: string,
      published: string,
      keywords: string,
      extractedImages: { src: string, filename: string }[]
    };

    // 构建最终的 org 文件内容
    let finalContent = `#+TITLE: ${title}\n`;
    finalContent += `#+DATE: ${new Date().toISOString()}\n`;
    if (author) finalContent += `#+AUTHOR: ${author}\n`;
    finalContent += `#+SOURCE_URL: ${url}\n`;

    let keywordList: string[] = [];
    if (keywords) {
        keywordList = keywords.split(/,\s*/).filter(k => k.trim());
        if (keywordList.length > 0) {
             finalContent += `#+KEYWORDS: ${keywordList.join(', ')}\n`;
        }
    }

    finalContent += `\n${content}`;

    // 使用 data URL
    const dataUrl = 'data:text/org;charset=utf-8;base64,' + btoa(unescape(encodeURIComponent(finalContent)));

    const sanitize = (s: string) => s.replace(/[<>:"/\\|?*#\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim();
    const cleanComponent = (s: string) => sanitize(s).replace(/__/g, ' ').replace(/==/g, ' ').trim();

    const safeTitle = cleanComponent(title);
    const safeAuthor = author ? cleanComponent(author) : '';
    const safeKeywords = keywordList.map(cleanComponent).slice(0, 5).join('_');

    let filename = '';
    if (safeAuthor) {
        filename += `${safeAuthor}__`;
    }
    filename += safeTitle;
    if (safeKeywords) {
        filename += `==${safeKeywords}`;
    }
    filename += `.org`;

    if (filename === '.org') filename = 'captured_content.org';

    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true // Let user pick location
    });

    // Images download block removed

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
      files: ['dist/defuddle.js', 'dist/content-script.js']
    });

    // 2. Convert and Extract URLs
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (options) => {
        try {
          // Use Defuddle to extract content
          let content = "";
          let title = document.title;
          let author = document.querySelector('meta[name="author"]')?.getAttribute('content') || '';
          let description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
          let site = '';
          let domain = window.location.hostname;
          let published = '';
          let keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
          
          if (window.Defuddle) {
              console.log('[content-script] Defuddle found, attempting parse...');
              try {
                  const defuddle = new window.Defuddle(document);
                  const article = defuddle.parse();
                  if (article) {
                      console.log('[content-script] Defuddle success:', article);
                      if (article.content) content = article.content;
                      if (article.title) title = article.title;
                      if (article.author) author = article.author;
                      if (article.description) description = article.description;
                      if (article.site) site = article.site;
                      if (article.domain) domain = article.domain;
                      if (article.published) published = article.published;
                      
                      if (article.metaTags) {
                          const meta: any = article.metaTags;
                          const tags = meta.keywords || meta.news_keywords || meta.tags;
                          if (tags) {
                              keywords = Array.isArray(tags) ? tags.join(',') : tags;
                          }
                      }
                  } else {
                      console.warn('[content-script] Defuddle returned null article');
                  }
              } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  console.error("[content-script] Defuddle failed:", e);
              }
          }

          if (!content) {
             const article = document.querySelector('article') || document.body;
             content = article.innerHTML;
          }

          const div = document.createElement('div');
          div.innerHTML = content;

          // Aggressively remove title-like headers from the beginning
          const titleText = title.trim().toLowerCase();
          let attempts = 0;
          while (div.firstElementChild && attempts < 3) {
              const el = div.firstElementChild;
              if (/^H[1-6]$/.test(el.tagName) || el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'HEADER') {
                   const elText = el.textContent?.trim().toLowerCase() || '';
                   if (elText.length > 5 && (titleText.includes(elText) || elText.includes(titleText))) {
                       el.remove();
                       attempts++;
                       continue;
                   }
              }
              break;
          }

          // @ts-ignore
          const conversionOptions = {
            ...options,
            extractedImages: [] // Enable extraction
          };

          let orgContent = "";
          try {
              orgContent = window.html2org.convert(div.innerHTML, conversionOptions);
          } catch (e) {
              console.error('[content-script] Conversion failed:', e);
              const rawArticle = document.querySelector('article') || document.body;
              div.innerHTML = rawArticle.innerHTML;
              orgContent = window.html2org.convert(div.innerHTML, conversionOptions);
          }

          return {
            title,
            content: orgContent,
            extractedImages: conversionOptions.extractedImages || [],
            url: document.URL,
            author,
            description,
            site,
            domain,
            published,
            keywords
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
      }]
    });

    if (!results?.[0]?.result) throw new Error('Failed to get page content');

    const result = results[0].result as {
      title: string,
      content: string,
      url: string,
      author: string,
      description: string,
      site: string,
      domain: string,
      published: string,
      keywords: string,
      extractedImages: { src: string, filename: string }[]
    };
    
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
      // showBgNotification('Processing', `Downloading ${imageUrls.length} images...`); // Removed to avoid confusion
      try {
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

            imagesData = result.extractedImages.map((img: any, index: number) => ({
              filename: img.filename,
              base64: fetchedData[index]?.base64 || ''
            })).filter((img: any) => img.base64);

            console.log('[savePageAsOrgFolder] Final image data with correct filenames:', imagesData);
          }
      } catch (e) {
          console.error("Failed to fetch images", e);
          showBgNotification('Warning', 'Failed to download images. Saving text only.');
          imagesData = [];
      }
    }

    // 4. Prepare Metadata and Filename
    let finalContent = `#+TITLE: ${result.title}\n`;
    finalContent += `#+DATE: ${new Date().toISOString()}\n`;
    if (result.author) finalContent += `#+AUTHOR: ${result.author}\n`;
    finalContent += `#+SOURCE_URL: ${result.url}\n`;

    let keywordList: string[] = [];
    if (result.keywords) {
        keywordList = result.keywords.split(/,\s*/).filter(k => k.trim());
        if (keywordList.length > 0) {
             finalContent += `#+KEYWORDS: ${keywordList.join(', ')}\n`;
        }
    }

    finalContent += `\n${result.content}`;

    const sanitize = (s: string) => s.replace(/[<>:"/\\|?*#\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim();
    const cleanComponent = (s: string) => sanitize(s).replace(/__/g, ' ').replace(/==/g, ' ').trim();

    const safeTitle = cleanComponent(result.title);
    const safeAuthor = result.author ? cleanComponent(result.author) : '';
    const safeKeywords = keywordList.map(cleanComponent).slice(0, 5).join('_');

    let filename = '';
    if (safeAuthor) {
        filename += `${safeAuthor}__`;
    }
    filename += safeTitle;
    if (safeKeywords) {
        filename += `==${safeKeywords}`;
    }
    filename += `.org`;

    if (filename === '.org') filename = 'captured_content.org';

    // 5. Store Data
    const dataId = `save_folder_${Date.now()}`;
    const storageData = {
        title: result.title,
        filename: filename,
        content: finalContent,
        images: imagesData
    };

    try {
        await chrome.storage.local.set({ [dataId]: storageData });
        // 6. Open Helper Page
        chrome.tabs.create({ url: `dist/save_folder.html?id=${dataId}` });
    } catch (e: any) {
        console.error("Storage set failed", e);
        showBgNotification('Error', `Failed to prepare data (likely too large): ${e.message}`);
    }

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

