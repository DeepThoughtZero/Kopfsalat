import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const bundle = await readFile(new URL('../app.bundle.js', import.meta.url), 'utf8');
function start(saved) {
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      textContent: '', disabled: selector === '#next', checked: true,
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, addEventListener() {}, querySelectorAll() { return []; },
    });
    return elements.get(selector);
  }
  // No fetch, imports or network API: startup must be self-contained.
  runInNewContext(bundle, {
    document: { querySelector: element, querySelectorAll: () => [], addEventListener() {} },
    localStorage: {
      getItem() { if (saved === 'blocked') throw new Error('Storage denied'); return saved; },
      setItem() { if (saved === 'blocked') throw new Error('Storage denied'); },
    },
  });
  return elements;
}
for (const [name, saved] of [
  ['first visit', null], ['broken save', '{bad json'], ['blocked storage', 'blocked'],
  ['old saved table mode', JSON.stringify({ level: 'medium', tableMode: true, decks: {} })],
]) {
  test(`startup without network: ${name}`, () => {
    const elements = start(saved);
    assert.equal(elements.get('#next').disabled, false);
    assert.ok(elements.get('#topic').textContent.length > 10);
    assert.equal(elements.get('#card-number').textContent, '1 / 100');
    assert.equal(elements.get('#status').textContent, '');
  });
}
