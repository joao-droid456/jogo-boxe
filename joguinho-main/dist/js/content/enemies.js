// Novo inimigo: acrescente uma definição com atributos, aparição e visual.
export const ENEMIES = {
  tank: {
    minElapsed: 40,
    threshold: 0.18,
    radius: 23,
    health: 7,
    healthInterval: 40,
    speed: 55,
    experience: 3,
    visual: { color: '#b17bff', fill: '#312048', sides: 6, rotation: 0 },
  },
  fast: {
    minElapsed: 15,
    threshold: 0.42,
    radius: 11,
    health: 1,
    healthInterval: 65,
    speed: 140,
    experience: 1,
    visual: { color: '#ffb15d', fill: '#40182c', sides: 3, rotation: 0 },
  },
  normal: {
    minElapsed: 0,
    threshold: 1,
    radius: 16,
    health: 2,
    healthInterval: 55,
    speed: 78,
    experience: 1,
    visual: { color: '#ff508b', fill: '#40182c', sides: 4, rotation: Math.PI / 4 },
  },
};

export function selectEnemy(elapsed, roll) {
  return (
    Object.keys(ENEMIES).find((type) => {
      const definition = ENEMIES[type];
      return elapsed >= definition.minElapsed && roll < definition.threshold;
    }) ?? 'normal'
  );
}

export function createEnemy(type, x, y, elapsed = 0) {
  const definition = ENEMIES[type];
  if (!definition) throw new Error(`Inimigo desconhecido: ${type}`);
  return {
    type,
    x,
    y,
    r: definition.radius,
    hp: definition.health + Math.floor(elapsed / definition.healthInterval),
    speed: definition.speed + elapsed * 0.24,
    experience: definition.experience,
    hit: 0,
    contactDamage: 1,
  };
}

export function createElite(x, y, elapsed = 0) {
  const enemy = createEnemy('tank', x, y, elapsed);
  enemy.elite = true;
  enemy.r *= 1.25;
  enemy.hp *= 3;
  enemy.maxHp = enemy.hp;
  enemy.speed *= 1.12;
  enemy.experience *= 4;
  enemy.contactDamage = 2;
  return enemy;
}
