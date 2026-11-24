import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../dist/js/core/session.js';
import { CONFIG, PHASE } from '../dist/js/core/config.js';
import { createEnemy } from '../dist/js/content/enemies.js';
import { UPGRADES, chooseUpgrades } from '../dist/js/content/upgrades.js';

function setup() {
  const game = new GameSession({ random: () => 0.5 });
  game.start();
  game.drainEvents();
  game.world.spawnClock = 1000;
  return game;
}

test('partidas e eventos são isolados; reiniciar limpa entidades e resultados', () => {
  const first = setup(),
    second = setup();
  first.world.player.hp = 1;
  first.world.gems.push({});
  assert.equal(second.world.player.hp, CONFIG.player.hp);
  first.start();
  assert.equal(first.world.gems.length, 0);
  assert.equal(first.world.result, null);
  assert.equal(first.world.player.hp, CONFIG.player.hp);
  assert.deepEqual(
    first.drainEvents().map((e) => e.type),
    ['started'],
  );
  assert.equal(first.drainEvents().length, 0);
});

test('movimento diagonal é normalizado e respeita os limites da arena', () => {
  const game = setup(),
    player = game.world.player,
    start = player.x;
  game.update(1 / 60, { x: 1, y: 1 });
  assert(Math.abs(Math.hypot(player.x - start, player.y - start) - player.speed / 60) < 1e-9);
  player.x = CONFIG.worldSize - 20;
  player.y = 20;
  game.update(1 / 60, { x: 1, y: -1 });
  assert.equal(player.x, CONFIG.worldSize - 20);
  assert.equal(player.y, 20);
});

test('pausa impede tempo, movimento, dano e dash; transições inválidas são ignoradas', () => {
  const game = setup();
  assert.equal(game.resume(), false);
  assert.equal(game.pause(), true);
  const snapshot = structuredClone(game.world);
  game.update(1, { x: 1, y: 0 });
  assert.deepEqual(game.world, snapshot);
  assert.equal(game.dash(), false);
  assert.equal(game.pause(), false);
  assert.equal(game.resume(), true);
  game.update(0.1);
  assert.equal(game.world.elapsed, 0.1);
  game.home();
  assert.equal(game.world.phase, PHASE.HOME);
  assert.equal(game.dash(), false);
});

test('dash dá impulso, invulnerabilidade e só se repete após cooldown', () => {
  const game = setup(),
    player = game.world.player;
  player.invincible = 0;
  game.world.direction = { x: 1, y: 0 };
  assert.equal(game.dash(), true);
  assert.equal(game.dash(), false);
  const x = player.x;
  game.update(1 / 60);
  assert(Math.abs(player.x - x - (player.speed * CONFIG.dash.multiplier) / 60) < 1e-9);
  assert(player.invincible > 0);
  for (let i = 0; i < 181; i++) game.update(1 / 60);
  assert.equal(game.dash(), true);
});

test('direto automático elimina sem duplicar energia ou pontos', () => {
  const game = setup();
  const enemy = createEnemy('fast', game.world.player.x + 70, game.world.player.y);
  enemy.speed = 0;
  game.world.enemies.push(enemy);
  for (let i = 0; i < 10; i++) game.update(1 / 60);
  assert.equal(game.world.kills, 1);
  assert.equal(game.world.enemies.length, 0);
  assert.equal(game.world.gems.length + game.world.player.xp, 1);
  game.update(1 / 60);
  assert.equal(game.world.kills, 1);
  assert(game.drainEvents().some((e) => e.type === 'cross' || e.type === 'crossHit'));
});

test('dano encerra a partida uma única vez', () => {
  const game = setup(),
    player = game.world.player;
  player.invincible = 0;
  player.hp = 1;
  game.world.enemies = [createEnemy('tank', player.x, player.y)];
  game.update(1 / 60);
  assert.equal(game.world.phase, PHASE.ENDED);
  assert.equal(game.world.result.won, false);
  assert.equal(player.hp, 0);
  game.update(1);
  assert.equal(player.hp, 0);
  assert.equal(game.drainEvents().filter((e) => e.type === 'ended').length, 1);
});

test('energia não ultrapassa jogador; cada nível exige uma escolha válida', () => {
  const game = setup(),
    player = game.world.player;
  game.world.gems = [{ x: player.x + 30, y: player.y, value: 30 }];
  game.update(0.1);
  assert.equal(game.world.gems.length, 0);
  assert.equal(game.world.phase, PHASE.UPGRADE);
  assert.equal(player.level, 2);
  assert.equal(new Set(game.world.choices).size, 3);
  const elapsed = game.world.elapsed;
  assert.equal(game.selectUpgrade('id-inexistente'), false);
  while (game.world.phase === PHASE.UPGRADE) {
    assert.equal(game.selectUpgrade(game.world.choices[0]), true);
    assert.equal(game.world.elapsed, elapsed);
  }
  assert(player.level >= 3);
  assert.equal(game.selectUpgrade('damage'), false);
});

test('catálogo usa IDs únicos, oferece poder e cura acima da vida máxima', () => {
  const player = { ...CONFIG.player };
  assert.equal(new Set(UPGRADES.map((u) => u.id)).size, UPGRADES.length);
  for (const rng of [() => 0, () => 0.5, () => 0.9999]) {
    const choices = chooseUpgrades(player, rng);
    assert.equal(new Set(choices).size, 3);
    assert(choices.some((id) => UPGRADES.find((item) => item.id === id).kind === 'power'));
  }
  UPGRADES.find((u) => u.id === 'repair').apply(player);
  assert.equal(player.hp, CONFIG.player.maxHp + 1);
});

test('vitória limita tempo e preserva o placar final', () => {
  const game = setup();
  game.world.elapsed = CONFIG.duration - 0.001;
  game.world.kills = 7;
  game.update(1 / 60);
  assert.equal(game.world.result.won, true);
  assert.equal(game.world.elapsed, CONFIG.duration);
  assert.equal(game.score, 700 + CONFIG.duration * 10);
  game.update(100);
  assert.equal(game.score, 700 + CONFIG.duration * 10);
});

test('simulação reproduzível não depende de DOM, áudio ou armazenamento', () => {
  function run() {
    const game = new GameSession({ random: () => 0.5 });
    game.start();
    for (let i = 0; i < 600; i++) game.update(1 / 60, { x: Math.sin(i), y: Math.cos(i) });
    return game.world;
  }
  assert.deepEqual(run(), run());
});
