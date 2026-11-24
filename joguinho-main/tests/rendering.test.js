import test from 'node:test';
import assert from 'node:assert/strict';
import { CanvasRenderer } from '../dist/js/rendering/canvas-renderer.js';
import { RenderQuality } from '../dist/js/rendering/quality.js';
import { GameSession } from '../dist/js/core/session.js';
import { CONFIG } from '../dist/js/core/config.js';
import { Effects } from '../dist/js/rendering/effects.js';
import { createEnemy, createElite } from '../dist/js/content/enemies.js';
import { AudioService } from '../dist/js/platform/audio.js';

function canvasFixture() {
  const calls = [],
    writes = [];
  let created = 0;
  function context(record = false) {
    return new Proxy(
      {},
      {
        get: (target, key) =>
          key in target
            ? target[key]
            : (...args) => {
                if (record) calls.push({ key, args });
              },
        set: (target, key, value) => {
          target[key] = value;
          if (record) writes.push({ key, value });
          return true;
        },
      },
    );
  }
  const main = context(true);
  const canvas = {
    getContext: () => main,
    ownerDocument: {
      createElement() {
        created++;
        const ctx = context();
        return { getContext: () => ctx };
      },
    },
  };
  return { canvas, calls, writes, created: () => created };
}

test('arena usa sprites em cache, sem criar Canvas nem recalcular desfoque a cada quadro', () => {
  const fixture = canvasFixture(),
    renderer = new CanvasRenderer(fixture.canvas);
  renderer.resize(390, 844, 3);
  const count = fixture.created(),
    game = new GameSession();
  game.start();
  game.world.enemies = Array.from({ length: 200 }, (_, i) =>
    createEnemy('normal', 1000 + (i % 20), 1100),
  );
  game.world.gems = [{ x: 1100, y: 1200, value: 1 }];
  const effects = new Effects();
  renderer.render(game.world, effects, 1000);
  renderer.render(game.world, effects, 1016);
  assert.equal(fixture.created(), count, 'nenhuma imagem alocada durante a horda');
  assert(fixture.calls.filter((call) => call.key === 'drawImage').length >= 400);
  assert(
    !fixture.writes.some(({ key, value }) => key === 'shadowBlur' && value > 0),
    'desfoque só nas imagens pré-calculadas',
  );
  assert.equal(renderer.atlas.cache.size, 18, 'cache limitado às variantes visuais');
});

test('interpolação suaviza o desenho sem modificar posições da simulação', () => {
  const fixture = canvasFixture(),
    renderer = new CanvasRenderer(fixture.canvas);
  renderer.resize(390, 844, 1);
  const game = new GameSession();
  game.start();
  game.world.player.invincible = 0;
  game.world.player.previousX = 1000;
  game.world.player.previousY = 1100;
  game.world.player.x = 1010;
  game.world.player.y = 1100;
  const snapshot = structuredClone(game.world);
  renderer.render(game.world, new Effects(), 1000, 0.5);
  assert(
    fixture.calls.some(
      ({ key, args }) => key === 'translate' && args[0] === 1005 && args[1] === 1100,
    ),
  );
  assert.deepEqual(game.world, snapshot);
});

test('qualidade reduz resolução em quedas persistentes e recupera devagar', () => {
  const quality = new RenderQuality();
  let timestamp = 0;
  quality.observe(timestamp, true);
  for (let i = 0; i < 110; i++) {
    timestamp += 33;
    quality.observe(timestamp, true);
  }
  assert.equal(quality.level, 2);
  assert.equal(quality.scale, 0.65);
  for (let i = 0; i < 200; i++) {
    timestamp += 16;
    quality.observe(timestamp, true);
  }
  assert.equal(quality.level, 2, 'não alterna qualidade em poucos quadros bons');
  for (let i = 0; i < 700; i++) {
    timestamp += 16;
    quality.observe(timestamp, true);
  }
  assert(quality.level < 2);
  const before = quality.level;
  quality.observe(timestamp + 60000, false);
  quality.observe(timestamp + 120000, true);
  assert.equal(quality.level, before, 'pausas longas não contam como queda de FPS');
});

test('qualidade baixa corta apenas efeitos; regras e limites da horda são preservados', () => {
  const fixture = canvasFixture(),
    renderer = new CanvasRenderer(fixture.canvas);
  renderer.resize(390, 844, 3);
  const initialPixels = fixture.canvas.width * fixture.canvas.height;
  const game = new GameSession();
  game.start();
  const snapshot = structuredClone(game.world);
  const effects = new Effects();
  for (let i = 0; i < 120; i++) renderer.render(game.world, effects, i * 33);
  assert(fixture.canvas.width * fixture.canvas.height < initialPixels);
  assert.deepEqual(game.world, snapshot);
  assert.equal(CONFIG.maxEnemies, 200);
  effects.burst(0, 0, '#fff', CONFIG.graphics.maxParticles);
  effects.setQuality(2);
  assert(effects.particles.length <= CONFIG.graphics.maxParticles * 0.3);
});

