import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanMetaText, orgFilename } from '../src/org-filename'

test('the usual AUTHOR__TITLE==KEYWORDS shape is unchanged', () => {
  assert.equal(orgFilename('A Title', 'Ann', ['x', 'y']), 'Ann__A Title==x_y.org')
  assert.equal(orgFilename('A Title'), 'A Title.org')
})

test('invisible characters are removed (Zhihu author with U+200B)', () => {
  assert.equal(orgFilename('DeepSeek Harness', '腾讯技术工程\u200b'), '腾讯技术工程__DeepSeek Harness.org')
  assert.equal(orgFilename('a\u200eb\ufeffc'), 'a b c.org')
  assert.equal(cleanMetaText('腾讯技术工程\u200b'), '腾讯技术工程')
  assert.equal(cleanMetaText(' line\none\u2028two '), 'line one two')
})

test('unsafe characters and separators are removed', () => {
  assert.equal(orgFilename('a/b:c?*d#e', 'x__y', ['k==v']), 'x y__abcde==k v.org')
})

test('no leading dot or tilde, no trailing dot or space', () => {
  assert.equal(orgFilename('...hidden'), 'hidden.org')
  assert.equal(orgFilename('~temp'), 'temp.org')
  assert.equal(orgFilename('ends with dots...'), 'ends with dots.org')
})

test('empty and reserved names fall back', () => {
  assert.equal(orgFilename(''), 'captured_content.org')
  assert.equal(orgFilename('\u200b'), 'captured_content.org')
  assert.equal(orgFilename('CON'), '_CON.org')
})

test('long names are cut to 200 bytes on a character boundary, keywords first', () => {
  const name = orgFilename('长'.repeat(100), 'Ann', ['kw'])
  assert.ok(new TextEncoder().encode(name.replace(/\.org$/, '')).length <= 200)
  assert.ok(name.startsWith('Ann__长'))
  assert.ok(!name.includes('=='))
  assert.ok(!name.includes('\ufffd'))
})
