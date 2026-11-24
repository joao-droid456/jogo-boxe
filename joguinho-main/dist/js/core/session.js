import { CONFIG, PHASE } from './config.js';
import { chooseUpgrades, UPGRADES } from '../content/upgrades.js';
import { movePlayer, moveEnemies } from '../systems/movement.js';
import { spawnEnemies, isInvasion } from '../systems/spawning.js';
import { resolveEnemies } from '../systems/combat.js';
import { collectEnergy } from '../systems/progression.js';
import { updatePowers } from '../systems/powers.js';
import { updateWeapons } from '../systems/weapons.js';
import { WEAPONS } from '../content/weapons.js';

function createWorld(phase, weaponId = 'cross') {
  const center = CONFIG.worldSize / 2;
  return {
    phase,
    player: {
      ...CONFIG.player,
      cross: 0,
      jab: 0,
      roll: 0,
      upper: 0,
      [WEAPONS[weaponId].stat]: 1,
      x: center,
      y: center,
    },
    initialWeapon: weaponId,
    camera: { x: center, y: center },
    direction: { x: 0, y: -1 },
    elapsed: 0,
    kills: 0,
    enemies: [],
    gems: [],
    spawnClock: 0.4,
    choices: [],
    result: null,
    flurryClock: 0,
    dashId: 0,
    dashActive: false,
    rollSide: 1,
    weaponTimers: { cross: 0, jab: 0, roll: 0, upper: 0 },
    nextEliteAt: CONFIG.difficulty.eliteStart,
    invasion: false,
  };
}

// Núcleo independente de document, Canvas, áudio, relógio e armazenamento.
export class GameSession {
  constructor({ random = Math.random } = {}) {
    this.random = random;
    this.world = createWorld(PHASE.HOME);
    this.events = [];
    this.emit = (event) => this.events.push(event);
  }

  get score() {
    return Math.floor(this.world.kills * 100 + this.world.elapsed * 10);
  }

  drainEvents() {
    return this.events.splice(0);
  }

  start(weaponId = 'cross') {
    if (!Object.hasOwn(WEAPONS, weaponId)) return false;
    this.world = createWorld(PHASE.PLAYING, weaponId);
    this.events = [];
    this.emit({ type: 'started' });
    return true;
  }

  pause() {
    if (this.world.phase !== PHASE.PLAYING) return false;
    this.world.phase = PHASE.PAUSED;
    return true;
  }

  resume() {
    if (this.world.phase !== PHASE.PAUSED) return false;
    this.world.phase = PHASE.PLAYING;
    return true;
  }

  home() {
    this.world = createWorld(PHASE.HOME);
    this.events = [];
  }

  dash() {
    const player = this.world.player;
    if (this.world.phase !== PHASE.PLAYING || player.dash > 0) return false;
    player.dash = CONFIG.dash.cooldown * 0.85 ** player.shoulder;
    this.world.dashId++;
    player.dashTime = CONFIG.dash.duration;
    player.invincible = Math.max(player.invincible, CONFIG.dash.invincible);
    this.emit({ type: 'dash', x: player.x, y: player.y });
    return true;
  }

  offerUpgrade() {
    const world = this.world,
      player = world.player;
    if (world.phase !== PHASE.PLAYING || player.xp < player.needed) return;
    player.xp -= player.needed;
    player.needed = Math.ceil(player.needed * 1.35);
    player.level++;
    world.choices = chooseUpgrades(player, this.random);
    world.phase = PHASE.UPGRADE;
    this.emit({ type: 'level' });
  }

  selectUpgrade(id) {
    const world = this.world;
    if (world.phase !== PHASE.UPGRADE || !world.choices.includes(id)) return false;
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (!upgrade || (upgrade.available && !upgrade.available(world.player))) return false;
    upgrade.apply(world.player);
    world.player.invincible = Math.max(world.player.invincible, 1);
    world.choices = [];
    world.phase = PHASE.PLAYING;
    this.emit({ type: 'upgradeSelected' });
    this.offerUpgrade();
    return true;
  }

  finish(won) {
    if (this.world.phase !== PHASE.PLAYING) return;
    this.world.phase = PHASE.ENDED;
    this.world.result = {
      won,
      score: this.score,
      elapsed: this.world.elapsed,
      kills: this.world.kills,
    };
    this.emit({ type: 'ended', result: this.world.result });
  }

  update(dt, input = { x: 0, y: 0 }, viewport = { width: 1280, height: 720 }) {
    if (this.world.phase !== PHASE.PLAYING || !Number.isFinite(dt) || dt <= 0) return;
    const world = this.world;
    world.elapsed = Math.min(CONFIG.duration, world.elapsed + dt);
    if (world.elapsed >= CONFIG.duration) {
      this.finish(true);
      return;
    }
    const invasion = isInvasion(world.elapsed);
    if (invasion && !world.invasion) this.emit({ type: 'invasion' });
    world.invasion = invasion;
    movePlayer(world, input, dt);
    spawnEnemies(world, viewport, dt, this.random, this.emit);
    moveEnemies(world, dt);
    updateWeapons(world, dt, this.emit);
    updatePowers(world, dt, this.emit);
    resolveEnemies(world, this.emit);
    if (world.player.hp <= 0) {
      this.finish(false);
      return;
    }
    collectEnergy(world, dt, this.emit);
    this.offerUpgrade();
  }
}
