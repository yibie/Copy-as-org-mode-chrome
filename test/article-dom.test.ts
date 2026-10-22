import './setup-dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { html2org } from '../src/html2org'
import { decorateArticle, articleHtmlForExport } from '../src/reader/article-dom'

const convert = (html: string) => html2org.convert(html, {})

function decorated(html: string): HTMLElement {
  const el = document.createElement('article')
  el.innerHTML = html
  decorateArticle(el)
  return el
}

const SAMPLE = `
<h2>Intro</h2>
<p>Hello <strong>world</strong>, see <a href="https://example.com/a">this</a>.</p>
<img data-src="https://example.com/real.png" src="data:image/gif;base64,R0lGOD">
<img data-src="https://example.com/lazy.png">
<img data-src="https://example.com/ignored.png" src="https://example.com/kept.png">
<h3 id="own-id">Table</h3>
<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>
<pre><code class="language-js">const x = 1</code></pre>
`

test('decorations change the live DOM', () => {
  const el = decorated(SAMPLE)
  assert.equal(el.querySelectorAll('.caom-table-wrapper').length, 1)
  assert.equal(el.querySelector('img')!.getAttribute('src'), 'https://example.com/real.png')
  assert.equal(el.querySelector('h2')!.id, 'caom-h-0')
})

test('export of an undecorated article converts like the extracted HTML', () => {
  assert.equal(convert(articleHtmlForExport(decorated(SAMPLE))), convert(SAMPLE))
})

test('export keeps the fixed image src, as v1.5.0 Save from the Reader did', () => {
  const html = articleHtmlForExport(decorated(SAMPLE))
  assert.match(html, /src="https:\/\/example\.com\/real\.png"/)
  assert.match(html, /src="https:\/\/example\.com\/lazy\.png"/)
  assert.match(html, /src="https:\/\/example\.com\/kept\.png"/)
  assert.doesNotMatch(html, /caom-table-wrapper/)
})

test('export does not modify the live DOM', () => {
  const el = decorated(SAMPLE)
  const before = el.innerHTML
  articleHtmlForExport(el)
  assert.equal(el.innerHTML, before)
})

test('export keeps highlights', () => {
  const el = decorated('<p>Hello world</p>')
  const p = el.querySelector('p')!
  p.innerHTML = 'Hello <mark data-chai-id="h1" data-chai-type="key">world</mark>'
  assert.equal(convert(articleHtmlForExport(el)), 'Hello [[chai:key][world]]')
})

test('Save (with images) options export highlights and collect the fixed image src', () => {
  const el = decorated(`<p>A <mark data-chai-id="h1" data-chai-type="key">key point</mark>.</p>
<img data-src="https://example.com/real.png" src="data:image/gif;base64,R0lGOD">`)
  const extractedImages: { src: string, filename: string }[] = []
  const org = html2org.convert(articleHtmlForExport(el), { saveImages: true, imagePathPrefix: './', extractedImages })
  assert.match(org, /\[\[chai:key\]\[key point\]\]/)
  assert.equal(extractedImages.length, 1)
  assert.equal(extractedImages[0].src, 'https://example.com/real.png')
  assert.ok(org.includes(extractedImages[0].filename))
})
