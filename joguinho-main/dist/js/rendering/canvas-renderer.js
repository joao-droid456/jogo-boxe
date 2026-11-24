import { CONFIG } from '../core/config.js';
import { randomBetween } from '../core/math.js';
import { ENEMIES } from '../content/enemies.js';
import { RenderQuality } from './quality.js';
import { SpriteAtlas, drawSprite } from './sprite-atlas.js';
import { drawWeapons } from './weapon-renderer.js';

const WORLD = CONFIG.worldSize;
const random = (min, max) => randomBetween(Math.random, min, max);

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('Canvas 2D indisponível neste navegador.');
    this.viewport = { width: 1, height: 1, dpr: 1 };
    this.quality = new RenderQuality();
    this.pixelRatio = 1;
    this.atlas = new SpriteAtlas(() => canvas.ownerDocument?.createElement('canvas'));
    // Prepara imagens antes da partida para não criar Canvas durante uma horda.
    for (const glow of [false, true]) {
      for (const type of Object.keys(ENEMIES)) {
        this.atlas.enemy(type, false, glow);
        this.atlas.enemy(type, true, glow);
      }
      this.atlas.gem(false, glow);
      this.atlas.gem(true, glow);
      this.atlas.player(glow);
    }
  }

  resize(width, height, pixelRatio = 1) {
    // Limita a área real do Canvas, inclusive em telas grandes com DPR alto.
    this.pixelRatio = pixelRatio;
    const baseDpr = Math.min(
      pixelRatio,
      CONFIG.graphics.maxDpr,
      Math.sqrt(CONFIG.graphics.maxPixels / (width * height)),
    );
    // A adaptação não derruba a nitidez abaixo de 1 pixel por pixel CSS,
    // exceto quando o teto de pixels já exige isso em uma tela muito grande.
    const dpr = Math.max(Math.min(1, baseDpr), baseDpr * this.quality.scale);
    this.viewport = { width, height, dpr };
    const physicalWidth = Math.max(1, Math.floor(width * dpr));
    const physicalHeight = Math.max(1, Math.floor(height * dpr));
    if (this.canvas.width !== physicalWidth) this.canvas.width = physicalWidth;
    if (this.canvas.height !== physicalHeight) this.canvas.height = physicalHeight;
  }

  render(world, effects, time, alpha = 1) {
    if (this.quality.observe(time, world.phase === 'playing')) {
      this.resize(this.viewport.width, this.viewport.height, this.pixelRatio);
    }
    draw(this.ctx, world, effects, this.viewport, time, alpha, this.atlas, this.quality.level);
  }
}

function poly(ctx, x, y, r, sides, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    i
      ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
      : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}
const renderX = (entity, alpha) =>
  (entity.previousX ?? entity.x) + (entity.x - (entity.previousX ?? entity.x)) * alpha;
const renderY = (entity, alpha) =>
  (entity.previousY ?? entity.y) + (entity.y - (entity.previousY ?? entity.y)) * alpha;

