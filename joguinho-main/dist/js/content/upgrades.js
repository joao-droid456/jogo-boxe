import { CONFIG } from '../core/config.js';
import { WEAPONS } from './weapons.js';

function power(id, stat, name, symbol, describe, kind = 'power', requires = () => true) {
  return {
    id,
    stat,
    name,
    symbol,
    kind,
    maxRank: CONFIG.powers.maxRank,
    desc: describe(1),
    describe: (player) => describe(player[stat] + 1),
    available: (player) => player[stat] < CONFIG.powers.maxRank && requires(player),
    apply: (player) => {
      player[stat] = Math.min(CONFIG.powers.maxRank, player[stat] + 1);
    },
  };
}

// IDs são estáveis: regras e seleção não dependem do texto exibido.
const hasMelee = (player) =>
  player.cross > 0 || player.jab > 0 || player.roll > 0 || player.upper > 0;

export const UPGRADES = [
  ...Object.values(WEAPONS).map((weapon) =>
    power(
      `weapon-${weapon.id}`,
      weapon.stat,
      weapon.name,
      weapon.symbol,
      weapon.describe,
      'weapon',
    ),
  ),
  power(
    'reach',
    'reach',
    'Alcance de campeão',
    '↔',
    (rank) => `Aumente em ${rank * 20}% o alcance de todos os golpes.`,
    'passive',
    hasMelee,
  ),
  power(
    'overdrive',
    'overdrive',
    'Ritmo de luta',
    '»',
    (rank) => `Todos os golpes atacam com ${rank * 15}% menos intervalo.`,
    'passive',
    hasMelee,
  ),
  power(
    'stagger',
    'stagger',
    'Atordoamento',
    '≈',
    (rank) =>
      `Seus golpes deixam inimigos ${25 + rank * 10}% mais lentos por ${(1 + rank * 0.25).toFixed(2)}s.`,
    'passive',
    hasMelee,
  ),
  power(
    'leech',
    'leech',
    'Segundo fôlego',
    '♥',
    (rank) => `Recupere 1 de vida a cada ${30 - rank * 5} nocautes.`,
    'passive',
  ),
  {
    ...power(
      'shield',
      'shield',
      'Guarda alta',
      '⬡',
      (rank) =>
        `Bloqueie um golpe e recarregue a guarda em ${15 - rank * 3}s. Carrega imediatamente ao evoluir.`,
      'passive',
    ),
    apply: (player) => {
      player.shield = Math.min(CONFIG.powers.maxRank, player.shield + 1);
      player.shieldReady = true;
      player.shieldCooldown = 0;
    },
  },
  power(
    'flurry',
    'flurry',
    'Sequência de golpes',
    '⇶',
    (rank) =>
      `A cada ${(3.6 - rank * 0.4).toFixed(1)}s, ${2 + rank * 2} jabs elásticos atingem os inimigos ao redor.`,
  ),
  power(
    'shoulder',
    'shoulder',
    'Choque de ombro',
    '➹',
    (rank) =>
      `A arrancada causa ${(1.8 + rank * 0.5).toFixed(1)}× o dano base em quem atravessar. Recarga reduzida em ${Math.round((1 - 0.85 ** rank) * 100)}%.`,
  ),
  power(
    'adrenaline',
    'adrenaline',
    'Adrenalina',
    '↑',
    (rank) =>
      `Cada nocaute acelera todos os golpes por ${(1.2 + rank * 0.4).toFixed(1)}s.`,
  ),
  {
    id: 'damage',
    name: 'Peso pesado',
    symbol: '✳',
    desc: 'Aumente o dano base de todos os seus golpes em +1.',
    apply: (p) => {
      p.damage++;
    },
  },
  {
    id: 'speed',
    name: 'Passo leve',
    symbol: '⇢',
    desc: 'Mova-se 12% mais rápido.',
    apply: (p) => {
      p.speed *= 1.12;
    },
  },
  {
    id: 'repair',
    name: 'Recuperação de canto',
    symbol: '♡',
    desc: 'Recupere toda a saúde e ganhe +1 de vida máxima.',
    apply: (p) => {
      p.maxHp++;
      p.hp = p.maxHp;
    },
  },
  {
    id: 'magnet',
    name: 'Ímã de energia',
    symbol: '◎',
    desc: 'Colete energia a uma distância 45% maior.',
    apply: (p) => {
      p.magnet *= 1.45;
    },
  },
];

export function chooseUpgrades(player, rng) {
  const available = UPGRADES.filter((item) => !item.available || item.available(player));
  // Fisher–Yates: embaralhamento sem comparador aleatório instável.
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  const choices = available.slice(0, 3);
  // Enquanto houver poderes para evoluir, ao menos uma opção muda a jogabilidade.
  if (!choices.some((item) => item.kind === 'power')) {
    const special = available.slice(3).find((item) => item.kind === 'power');
    if (special) choices[choices.length - 1] = special;
  }
  return choices.map((item) => item.id);
}