test('personagem e inimigos mantêm brilho, contorno e núcleo vetorial na qualidade baixa', () => {
  const fixture = canvasFixture(),
    renderer = new CanvasRenderer(fixture.canvas);
  renderer.resize(390, 844, 3);
  const game = new GameSession();
  game.start();
  game.world.player.invincible = 0;
  game.world.enemies = [
    createEnemy('normal', 1150, 1100),
    createEnemy('fast', 1100, 1150),
    createEnemy('tank', 1050, 1100),
  ];
  const effects = new Effects();
  for (let i = 0; i < 120; i++) renderer.render(game.world, effects, i * 33);
  assert.equal(renderer.quality.level, 2);
  assert(renderer.viewport.dpr >= 1, 'resolução não fica abaixo do tamanho CSS no celular');
  fixture.calls.length = 0;
  renderer.render(game.world, effects, 4000);
  assert(
    fixture.calls.some(({ key }) => key === 'arc'),
    'centro do personagem preservado',
  );
  assert(
    fixture.calls.filter(({ key }) => key === 'fillRect').length >= 4,
    'núcleos dos três inimigos preservados',
  );
  const actorSprites = fixture.calls
    .filter(({ key }) => key === 'drawImage')
    .map(({ args }) => args[0]);
  assert(actorSprites.includes(renderer.atlas.player(true).canvas));
  assert(
    fixture.writes.some(({ key, value }) => key === 'fillStyle' && value === '#a855f7'),
    'personagem roxo',
  );
  for (const type of ['normal', 'fast', 'tank'])
    assert(actorSprites.includes(renderer.atlas.enemy(type, false, true).canvas));
  assert(!fixture.writes.some(({ key, value }) => key === 'shadowBlur' && value > 0));
});

test('coleta em massa limita vozes de áudio e libera nós ao terminar', () => {
  let created = 0;
  const oscillators = [];
  const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  const context = {
    currentTime: 0,
    state: 'running',
    destination: {},
    createOscillator() {
      created++;
      const oscillator = {
        frequency: parameter,
        connect() {},
        disconnect() {},
        start() {},
        stop() {},
      };
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain: () => ({ gain: parameter, connect() {}, disconnect() {} }),
    close: () => Promise.resolve(),
  };
  const audio = new AudioService(() => context);
  audio.toggle();
  for (let i = 0; i < 700; i++) audio.handle({ type: 'energy' });
  assert.equal(created, 2, 'um som de ativação e um de coleta');
  for (let i = 0; i < 100; i++) audio.play(440);
  assert.equal(created, 8);
  assert.equal(audio.activeVoices.size, 8);
  for (const oscillator of oscillators) oscillator.onended();
  assert.equal(audio.activeVoices.size, 0);
  audio.dispose();
});

test('socos, arrancada, guarda e Uppercut aparecem sem alterar a simulação', () => {
  const fixture = canvasFixture(),
    renderer = new CanvasRenderer(fixture.canvas);
  renderer.resize(390, 844, 1);
  const game = new GameSession();
  game.start('roll');
  game.world.player.jab = 1;
  game.world.player.upper = 1;
  game.world.player.shield = 1;
  game.world.player.shieldReady = true;
  game.world.spawnClock = 1000;
  const enemy = createEnemy('normal', 1170, 1100);
  enemy.hp = 100;
  enemy.speed = 0;
  game.world.enemies.push(enemy);
  assert.equal(game.dash(), true);
  game.update(CONFIG.step, { x: 1, y: 0 });
  const effects = new Effects();
  for (const event of game.drainEvents()) effects.handle(event);
  effects.update(CONFIG.step, game.world.player);
  const snapshot = structuredClone(game.world);
  renderer.render(game.world, effects, 1000);
  assert(
    fixture.calls.some(({ key, args }) => key === 'arc' && args[2] === 23),
    'guarda alta',
  );
  assert(
    fixture.calls.some(({ key, args }) => key === 'arc' && args[2] === 8),
    'punho curto do Dempsey Roll',
  );
  assert(
    fixture.calls.some(({ key, args }) => key === 'arc' && args[2] === 7),
    'luva do jab',
  );
  assert(
    fixture.calls.some(({ key, args }) => key === 'arc' && args[2] === 11),
    'punho subindo no Uppercut',
  );
  assert(effects.jabs.some((jab) => jab.style === 'roll'), 'soco do Roll animado');
  assert(effects.jabs.some((jab) => jab.style === 'jab'), 'braço do jab animado');
  assert(effects.arcs.some((arc) => arc.type === 'upper'), 'animação ascendente');
  assert(
    effects.rings.some((ring) => ring.color === '#ff9d3c'),
    'onda do Uppercut',
  );
  assert.deepEqual(game.world, snapshot);
});

test('punho do Uppercut acompanha o jogador durante a animação', () => {
  const effects = new Effects();
  effects.handle({ type: 'upper', x: 100, y: 100, radius: 60, angle: 0 });
  assert.equal(effects.arcs[0].x, 100);
  effects.update(0.05, { x: 160, y: 130 });
  const upper = effects.arcs.find((arc) => arc.type === 'upper');
  assert(upper);
  assert.equal(upper.x, 160);
  assert.equal(upper.y, 130);
});

test('elite usa contorno dourado, halo dimensionado e barra de vida', () => {
  const fixture = canvasFixture(),
    renderer = new CanvasRenderer(fixture.canvas);
  renderer.resize(390, 844, 1);
  const game = new GameSession();
  game.start();
  const elite = createElite(1200, 1100, 90);
  game.world.enemies.push(elite);
  renderer.render(game.world, new Effects(), 1000);
  assert(fixture.writes.some(({ key, value }) => key === 'strokeStyle' && value === '#ffd17c'));
  assert(fixture.calls.some(({ key, args }) => key === 'arc' && args[2] === elite.r + 5));
  assert(
    fixture.calls.some(
      ({ key, args }) => key === 'fillRect' && args[2] === elite.r * 2 && args[3] === 4,
    ),
  );
  const sprite = renderer.atlas.enemy(elite.type, false, true);
  assert(
    fixture.calls.some(
      ({ key, args }) => key === 'drawImage' && args[0] === sprite.canvas && args[3] > sprite.size,
    ),
  );
});
