import './setup-dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanZhihuBody, ZHIHU_PATTERNS } from '../src/extractors/zhihu'

function clean(html: string): string {
  const el = document.createElement('div')
  el.innerHTML = html
  cleanZhihuBody(el)
  return el.innerHTML
}

test('search links become plain words, without the star icon', () => {
  assert.equal(
    clean('<p>写了一个 <span><a class="RichContent-EntityWord css-b7erz1" href="https://zhida.zhihu.com/search?q=x&amp;zd_token=t">聊天机器人<svg class="ZDI ZDI--FourPointedStar16"><path d="m5"></path></svg></a></span>。</p>'),
    '<p>写了一个 <span>聊天机器人</span>。</p>')
})

test('link.zhihu.com redirects point at the target, hidden URL parts are dropped', () => {
  assert.equal(
    clean('<a href="https://link.zhihu.com/?target=http%3A//api.npmjs.org" class=" external"><span class="invisible">http://</span><span class="visible">api.npmjs.org</span><span class="invisible"></span></a>'),
    '<a href="http://api.npmjs.org" class=" external">api.npmjs.org</a>')
})

test('images use the full-size source and lose the portal wrapper', () => {
  assert.equal(
    clean('<figure><div class="RichText-ConditionalImagePortal"><img src="https://pic2.zhimg.com/v2-a_1440w.jpg" data-original="https://pic2.zhimg.com/v2-a_r.jpg"></div></figure>'),
    '<figure><img src="https://pic2.zhimg.com/v2-a_r.jpg" data-original="https://pic2.zhimg.com/v2-a_r.jpg"></figure>')
})

test('empty spacer paragraphs are removed', () => {
  assert.equal(clean('<p>a</p><p class="ztext-empty-paragraph"><br></p><p>b</p>'), '<p>a</p><p>b</p>')
})

test('only column articles match', () => {
  const m = (u: string) => ZHIHU_PATTERNS.some(p => p.test(u))
  assert.ok(m('https://zhuanlan.zhihu.com/p/2079219486700344366'))
  assert.ok(!m('https://www.zhihu.com/question/1/answer/2'))
})
