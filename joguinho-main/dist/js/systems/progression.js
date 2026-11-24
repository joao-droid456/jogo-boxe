import { CONFIG } from '../core/config.js';
import { distance } from '../core/math.js';

export function collectEnergy(world, dt, emit) {
  const player = world.player;
  for (let i = world.gems.length - 1; i >= 0; i--) {
    const gem = world.gems[i];
    gem.previousX = gem.x;
    gem.previousY = gem.y;
    // O drop fica visível antes de ser puxado, mesmo com ímã muito forte.
    if (gem.pickupDelay > 0) {
      gem.pickupDelay = Math.max(0, gem.pickupDelay - dt);
      continue;
    }
    let length = distance(gem, player);
    if (length < player.magnet && length > 0) {
      // Limita o deslocamento para o cristal não ultrapassar o jogador.
      const travel = Math.min(length, (330 + (player.magnet - length) * 4) * dt);
      gem.x += ((player.x - gem.x) / length) * travel;
      gem.y += ((player.y - gem.y) / length) * travel;
      length = distance(gem, player);
    }
    if (length < 20) {
      player.xp += gem.value;
      world.gems.splice(i, 1);
      emit({ type: 'energy' });
    }
  }
  if (world.gems.length > CONFIG.maxGems) world.gems.splice(0, world.gems.length - CONFIG.maxGems);
}
