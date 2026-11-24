import { CONFIG, PHASE } from '../core/config.js';
import { UPGRADES } from '../content/upgrades.js';
import { WEAPONS } from '../content/weapons.js';
import { formatTime, formatScore } from './format.js';

export class GameView {
  constructor(document) {
    this.document = document;
    this.elements = new Map();
    this.disposers = [];
    this.weaponDisposers = [];
    this.modalKey = null;
    this.toastTimer = null;
    this.values = new Map();
    this.$ = (id) => {
      if (!this.elements.has(id)) {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Elemento da interface ausente: ${id}`);
        this.elements.set(id, element);
      }
      return this.elements.get(id);
    };
    this.$('goal').textContent = `SOBREVIVA ATÉ ${formatTime(CONFIG.duration)}`;
  }

  bind(actions) {
    for (const [id, action] of Object.entries(actions)) {
      this.$(id).addEventListener('click', action);
      this.disposers.push(() => this.$(id).removeEventListener('click', action));
    }
  }

  renderWeaponSelection(selected, onSelect) {
    for (const remove of this.weaponDisposers) remove();
    this.weaponDisposers = [];
    this.$('weapon-options').replaceChildren();
    for (const weapon of Object.values(WEAPONS)) {
      const button = this.document.createElement('button');
      button.className = 'weapon-option';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(selected === weapon.id));
      button.setAttribute('data-weapon', weapon.id);
      button.setAttribute('title', weapon.description);
      const icon = this.document.createElement('span'),
        label = this.document.createElement('span');
      icon.className = 'weapon-symbol';
      icon.textContent = weapon.symbol;
      label.textContent = weapon.name;
      button.append(icon, label);
      const listener = () => onSelect(weapon.id);
      button.addEventListener('click', listener);
      this.weaponDisposers.push(() => button.removeEventListener('click', listener));
      this.$('weapon-options').append(button);
    }
    this.writeText('weapon-description', WEAPONS[selected].description);
  }

  writeText(id, value) {
    const text = String(value);
    if (this.values.get(id) === text) return;
    this.values.set(id, text);
    this.$(id).textContent = text;
  }

  openModal(tag, title, copy) {
    this.$('modal-tag').textContent = tag;
    this.$('modal-title').textContent = title;
    this.$('modal-copy').textContent = copy;
    this.$('choices').replaceChildren();
    this.$('results').replaceChildren();
    for (const id of ['resume', 'restart', 'share', 'exit', 'back']) this.$(id).hidden = true;
  }

  render(session, best, newRecord, selectUpgrade) {
    const world = session.world,
      phase = world.phase;
    const home = phase === PHASE.HOME;
    this.writeText('home-best', formatScore(best));
    this.writeText(
      'status',
      home
        ? 'ARENA 01'
        : world.invasion
          ? 'INVASÃO'
          : world.enemies.some((enemy) => enemy.elite)
            ? 'ELITE NA ARENA'
            : 'SISTEMA ATIVO',
    );
    const key = `${phase}:${world.player.level}`;
    if (key !== this.modalKey) {
      this.$('home').hidden = !home;
      this.$('hud').hidden = home;
      this.$('controls').hidden = home;
      this.$('modal').hidden = ![PHASE.PAUSED, PHASE.UPGRADE, PHASE.ENDED].includes(phase);
      this.document.body.classList.toggle('playing', !home);
      this.modalKey = key;
      if (phase === PHASE.PAUSED) {
        this.openModal(
          'RESPIRE UM POUCO',
          'ARENA EM PAUSA',
          'Continue quando quiser. Sair encerra esta tentativa e volta ao início.',
        );
        this.$('resume').hidden = false;
        this.$('exit').hidden = false;
      }
      if (phase === PHASE.UPGRADE) {
        this.openModal(
          `NÍVEL ${world.player.level} DESBLOQUEADO`,
          'ESCOLHA SUA EVOLUÇÃO',
          'Uma melhoria. Uma nova chance de ir mais longe.',
        );
        for (const id of world.choices) {
          const item = UPGRADES.find((upgrade) => upgrade.id === id);
          const button = this.document.createElement('button');
          button.className = 'upgrade';
          button.setAttribute('data-kind', item.kind ?? 'basic');
          if (item.kind === 'power') button.setAttribute('data-power', 'true');
          for (const [tag, className, text] of [
            ['span', 'symbol', item.symbol],
            [
              'strong',
              '',
              item.maxRank
                ? `${item.name} · ${world.player[item.stat] + 1}/${item.maxRank}`
                : item.name,
            ],
            ['small', '', item.describe?.(world.player) ?? item.desc],
            ['span', 'select', 'SELECIONAR'],
          ]) {
            const child = this.document.createElement(tag);
            child.className = className;
            child.textContent = text;
            button.append(child);
          }
          button.addEventListener('click', () => selectUpgrade(id));
          this.$('choices').append(button);
        }
        this.$('exit').hidden = false;
      }
      if (phase === PHASE.ENDED) this.renderResults(world.result, newRecord);
    }
    if (!home) this.renderHud(world, session.score);
  }

  renderHud(world, score) {
    const player = world.player;
    const powers = UPGRADES.filter((item) => item.maxRank && player[item.stat] > 0);
    const powerKey = powers.map((item) => `${item.id}:${player[item.stat]}`).join(',');
    if (this.powerKey !== powerKey) {
      this.powerKey = powerKey;
      this.$('power-bar').replaceChildren();
      for (const item of powers) {
        const chip = this.document.createElement('span');
        chip.className = 'power-chip';
        chip.setAttribute('data-kind', item.kind);
        chip.textContent = `${item.symbol} ${player[item.stat]}`;
        chip.setAttribute('title', `${item.name} — nível ${player[item.stat]}`);
        chip.setAttribute('aria-label', `${item.name}, nível ${player[item.stat]}`);
        this.$('power-bar').append(chip);
      }
    }
    this.writeText('timer', formatTime(world.elapsed));
    this.writeText('score', formatScore(score));
    this.writeText('level', player.level);
    const xpWidth = Math.min(100, (player.xp / player.needed) * 100).toFixed(1) + '%';
    if (this.xpWidth !== xpWidth) {
      this.$('xp').style.width = xpWidth;
      this.xpWidth = xpWidth;
    }
    const healthKey = `${player.hp}:${player.maxHp}`;
    if (this.healthKey !== healthKey) {
      this.healthKey = healthKey;
      this.$('hearts').replaceChildren();
      for (let i = 0; i < player.maxHp; i++) {
        const heart = this.document.createElement('i');
        if (i >= player.hp) heart.className = 'empty';
        this.$('hearts').append(heart);
      }
    }
    const dashText = player.dash > 0 ? `${Math.ceil(player.dash)}s` : 'ARRANCADA';
    if (this.dashText !== dashText) {
      this.dashText = dashText;
      this.$('dash').disabled = player.dash > 0;
      this.$('dash').querySelector('small').textContent = dashText;
    }
  }

  renderResults(result, record) {
    this.openModal(
      result.won ? 'MISSÃO CONCLUÍDA' : record ? 'NOVO RECORDE PESSOAL' : 'FIM DE PARTIDA',
      result.won ? 'VOCÊ É UMA LENDA.' : 'MAIS UMA TENTATIVA?',
      result.won
        ? `${formatTime(result.elapsed)} de sobrevivência. Você dominou o ringue de neon.`
        : 'Cada tentativa te deixa mais perto. A arena te espera.',
    );
    for (const [value, label] of [
      [result.score, 'PONTOS'],
      [formatTime(result.elapsed), 'TEMPO'],
      [result.kills, 'ELIMINAÇÕES'],
    ]) {
      const item = this.document.createElement('div'),
        strong = this.document.createElement('strong'),
        small = this.document.createElement('small');
      strong.textContent = value;
      small.textContent = label;
      item.append(strong, small);
      this.$('results').append(item);
    }
    for (const id of ['restart', 'share', 'back']) this.$(id).hidden = false;
  }

  renderAudio(muted) {
    this.$('sound').querySelector('span').textContent = muted ? 'OFF' : 'ON';
    this.$('sound').setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
  }

  clearToast() {
    clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.$('toast').style.opacity = 0;
  }

  toast(message) {
    this.clearToast();
    this.$('toast').textContent = message;
    this.$('toast').style.opacity = 1;
    this.toastTimer = setTimeout(() => {
      this.$('toast').style.opacity = 0;
    }, 2200);
  }

  dispose() {
    this.clearToast();
    for (const remove of this.disposers) remove();
    for (const remove of this.weaponDisposers) remove();
  }
}
