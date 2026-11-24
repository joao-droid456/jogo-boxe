import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameApp } from '../dist/js/app.js';
import { PHASE, CONFIG } from '../dist/js/core/config.js';
import { createEnemy } from '../dist/js/content/enemies.js';
import { RecordStore } from '../dist/js/platform/storage.js';
import { UPGRADES } from '../dist/js/content/upgrades.js';

class Element extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.children = [];
    this.attributes = {};
    this.captured = new Set();
    this.classList = { toggle() {} };
    this.hidden = false;
    this.textContent = '';
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  querySelector() {
    return (this.child ??= new Element());
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 120, height: 120 };
  }
  setPointerCapture(id) {
    this.captured.add(id);
  }
  hasPointerCapture(id) {
    return this.captured.has(id);
  }
  releasePointerCapture(id) {
    this.captured.delete(id);
  }
  fire(type, properties = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, properties);
    this.dispatchEvent(event);
  }
}

function browser() {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const elements = new Map(
    [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], new Element()]),
  );
  const document = new Element();
  document.body = new Element();
  document.getElementById = (id) => elements.get(id) ?? null;
  document.createElement = () => new Element();
  let drawCalls = 0;
  const context = new Proxy(
    { createRadialGradient: () => ({ addColorStop() {} }) },
    {
      get: (target, key) =>
        key in target
          ? target[key]
          : () => {
              drawCalls++;
            },
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  elements.get('game').getContext = () => context;
  const window = new Element();
  window.innerWidth = 390;
  window.innerHeight = 844;
  window.devicePixelRatio = 3;
  const saved = new Map(),
    callbacks = new Map();
  let frameId = 0;
  window.localStorage = {
    getItem: (key) => saved.get(key),
    setItem: (key, value) => saved.set(key, value),
  };
  window.requestAnimationFrame = (callback) => {
    callbacks.set(++frameId, callback);
    return frameId;
  };
  window.cancelAnimationFrame = (id) => callbacks.delete(id);
  window.location = { href: 'https://example.test/joguinho/' };
  window.navigator = {};
  function frame(timestamp) {
    const [id, callback] = callbacks.entries().next().value;
    callbacks.delete(id);
    callback(timestamp);
  }
  return { window, document, elements, saved, callbacks, frame, draws: () => drawCalls };
}

test('integração: menu, toque, dash, pausa, melhorias, resultado, reinício e descarte', () => {
  const b = browser(),
    app = new GameApp(b),
    el = (id) => b.elements.get(id);
  app.start();
  b.frame(0);
  assert(b.draws() > 0);
  assert.equal(el('home').hidden, false);
  assert.equal(el('game').width, Math.floor(390 * CONFIG.graphics.maxDpr), 'DPR limitado');
  el('start').fire('click');
  assert.equal(app.session.world.phase, PHASE.PLAYING);
  assert.equal(el('home').hidden, true);
  assert.equal(el('controls').hidden, false);
  el('joystick').fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 60 });
  const startX = app.session.world.player.x;
  b.frame(16);
  b.frame(33);
  assert(app.session.world.player.x > startX);
  el('joystick').fire('pointercancel', { pointerId: 1 });
  const x = app.session.world.player.x;
  b.frame(50);
  assert.equal(app.session.world.player.x, x);
  el('dash').fire('pointerdown');
  assert(app.session.world.player.dash > 0);
  el('pause').fire('click');
  assert.equal(app.session.world.phase, PHASE.PAUSED);
  const elapsed = app.session.world.elapsed;
  b.frame(1000);
  assert.equal(app.session.world.elapsed, elapsed);
  assert.equal(el('modal-title').textContent, 'ARENA EM PAUSA');
  el('resume').fire('click');
  b.frame(2000);
  assert.equal(app.session.world.elapsed, elapsed, 'retomar não recupera tempo de pausa');
  app.session.world.player.xp = app.session.world.player.needed;
  b.frame(2020);
  assert.equal(app.session.world.phase, PHASE.UPGRADE);
  assert.equal(el('choices').children.length, 3);
  el('choices').children[0].fire('click');
  assert.equal(app.session.world.phase, PHASE.PLAYING);
  const player = app.session.world.player;
  // Este trecho testa a derrota por colisão, independentemente da carta sorteada.
  for (const stat of [
    'cross',
    'roll',
    'jab',
    'upper',
    'shield',
    'shoulder',
    'flurry',
    'adrenaline',
  ])
    player[stat] = 0;
  player.shieldReady = false;
  player.invincible = 0;
  player.hp = 1;
  app.session.world.kills = 2;
  app.session.world.enemies = [createEnemy('tank', player.x, player.y)];
  b.frame(2040);
  b.frame(2060);
  assert.equal(app.session.world.phase, PHASE.ENDED);
  assert.equal(el('results').children.length, 3);
  assert(Number(b.saved.get('neon-rush-best')) > 0);
  el('restart').fire('click');
  assert.equal(app.session.world.phase, PHASE.PLAYING);
  assert.equal(app.session.world.enemies.length, 0);
  b.window.fire('keydown', { code: 'KeyD' });
  b.window.fire('blur');
  assert.equal(app.session.world.phase, PHASE.PAUSED);
  el('resume').fire('click');
  assert.deepEqual(app.input.read(), { x: 0, y: 0 });
  app.dispose();
  assert.equal(b.callbacks.size, 0);
  el('pause').fire('click');
  b.window.fire('keydown', { code: 'KeyP' });
  assert.equal(app.session.world.phase, PHASE.PLAYING, 'listeners removidos no descarte');
});

