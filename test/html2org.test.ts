import './setup-dom'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { html2org } from '../src/html2org'

const convert = (html: string) => html2org.convert(html, {})

test('converts paragraph with emphasis and link', () => {
  assert.equal(
    convert('<p>Hello <strong>bold</strong> and <a href="https://example.com">link</a>.</p>'),
    'Hello *bold* and [[https://example.com][link]].',
  )
})
