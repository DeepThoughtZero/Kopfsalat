export const LEVELS = {
  easy: { name: 'Locker flockig', icon: '✿' },
  medium: { name: 'Schön schräg', icon: 'ϟ' },
  hard: { name: 'Völlig verkopft', icon: '✳' },
};

export function shuffle(ids, random = Math.random) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createDeck(topics, level) {
  return { order: shuffle(topics.filter(topic => topic.level === level).map(topic => topic.id)), position: 0 };
}

export function validDeck(deck, topics, level) {
  const ids = new Set(topics.filter(topic => topic.level === level).map(topic => topic.id));
  return Boolean(deck && Array.isArray(deck.order) && deck.order.length === ids.size &&
    new Set(deck.order).size === ids.size && deck.order.every(id => ids.has(id)) &&
    Number.isInteger(deck.position) && deck.position >= 0 && deck.position < deck.order.length);
}

export function validateTopics(topics) {
  if (!Array.isArray(topics) || topics.length !== 300) throw new Error('Es werden 300 Themen benötigt.');
  const texts = new Set();
  const ids = new Set();
  for (const topic of topics) {
    if (!topic || !LEVELS[topic.level] || !new RegExp(`^${topic.level}-\\d{3}$`).test(topic.id) ||
      typeof topic.text !== 'string' || !topic.text.trim() || ids.has(topic.id) || texts.has(topic.text)) {
      throw new Error('Die Themendatei enthält ungültige oder doppelte Einträge.');
    }
    ids.add(topic.id);
    texts.add(topic.text);
  }
  for (const level of Object.keys(LEVELS)) {
    if (topics.filter(topic => topic.level === level).length !== 100) throw new Error('Jede Stufe benötigt 100 Themen.');
  }
  return topics;
}
