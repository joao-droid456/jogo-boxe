import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../dist/js/core/session.js';
import { CONFIG } from '../dist/js/core/config.js';
import { createEnemy } from '../dist/js/content/enemies.js';
import { rollStats } from '../dist/js/content/weapons.js';
import { Effects } from '../dist/js/rendering/effects.js';

function setup() {
  const game = new GameSession();
  game.start('roll');
  game.world.spawnClock = 1000;
  return game;
}

test('arrancada do Dempsey Roll fere cada inimigo atravessado uma vez por impulso', () => {
  const game = setup(),
    world = game.world,
    player = world.player;
  world.weaponTimers.roll = 1000; // isola a arrancada dos socos curtos
  const enemy = createEnemy('tank', player.x + 60, player.y);
  enemy.hp = 100;
  enemy.speed = 0;
  world.enemies.push(enemy);
  assert.equal(game.dash(), true);
  let hit = false;
  for (let i = 0; i < 12; i++) {
    game.update(CONFIG.step, { x: 1, y: 0 });
    if (enemy.hp < 100) {
      hit = true;
      break;
    }
  }
  assert(hit, 'a arrancada atravessa o inimigo');
  const stats = rollStats(player);
  assert(Math.abs(enemy.hp - (100 - stats.dashDamage)) < 1e-9);
  const hp = enemy.hp;
  for (let i = 0; i < 8; i++) game.update(CONFIG.step, { x: 1, y: 0 });
  assert.equal(enemy.hp, hp, 'cada arrancada acerta o inimigo uma única vez');
});

test('socos do Dempsey Roll são curtos, alternados e não giram braços', () => {
  const game = setup(),
    world = game.world,
    player = world.player;
  const near = createEnemy('tank', player.x + 70, player.y),
    far = createEnemy('tank', player.x + 150, player.y);
  near.hp = far.hp = 100;
  near.speed = far.speed = 0;
  world.enemies.push(near, far);
  game.update(CONFIG.step);
  assert(near.hp < 100);
  assert.equal(far.hp, 100, 'o soco não alcança quem está longe');
  const first = game.drainEvents().find((event) => event.type === 'rollPunch');
  assert(first);
  assert(first.length <= rollStats(player).reach + 1);
  assert(Math.abs(first.side), 'o punho alterna de lado');
  world.weaponTimers.roll = 0;
  game.update(CONFIG.step);
  const second = game.drainEvents().find((event) => event.type === 'rollPunch');
  assert(second);
  assert.equal(second.side, -first.side);
  assert(!('rollers' in world), 'nenhuma luva gira ao redor do jogador');
});

test('evoluir fortalece a arrancada e acelera os socos curtos', () => {
  const game = setup(),
    player = game.world.player;
  const base = rollStats(player);
  player.roll = 3;
  const upgraded = rollStats(player);
  assert(upgraded.dashDamage > base.dashDamage);
  assert(upgraded.damage > base.damage);
  assert(upgraded.interval < base.interval);
  assert(upgraded.reach > base.reach);
});

test('impactos do Roll e do Uppercut respeitam o orçamento sem esconder o jab', () => {
  const effects = new Effects();
  for (let i = 0; i < 200; i++)
    effects.handle({ type: 'upper', x: 0, y: 0, radius: 60, angle: 0 });
  effects.handle({
    type: 'rollPunch',
    x: 0,
    y: 0,
    angle: 0,
    length: 75,
    duration: 0.18,
    side: 1,
  });
  effects.handle({ type: 'jab', x: 0, y: 0, angle: 0, length: 145, duration: 0.26 });
  assert(effects.arcs.length <= CONFIG.graphics.maxWeaponEffects);
  assert(effects.jabs.length, 'braços do Roll e do jab continuam visíveis');
});
