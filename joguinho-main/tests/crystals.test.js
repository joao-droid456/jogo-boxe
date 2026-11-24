import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../dist/js/core/session.js';
import { CONFIG } from '../dist/js/core/config.js';
import { createEnemy } from '../dist/js/content/enemies.js';
import { CanvasRenderer } from '../dist/js/rendering/canvas-renderer.js';
import { Effects } from '../dist/js/rendering/effects.js';

function gameWithoutSpawns() {
  const game = new GameSession();
  game.start();
  game.world.spawnClock = 1000;
  return game;
}

test('morte deixa cristal visível mesmo dentro do ímã; depois coleta uma única vez', () => {
  const game = gameWithoutSpawns(),
    world = game.world;
  world.player.magnet = 2000;
  const enemy = createEnemy('normal', world.player.x + 10, world.player.y);
  enemy.hp = 0;
  world.enemies.push(enemy);
  game.update(CONFIG.step);
  assert.equal(world.kills, 1);
  assert.equal(world.gems.length, 1);
  assert.equal(world.player.xp, 0);
  const gem = world.gems[0];
  const originalX = gem.x;
  for (let i = 0; i < 8; i++) game.update(CONFIG.step);
  assert.equal(world.gems.length, 1);
  assert.equal(gem.x, originalX);
  assert.equal(world.player.xp, 0, 'não coleta antes da janela de exibição');
  for (let i = 0; i < 25; i++) game.update(CONFIG.step);
  assert.equal(world.gems.length, 0);
  assert.equal(world.player.xp, 1);
  game.update(CONFIG.step);
  assert.equal(world.player.xp, 1);
});

test('cristais de inimigos comuns e tanques ficam no chão fora do alcance do ímã', () => {
  const game = gameWithoutSpawns(),
    world = game.world;
  world.enemies = ['normal', 'tank'].map((type, i) => {
    const enemy = createEnemy(type, world.player.x + 300 + i * 50, world.player.y);
    enemy.hp = 0;
    return enemy;
  });
  for (let i = 0; i < 120; i++) game.update(CONFIG.step);
  assert.equal(world.gems.length, 2);
  assert.deepEqual(
    world.gems.map((gem) => gem.value),
    [1, 3],
  );
  assert.equal(world.player.xp, 0);
});

test('cristal tem corpo, contorno e centro visíveis mesmo sem imagem de cache e com qualidade baixa', () => {
  for (const hasCache of [false, true]) {
    const calls = [];
    let color = '';
    const context = new Proxy(
      {},
      {
        get: (target, key) =>
          key in target ? target[key] : (...args) => calls.push({ key, args, color }),
        set: (target, key, value) => {
          target[key] = value;
          if (key === 'fillStyle') color = value;
          return true;
        },
      },
    );
    const canvas = { getContext: () => context };
    if (hasCache)
      canvas.ownerDocument = {
        createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {} }) }),
      };
    const renderer = new CanvasRenderer(canvas);
    renderer.resize(390, 844, 2);
    renderer.quality.level = 2;
    const game = gameWithoutSpawns();
    game.world.gems.push({ x: 1200, y: 1100, value: 1 });
    renderer.render(game.world, new Effects(), 1000);
    assert(calls.some((call) => call.key === 'fill' && call.color === '#4eeaff'));
    assert(calls.some((call) => call.key === 'fillRect' && call.color === '#f0ffff'));
    assert(calls.some((call) => call.key === 'stroke'));
  }
});
