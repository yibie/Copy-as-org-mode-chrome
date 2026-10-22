import './setup-dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { html2org } from '../src/html2org'

const convert = (html: string) => html2org.convert(html, {})
const ZWSP = '​'

function mark(text: string, type = 'key', note?: string, id = 'h1'): string {
  const noteAttr = note === undefined ? '' : ` data-chai-note="${note}"`
  return `<mark data-chai-id="${id}" data-chai-type="${type}"${noteAttr}>${text}</mark>`
}

test('highlight without note', () => {
  assert.equal(convert(`<p>a ${mark('hello')} b</p>`), 'a [[chai:key][hello]] b')
})

test('highlight with note', () => {
  assert.equal(convert(`<p>${mark('hello', 'key', 'why?')}</p>`), '[[chai:key:why?][hello]]')
})

test('custom type is passed through', () => {
  assert.equal(convert(`<p>${mark('custom', 'fact')}</p>`), '[[chai:fact][custom]]')
})

test('note keeps colons', () => {
  assert.equal(convert(`<p>${mark('hello', 'key', 'a: b: c')}</p>`), '[[chai:key:a: b: c][hello]]')
})

test('note escapes brackets and trailing backslash like org-link-escape', () => {
  assert.equal(convert(`<p>${mark('t', 'key', 'x [a] y')}</p>`), '[[chai:key:x \\[a\\] y][t]]')
  assert.equal(convert(`<p>${mark('t', 'key', 'end\\')}</p>`), '[[chai:key:end\\\\][t]]')
})

test('note newlines collapse to a space', () => {
  assert.equal(convert(`<p>${mark('t', 'key', 'line one\nline two')}</p>`), '[[chai:key:line one line two][t]]')
})

test('empty note is omitted', () => {
  assert.equal(convert(`<p>${mark('t', 'key', '  ')}</p>`), '[[chai:key][t]]')
})

test('text containing ]] gets a zero-width space', () => {
  assert.equal(convert(`<p>${mark('a ]] b')}</p>`), `[[chai:key][a ]${ZWSP}] b]]`)
})

test('text ending with ] gets a zero-width space', () => {
  assert.equal(convert(`<p>${mark('arr[0]')}</p>`), `[[chai:key][arr[0]${ZWSP}]]`)
})

test('surrounding whitespace moves outside the link', () => {
  assert.equal(convert(`<p>a${mark(' hello ')}b</p>`), 'a [[chai:key][hello]] b')
})

// The double spaces after /…/ come from wrapInlineMarkWithSpace and also occur
// without highlights (issue001); they are not part of the chai conversion.
test('fragments sharing an id across inline elements merge into one link', () => {
  const html = `<p>${mark('one ')}<em>${mark('two')}</em>${mark(' three')}</p>`
  assert.equal(convert(html), '[[chai:key][one /two/  three]]')
})

test('highlight starting inside an inline element', () => {
  const html = `<p><em>x ${mark('a')}</em>${mark(' b')}</p>`
  assert.equal(convert(html), '/x/  [[chai:key][/a/  b]]')
})

test('links inside a highlight keep only their text', () => {
  const html = `<p>${mark('see <a href="https://e.com">site</a> now')}</p>`
  assert.equal(convert(html), '[[chai:key][see site now]]')
})

test('distinct ids in one paragraph stay separate', () => {
  const html = `<p>${mark('one', 'key', undefined, 'h1')} and ${mark('two', 'idea', 'n', 'h2')}</p>`
  assert.equal(convert(html), '[[chai:key][one]] and [[chai:idea:n][two]]')
})

test('invalid type falls back to plain text', () => {
  assert.equal(convert(`<p>${mark('hello', 'bad:type')}</p>`), 'hello')
})

test('plain <mark> without chai attributes is untouched', () => {
  assert.equal(convert('<p><mark>hello</mark></p>'), 'hello')
})
