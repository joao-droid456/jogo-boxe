export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const randomBetween = (rng, min, max) => min + rng() * (max - min);
export function normalize(x, y) {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

// Primeiro ponto de contato entre o trajeto do tiro e o círculo do inimigo.
// Evita atravessar alvos quando o tiro anda mais que o raio em um passo.
export function segmentCircleHit(start, end, circle, radius) {
  const dx = end.x - start.x,
    dy = end.y - start.y;
  const ox = start.x - circle.x,
    oy = start.y - circle.y;
  const a = dx * dx + dy * dy;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  if (a === 0) return null;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
