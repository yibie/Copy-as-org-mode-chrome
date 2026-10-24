/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Names for saved .org files: AUTHOR__TITLE==KW1_KW2.org
 *
 * Chrome refuses names it considers unsafe ("Name is not allowed"): invisible
 * format characters such as U+200B, a leading or trailing dot or space, and
 * over-long names. Page metadata carries these more often than one would
 * think, e.g. Zhihu appends U+200B to author names.
 */

/** Control and invisible format characters (zero-width spaces, direction marks, BOM) */
const INVISIBLE = /[\p{Cc}\p{Cf}\u2028\u2029]/gu
const UNSAFE = /[<>:"/\\|?*#]/g
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i
/** Bytes; file systems allow 255, leave room for a " (1)" the browser may add */
const MAX_BYTES = 200
const FALLBACK = 'captured_content'

/** Page metadata as one clean line, for #+TITLE / #+AUTHOR / #+KEYWORDS and file names */
export function cleanMetaText(s: string): string {
    return s.replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim()
}

function component(s: string): string {
    return cleanMetaText(s.replace(UNSAFE, '')).replace(/__/g, ' ').replace(/==/g, ' ').trim()
}

const bytes = (s: string) => new TextEncoder().encode(s).length

/** Cut to at most `max` UTF-8 bytes without splitting a character */
function cutBytes(s: string, max: number): string {
    let out = ''
    for (const ch of s) {
        if (bytes(out + ch) > max) { break }
        out += ch
    }
    return out
}

export function orgFilename(title: string, author = '', keywords: string[] = []): string {
    const safeTitle = component(title)
    const safeAuthor = component(author)
    const safeKeywords = keywords.map(component).filter(k => k).slice(0, 5).join('_')

    const head = safeAuthor ? `${safeAuthor}__` : ''
    let base = head + safeTitle + (safeKeywords ? `==${safeKeywords}` : '')
    if (bytes(base) > MAX_BYTES) { base = cutBytes(head + safeTitle, MAX_BYTES) }

    // No leading dot/tilde (hidden or special files), no trailing dot or space
    base = base.replace(/^[.~\s]+/, '').replace(/[.\s]+$/, '')
    if (!base) { base = FALLBACK }
    if (WINDOWS_RESERVED.test(base)) { base = `_${base}` }
    return `${base}.org`
}
