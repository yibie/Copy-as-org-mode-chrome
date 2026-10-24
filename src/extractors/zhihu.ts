/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Site extractor for Zhihu column articles (zhuanlan.zhihu.com/p/ID).
 *
 * Generic extraction keeps the page chrome ("N 人赞同了该文章", "发布于 …",
 * "赞同 N") and Zhihu's rewritten links. This takes only the article body and:
 * - unwraps the auto-inserted search links (a.RichContent-EntityWord to
 *   zhida.zhihu.com, with a long token and a star icon) back into plain text;
 * - resolves link.zhihu.com/?target=… redirects to the real URL;
 * - drops the hidden "http://" parts Zhihu splits link text into;
 * - uses the full-size image (data-original) instead of the 1440w thumbnail.
 */

import type { SiteExtraction } from './index'

export const ZHIHU_PATTERNS = [/^https?:\/\/zhuanlan\.zhihu\.com\/p\/\d+/]

const text = (el: Element | null) => (el?.textContent ?? '').replace(/[​-‏﻿]/g, '').trim()

export function cleanZhihuBody(body: Element): void {
    // Search links end in a star icon (svg.ZDI); keep only the word
    body.querySelectorAll('a.RichContent-EntityWord svg').forEach(svg => svg.remove())
    body.querySelectorAll('a.RichContent-EntityWord').forEach(a => a.replaceWith(...Array.from(a.childNodes)))
    body.querySelectorAll<HTMLAnchorElement>('a[href*="link.zhihu.com/?target="]').forEach(a => {
        const target = new URL(a.href, 'https://link.zhihu.com').searchParams.get('target')
        if (target) { a.setAttribute('href', target) }
    })
    body.querySelectorAll('a span.invisible').forEach(s => s.remove())
    body.querySelectorAll('a span.visible, a span.ellipsis').forEach(s => s.replaceWith(...Array.from(s.childNodes)))
    body.querySelectorAll('img[data-original]').forEach(img => img.setAttribute('src', img.getAttribute('data-original')!))
    body.querySelectorAll('.RichText-ConditionalImagePortal').forEach(d => d.replaceWith(...Array.from(d.childNodes)))
    body.querySelectorAll('p.ztext-empty-paragraph').forEach(p => p.remove())
}

export function extractZhihu(doc: Document): SiteExtraction | null {
    const rich = doc.querySelector('.Post-RichText')
    if (!rich) { return null }
    const body = rich.cloneNode(true) as Element
    cleanZhihuBody(body)
    const time = text(doc.querySelector('.ContentItem-time'))
    return {
        content: body.innerHTML,
        title: text(doc.querySelector('h1.Post-Title')),
        author: text(doc.querySelector('.AuthorInfo-name .UserLink-link')) || text(doc.querySelector('.AuthorInfo-name')),
        site: '知乎专栏',
        published: time.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '',
    }
}
