import './setup-dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractGoogleAiMode, GOOGLE_AI_MODE_PATTERNS } from '../src/extractors/google-ai-mode'
import { html2org } from '../src/html2org'

// Trimmed from a real AI Mode page (2026-10-24): one turn, Google's markup kept
const TURN = (q: string, a: string) => `
<div data-scope-id="turn"><div data-subtree="aimc"><div class="Zkbeff">
  <h3 data-ignore-copy="" class="MheKwc">AI Mode reply for ${q}<!--TgQPHd|||[]--></h3>
  <div class="pWvJNd"><div class="mZJni" jsname="KFl8ub"><div style="display: contents">${a}
    <div><div class="DBd2Wb"><div>AI can make mistakes, so double-check responses</div><div class="HvurC">Saved timeClear</div></div></div>
  </div></div></div>
    <div class="ofHStc"><div style="display: contents"><div class="hjPQm"><div class="srOP7c" role="button"><h1 class="zeIqo">Shared</h1></div></div></div><p>0 files</p><ul></ul><p>Show allShow less</p></div>
    <div aria-live="polite">Copied to clipboardFailed to copy to clipboard. Try again later.</div>
  <div role="dialog" aria-label="Related links" style="display: none;">x</div>
</div></div></div>`

const ANSWER = `
<div class="n6owBd awi2gc" jsaction="" data-hveid="CAIIAQgGEAA"><span style="display:none;" data-key="aimhl"><!--x--></span><span data-subtree="aimfl">要想扩大 X 的影响力，</span><mark class="b6AQX" jsaction="click:x"><strong class="rQesXe MPyX">多与别人互动更有效<!--c--></strong></mark>。<span class="DHPVt Wg1cdb notranslate"><span class="NMq1me"><span aria-hidden="true">&nbsp;</span><button aria-label="Related results">3</button></span></span></div>
<div class="yhAwj"></div>
<div class="ZLzG0d ncoeY" role="heading" aria-level="3">1. 评论区借势<!--c--></div>
<ul class="XSq4R"><li class="Z1qcYe"><span class="iNqyIf"><strong class="rQesXe">抢占大 V 评论区：</strong> 发帖后 5 分钟内评论。</span><span class="DHPVt"><button>1</button></span></li></ul>
<div class="AHmQrc"><div class="n6owBd">你可以告诉我：</div><ul><li>你的领域？</li></ul></div>`

function page(body: string): Document {
  return new DOMParser().parseFromString(`<html><body><div role="main">${body}</div><div>Shared</div><div>0 files</div></body></html>`, 'text/html')
}

test('turns become question headings followed by clean answers', () => {
  const doc = page('<h1>AI Mode Conversation: 怎么扩大影响力</h1>' + TURN('怎么扩大影响力', ANSWER) + TURN('我的粉丝 6000', '<div class="n6owBd">先找同频战友。</div>'))
  const r = extractGoogleAiMode(doc)!
  assert.equal(r.title, '怎么扩大影响力')
  assert.equal(r.site, 'Google AI Mode')
  assert.equal(r.content.replace(/>\s+</g, '><').trim(),
    '<h2>怎么扩大影响力</h2>'
    + '<p>要想扩大 X 的影响力，<strong>多与别人互动更有效</strong>。</p>'
    + '<h3>1. 评论区借势</h3>'
    + '<ul><li><strong>抢占大 V 评论区：</strong> 发帖后 5 分钟内评论。</li></ul>'
    + '<p>你可以告诉我：</p><ul><li>你的领域？</li></ul>'
    + '<h2>我的粉丝 6000</h2><p>先找同频战友。</p>')
  assert.doesNotMatch(r.content, /AI can make mistakes|Shared|files|Show all|Copied|Related|jsaction|class=/)
})

test('org output keeps the structure', () => {
  const r = extractGoogleAiMode(page(TURN('q', ANSWER)))!
  const org = html2org.convert(r.content, {})
  assert.match(org, /^\*\* q$/m)
  assert.match(org, /^\*\*\* 1\\\. 评论区借势$/m)
  // The double space after the bold label is issue001
  assert.match(org, /^- \*抢占大 V 评论区：\*  发帖后 5 分钟内评论。$/m)
})

test('pages without turns are left to Defuddle', () => {
  assert.equal(extractGoogleAiMode(page('<p>plain results</p>')), null)
})

test('only AI Mode searches match', () => {
  const m = (u: string) => GOOGLE_AI_MODE_PATTERNS.some(p => p.test(u))
  assert.ok(m('https://www.google.com/search?newwindow=1&q=x&mtid=y&udm=50'))
  assert.ok(m('https://www.google.co.jp/search?udm=50&q=x'))
  assert.ok(!m('https://www.google.com/search?q=x'))
  assert.ok(!m('https://www.google.com/search?q=x&udm=500'))
})