test('redimensionar entre retrato e paisagem não reinicia a partida', () => {
  const b = browser(),
    app = new GameApp(b);
  app.command('start');
  app.session.world.player.hp = 3;
  b.window.innerWidth = 844;
  b.window.innerHeight = 390;
  b.window.fire('resize');
  assert.equal(app.renderer.viewport.width, 844);
  assert.equal(app.session.world.player.hp, 3);
  app.start();
  b.frame(0);
  app.dispose();
});

test('armazenamento bloqueado ou corrompido não impede jogar', () => {
  const storage = {
    getItem() {
      throw new Error('bloqueado');
    },
    setItem() {
      throw new Error('bloqueado');
    },
  };
  const records = new RecordStore(storage);
  assert.equal(records.read(), 0);
  assert.doesNotThrow(() => records.save(100));
  for (const value of ['NaN', 'Infinity', '-1', 'texto'])
    assert.equal(new RecordStore({ getItem: () => value }).read(), 0);
  const b = browser();
  Object.defineProperty(b.window, 'localStorage', {
    get() {
      throw new Error('bloqueado');
    },
  });
  const app = new GameApp(b);
  app.command('start');
  assert.equal(app.session.world.phase, PHASE.PLAYING);
  app.dispose();
});

test('escolher carta especial exibe nível, descrição e poder equipado no HUD', () => {
  const b = browser(),
    app = new GameApp(b);
  app.command('start');
  app.session.world.player.xp = app.session.world.player.needed;
  app.session.offerUpgrade();
  app.sync(0, true);
  const index = app.session.world.choices.findIndex(
    (id) => UPGRADES.find((item) => item.id === id).kind === 'power',
  );
  assert(index >= 0);
  const card = b.elements.get('choices').children[index];
  assert.equal(card.attributes['data-power'], 'true');
  assert(card.children[1].textContent.includes('1/3'));
  assert(card.children[2].textContent.length > 0);
  card.fire('click');
  assert.equal(app.session.world.phase, PHASE.PLAYING);
  assert.equal(b.elements.get('power-bar').children.length, 2);
  assert(b.elements.get('power-bar').children[0].attributes['aria-label'].includes('nível 1'));
  app.dispose();
});

test('escolha inicial e reinício usam a arma selecionada, sem arma escondida', () => {
  const b = browser(),
    app = new GameApp(b);
  assert.equal(b.elements.get('weapon-options').children.length, 4);
  const option = b.elements
    .get('weapon-options')
    .children.find((button) => button.attributes['data-weapon'] === 'jab');
  option.fire('click');
  assert.equal(app.selectedWeapon, 'jab');
  b.elements.get('start').fire('click');
  assert.equal(app.session.world.player.jab, 1);
  assert.equal(app.session.world.player.cross, 0);
  app.session.world.player.jab = 3;
  b.elements.get('restart').fire('click');
  assert.equal(app.session.world.player.jab, 1);
  assert.equal(app.session.world.initialWeapon, 'jab');
  app.dispose();
});

test('sair pela pausa ou evolução limpa a partida, preserva recorde e permite começar de novo', () => {
  for (const menu of ['pause', 'upgrade']) {
    const b = browser();
    b.saved.set('neon-rush-best', '900');
    const app = new GameApp(b);
    app.selectWeapon('jab');
    b.elements.get('start').fire('click');
    const world = app.session.world;
    world.elapsed = 42;
    world.kills = 100;
    world.enemies.push(createEnemy('normal', 1200, 1100));
    app.effects.handle({ type: 'upper', x: 100, y: 100, radius: 80 });
    app.view.toast('INVASÃO!');
    if (menu === 'pause') b.elements.get('pause').fire('click');
    else {
      world.player.xp = world.player.needed;
      app.session.offerUpgrade();
      app.sync(0, true);
    }
    assert.equal(b.elements.get('exit').hidden, false);
    b.elements.get('exit').fire('click');
    assert.equal(app.session.world.phase, PHASE.HOME);
    assert.equal(b.elements.get('home').hidden, false);
    assert.equal(b.elements.get('modal').hidden, true);
    assert.equal(b.elements.get('controls').hidden, true);
    assert.equal(b.elements.get('hud').hidden, true);
    assert.equal(app.session.world.elapsed, 0);
    assert.equal(app.session.world.enemies.length, 0);
    assert.equal(app.effects.rings.length, 0);
    assert.equal(b.elements.get('toast').style.opacity, 0);
    assert.equal(app.best, 900);
    assert.equal(b.saved.get('neon-rush-best'), '900');
    assert.deepEqual(app.input.read(), { x: 0, y: 0 });
    b.elements.get('start').fire('click');
    assert.equal(app.session.world.phase, PHASE.PLAYING);
    assert.equal(app.session.world.player.jab, 1);
    assert.equal(app.session.world.elapsed, 0);
    app.dispose();
  }
});
