import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateTopics, createDeck, validDeck, shuffle, LEVELS } from '../game.js';
const topics = JSON.parse(await readFile(new URL('../topics.json', import.meta.url)));
test('900 unique topics, 300 in each difficulty', () => {
  assert.equal(validateTopics(topics), topics);
  for (const level of Object.keys(LEVELS)) assert.equal(topics.filter(t => t.level === level).length, 300);
});
test('each deck contains all and only its level without repetitions', () => {
  for (const level of Object.keys(LEVELS)) {
    const deck = createDeck(topics, level);
    assert.equal(validDeck(deck, topics, level), true);
    assert.equal(new Set(deck.order).size, 300);
    assert.ok(deck.order.every(id => id.startsWith(level)));
  }
});
test('shuffle preserves input and uses random draws to reorder', () => {
  const input = ['a', 'b', 'c', 'd'];
  assert.deepEqual(shuffle(input, () => 0), ['b', 'c', 'd', 'a']);
  assert.deepEqual(input, ['a', 'b', 'c', 'd']);
});
test('damaged or outdated saved decks are rejected', () => {
  const deck = createDeck(topics, 'easy');
  for (const invalid of [null, {}, { ...deck, position: -1 }, { ...deck, position: 300 },
    { ...deck, position: .5 }, { ...deck, order: Array(300).fill('easy-001') },
    { order: deck.order.slice(0, 100), position: 99 },
    { ...deck, order: deck.order.slice(1) }, { ...deck, order: ['medium-001', ...deck.order.slice(1)] }]) {
    assert.equal(validDeck(invalid, topics, 'easy'), false);
  }
  assert.equal(validDeck({ ...deck, position: 299 }, topics, 'easy'), true);
});
test('invalid topic catalogs are rejected', () => {
  assert.throws(() => validateTopics(topics.slice(1)));
  assert.throws(() => validateTopics([topics[1], ...topics.slice(1)]));
  assert.throws(() => validateTopics([{ ...topics[0], level: 'unknown' }, ...topics.slice(1)]));
});
