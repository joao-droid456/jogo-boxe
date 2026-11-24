import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../dist/js/core/session.js';
import { CONFIG } from '../dist/js/core/config.js';
import { createEnemy, createElite } from '../dist/js/content/enemies.js';
import { spawnEnemies, isInvasion, getSpawnBudget } from '../dist/js/systems/spawning.js';

test('elite tem mais vida, tamanho, recompensa e dano que o tanque comum', () => {
  const normal = createEnemy('tank', 1200, 1100, 90),
    elite = createElite(1200, 1100, 90);
  assert(elite.hp > normal.hp);
  assert(elite.r > normal.r);
  assert(elite.experience > normal.experience);
  assert.equal(elite.hp, elite.maxHp);
  assert.equal(elite.contactDamage, 2);
  assert.equal(normal.contactDamage, 1);
});

test('elites entram progressivamente e nunca ultrapassam três ou o teto da horda', () => {
  const game = new GameSession();
  game.start();
  const world = game.world,
    events = [];
  const spawn = () => {
    world.spawnClock = 0;
    spawnEnemies(
      world,
      { width: 390, height: 844 },
      CONFIG.step,
      () => 0.5,
      (event) => events.push(event),
    );
  };
  world.elapsed = 44;
  spawn();
  assert(!world.enemies.some((e) => e.elite));
  world.elapsed = 45;
  spawn();
  assert.equal(world.enemies.filter((e) => e.elite).length, 1);
  assert.equal(events.filter((e) => e.type === 'eliteSpawned').length, 1);
  spawn();
  assert.equal(world.enemies.filter((e) => e.elite).length, 1);
  world.elapsed = 250;
  world.enemies = Array.from({ length: CONFIG.difficulty.maxElites }, () =>
    createElite(100, 100, 250),
  );
  world.nextEliteAt = 250;
  spawn();
  assert.equal(world.enemies.filter((e) => e.elite).length, 3);
  world.enemies = Array.from({ length: CONFIG.maxEnemies }, () => createEnemy('normal', 100, 100));
  spawn();
  assert.equal(world.enemies.length, CONFIG.maxEnemies);
});

test('elite causa dois pontos de dano, respeitando escudo e invulnerabilidade', () => {
  const game = new GameSession();
  game.start();
  const world = game.world,
    player = world.player;
  world.spawnClock = 1000;
  player.invincible = 0;
  const elite = createElite(player.x, player.y);
  elite.speed = 0;
  world.enemies.push(elite);
  game.update(CONFIG.step);
  assert.equal(player.hp, 3);
  game.update(CONFIG.step);
  assert.equal(player.hp, 3);
  player.invincible = 0;
  player.shield = 1;
  player.shieldReady = true;
  elite.x = player.x;
  elite.y = player.y;
  game.update(CONFIG.step);
  assert.equal(player.hp, 3);
  assert.equal(player.shieldReady, false);
});

test('invasões duram 12 segundos e aumentam aparições sem aumentar o limite', () => {
  assert.equal(isInvasion(59.9), false);
  assert.equal(isInvasion(60), true);
  assert.equal(isInvasion(71.9), true);
  assert.equal(isInvasion(72), false);
  assert.equal(isInvasion(120), true);
  const during = getSpawnBudget(60),
    after = getSpawnBudget(72);
  assert(during.interval < after.interval);
  assert(during.cap <= CONFIG.maxEnemies);
  assert(after.cap <= CONFIG.maxEnemies);
  const game = new GameSession();
  game.start();
  game.world.spawnClock = 1000;
  game.world.elapsed = 59.99;
  game.update(CONFIG.step);
  game.update(CONFIG.step);
  assert.equal(game.drainEvents().filter((event) => event.type === 'invasion').length, 1);
});
