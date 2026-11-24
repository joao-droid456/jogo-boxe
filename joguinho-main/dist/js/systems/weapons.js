import { rollStats, crossStats, jabStats, upperStats } from '../content/weapons.js';
import { segmentCircleHit, clamp } from '../core/math.js';
import { CONFIG } from '../core/config.js';

export function hitEnemy(world, enemy, damage) {
  enemy.hp -= damage;
  enemy.hit = 0.12;
  const player = world.player;
  if (player.stagger > 0) {
    enemy.slowTime = 1 + player.stagger * 0.25;
    enemy.slowFactor = 0.75 - player.stagger * 0.1;
  }
}

export function nearestTargets(world, player, reach, count) {
  const targets = [];
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x,
      dy = enemy.y - player.y;
    const squared = dx * dx + dy * dy;
    if (squared > (reach + enemy.r) ** 2) continue;
    targets.push({ enemy, squared });
  }
  targets.sort((a, b) => a.squared - b.squared);
  return targets.slice(0, count).map((target) => target.enemy);
}

function pushEnemy(enemy, from, distance) {
  const length = Math.hypot(enemy.x - from.x, enemy.y - from.y) || 1;
  enemy.x = clamp(enemy.x + ((enemy.x - from.x) / length) * distance, 20, CONFIG.worldSize - 20);
  enemy.y = clamp(enemy.y + ((enemy.y - from.y) / length) * distance, 20, CONFIG.worldSize - 20);
}

function updateRoll(world, dt, emit) {
  const player = world.player;
  if (player.roll <= 0) return;
  const stats = rollStats(player);
  // A arrancada é o golpe principal do Dempsey Roll: o rolo atravessa a horda
  // e cada inimigo cruzado leva um soco uma única vez por impulso.
  if (world.dashActive) {
    const start = { x: player.previousX ?? player.x, y: player.previousY ?? player.y };
    let impacts = 0;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0 || enemy.lastRollDashId === world.dashId) continue;
      if (segmentCircleHit(start, player, enemy, enemy.r + player.r + 6) === null) continue;
      hitEnemy(world, enemy, stats.dashDamage);
      enemy.lastRollDashId = world.dashId;
      pushEnemy(enemy, player, stats.dashKnockback);
      if (impacts < 4) {
        emit({ type: 'rollHit', x: enemy.x, y: enemy.y, dash: true });
        impacts++;
      }
    }
  }
  world.weaponTimers.roll = Math.max(0, world.weaponTimers.roll - dt);
  if (world.weaponTimers.roll > 0) return;
  const [target] = nearestTargets(world, player, stats.reach, 1);
  if (!target) return;
  world.weaponTimers.roll = stats.interval;
  const dx = target.x - player.x,
    dy = target.y - player.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const aimX = Math.cos(angle),
    aimY = Math.sin(angle);
  const length = Math.min(stats.reach, distance + target.r);
  hitEnemy(world, target, stats.damage);
  target.x = clamp(target.x + aimX * stats.knockback, 20, CONFIG.worldSize - 20);
  target.y = clamp(target.y + aimY * stats.knockback, 20, CONFIG.worldSize - 20);
  emit({ type: 'rollHit', x: target.x, y: target.y });
  emit({
    type: 'rollPunch',
    x: player.x,
    y: player.y,
    angle,
    length,
    duration: stats.animation,
    side: world.rollSide,
  });
  world.rollSide = -world.rollSide;
}

function updateCross(world, dt, emit) {
  const player = world.player;
  if (player.cross <= 0) return;
  world.weaponTimers.cross = Math.max(0, world.weaponTimers.cross - dt);
  if (world.weaponTimers.cross > 0) return;
  const stats = crossStats(player);
  const [target] = nearestTargets(world, player, stats.reach, stats.count);
  if (!target) return;
  world.weaponTimers.cross = stats.interval;
  const dx = target.x - player.x,
    dy = target.y - player.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const aimX = Math.cos(angle),
    aimY = Math.sin(angle);
  const length = Math.min(stats.reach, distance + target.r);
  hitEnemy(world, target, stats.damage);
  target.x = clamp(target.x + aimX * stats.knockback, 20, CONFIG.worldSize - 20);
  target.y = clamp(target.y + aimY * stats.knockback, 20, CONFIG.worldSize - 20);
  emit({ type: 'crossHit', x: target.x, y: target.y, angle });
  emit({ type: 'cross', x: player.x, y: player.y, angle, length, duration: stats.animation });
}

function updateJab(world, dt, emit) {
  const player = world.player;
  if (player.jab <= 0) return;
  world.weaponTimers.jab = Math.max(0, world.weaponTimers.jab - dt);
  if (world.weaponTimers.jab > 0) return;
  const stats = jabStats(player);
  const targets = nearestTargets(world, player, stats.reach, stats.count);
  if (!targets.length) return;
  world.weaponTimers.jab = stats.interval;
  for (const target of targets) {
    if (target.hp <= 0) continue;
    const dx = target.x - player.x,
      dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const aimX = Math.cos(angle),
      aimY = Math.sin(angle);
    // O braço estica até o alvo e atinge quem estiver na linha do golpe.
    const length = Math.min(stats.reach, distance + target.r);
    const tip = { x: player.x + aimX * length, y: player.y + aimY * length };
    let hits = 0;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue;
      if (
        segmentCircleHit({ x: player.x, y: player.y }, tip, enemy, enemy.r + stats.fistRadius) ===
        null
      )
        continue;
      hitEnemy(world, enemy, stats.damage);
      enemy.x = clamp(enemy.x + aimX * stats.knockback, 20, CONFIG.worldSize - 20);
      enemy.y = clamp(enemy.y + aimY * stats.knockback, 20, CONFIG.worldSize - 20);
      emit({ type: 'jabHit', x: enemy.x, y: enemy.y, angle });
      hits++;
    }
    if (hits) {
      emit({
        type: 'jab',
        x: player.x,
        y: player.y,
        angle,
        length,
        duration: stats.animation,
      });
    }
  }
}

function updateUpper(world, dt, emit) {
  const player = world.player;
  if (player.upper <= 0) return;
  world.weaponTimers.upper = Math.max(0, world.weaponTimers.upper - dt);
  if (world.weaponTimers.upper > 0) return;
  const stats = upperStats(player);
  let hits = 0;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x,
      dy = enemy.y - player.y;
    const squared = dx * dx + dy * dy;
    if (squared > (stats.radius + enemy.r) ** 2) continue;
    hitEnemy(world, enemy, stats.damage);
    hits++;
    const length = Math.sqrt(squared) || 1;
    enemy.x = clamp(enemy.x + (dx / length) * stats.knockback, 20, CONFIG.worldSize - 20);
    enemy.y = clamp(enemy.y + (dy / length) * stats.knockback, 20, CONFIG.worldSize - 20);
  }
  if (hits > 0) {
    world.weaponTimers.upper = stats.interval;
    emit({
      type: 'upper',
      x: player.x,
      y: player.y,
      radius: stats.radius,
      angle: Math.atan2(world.direction.y, world.direction.x),
    });
  }
}

// Punhos e braços não criam projéteis; nenhuma luva gira ao redor do jogador.
export function updateWeapons(world, dt, emit) {
  updateRoll(world, dt, emit);
  updateCross(world, dt, emit);
  updateJab(world, dt, emit);
  updateUpper(world, dt, emit);
}
