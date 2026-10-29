import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const bundle = await readFile(new URL('../app.bundle.js', import.meta.url), 'utf8');
const topics = JSON.parse(await readFile(new URL('../topics.json', import.meta.url), 'utf8'));
function start(saved) {
  const elements = new Map();
  let stored;
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
      setItem(key, value) { if (saved === 'blocked') throw new Error('Storage denied'); stored = JSON.parse(value); },
    },
  });
  return { elements, stored };
}
for (const [name, saved] of [
  ['first visit', null], ['broken save', '{bad json'], ['blocked storage', 'blocked'],
  ['old saved table mode', JSON.stringify({ level: 'medium', tableMode: true, decks: {} })],
]) {
  test(`startup without network: ${name}`, () => {
    const { elements } = start(saved);
    assert.equal(elements.get('#next').disabled, false);
    assert.ok(elements.get('#topic').textContent.length > 10);
    assert.equal(elements.get('#card-number').textContent, '1 / 300');
    assert.equal(elements.get('#status').textContent, '');
  });
}
test('old 100-card saves receive full decks and preserve preferences', () => {
  const decks = Object.fromEntries(['easy', 'medium', 'hard'].map(level => [level, {
    order: topics.filter(t => t.level === level).slice(0, 100).map(t => t.id), position: 99,
  }]));
  const { elements, stored } = start(JSON.stringify({ level: 'medium', autoRead: false, decks }));
  assert.equal(stored.level, 'medium');
  assert.equal(elements.get('#auto-read').checked, false);
  assert.equal(elements.get('#card-number').textContent, '1 / 300');
  for (const [level, deck] of Object.entries(stored.decks)) {
    assert.equal(deck.position, 0);
    assert.deepEqual([...deck.order].sort(), topics.filter(t => t.level === level).map(t => t.id).sort());
  }
});
test('a saved 300-card deck resumes at its last card', () => {
  const order = topics.filter(t => t.level === 'hard').map(t => t.id);
  const { elements, stored } = start(JSON.stringify({
    level: 'hard', autoRead: false, decks: { hard: { order, position: 299 } },
  }));
  assert.equal(elements.get('#card-number').textContent, '300 / 300');
  assert.equal(elements.get('#topic').textContent, topics.find(t => t.id === 'hard-300').text);
  assert.match(elements.get('#next').innerHTML, /Neuer Stapel/);
  assert.deepEqual(stored.decks.hard, { order, position: 299 });
});
