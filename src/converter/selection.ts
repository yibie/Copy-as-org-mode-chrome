/*!
 * This file is derived from copy-selection-as-markdown by 0x6b
 * @see https://github.com/0x6b/copy-selection-as-markdown
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


// https://github.com/defunctzombie/node-url/issues/54
// https://github.com/defunctzombie/node-url/issues/41
// @ts-ignore
import * as url from 'url'
import { imgToCanvasToDataUrl } from '../common';
import { CopyAsOrgModeOptions } from '../options';
import TurndownService from "../html2org/turndown";

interface ConversionResult {
    /** Org-Mode formatted text */
    output: string
    /** Clean HTML. See selection.ts */
    html: string
}

/**
 *
 * @returns If not found selection in page, return empty string.
 */
export async function getSelectionAndConvertToOrgMode(options: CopyAsOrgModeOptions): Promise<ConversionResult> {
    const htmlStr: string = await getSelectionAsCleanHtml(options)
    var turndownService = new TurndownService({
        unorderedListMarker: options.ulBulletChar,
        orderedListMarker: options.olBulletChar,
        codeDelimiter: options.codeChar,
        listIndentSize: options.listIndentSize,
        codeBlockStyle: options.codeBlockStyle,
        decodeUri: options.decodeUri,
        squareBracketsInLink: options.squareBracketsInLink,
        ruby: options.rubyHandleMethod,
    })
    const orgStr = turndownService.turndown(htmlStr)
    return {
        html: htmlStr,
        output: orgStr
    }
}

/** Process or resolve img.src, a.href in HTML.
 *
 * Resolve URL, for example: ///image/foo.jpg  ->  https://domain.com/image/foo.jpg
 *
 * Or convert into Base64 data URL.
 *
 * @return if not found selection in page, return empty string.
 */
export async function getSelectionAsCleanHtml(options: CopyAsOrgModeOptions): Promise<string> {

    let selection = document.getSelection();
    if (!selection) {
        console.error('[To Developer] document.getSelection() is null???')
        return 'ERROR'
    }
    if (selection.rangeCount === 0) {
        let frames = document.getElementsByTagName("iframe");
        if (frames) {
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i]
                const contentDocument = frame.contentDocument
                if (!contentDocument) { continue }
                const tmpSel = contentDocument.getSelection()
                if (!tmpSel) { continue }
                if (tmpSel.rangeCount > 0) {
                    selection = tmpSel
                    break  // NOTE: Right?
                }
            }
        }
    }

    if (selection.rangeCount === 0) {
        console.log('[INFO] document.getSelection().rangeCount is 0. Return empty string.')
        return ''
    }

    const container = document.createElement("div");

    for (let i = 0; i < selection.rangeCount; ++i) {
        container.appendChild(selection.getRangeAt(i).cloneContents())
    }

    for (const anchor of Array.from(container.getElementsByTagName('a'))) {
        const href = anchor.getAttribute("href")
        if (!href) { continue }
        if (href.startsWith("http")) { continue }
        const fixedHref = url.resolve(document.URL, href)
        anchor.setAttribute("href", fixedHref);
    }

    for (const img of Array.from(container.getElementsByTagName("img"))) {
        const src = img.getAttribute("src")
        if (!src) { continue }
        if (src.startsWith("http")) { continue }
        if (src.startsWith("data:")) { continue }
        const fixedSrc = url.resolve(document.URL, src)
        img.setAttribute("src", fixedSrc)
    }

    if (options.convertImageAsDataUrl) {
        for (const img of Array.from(container.getElementsByTagName("img"))) {
            const src = img.getAttribute('src')
            if (!src) { continue }
            if (!src.startsWith("http")) { continue }
            const srcWithoutParam = src.split("?", 2)[0]
            if (srcWithoutParam.match(/(gif|jpe?g|png|webp)$/)) {
                img.setAttribute("src", await imgToCanvasToDataUrl(img))
            }
        }
    }

    const cleanHTML = container.innerHTML
    return cleanHTML
};
