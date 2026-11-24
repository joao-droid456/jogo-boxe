import { CONFIG } from '../core/config.js';
import { distance } from '../core/math.js';

export function resolveEnemies(world, emit) {
  const player = world.player;
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) {
      world.kills++;
      if (
        player.leech > 0 &&
        world.kills % (30 - player.leech * 5) === 0 &&
        player.hp < player.maxHp
      ) {
        player.hp++;
        emit({ type: 'healed', x: player.x, y: player.y });
      }
      if (player.adrenaline > 0) {
        player.adrenalineTime = Math.max(player.adrenalineTime, 1.2 + player.adrenaline * 0.4);
      }
      world.gems.push({
        x: enemy.x,
        y: enemy.y,
        value: enemy.experience,
        pickupDelay: CONFIG.energy.dropDelay,
      });
      emit({ type: 'kill', x: enemy.x, y: enemy.y, enemyType: enemy.type });
      continue;
    }
    const length = distance(player, enemy);
    if (length < enemy.r + player.r && player.invincible <= 0) {
      if (player.shieldReady) {
        player.shieldReady = false;
        player.shieldCooldown = 15 - player.shield * 3;
        emit({ type: 'shieldBreak', x: player.x, y: player.y });
      } else {
        player.hp = Math.max(0, player.hp - (enemy.contactDamage ?? 1));
        emit({ type: 'damaged', x: player.x, y: player.y });
      }
      player.invincible = 1.15;
      enemy.x -= ((player.x - enemy.x) / (length || 1)) * 45;
      enemy.y -= ((player.y - enemy.y) / (length || 1)) * 45;
      if (player.hp <= 0) return;
    }
  }
  world.enemies = world.enemies.filter((enemy) => enemy.hp > 0);
}
