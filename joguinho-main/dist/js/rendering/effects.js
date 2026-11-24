import { randomBetween } from '../core/math.js';
import { ENEMIES } from '../content/enemies.js';
import { CONFIG } from '../core/config.js';

// Efeitos visuais não participam de dano, colisão nem aleatoriedade da partida.
export class Effects {
  constructor(random = Math.random) {
    this.random = random;
    this.particleLimit = CONFIG.graphics.maxParticles;
    this.reset();
  }
  reset() {
    this.particles = [];
    this.rings = [];
    this.arcs = [];
    this.jabs = [];
    this.shake = 0;
  }

  burst(x, y, color, count = 12) {
    // Respeita o orçamento antes de alocar partículas, mesmo em muitas mortes juntas.
    count = Math.min(count, this.particleLimit - this.particles.length);
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = randomBetween(this.random, 35, 190);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randomBetween(this.random, 0.2, 0.55),
        color,
      });
    }
  }

  // Impactos de soco sacodem a tela de leve; dano recebido continua sendo o maior tremor.
  kick(amount) {
    if (amount > this.shake) this.shake = Math.min(14, amount);
  }

  handle(event) {
    const { x, y, type } = event;
    if (type === 'started') this.reset();
    if (type === 'kill') this.burst(x, y, ENEMIES[event.enemyType].visual.color);
    if (type === 'damaged') {
      this.shake = 12;
      this.burst(x, y, '#ffffff', 18);
    }
    if (type === 'dash') this.addRing(x, y, '#b17bff', 0.35, 92);
    if (type === 'jabHit') {
      this.burst(x, y, '#ff5a4a', 4);
      this.kick(2.4);
    }
    if (type === 'crossHit') {
      this.addRing(x, y, '#ffd166', 0.18, 34);
      this.burst(x, y, '#ffd166', 8);
      this.kick(4.2);
    }
    if (type === 'shoulderHit') {
      this.burst(x, y, '#ffd166', 6);
      this.kick(3.2);
    }
    if (type === 'rollHit') {
      this.burst(x, y, '#ff5a4a', event.dash ? 8 : 5);
      this.kick(event.dash ? 3.8 : 2.2);
    }
    if (type === 'upper') {
      this.addRing(x, y, '#ff9d3c', 0.35, event.radius);
      this.burst(x, y, '#ffb15d', 10);
      this.kick(6);
      // O punho sobe no desenho por um instante após o golpe.
      if (this.arcs.length < CONFIG.graphics.maxWeaponEffects)
        this.arcs.push({ type: 'upper', x, y, angle: event.angle, life: 0.32, max: 0.32 });
    }
    if (type === 'flurry') this.addRing(x, y, '#ff5a4a', 0.22, event.radius * 0.5);
    // O braço do soco é uma animação curta, independente das partículas.
    if (
      (type === 'jab' || type === 'cross' || type === 'rollPunch') &&
      this.jabs.length < CONFIG.graphics.maxJabs
    ) {
      this.jabs.push({
        style: type === 'rollPunch' ? 'roll' : type,
        x,
        y,
        angle: event.angle,
        length: event.length,
        side: event.side ?? 1,
        life: event.duration,
        max: event.duration,
      });
    }
    if (type === 'shieldBreak') this.addRing(x, y, '#ffd166', 0.3, 54);
    if (type === 'healed') {
      this.addRing(x, y, '#8ee06a', 0.4, 40);
      this.burst(x, y, '#8ee06a', 8);
    }
  }

  addRing(x, y, color, life, radius) {
    if (this.rings.length >= CONFIG.graphics.maxRings) return;
    this.rings.push({ x, y, color, r: 12, life, max: life, speed: (radius - 12) / life });
  }

  setQuality(level) {
    this.particleLimit = Math.floor(CONFIG.graphics.maxParticles * [1, 0.6, 0.3][level]);
    if (this.particles.length > this.particleLimit) this.particles.length = this.particleLimit;
  }

  update(dt, player) {
    if (player.dashTime > 0) this.burst(player.x, player.y, '#b17bff', 2);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    let alive = 0;
    for (const particle of this.particles)
      if (particle.life > 0) this.particles[alive++] = particle;
    this.particles.length = alive;
    for (const ring of this.rings) {
      ring.r += dt * ring.speed;
      ring.life -= dt;
    }
    alive = 0;
    for (const ring of this.rings) if (ring.life > 0) this.rings[alive++] = ring;
    this.rings.length = alive;
    alive = 0;
    for (const arc of this.arcs) {
      // O punho do Uppercut sobe preso ao corpo, mesmo com o jogador se movendo.
      if (arc.type === 'upper' && player) {
        arc.x = player.x;
        arc.y = player.y;
      }
      arc.life -= dt;
      if (arc.life > 0) this.arcs[alive++] = arc;
    }
    this.arcs.length = alive;
    alive = 0;
    for (const jab of this.jabs) {
      jab.life -= dt;
      // O braço continua preso ao corpo enquanto estica e recolhe.
      if (player) {
        jab.x = player.x;
        jab.y = player.y;
      }
      if (jab.life > 0) this.jabs[alive++] = jab;
    }
    this.jabs.length = alive;
    this.shake = Math.max(0, this.shake - dt * 45);
  }
}
