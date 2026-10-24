import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CHAI_TYPES, isValidChaiTypeName, chaiTypesError, normalizeChaiTypes } from '../src/chai-types'

test('defaults follow the user\'s chai-highlight-types, in its order', () => {
  assert.deepEqual(DEFAULT_CHAI_TYPES.map(t => t.name), [
    'key', 'idea', 'question', 'fact',
  ])
  assert.equal(chaiTypesError(DEFAULT_CHAI_TYPES), null)
})

test('type names allow only letters, digits, _ and -', () => {
  for (const ok of ['key', 'fact', 'to_do', 'my-type', 'A1']) { assert.ok(isValidChaiTypeName(ok), ok) }
  for (const bad of ['', 'a:b', 'a b', 'a]', '重点', 'a\n']) { assert.ok(!isValidChaiTypeName(bad), bad) }
})

test('chaiTypesError reports invalid names, duplicates and bad colors', () => {
  assert.match(chaiTypesError([{ name: 'a:b', color: '#ffffff' }])!, /Invalid type name/)
  assert.match(chaiTypesError([{ name: 'a', color: '#ffffff' }, { name: 'a', color: '#000000' }])!, /Duplicate/)
  assert.match(chaiTypesError([{ name: 'a', color: 'red' }])!, /Invalid color/)
  assert.equal(chaiTypesError([]), null)
})

test('normalizeChaiTypes: non-list falls back to defaults, as a copy', () => {
  for (const v of [undefined, null, 'x', {}]) {
    const out = normalizeChaiTypes(v)
    assert.deepEqual(out, DEFAULT_CHAI_TYPES)
    assert.notEqual(out[0], DEFAULT_CHAI_TYPES[0])
  }
})

test('normalizeChaiTypes keeps user order and custom types, drops bad entries', () => {
  const out = normalizeChaiTypes([
    { name: 'fact', color: '#ABCDEF' },
    { name: 'key', color: '#ffe082' },
    { name: 'bad name', color: '#ffffff' },
    { name: 'fact', color: '#000000' },
    { name: 'nocolor' },
    null,
  ])
  assert.deepEqual(out, [{ name: 'fact', color: '#abcdef' }, { name: 'key', color: '#ffe082' }])
})

test('normalizeChaiTypes keeps an empty list (user removed every type)', () => {
  assert.deepEqual(normalizeChaiTypes([]), [])
})
