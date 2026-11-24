import { segmentCircleHit, clamp } from '../core/math.js';
import { flurryStats } from '../content/weapons.js';
import { hitEnemy, nearestTargets } from './weapons.js';
import { CONFIG } from '../core/config.js';

export function updatePowers(world, dt, emit) {
  const player = world.player;
  // Choque de ombro: a arrancada acerta cada inimigo atravessado uma única vez.
  if (player.shoulder > 0 && world.dashActive) {
    const start = { x: player.previousX ?? player.x, y: player.previousY ?? player.y };
    const damage = player.damage * (1.8 + player.shoulder * 0.5);
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0 || enemy.lastDashId === world.dashId) continue;
      if (segmentCircleHit(start, player, enemy, enemy.r + player.r + 8) === null) continue;
      hitEnemy(world, enemy, damage);
      enemy.lastDashId = world.dashId;
      const length = Math.hypot(enemy.x - player.x, enemy.y - player.y) || 1;
      enemy.x = clamp(enemy.x + ((enemy.x - player.x) / length) * 26, 20, CONFIG.worldSize - 20);
      enemy.y = clamp(enemy.y + ((enemy.y - player.y) / length) * 26, 20, CONFIG.worldSize - 20);
      emit({ type: 'shoulderHit', x: enemy.x, y: enemy.y });
    }
  }

  if (player.flurry <= 0) return;
  world.flurryClock -= dt;
  if (world.flurryClock > 0) return;
  const stats = flurryStats(player);
  const targets = nearestTargets(world, player, stats.radius, stats.count);
  if (!targets.length) return;
  world.flurryClock = stats.interval;
  for (const target of targets) {
    const dx = target.x - player.x,
      dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    hitEnemy(world, target, stats.damage);
    target.x = clamp(target.x + Math.cos(angle) * stats.knockback, 20, CONFIG.worldSize - 20);
    target.y = clamp(target.y + Math.sin(angle) * stats.knockback, 20, CONFIG.worldSize - 20);
    emit({ type: 'jabHit', x: target.x, y: target.y, angle });
    emit({
      type: 'jab',
      x: player.x,
      y: player.y,
      angle,
      length: Math.min(stats.radius, distance + target.r),
      duration: stats.animation,
    });
  }
  emit({ type: 'flurry', x: player.x, y: player.y, radius: stats.radius });
}
