import { CONFIG } from '../core/config.js';

// Luva vermelha: o punho é sempre a parte mais visível do golpe.
function drawGlove(ctx, x, y, radius, angle) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  ctx.fillStyle = '#ff3b30';
  ctx.strokeStyle = '#7c1016';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,157,140,0.75)';
  ctx.beginPath();
  ctx.arc(x - radius * 0.28, y - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a3151f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.68, angle + 0.5, angle + Math.PI * 1.3);
  ctx.stroke();
  // Atadura no pulso, atrás da luva.
  ctx.strokeStyle = '#ffd5cc';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - cos * radius * 0.85 - sin * radius * 0.5, y - sin * radius * 0.85 + cos * radius * 0.5);
  ctx.lineTo(x - cos * radius * 0.85 + sin * radius * 0.5, y - sin * radius * 0.85 - cos * radius * 0.5);
  ctx.stroke();
}

// Estica com overshoot e volta como um chicote, no estilo Mashiba.
function punchReach(progress, elastic) {
  if (progress <= 0) return 0;
  if (progress < 0.38) {
    const t = progress / 0.38,
      s = elastic ? 1.9 : 1.2,
      c1 = 1.70158 * s,
      c3 = c1 + 1,
      p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  }
  const t = (progress - 0.38) / 0.62;
  return (1 - t) * (1 - t);
}

function drawJabs(ctx, effects, playerX, playerY) {
  for (const jab of effects.jabs) {
    const progress = 1 - Math.max(0, jab.life) / jab.max;
    if (progress <= 0) continue;
    const cross = jab.style === 'cross';
    const roll = jab.style === 'roll';
    const reach = punchReach(progress, !cross && !roll);
    if (reach <= 0.01) continue;
    const cos = Math.cos(jab.angle),
      sin = Math.sin(jab.angle);
    const distance = jab.length * Math.min(1.14, reach);
    const shape = Math.sin(Math.min(1, reach) * Math.PI);
    const bow = cross
      ? Math.min(7, distance * 0.04) * shape
      : roll
        ? Math.min(10, distance * 0.12) * shape
        : Math.min(52, distance * 0.34) * shape;
    const side = roll ? (jab.side ?? 1) : 1;
    const alpha = Math.min(1, progress * 12, (1 - progress) * 12);
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const u = i / 10,
        offset =
          Math.sin(u * Math.PI) * bow + Math.sin(u * Math.PI * 2) * bow * (cross ? 0.1 : 0.38);
      const x = playerX + cos * distance * u - sin * (offset + (roll ? side * 5 : 0)) * u,
        y = playerY + sin * distance * u + cos * (offset + (roll ? side * 5 : 0)) * u;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.globalAlpha = alpha * 0.25;
    ctx.strokeStyle = '#e9d5ff';
    ctx.lineWidth = cross ? 13 : roll ? 8 : 9;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = cross ? 7 : roll ? 4 : 5;
    ctx.stroke();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = cross ? 3.5 : roll ? 2 : 2.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawGlove(
      ctx,
      playerX + cos * distance - sin * (roll ? side * 5 : 0),
      playerY + sin * distance + cos * (roll ? side * 5 : 0),
      cross ? 9 : roll ? 8 : 7,
      jab.angle,
    );
  }
}

// A arrancada do Dempsey Roll deixa um rastro vermelho e dois punhos à frente.
function drawRollDash(ctx, world, playerX, playerY) {
  const player = world.player;
  if (player.roll <= 0 || !(player.dashTime > 0)) return;
  const t = Math.max(0, Math.min(1, player.dashTime / CONFIG.dash.duration));
  const { x, y } = world.direction;
  const length = Math.hypot(x, y) || 1;
  const ux = x / length,
    uy = y / length;
  const sideX = -uy,
    sideY = ux;
  ctx.globalAlpha = 0.16 + t * 0.34;
  ctx.strokeStyle = '#ff5a4a';
  ctx.lineWidth = 10 + (1 - t) * 8;
  ctx.beginPath();
  ctx.moveTo(playerX - ux * (26 + 44 * (1 - t)), playerY - uy * (26 + 44 * (1 - t)));
  ctx.lineTo(playerX - ux * 8, playerY - uy * 8);
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (const side of [-1, 1])
    drawGlove(
      ctx,
      playerX + ux * 16 + sideX * side * 7,
      playerY + uy * 16 + sideY * side * 7,
      8.5,
      Math.atan2(uy, ux),
    );
}

// O Uppercut sobe o punho colado ao corpo até acima da cabeça.
function drawUppers(ctx, effects) {
  for (const arc of effects.arcs) {
    if (arc.type !== 'upper') continue;
    const progress = 1 - Math.max(0, arc.life) / arc.max;
    const ease = 1 - Math.pow(1 - progress, 3);
    const fade = Math.min(1, progress * 6, (1 - progress) * 4);
    const angle = arc.angle ?? -Math.PI / 2;
    const lift = Math.cos(angle) * 14;
    const footY = arc.y + 24,
      headY = arc.y - 36;
    for (let i = 2; i >= 1; i--) {
      const p = Math.max(0, ease - i * 0.18);
      ctx.globalAlpha = fade * (0.4 / i);
      drawGlove(ctx, arc.x + lift, footY + (headY - footY) * p, 11 - i, angle);
    }
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(arc.x - lift, arc.y + 18);
    ctx.quadraticCurveTo(arc.x + lift * 2, arc.y - 8, arc.x + lift, footY + (headY - footY) * ease);
    ctx.stroke();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawGlove(ctx, arc.x + lift, footY + (headY - footY) * ease, 11, angle);
  }
}

export function drawWeapons(ctx, world, effects, playerX, playerY) {
  drawRollDash(ctx, world, playerX, playerY);
  drawUppers(ctx, effects);
  drawJabs(ctx, effects, playerX, playerY);
  if (world.player.shieldReady) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(playerX, playerY, 23, 0, Math.PI * 2);
    ctx.stroke();
  }
}
