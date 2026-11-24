import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../dist/js/core/session.js';
import { CONFIG, PHASE } from '../dist/js/core/config.js';
import { UPGRADES, chooseUpgrades } from '../dist/js/content/upgrades.js';
import { createEnemy } from '../dist/js/content/enemies.js';
import { jabStats, flurryStats } from '../dist/js/content/weapons.js';
import { Effects } from '../dist/js/rendering/effects.js';

function gameWithNoSpawns() {
  const game = new GameSession({ random: () => 0.5 });
  game.start();
  game.world.spawnClock = 1000;
  const player = game.world.player;
  player.cross = player.jab = player.roll = player.upper = 0;
  return game;
}

test('sequência de golpes atinge vários ao redor, respeita recarga e pausa', () => {
  const game = gameWithNoSpawns(),
    world = game.world,
    player = world.player;
  player.flurry = 2;
  player.damage = 1;
  world.enemies = [60, -60, 140, -140].map((offset) => {
    const enemy = createEnemy('normal', player.x + offset, player.y);
    enemy.hp = 100;
    enemy.speed = 0;
    return enemy;
  });
  game.update(CONFIG.step);
  const stats = flurryStats(player);
  assert(world.enemies.every((enemy) => enemy.hp === 100 - stats.damage));
  assert(world.flurryClock > 0);
  assert(game.drainEvents().some((event) => event.type === 'jab'));
  const hp = world.enemies[0].hp;
  game.update(CONFIG.step);
  assert.equal(world.enemies[0].hp, hp);
  game.pause();
  const clock = world.flurryClock;
  game.update(2);
  assert.equal(world.flurryClock, clock);
});

test('choque de ombro acerta uma vez por arrancada e reduz a recarga', () => {
  const game = gameWithNoSpawns(),
    world = game.world,
    player = world.player;
  player.shoulder = 1;
  player.damage = 2;
  const enemy = createEnemy('tank', player.x + 6, player.y);
  enemy.hp = 100;
  enemy.speed = 0;
  world.enemies.push(enemy);
  assert.equal(game.dash(), true);
  assert(player.dash < CONFIG.dash.cooldown);
  game.update(CONFIG.step);
  const first = 100 - player.damage * (1.8 + player.shoulder * 0.5);
  assert(Math.abs(enemy.hp - first) < 1e-9);
  game.update(CONFIG.step);
  assert(Math.abs(enemy.hp - first) < 1e-9);
  player.dash = 0;
  enemy.x = player.x;
  enemy.y = player.y;
  game.dash();
  game.update(CONFIG.step);
  assert(enemy.hp < first);
});

test('adrenalina acelera os golpes após um nocaute e expira', () => {
  const game = gameWithNoSpawns(),
    world = game.world,
    player = world.player;
  player.adrenaline = 1;
  player.magnet = 0;
  const enemy = createEnemy('normal', player.x + 40, player.y);
  enemy.hp = 0;
  world.enemies.push(enemy);
  game.update(CONFIG.step);
  assert.equal(world.kills, 1);
  assert.equal(player.adrenalineTime, 1.6);
  const boosted = jabStats(player).interval;
  player.adrenalineTime = 0;
  assert(jabStats(player).interval > boosted);
  for (let i = 0; i < 100; i++) game.update(CONFIG.step);
  assert.equal(player.adrenalineTime, 0);
  assert.equal(world.phase, PHASE.PLAYING);
});

test('impactos sacodem a tela de leve e efeitos continuam limitados', () => {
  const effects = new Effects();
  for (let i = 0; i < 200; i++) effects.handle({ type: 'jabHit', x: 0, y: 0 });
  assert.equal(effects.particles.length, CONFIG.graphics.maxParticles);
  assert(effects.shake > 0 && effects.shake <= 14);
  effects.handle({ type: 'crossHit', x: 0, y: 0 });
  assert(effects.shake >= 4.2);
  assert(effects.rings.length > 0 && effects.rings.length <= CONFIG.graphics.maxRings);
  for (let i = 0; i < 200; i++)
    effects.handle({ type: 'jab', x: 0, y: 0, angle: 0, length: 120, duration: 0.26 });
  assert.equal(effects.jabs.length, CONFIG.graphics.maxJabs);
  effects.update(1, { dashTime: 0 });
  assert.equal(effects.rings.length, 0);
  assert.equal(effects.jabs.length, 0);
  assert.equal(effects.particles.length, 0);
  assert.equal(effects.shake, 0);
});

test('escolhas oferecem um poder por vez, respeitam três níveis e reiniciar limpa poderes', () => {
  const powers = UPGRADES.filter((item) => item.kind === 'power');
  for (const random of [() => 0, () => 0.5, () => 0.9999]) {
    const player = { ...CONFIG.player };
    const choices = chooseUpgrades(player, random);
    assert.equal(new Set(choices).size, 3);
    assert(choices.some((id) => powers.some((item) => item.id === id)));
    for (const power of powers) {
      for (let i = 0; i < 3; i++) power.apply(player);
      assert.equal(power.available(player), false);
      assert.equal(player[power.stat], 3);
    }
    assert(!chooseUpgrades(player, random).some((id) => powers.some((item) => item.id === id)));
  }
  const game = gameWithNoSpawns();
  game.world.player.flurry = 3;
  game.world.player.shoulder = 2;
  game.world.player.adrenaline = 1;
  game.start();
  const player = game.world.player;
  assert.equal(player.flurry, 0);
  assert.equal(player.shoulder, 0);
  assert.equal(player.adrenaline, 0);
  assert.equal(player.adrenalineTime, 0);
  assert.equal(game.world.phase, PHASE.PLAYING);
});
