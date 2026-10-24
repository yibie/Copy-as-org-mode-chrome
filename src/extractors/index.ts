/*!
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0 (MPL-2.0). If a copy of the MPL was not distributed with this file,
 * You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/*
 * Our own site extractors, applied on top of Defuddle's result.
 *
 * Defuddle has an extractor registry, but its browser build (dist/index.js)
 * bundles a private copy of it; registering into the unbundled module only
 * works with the unbundled build, which pulls in ~650 KB of math libraries.
 * So these run after Defuddle and replace the fields they know better.
 */

import { extractZhihu, ZHIHU_PATTERNS } from './zhihu'

export interface SiteExtraction {
    content: string
    title?: string
    author?: string
    site?: string
    published?: string
}

const SITES: { patterns: RegExp[], extract: (doc: Document) => SiteExtraction | null }[] = [
    { patterns: ZHIHU_PATTERNS, extract: extractZhihu },
]

/** The extraction for this page from one of our site extractors, or null. */
export function extractSite(doc: Document, url: string): SiteExtraction | null {
    const site = SITES.find(s => s.patterns.some(p => p.test(url)))
    return site ? site.extract(doc) : null
}

/** Defuddle's result with the site extractor's non-empty fields laid over it. */
export function applySiteExtraction<T extends object>(result: T, site: SiteExtraction | null): T {
    if (!site) { return result }
    const over = Object.fromEntries(Object.entries(site).filter(([, v]) => v))
    return { ...result, ...over }
}
