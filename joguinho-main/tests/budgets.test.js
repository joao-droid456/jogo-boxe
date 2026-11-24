import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, PHASE } from '../dist/js/core/config.js';
import { GameSession } from '../dist/js/core/session.js';
import { getSpawnBudget, spawnEnemies } from '../dist/js/systems/spawning.js';
import { createEnemy } from '../dist/js/content/enemies.js';
import { Effects } from '../dist/js/rendering/effects.js';
import { CanvasRenderer } from '../dist/js/rendering/canvas-renderer.js';

test('partida dura cinco minutos e não termina na antiga marca de três', () => {
  assert.equal(CONFIG.duration, 300);
  const game = new GameSession();
  game.start();
  game.world.elapsed = 179.99;
  game.world.spawnClock = 1000;
  game.update(1 / 60);
  assert.equal(game.world.phase, PHASE.PLAYING);
  game.world.elapsed = 299.99;
  game.update(1 / 60);
  assert.equal(game.world.result.won, true);
  assert.equal(game.world.elapsed, 300);
});

test('horda cresce sem ultrapassar seu orçamento mesmo no final', () => {
  assert(getSpawnBudget(0).cap < getSpawnBudget(120).cap);
  assert(getSpawnBudget(0).interval > getSpawnBudget(240).interval);
  for (const elapsed of [0, 120, 299]) {
    const game = new GameSession();
    game.start();
    const world = game.world;
    world.elapsed = elapsed;
    const budget = getSpawnBudget(elapsed);
    for (let i = 0; i < budget.cap - 1; i++) world.enemies.push(createEnemy('normal', 100, 100));
    world.spawnClock = -1;
    spawnEnemies(world, { width: 390, height: 844 }, 1 / 60, () => 0.5);
    assert.equal(world.enemies.length, budget.cap);
    assert(world.enemies.length <= CONFIG.maxEnemies);
  }
});

test('rajadas e mortes simultâneas respeitam limites de golpes e partículas', () => {
  const effects = new Effects(() => 0.5);
  for (let i = 0; i < 200; i++) effects.handle({ type: 'kill', x: 10, y: 10, enemyType: 'normal' });
  for (let i = 0; i < 200; i++)
    effects.handle({ type: 'jab', x: 10, y: 10, angle: 0, length: 160, duration: 0.26 });
  for (let i = 0; i < 200; i++)
    effects.handle({ type: 'upper', x: 10, y: 10, radius: 60, angle: 0 });
  assert.equal(effects.particles.length, CONFIG.graphics.maxParticles);
  assert.equal(effects.jabs.length, CONFIG.graphics.maxJabs);
  assert.equal(effects.arcs.length, CONFIG.graphics.maxWeaponEffects);
  const sameArray = effects.particles;
  effects.update(1, { dashTime: 0 });
  assert.equal(effects.particles, sameArray);
  assert.equal(effects.particles.length, 0);
  assert.equal(effects.jabs.length, 0);
  assert.equal(effects.arcs.length, 0);
});

test('renderizador evita desenhos fora da tela e limita os pixels em telas grandes', () => {
  let draws = 0;
  const context = new Proxy(
    {},
    {
      get: (target, key) =>
        key in target
          ? target[key]
          : () => {
              draws++;
            },
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  const canvas = { getContext: () => context };
  const renderer = new CanvasRenderer(canvas);
  renderer.resize(3840, 2160, 3);
  assert(canvas.width * canvas.height <= CONFIG.graphics.maxPixels);
  renderer.resize(390, 844, 3);
  const game = new GameSession();
  game.start();
  const effects = new Effects();
  renderer.render(game.world, effects, 10);
  const baseline = draws;
  draws = 0;
  for (let i = 0; i < CONFIG.maxEnemies; i++)
    game.world.enemies.push(createEnemy('normal', 50, 50));
  renderer.render(game.world, effects, 10);
  assert.equal(draws, baseline, 'inimigos fora da tela não emitem comandos Canvas');
  assert.equal(game.world.enemies.length, CONFIG.maxEnemies, 'simulação preservada');
});
