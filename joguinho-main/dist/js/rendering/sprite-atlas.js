import { ENEMIES } from '../content/enemies.js';
import { CONFIG } from '../core/config.js';

// Halos e cristais são rasterizados uma vez em um Canvas pequeno.
// Os corpos dos atores mantêm vetores nítidos sem shadowBlur no quadro principal.
export class SpriteAtlas {
  constructor(createCanvas) {
    this.createCanvas = createCanvas;
    this.cache = new Map();
  }

  get(key, radius, color, glow, paint) {
    if (this.cache.has(key)) return this.cache.get(key);
    const canvas = this.createCanvas?.();
    if (!canvas) {
      this.cache.set(key, null);
      return null;
    }
    const size = Math.ceil((radius + (glow ? 24 : 4)) * 2);
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.cache.set(key, null);
      return null;
    }
    ctx.setTransform(2, 0, 0, 2, size, size);
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? 24 : 0;
    paint(ctx);
    const sprite = { canvas, size };
    this.cache.set(key, sprite);
    return sprite;
  }

  enemy(type, hit, glow) {
    const definition = ENEMIES[type],
      visual = definition.visual;
    const color = hit ? '#fff' : visual.color;
    return this.get(`enemy:${type}:${hit}:${glow}`, definition.radius, color, glow, (ctx) => {
      polygon(ctx, definition.radius, visual.sides, visual.rotation);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  gem(large, glow) {
    const radius = large ? CONFIG.graphics.largeGemRadius : CONFIG.graphics.gemRadius;
    return this.get(`gem:${large}:${glow}`, radius, '#4eeaff', glow, (ctx) => {
      ctx.fillStyle = '#4eeaff';
      polygon(ctx, radius, 4);
      ctx.fill();
    });
  }

  player(glow) {
    return this.get(`player:${glow}`, 14, '#a855f7', glow, (ctx) => {
      ctx.fillStyle = '#a855f7';
      polygon(ctx, 14, 6);
      ctx.fill();
    });
  }
}

function polygon(ctx, radius, sides, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + i * Math.PI * 2;
    if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
}

export function drawSprite(ctx, sprite, x, y, angle = 0, scale = 1) {
  if (!sprite) return false;
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  const size = sprite.size * scale;
  ctx.drawImage(sprite.canvas, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}
