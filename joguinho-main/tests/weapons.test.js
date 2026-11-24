import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../dist/js/core/session.js';
import { CONFIG, PHASE } from '../dist/js/core/config.js';
import {
  WEAPONS,
  crossStats,
  jabStats,
  rollStats,
  upperStats,
} from '../dist/js/content/weapons.js';
import { UPGRADES, chooseUpgrades } from '../dist/js/content/upgrades.js';
import { createEnemy } from '../dist/js/content/enemies.js';
import { moveEnemies } from '../dist/js/systems/movement.js';
import { Effects } from '../dist/js/rendering/effects.js';

function setup(weapon = 'cross') {
  const game = new GameSession({ random: () => 0.5 });
  game.start(weapon);
  game.world.spawnClock = 1000;
  return game;
}
function addEnemy(world, x, y) {
  const enemy = createEnemy('normal', x, y);
  enemy.hp = 100;
  enemy.speed = 0;
  world.enemies.push(enemy);
  return enemy;
}
const upgrade = (id, player) => UPGRADES.find((item) => item.id === id).apply(player);

test('quatro armas de boxe válidas; só a escolhida inicia equipada', () => {
  for (const weapon of Object.values(WEAPONS)) {
    const game = setup(weapon.id),
      world = game.world;
    for (const stat of ['cross', 'jab', 'roll', 'upper'])
      assert.equal(world.player[stat], stat === weapon.stat ? 1 : 0);
    addEnemy(world, 1200, 1100);
    game.update(CONFIG.step);
    assert.equal(world.initialWeapon, weapon.id);
    assert.equal(world.phase, PHASE.PLAYING);
  }
  const game = setup();
  const world = game.world;
  assert.equal(game.start('arma-inexistente'), false);
  assert.equal(game.start('__proto__'), false);
  assert.equal(game.world, world);
});

test('Dempsey Roll soca de perto e usa a arrancada como golpe principal', () => {
  const game = setup('roll'),
    world = game.world;
  const near = addEnemy(world, 1170, 1100),
    far = addEnemy(world, 1300, 1100);
  game.update(CONFIG.step);
  assert(near.hp < 100);
  assert.equal(far.hp, 100);
  assert(world.weaponTimers.roll > 0);
  const events = game.drainEvents();
  assert(events.some((event) => event.type === 'rollPunch'));
  assert(events.some((event) => event.type === 'rollHit' && !event.dash));
  assert(!('rollers' in world), 'nenhuma luva gira ao redor do jogador');
  assert.equal(world.player.roll, 1);
});

test('alcances: jab é o maior, Direto é médio e Roll/Uppercut são curtos', () => {
  const player = { ...CONFIG.player, cross: 1, jab: 1, roll: 1, upper: 1 };
  const jab = jabStats(player),
    cross = crossStats(player),
    roll = rollStats(player),
    upper = upperStats(player);
  assert(jab.reach > cross.reach);
  assert(cross.reach > roll.reach);
  assert(cross.reach > upper.radius);
  assert(upper.damage > cross.damage);
  assert(upper.damage > roll.dashDamage);
  assert(roll.dashDamage > cross.damage * 0.9, 'a arrancada do Roll é a parte forte do estilo');
});

test('jab elástico estica até o alvo mais próximo e atinge a linha do golpe', () => {
  const game = setup('jab'),
    world = game.world;
  const target = addEnemy(world, 1160, 1100),
    inLine = addEnemy(world, 1185, 1100),
    offLine = addEnemy(world, 1100, 1240);
  game.update(CONFIG.step);
  assert(target.hp < 100);
  assert(inLine.hp < 100);
  assert.equal(offLine.hp, 100);
  const events = game.drainEvents();
  assert(events.some((event) => event.type === 'jab' && event.length > 0));
  assert(events.some((event) => event.type === 'jabHit'));
  const hp = target.hp;
  game.update(CONFIG.step);
  assert.equal(target.hp, hp);
});

test('direto atinge só o alvo mais próximo e arremessa com força', () => {
  const game = setup(),
    world = game.world;
  const target = addEnemy(world, 1220, 1100),
    behind = addEnemy(world, 1245, 1100);
  game.update(CONFIG.step);
  assert(target.hp < 100);
  assert.equal(behind.hp, 100);
  assert(target.x > 1220);
  const events = game.drainEvents();
  assert(events.some((event) => event.type === 'cross'));
  assert(events.some((event) => event.type === 'crossHit'));
});

test('Uppercut atinge colado, empurra, respeita alcance curto e não repete a cada passo', () => {
  const game = setup('upper'),
    world = game.world;
  const near = addEnemy(world, 1150, 1100),
    far = addEnemy(world, 1400, 1100);
  game.update(CONFIG.step);
  assert(near.hp < 100);
  assert(near.x > 1150);
  assert.equal(far.hp, 100);
  const events = game.drainEvents();
  assert(events.some((event) => event.type === 'upper' && event.radius < 100));
  assert(events.some((event) => event.type === 'upper' && typeof event.angle === 'number'));
  const hp = near.hp;
  game.update(CONFIG.step);
  assert.equal(near.hp, hp);
});

test('alcance torna o jab distante possível; atordoamento reduz movimento e expira', () => {
  const game = setup('jab'),
    world = game.world,
    player = world.player;
  const enemy = addEnemy(world, 1340, 1100);
  enemy.speed = 60;
  game.update(CONFIG.step);
  assert.equal(enemy.hp, 100);
  upgrade('reach', player);
  upgrade('reach', player);
  upgrade('stagger', player);
  world.weaponTimers.jab = 0;
  game.update(CONFIG.step);
  assert(enemy.hp < 100);
  assert(enemy.slowTime > 0);
  const x = enemy.x;
  moveEnemies(world, 0.1);
  assert(x - enemy.x < 6);
  moveEnemies(world, 2);
  assert.equal(enemy.slowTime, 0);
  assert.equal(enemy.speed, 60);
});

