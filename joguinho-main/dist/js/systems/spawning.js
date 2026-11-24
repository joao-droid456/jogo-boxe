import { CONFIG } from '../core/config.js';
import { clamp, distance, randomBetween } from '../core/math.js';
import { createEnemy, createElite, selectEnemy } from '../content/enemies.js';

export function isInvasion(elapsed) {
  const tuning = CONFIG.difficulty;
  return (
    elapsed >= tuning.invasionStart && elapsed % tuning.invasionPeriod < tuning.invasionDuration
  );
}

export function getSpawnBudget(elapsed) {
  const tuning = CONFIG.spawning;
  const progress = clamp(elapsed / tuning.capRampSeconds, 0, 1);
  const intervalProgress = clamp(elapsed / tuning.intervalRampSeconds, 0, 1);
  const invasion = isInvasion(elapsed);
  return {
    cap: Math.floor(tuning.initialCap + (CONFIG.maxEnemies - tuning.initialCap) * progress),
    interval:
      (tuning.initialInterval +
        (tuning.finalInterval - tuning.initialInterval) * intervalProgress) *
      (invasion ? CONFIG.difficulty.invasionIntervalScale : 1),
    invasion,
  };
}

export function spawnEnemies(world, viewport, dt, rng, emit = () => {}) {
  const budget = getSpawnBudget(world.elapsed);
  world.spawnClock -= dt;
  while (world.spawnClock <= 0) {
    if (world.enemies.length < budget.cap) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.hypot(viewport.width, viewport.height) / 2 + 65;
      let x = clamp(world.player.x + Math.cos(angle) * radius, 24, CONFIG.worldSize - 24);
      let y = clamp(world.player.y + Math.sin(angle) * radius, 24, CONFIG.worldSize - 24);
      if (distance({ x, y }, world.player) < 250) {
        x = world.player.x < CONFIG.worldSize / 2 ? CONFIG.worldSize - 30 : 30;
        y = randomBetween(rng, 30, CONFIG.worldSize - 30);
      }
      const type = selectEnemy(world.elapsed, rng());
      const eliteDue =
        world.elapsed >= world.nextEliteAt &&
        world.enemies.filter((enemy) => enemy.elite && enemy.hp > 0).length <
          CONFIG.difficulty.maxElites;
      const enemy = eliteDue
        ? createElite(x, y, world.elapsed)
        : createEnemy(type, x, y, world.elapsed);
      world.enemies.push(enemy);
      if (eliteDue) {
        world.nextEliteAt = world.elapsed + CONFIG.difficulty.eliteInterval;
        emit({ type: 'eliteSpawned' });
      }
    }
    world.spawnClock += budget.interval;
  }
}
