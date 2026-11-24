// Mede apenas CPU da simulação; não mede GPU, navegador nem FPS de celular.
import { performance } from 'node:perf_hooks';
import { GameSession } from '../dist/js/core/session.js';
import { CONFIG, PHASE } from '../dist/js/core/config.js';
import { Effects } from '../dist/js/rendering/effects.js';
import { createEnemy, createElite } from '../dist/js/content/enemies.js';
import { WEAPONS } from '../dist/js/content/weapons.js';

let seed = 12345;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
};
const game = new GameSession({ random });
const starter =
  process.argv.find((arg) => arg.startsWith('--starter='))?.split('=')[1] ?? 'cross';
if (!Object.hasOwn(WEAPONS, starter)) throw new Error('Arma inicial inválida.');
game.start(starter);
game.world.player.invincible = Infinity;
game.world.player.damage = 3;
const effects = new Effects(() => 0.5),
  times = [],
  peaks = {
    enemies: 0,
    gems: 0,
    particles: 0,
    rings: 0,
    arcs: 0,
    jabs: 0,
    elites: 0,
  };
const stress = process.argv.includes('--stress');
const arsenal = process.argv.includes('--arsenal');
const powers = process.argv.includes('--powers') || arsenal;
if (powers) {
  for (const stat of ['flurry', 'shoulder', 'adrenaline'])
    game.world.player[stat] = CONFIG.powers.maxRank;
}
if (arsenal) {
  for (const stat of [
    'cross',
    'jab',
    'roll',
    'upper',
    'reach',
    'overdrive',
    'stagger',
    'leech',
    'shield',
  ])
    game.world.player[stat] = 3;
  game.world.player.shieldReady = true;
}
if (stress) {
  game.world.player.damage = 0;
  // Carga artificial persistente: não é uma configuração acessível na partida.
  game.world.enemies = Array.from({ length: CONFIG.maxEnemies }, (_, i) => {
    const angle = (i / CONFIG.maxEnemies) * Math.PI * 2;
    // Anel curto: exercita também os golpes de perto (Roll e Uppercut).
    const x = 1100 + Math.cos(angle) * 90,
      y = 1100 + Math.sin(angle) * 90;
    const enemy =
      i < CONFIG.difficulty.maxElites ? createElite(x, y, 240) : createEnemy('tank', x, y);
    enemy.hp = Infinity;
    enemy.speed = 0;
    return enemy;
  });
  game.world.gems = Array.from({ length: CONFIG.maxGems }, (_, i) => ({
    x: 30 + (i % 20),
    y: 30,
    value: 1,
  }));
}
let steps = 0;
const begin = performance.now();
while (game.world.phase !== PHASE.ENDED && steps < CONFIG.duration * 60 + 10) {
  const elapsed = game.world.elapsed,
    start = performance.now();
  if (!stress && (powers || game.world.player.roll > 0) && game.world.player.dash <= 0)
    game.dash();
  game.update(
    CONFIG.step,
    stress ? { x: 0, y: 0 } : { x: Math.cos(elapsed * 0.4), y: Math.sin(elapsed * 0.4) },
    { width: 390, height: 844 },
  );
  for (const event of game.drainEvents()) effects.handle(event);
  if (stress) effects.burst(1100, 1100, '#b17bff', CONFIG.graphics.maxParticles);
  effects.update(CONFIG.step, game.world.player);
  while (game.world.phase === PHASE.UPGRADE) game.selectUpgrade(game.world.choices[0]);
  times.push(performance.now() - start);
  steps++;
  for (const key of ['enemies', 'gems'])
    peaks[key] = Math.max(peaks[key], game.world[key].length);
  peaks.particles = Math.max(peaks.particles, effects.particles.length);
  peaks.rings = Math.max(peaks.rings, effects.rings.length);
  peaks.arcs = Math.max(peaks.arcs, effects.arcs.length);
  peaks.jabs = Math.max(peaks.jabs, effects.jabs.length);
  peaks.elites = Math.max(peaks.elites, game.world.enemies.filter((enemy) => enemy.elite).length);
}
times.sort((a, b) => a - b);
if (
  !game.world.result?.won ||
  peaks.enemies > CONFIG.maxEnemies ||
  peaks.gems > CONFIG.maxGems ||
  peaks.particles > CONFIG.graphics.maxParticles ||
  peaks.rings > CONFIG.graphics.maxRings ||
  peaks.arcs > CONFIG.graphics.maxWeaponEffects ||
  peaks.jabs > CONFIG.graphics.maxJabs ||
  peaks.elites > CONFIG.difficulty.maxElites
)
  throw new Error('Simulação violou duração ou orçamento.');
console.log(
  JSON.stringify(
    {
      simulatedSeconds: game.world.elapsed,
      scenario: stress ? 'Carga artificial nos limites' : 'Partida com arma evoluída',
      allPowersMaxed: powers,
      starterWeapon: starter,
      fullArsenal: arsenal,
      steps,
      kills: game.world.kills,
      peaks,
      cpuTotalMs: Math.round(performance.now() - begin),
      cpuStepP95Ms: +times[Math.floor(times.length * 0.95)].toFixed(3),
      note: 'Simulação Node com invulnerabilidade e arma evoluída; não é medição de FPS nem teste em celular.',
    },
    null,
    2,
  ),
);
