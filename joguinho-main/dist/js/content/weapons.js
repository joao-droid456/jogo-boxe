// Estilos de boxe; todas as armas são corpo a corpo e não criam projéteis.
export const WEAPONS = {
  cross: {
    id: 'cross',
    stat: 'cross',
    name: 'Direto',
    symbol: '➤',
    description: 'Soco reto de alcance médio: acerta o alvo mais próximo e arremessa com força.',
    describe: (rank) =>
      rank === 1
        ? 'Adicione o Direto ao seu arsenal.'
        : `Direto nível ${rank}: mais dano, alcance e força de nocaute.`,
  },
  jab: {
    id: 'jab',
    stat: 'jab',
    name: 'Jab elástico',
    symbol: '⇉',
    description: 'Estilo Mashiba: braços elásticos disparam até o inimigo e chicoteiam de volta.',
    describe: (rank) =>
      rank === 1
        ? 'Adicione o Jab elástico ao seu arsenal.'
        : `Jab elástico nível ${rank}: ${Math.min(3, rank)} golpes por rajada, com mais dano e alcance.`,
  },
  roll: {
    id: 'roll',
    stat: 'roll',
    name: 'Dempsey Roll',
    symbol: '✊',
    description: 'A arrancada atravessa a horda com socos e os punhos martelam quem chega perto.',
    describe: (rank) =>
      `Dempsey Roll nível ${rank}: a arrancada fere cada inimigo atravessado e os socos curtos ficam mais fortes e rápidos.`,
  },
  upper: {
    id: 'upper',
    stat: 'upper',
    name: 'Uppercut',
    symbol: '↥',
    description: 'O punho sobe colado ao corpo e arremessa quem está perto. É o golpe mais forte.',
    describe: (rank) =>
      `Uppercut nível ${rank}: o golpe mais forte do arsenal, sempre no alcance curto. Evoluir aumenta dano, força e frequência.`,
  },
};

export function meleeStats(player) {
  // A adrenalina encurta a recarga enquanto durar o ímpeto após um nocaute.
  const haste =
    player.adrenalineTime > 0 ? 1 - Math.min(0.28, 0.12 + player.adrenaline * 0.06) : 1;
  return {
    reach: 1 + player.reach * 0.2,
    cooldown: (1 - player.overdrive * 0.15) * haste,
  };
}

// O jab elástico tem o maior alcance; o Direto fica no médio e os golpes
// curtos (Dempsey Roll e Uppercut) só acertam quem já está colado.
export function crossStats(player) {
  const modifiers = meleeStats(player);
  return {
    count: 1,
    reach: (125 + player.cross * 12) * modifiers.reach,
    damage: player.damage * (2.1 + player.cross * 0.5),
    interval: (0.95 - player.cross * 0.08) * modifiers.cooldown,
    knockback: 26 + player.cross * 6,
    fistRadius: 10,
    animation: 0.24,
  };
}

export function jabStats(player) {
  const modifiers = meleeStats(player);
  return {
    count: Math.min(3, player.jab),
    reach: (200 + player.jab * 20) * modifiers.reach,
    damage: player.damage * (1.4 + player.jab * 0.35),
    interval: (0.52 - player.jab * 0.06) * modifiers.cooldown,
    knockback: 3 + player.jab * 2,
    fistRadius: 7,
    animation: 0.26,
  };
}

export function rollStats(player) {
  const modifiers = meleeStats(player);
  return {
    reach: (78 + player.roll * 5) * modifiers.reach,
    damage: player.damage * (1.15 + player.roll * 0.25),
    interval: (0.6 - player.roll * 0.06) * modifiers.cooldown,
    knockback: 5 + player.roll * 2,
    fistRadius: 8,
    animation: 0.18,
    // A arrancada é o golpe principal do estilo.
    dashDamage: player.damage * (2.2 + player.roll * 0.7),
    dashKnockback: 20 + player.roll * 6,
  };
}

export function upperStats(player) {
  const modifiers = meleeStats(player);
  return {
    radius: (58 + player.upper * 7) * modifiers.reach,
    damage: player.damage * (4.0 + player.upper * 0.9),
    interval: (1.9 - player.upper * 0.15) * modifiers.cooldown,
    knockback: 24 + player.upper * 11,
  };
}

export function flurryStats(player) {
  const modifiers = meleeStats(player);
  return {
    radius: (140 + player.flurry * 12) * modifiers.reach,
    count: 2 + player.flurry * 2,
    damage: player.damage * (1.2 + player.flurry * 0.4),
    interval: (3.6 - player.flurry * 0.4) * modifiers.cooldown,
    knockback: 6 + player.flurry * 2,
    animation: 0.26,
  };
}
