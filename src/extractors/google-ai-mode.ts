/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Site extractor for Google AI Mode conversations (google.*\/search?...udm=50).
 *
 * Generic extraction mixes every turn with Google's UI ("Shared", "0 files",
 * "Source preferences", account menu, feedback form) and keeps the hidden
 * copies of the answers. This takes each turn ([data-scope-id="turn"]) and
 * outputs the question as a heading followed by the answer, rebuilt from
 * Google's div soup into plain p / h3 / ul / ol:
 * - citation buttons, the disclaimer and feedback form, the shared-files
 *   panel, status messages and hidden nodes go;
 * - div[role=heading] becomes a real heading;
 * - Google's own <mark> emphasis is unwrapped (its <strong> stays);
 * - divs holding only inline content become paragraphs, others unwrap;
 * - Google's attributes (jsaction, data-*, classes) are dropped.
 */

import type { SiteExtraction } from './index'

export const GOOGLE_AI_MODE_PATTERNS = [/^https?:\/\/(www\.)?google\.[a-z.]+\/search\?(.*&)?udm=50(&|$)/]

const REMOVE = [
    'script', 'style', 'noscript', 'button', 'svg', 'img[src^="data:"]',
    '[role="dialog"]', '[role="button"]', '[aria-live]', '[aria-hidden="true"]',
    '[style*="display:none"]', '[style*="display: none"]',
    'h3[data-ignore-copy]', // "AI Mode reply for …", the turn's question; we add our own heading
    '.DHPVt', // inline citation chips
    '.DBd2Wb', // "AI can make mistakes" disclaimer and the feedback form
    '.ofHStc', // "Shared / 0 files / Show all" panel, hidden by Google's CSS
].join(',')

const KEEP_ATTRS = new Set(['href', 'src', 'alt', 'colspan', 'rowspan'])
const BLOCK = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'DD', 'DT', 'FIGURE', 'FIGCAPTION', 'FOOTER',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL',
])

const text = (el: Element | null) => (el?.textContent ?? '').replace(/[​-‏﻿]/g, '').replace(/\s+/g, ' ').trim()

function rename(el: Element, tag: string): Element {
    const out = el.ownerDocument.createElement(tag)
    out.append(...Array.from(el.childNodes))
    el.replaceWith(out)
    return out
}

const unwrap = (el: Element) => el.replaceWith(...Array.from(el.childNodes))

/** Turn one answer's Google markup into plain HTML, in place. */
export function cleanAiModeAnswer(root: Element): void {
    root.querySelectorAll(REMOVE).forEach(el => el.remove())
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
    const comments: Node[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { comments.push(n) }
    comments.forEach(c => c.parentNode?.removeChild(c))

    root.querySelectorAll('mark').forEach(unwrap)
    root.querySelectorAll('[role="heading"]').forEach(h => {
        const level = Math.min(6, Math.max(3, Number(h.getAttribute('aria-level')) || 3))
        rename(h, `h${level}`)
    })
    // Deepest divs first, so a div's children are settled before it is judged
    Array.from(root.querySelectorAll('div')).reverse().forEach(div => {
        const hasBlock = Array.from(div.children).some(c => BLOCK.has(c.tagName))
        if (hasBlock || div.parentElement?.tagName === 'P' || div.closest('li, h1, h2, h3, h4, h5, h6, td, th')) {
            unwrap(div)
        } else {
            rename(div, 'p')
        }
    })
    root.querySelectorAll('span').forEach(unwrap)
    root.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(a => { if (!KEEP_ATTRS.has(a.name)) { el.removeAttribute(a.name) } })
    })
    root.querySelectorAll('p, li, h3, h4, h5, h6').forEach(el => {
        if (text(el) === '' && !el.querySelector('img')) { el.remove() }
    })
}

/** The question of a turn: its hidden "AI Mode reply for …" heading, without that prefix. */
function turnQuestion(turn: Element): string {
    return text(turn.querySelector('h3[data-ignore-copy]')).replace(/^AI Mode reply for\s*/i, '')
}

export function extractGoogleAiMode(doc: Document): SiteExtraction | null {
    const turns = Array.from(doc.querySelectorAll('[data-scope-id="turn"]'))
    if (turns.length === 0) { return null }
    const out = doc.createElement('div')
    turns.forEach(turn => {
        const answer = turn.querySelector('[data-subtree="aimc"]')
        if (!answer) { return }
        const question = turnQuestion(turn)
        if (question) {
            const h = doc.createElement('h2')
            h.textContent = question
            out.appendChild(h)
        }
        const body = answer.cloneNode(true) as Element
        cleanAiModeAnswer(body)
        out.append(...Array.from(body.childNodes))
    })
    if (text(out) === '') { return null }
    const title = text(doc.querySelector('h1')).replace(/^AI Mode Conversation:\s*/i, '')
        || turnQuestion(turns[0])
    return { content: out.innerHTML, title, site: 'Google AI Mode' }
}