function draw(ctx, world, effects, viewport, t, alpha, atlas, qualityLevel) {
  const { player, camera, enemies, gems, phase: state } = world;
  const { particles, rings, shake } = effects;
  const { width: w, height: h, dpr } = viewport;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#080d1b';
  ctx.fillRect(0, 0, w, h);
  const home = state === 'home';
  const playerX = renderX(player, alpha),
    playerY = renderY(player, alpha);
  let cx = home ? CONFIG.worldSize / 2 : renderX(camera, alpha),
    cy = home ? CONFIG.worldSize / 2 : renderY(camera, alpha);
  // Nenhum desfoque é recalculado no Canvas principal durante a partida.
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.translate(
    w / 2 - cx + (shake ? random(-shake, shake) : 0),
    h / 2 - cy + (shake ? random(-shake, shake) : 0),
  );
  const left = cx - w / 2,
    top = cy - h / 2;
  const margin = CONFIG.graphics.cullMargin;
  const visible = (entity) =>
    entity.x >= left - margin &&
    entity.x <= left + w + margin &&
    entity.y >= top - margin &&
    entity.y <= top + h + margin;
  const glow = qualityLevel === 0 && enemies.length <= CONFIG.graphics.glowEnemyLimit;
  ctx.strokeStyle = '#192638';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = Math.floor(left / 64) * 64; x < left + w; x += 64) {
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + h);
  }
  for (let y = Math.floor(top / 64) * 64; y < top + h; y += 64) {
    ctx.moveTo(left, y);
    ctx.lineTo(left + w, y);
  }
  ctx.stroke();
  ctx.strokeStyle = '#26384d';
  ctx.beginPath();
  for (let x = Math.floor(left / 256) * 256; x < left + w; x += 256)
    for (let y = Math.floor(top / 256) * 256; y < top + h; y += 256) {
      ctx.moveTo(x - 3, y);
      ctx.lineTo(x + 3, y);
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x, y + 3);
    }
  ctx.stroke();
  ctx.strokeStyle = '#ff508b';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, WORLD, WORLD);
  if (home) {
    drawHero(ctx, t, left, top, w, h);
    ctx.restore();
    return;
  }
  ctx.shadowBlur = 0;
  for (const e of enemies) {
    if (!visible(e)) continue;
    const x = renderX(e, alpha),
      y = renderY(e, alpha);
    const angle = Math.atan2(playerY - y, playerX - x);
    // Só o halo fica no cache. Corpo, contorno e núcleo são vetores nítidos.
    drawSprite(
      ctx,
      atlas.enemy(e.type, e.hit > 0, true),
      x,
      y,
      angle,
      e.r / ENEMIES[e.type].radius,
    );
    const visual = ENEMIES[e.type].visual;
    const color =
      e.hit > 0 ? '#fff' : e.slowTime > 0 ? '#ffcf7a' : e.elite ? '#ffd17c' : visual.color;
    ctx.fillStyle = e.elite ? '#34261a' : visual.fill;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    poly(ctx, x, y, e.r, visual.sides, angle + visual.rotation);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(x - 3, y - 3, 6, 6);
    if (e.elite) {
      ctx.strokeStyle = '#ffd17c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, e.r + 5, 0, Math.PI * 2);
      ctx.stroke();
      const width = e.r * 2,
        health = Math.max(0, Math.min(1, e.hp / e.maxHp));
      ctx.fillStyle = '#1c1720';
      ctx.fillRect(x - e.r, y - e.r - 12, width, 4);
      ctx.fillStyle = '#ffd17c';
      ctx.fillRect(x - e.r, y - e.r - 12, width * health, 4);
    }
  }
  // O corpo do cristal é sempre vetorial e fica acima da horda, abaixo do jogador.
  // O cache é um complemento visual, nunca a única forma de enxergar o drop.
  for (const gem of gems) {
    if (!visible(gem)) continue;
    const x = renderX(gem, alpha),
      y = renderY(gem, alpha);
    const large = gem.value > 1;
    drawSprite(ctx, atlas.gem(large, glow), x, y, t * 0.0005);
    ctx.fillStyle = large ? '#96ffff' : '#4eeaff';
    ctx.strokeStyle = '#e0ffff';
    ctx.lineWidth = 1;
    poly(
      ctx,
      x,
      y,
      large ? CONFIG.graphics.largeGemRadius : CONFIG.graphics.gemRadius,
      4,
      t * 0.0005,
    );
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f0ffff';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  drawWeapons(ctx, world, effects, playerX, playerY);
  if (!(player.invincible > 0 && Math.floor(t / 80) % 2)) {
    drawSprite(ctx, atlas.player(true), playerX, playerY, t * 0.001);
    // Boxeador roxo com as luvas vermelhas em guarda.
    const guard = t * 0.0006;
    for (const side of [-1, 1]) {
      const angle = guard + side * 1.3;
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playerX, playerY);
      ctx.lineTo(
        playerX + Math.cos(angle) * (player.r + 3),
        playerY + Math.sin(angle) * (player.r + 3),
      );
      ctx.stroke();
      ctx.fillStyle = '#ff3b30';
      ctx.strokeStyle = '#7c1016';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        playerX + Math.cos(angle) * (player.r + 4),
        playerY + Math.sin(angle) * (player.r + 4),
        3.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#a855f7';
    poly(ctx, playerX, playerY, player.r, 6, t * 0.001);
    ctx.fill();
    ctx.fillStyle = '#241040';
    poly(ctx, playerX, playerY, 7, 6, -t * 0.001);
    ctx.fill();
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(playerX, playerY, 3, 0, 7);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const r of rings) {
    if (!visible(r)) continue;
    ctx.globalAlpha = r.life / r.max;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of particles) {
    if (!visible(p)) continue;
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (player.hp === 1 && state === 'playing') {
    ctx.fillStyle =
      '#ff205b' +
      Math.floor(10 + Math.sin(t * 0.005) * 6)
        .toString(16)
        .padStart(2, '0');
    ctx.fillRect(0, 0, w, h);
  }
}
function drawHero(ctx, t, left, top, w, h) {
  const px = left + w * (w > 650 ? 0.73 : 0.82),
    py = top + h * 0.5,
    s = w > 650 ? 1 : 0.65;
  const glow = ctx.createRadialGradient(px, py, 5, px, py, 330 * s);
  glow.addColorStop(0, '#7c3aed33');
  glow.addColorStop(1, '#080d1b00');
  ctx.fillStyle = glow;
  ctx.fillRect(left, top, w, h);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = ['#a855f720', '#ff5a4a15', '#ff5a4a0c'][i];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, (95 + i * 64) * s, 0, 7);
    ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + t * 0.00008,
      r = (150 + (i % 3) * 50) * s,
      x = px + Math.cos(a) * r,
      y = py + Math.sin(a) * r;
    ctx.strokeStyle = i % 2 ? '#ff508baa' : '#b17bff99';
    ctx.fillStyle = '#171c30';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 18;
    poly(ctx, x, y, (i % 2 ? 14 : 20) * s, i % 2 ? 4 : 6, t * 0.0002);
    ctx.fill();
    ctx.stroke();
  }
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#a855f7';
  poly(ctx, px, py, 37 * s, 6, t * 0.0003);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#241040';
  poly(ctx, px, py, 20 * s, 6, -t * 0.0003);
  ctx.fill();
  ctx.fillStyle = '#f3e8ff';
  poly(ctx, px, py, 8 * s, 6, t * 0.0003);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = -0.9,
      d = (65 + i * 24 + ((t * 0.07) % 24)) * s;
    ctx.fillStyle = `rgba(255,90,74,${0.8 - i * 0.14})`;
    ctx.save();
    ctx.translate(px + Math.cos(a) * d, py + Math.sin(a) * d);
    ctx.rotate(a);
    ctx.fillRect(0, 0, 12 * s, 3 * s);
    ctx.restore();
  }
}