test('guarda alta bloqueia uma colisão e recarrega apenas com a partida em andamento', () => {
  const game = setup(),
    world = game.world,
    player = world.player;
  player.hp = 2;
  player.invincible = 0;
  player.cross = 0;
  upgrade('shield', player);
  addEnemy(world, player.x, player.y);
  game.update(CONFIG.step);
  assert.equal(player.hp, 2);
  assert.equal(player.shieldReady, false);
  const cooldown = player.shieldCooldown;
  game.pause();
  game.update(20);
  assert.equal(player.shieldCooldown, cooldown);
  game.resume();
  world.enemies = [];
  for (let i = 0; i < 121; i++) game.update(0.1);
  assert.equal(player.shieldReady, true);
  assert.equal(player.hp, 2);
});

test('segundo fôlego cura por nocautes sem ultrapassar a vida máxima', () => {
  const game = setup(),
    world = game.world;
  upgrade('leech', world.player);
  world.player.hp = 1;
  world.enemies = Array.from({ length: 25 }, () => {
    const enemy = createEnemy('normal', 1400, 1100);
    enemy.hp = 0;
    return enemy;
  });
  game.update(CONFIG.step);
  assert.equal(world.kills, 25);
  assert.equal(world.player.hp, 2);
  world.player.hp = world.player.maxHp;
  world.enemies = Array.from({ length: 25 }, () => {
    const enemy = createEnemy('normal', 1400, 1100);
    enemy.hp = 0;
    return enemy;
  });
  game.update(CONFIG.step);
  assert.equal(world.player.hp, world.player.maxHp);
});

test('armas podem combinar e as cartas sempre oferecem um poder', () => {
  for (const random of [() => 0, () => 0.5, () => 0.9999]) {
    const player = { ...CONFIG.player };
    const choices = chooseUpgrades(player, random);
    assert.equal(new Set(choices).size, 3);
    assert(choices.some((id) => UPGRADES.find((item) => item.id === id).kind === 'power'));
  }
  const game = setup('roll');
  upgrade('weapon-cross', game.world.player);
  const enemy = addEnemy(game.world, 1220, 1100);
  game.update(CONFIG.step);
  assert.equal(game.world.player.cross, 1);
  assert(enemy.hp < 100);
  assert(!('rollers' in game.world));
});

test('armas e passivas respeitam níveis, pré-requisitos e limites de efeitos', () => {
  const game = setup('jab'),
    player = game.world.player;
  const meleeOnly = UPGRADES.find((item) => item.id === 'stagger');
  assert.equal(
    meleeOnly.available({ ...CONFIG.player, cross: 0, jab: 0, roll: 0, upper: 0 }),
    false,
  );
  assert.equal(meleeOnly.available(player), true);
  for (const item of UPGRADES.filter((item) => item.kind === 'weapon' || item.kind === 'passive')) {
    for (let i = 0; i < 3; i++) item.apply(player);
    assert.equal(player[item.stat], 3);
    assert.equal(item.available(player), false);
  }
  const effects = new Effects();
  for (let i = 0; i < 200; i++)
    effects.handle({ type: 'jab', x: 0, y: 0, angle: 0, length: 200, duration: 0.26 });
  assert.equal(effects.jabs.length, CONFIG.graphics.maxJabs);
  effects.update(1, player);
  assert.equal(effects.jabs.length, 0);
  game.start('jab');
  assert.equal(game.world.player.stagger, 0);
  assert.equal(game.world.player.shield, 0);
  assert.equal(game.world.weaponTimers.roll, 0);
  assert.equal(game.world.phase, PHASE.PLAYING);
});

test('Ritmo de luta aumenta a frequência dos jabs sem criar projéteis', () => {
  function countAttacks(upgraded) {
    const game = setup('jab');
    const target = addEnemy(game.world, 1200, 1100);
    target.hp = Infinity;
    if (upgraded) for (let i = 0; i < 3; i++) upgrade('overdrive', game.world.player);
    for (let i = 0; i < 360; i++) {
      target.x = 1200;
      target.y = 1100;
      game.update(CONFIG.step);
    }
    assert.equal(game.world.player.roll, 0);
    return game.drainEvents().filter((event) => event.type === 'jab').length;
  }
  assert(countAttacks(true) > countAttacks(false) * 1.5);
});

test('jab e Uppercut guardam a recarga e atacam assim que o alvo entra no alcance', () => {
  for (const weapon of ['jab', 'upper']) {
    const game = setup(weapon);
    for (let i = 0; i < 180; i++) game.update(CONFIG.step);
    assert.equal(game.world.weaponTimers[weapon], 0);
    assert(!game.drainEvents().some((event) => event.type === weapon));
    const target = addEnemy(game.world, 1160, 1100);
    game.update(CONFIG.step);
    assert(target.hp < 100);
    assert(game.world.weaponTimers[weapon] > 0);
    const hp = target.hp;
    game.update(CONFIG.step);
    assert.equal(target.hp, hp);
  }
});

test('jab reconhece inimigo cuja borda já está no alcance', () => {
  const game = setup('jab');
  const target = addEnemy(game.world, 1330, 1100);
  game.update(CONFIG.step);
  assert(target.hp < 100);
});
