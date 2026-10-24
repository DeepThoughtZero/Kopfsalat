const $ = selector => document.querySelector(selector);
const storageKey = 'kopfsalat-v1';
let topics = [];
let state = { level: 'easy', decks: {}, autoRead: true };
let audio = null;
let audioVersion = 0;
let ready = false;

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* The game also works without storage. */ }
}

function currentDeck() { return state.decks[state.level]; }
function currentTopic() { return topics.find(topic => topic.id === currentDeck().order[currentDeck().position]); }
function status(text = '') { $('#status').textContent = text; }

function stopAudio() {
  audioVersion++;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
  }
  $('#speak').classList.remove('is-playing');
  $('#speak').setAttribute('aria-label', 'Thema noch einmal vorlesen');
  $('#speak span').textContent = 'Vorlesen';
}

async function speak() {
  if (!ready) return;
  stopAudio();
  const version = audioVersion;
  const clip = new Audio(new URL(`assets/audio/${currentTopic().id}.mp3`, document.baseURI));
  audio = clip;
  $('#speak').classList.add('is-playing');
  $('#speak').setAttribute('aria-label', 'Vorlesen stoppen');
  $('#speak span').textContent = 'Stopp';
  status();
  clip.addEventListener('ended', () => {
    if (version !== audioVersion) return;
    stopAudio();
    status();
  }, { once: true });
  clip.addEventListener('error', () => {
    if (version !== audioVersion) return;
    stopAudio();
    status('Die Aufnahme konnte nicht geladen werden. Ihr könnt das Thema selbst vorlesen.');
  }, { once: true });
  try {
    await clip.play();
  } catch (error) {
    if (version !== audioVersion) return;
    stopAudio();
    status(error.name === 'NotAllowedError' ? 'Einmal auf „Vorlesen“ tippen, um Dylan zu starten.' :
      'Die Aufnahme ist gerade nicht verfügbar. Versucht es mit „Vorlesen“ erneut.');
  }
}

function render({ animate = true, read = false } = {}) {
  stopAudio();
  const deck = currentDeck();
  $('#topic').textContent = currentTopic().text;
  $('#card-number').textContent = `${deck.position + 1} / ${deck.order.length}`;
  $('#card-number').setAttribute('aria-label', `Thema ${deck.position + 1} von ${deck.order.length}`);
  const remaining = deck.order.length - deck.position - 1;
  $('#next').innerHTML = remaining ? 'Weiter <span aria-hidden="true">↗</span>' : 'Neuer Stapel <span aria-hidden="true">↗</span>';
  $('.levels').querySelectorAll('button').forEach(button => {
    const selected = button.dataset.level === state.level;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (animate) {
    $('#topic-card').classList.remove('card-changing');
    void $('#topic-card').offsetWidth;
    $('#topic-card').classList.add('card-changing');
  }
  status();
  save();
  if (read && state.autoRead) void speak();
}

$('#next').addEventListener('click', () => {
  if (!ready) return;
  const deck = currentDeck();
  if (deck.position === deck.order.length - 1) {
    const last = currentTopic().id;
    state.decks[state.level] = createDeck(topics, state.level);
    // Avoid an immediate repeat at a deck boundary.
    if (currentDeck().order[0] === last) [currentDeck().order[0], currentDeck().order[1]] = [currentDeck().order[1], currentDeck().order[0]];
  } else deck.position++;
  render({ read: true });
});
$('.levels').addEventListener('click', event => {
  const button = event.target.closest('[data-level]');
  if (!button || !ready || button.dataset.level === state.level) return;
  state.level = button.dataset.level;
  render({ read: true });
});
$('#speak').addEventListener('click', () => {
  if (audio) { stopAudio(); status(); }
  else void speak();
});
$('#auto-read').addEventListener('change', event => {
  state.autoRead = event.target.checked;
  save();
  if (!state.autoRead) { stopAudio(); status(); }
  else if (ready) void speak();
});
function fullscreenActive() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}
function syncFullscreen() {
  const active = fullscreenActive();
  $('#fullscreen').setAttribute('aria-pressed', String(active));
  $('#fullscreen').setAttribute('aria-label', active ? 'Vollbild verlassen' : 'Vollbild einschalten');
  $('#fullscreen span').textContent = active ? 'Verlassen' : 'Vollbild';
}
$('#fullscreen').addEventListener('click', async () => {
  try {
    if (fullscreenActive()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) await exit.call(document);
    } else {
      const root = document.documentElement;
      const enter = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!enter) { status('Vollbild wird von diesem Browser nicht unterstützt.'); return; }
      await enter.call(root);
    }
    syncFullscreen();
    status();
  } catch {
    syncFullscreen();
    status('Vollbild konnte nicht gestartet werden. Bitte erneut versuchen.');
  }
});
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);
$('#rules-button').addEventListener('click', () => $('#rules-dialog').showModal());
$('#reset').addEventListener('click', () => { if (ready) $('#reset-dialog').showModal(); });
$('#confirm-reset').addEventListener('click', () => {
  state.decks[state.level] = createDeck(topics, state.level);
  $('#reset-dialog').close();
  render({ read: true });
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }});
});
document.addEventListener('keydown', event => {
  if (event.code === 'ArrowRight' && !event.repeat && !document.querySelector('dialog[open]') &&
      !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) {
    event.preventDefault();
    $('#next').click();
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); });

function init() {
  try {
    topics = validateTopics(TOPICS);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && LEVELS[saved.level]) {
        state.level = saved.level;
        state.autoRead = typeof saved.autoRead === 'boolean' ? saved.autoRead : true;
        for (const level of Object.keys(LEVELS)) {
          if (validDeck(saved.decks?.[level], topics, level)) state.decks[level] = saved.decks[level];
        }
      }
    } catch { /* Ignore blocked storage and old/corrupt saves. */ }
    for (const level of Object.keys(LEVELS)) state.decks[level] ??= createDeck(topics, level);
    $('#auto-read').checked = state.autoRead;
    ready = true;
    $('#next').disabled = false;
    render({ animate: false });
    status();
  } catch {
    $('#topic').textContent = 'Spiel konnte nicht gestartet werden.';
    status('Bitte lade die Seite neu.');
    $('#speak').disabled = true;
    $('#reset').disabled = true;
    document.querySelectorAll('.level').forEach(button => button.disabled = true);
  }
}
void init();
