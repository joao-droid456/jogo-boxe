import { CONFIG } from '../core/config.js';
import { clamp, normalize } from '../core/math.js';

export function movePlayer(world, input, dt) {
  const player = world.player;
  player.previousX = player.x;
  player.previousY = player.y;
  world.camera.previousX = world.camera.x;
  world.camera.previousY = world.camera.y;
  let { x, y } = normalize(input.x || 0, input.y || 0);
  const length = Math.hypot(x, y);
  if (length > 0.08) world.direction = { x: x / length, y: y / length };
  world.dashActive = player.dashTime > 0;
  if (world.dashActive) {
    x = world.direction.x * CONFIG.dash.multiplier;
    y = world.direction.y * CONFIG.dash.multiplier;
    player.dashTime = Math.max(0, player.dashTime - dt);
  }
  player.x = clamp(player.x + x * player.speed * dt, 20, CONFIG.worldSize - 20);
  player.y = clamp(player.y + y * player.speed * dt, 20, CONFIG.worldSize - 20);
  player.invincible = Math.max(0, player.invincible - dt);
  player.dash = Math.max(0, player.dash - dt);
  player.adrenalineTime = Math.max(0, player.adrenalineTime - dt);
  player.shieldCooldown = Math.max(0, player.shieldCooldown - dt);
  if (player.shield > 0 && player.shieldCooldown === 0) player.shieldReady = true;
  world.camera.x += (player.x - world.camera.x) * Math.min(1, dt * 8);
  world.camera.y += (player.y - world.camera.y) * Math.min(1, dt * 8);
}

export function moveEnemies(world, dt) {
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.previousX = enemy.x;
    enemy.previousY = enemy.y;
    const dx = world.player.x - enemy.x,
      dy = world.player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    enemy.slowTime = Math.max(0, (enemy.slowTime ?? 0) - dt);
    const speed = enemy.speed * (enemy.slowTime > 0 ? enemy.slowFactor : 1);
    enemy.x += (dx / length) * speed * dt;
    enemy.y += (dy / length) * speed * dt;
    enemy.hit = Math.max(0, enemy.hit - dt);
  }
}
