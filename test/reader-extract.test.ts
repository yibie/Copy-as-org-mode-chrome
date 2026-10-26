import './setup-dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { absolutizeUrls, cloneDocumentWithShadow, stripDuplicateTitle } from '../src/reader/extract'

test('the clone gets shadow content; the page is not changed', () => {
  const page = new JSDOM('<!doctype html><html><body><p>light</p><div id="host"></div></body></html>').window.document
  const host = page.getElementById('host')!
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = '<p>shadow text</p><span id="inner"></span>'
  root.getElementById('inner')!.attachShadow({ mode: 'open' }).innerHTML = '<b>nested</b>'
  const before = page.body.innerHTML

  const clone = cloneDocumentWithShadow(page)

  assert.equal(page.body.innerHTML, before)
  assert.equal(clone.getElementById('host')!.innerHTML, '<p>shadow text</p><span id="inner"><b>nested</b></span>')
  assert.equal(clone.querySelector('p')!.textContent, 'light')
})

test('relative URLs resolve against the page; fragments stay', () => {
  const html = '<p><a href="/a">a</a> <a href="#fn1">1</a> <a href="https://x.org/b">b</a></p>' +
    '<img src="img/c.png" data-src="d.png" srcset="e.png 1x, /f.png 2x"><video poster="p.jpg"></video>'
  const out = new JSDOM(`<body>${absolutizeUrls(html, 'https://site.com/post/1')}</body>`).window.document
  const links = out.querySelectorAll('a')
  assert.equal(links[0].getAttribute('href'), 'https://site.com/a')
  assert.equal(links[1].getAttribute('href'), '#fn1')
  assert.equal(links[2].getAttribute('href'), 'https://x.org/b')
  const img = out.querySelector('img')!
  assert.equal(img.getAttribute('src'), 'https://site.com/post/img/c.png')
  assert.equal(img.getAttribute('data-src'), 'https://site.com/post/d.png')
  assert.equal(img.getAttribute('srcset'), 'https://site.com/post/e.png 1x, https://site.com/f.png 2x')
  assert.equal(out.querySelector('video')!.getAttribute('poster'), 'https://site.com/post/p.jpg')
})

test('a leading heading equal to the title is dropped', () => {
  assert.equal(stripDuplicateTitle('<h1>My Post</h1><p>x</p>', ' my post '), '<p>x</p>')
  assert.equal(stripDuplicateTitle('<h2>Other</h2><p>x</p>', 'My Post'), '<h2>Other</h2><p>x</p>')
})
