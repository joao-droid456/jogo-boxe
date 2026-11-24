import { GameSession } from './core/session.js';
import { GameLoop } from './core/loop.js';
import { PHASE } from './core/config.js';
import { CanvasRenderer } from './rendering/canvas-renderer.js';
import { Effects } from './rendering/effects.js';
import { InputController } from './platform/input.js';
import { AudioService } from './platform/audio.js';
import { RecordStore } from './platform/storage.js';
import { GameView } from './ui/game-view.js';
import { formatTime } from './ui/format.js';

// Ponto de composição: somente aqui as regras são conectadas ao navegador.
export class GameApp {
  constructor({ window, document }) {
    this.window = window;
    this.document = document;
    this.session = new GameSession();
    this.view = new GameView(document);
    this.selectedWeapon = 'cross';
    this.selectWeapon = (id) => {
      this.selectedWeapon = id;
      this.view.renderWeaponSelection(id, this.selectWeapon);
    };
    this.view.renderWeaponSelection(this.selectedWeapon, this.selectWeapon);
    this.renderer = new CanvasRenderer(this.view.$('game'));
    this.effects = new Effects();
    this.audio = new AudioService(() => new (window.AudioContext || window.webkitAudioContext)());
    let storage;
    try {
      storage = window.localStorage;
    } catch {
      /* Modo privado ou armazenamento bloqueado. */
    }
    this.records = new RecordStore(storage);
    this.best = this.records.read();
    this.newRecord = false;
    this.lastPhaseKey = null;
    this.uiClock = 0;
    this.input = new InputController({
      target: window,
      document,
      joystick: this.view.$('joystick'),
      stick: this.view.$('stick'),
      dash: this.view.$('dash'),
      isPlaying: () => this.session.world.phase === PHASE.PLAYING,
      onDash: () => this.command('dash'),
      onPause: (toggle) => {
        const method = toggle && this.session.world.phase === PHASE.PAUSED ? 'resume' : 'pause';
        this.command(method);
      },
    });
    this.view.bind({
      start: () => this.command('start', this.selectedWeapon),
      restart: () => this.command('start', this.selectedWeapon),
      pause: () => this.command('pause'),
      resume: () => this.command('resume'),
      back: () => this.command('home'),
      exit: () => this.command('home'),
      sound: () => this.view.renderAudio(this.audio.toggle()),
      share: () => this.share(),
    });
    this.resize = () =>
      this.renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.loop = new GameLoop({
      isPlaying: () => this.session.world.phase === PHASE.PLAYING,
      update: (dt) => {
        this.session.update(dt, this.input.read(), this.renderer.viewport);
        this.effects.update(dt, this.session.world.player);
        this.sync(dt);
      },
      render: (time, alpha) => {
        this.renderer.render(this.session.world, this.effects, time, alpha);
        this.effects.setQuality(this.renderer.quality.level);
      },
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (id) => window.cancelAnimationFrame(id),
    });
    this.sync(0, true);
  }

  start() {
    this.loop.start();
  }

  command(method, ...args) {
    this.session[method](...args);
    if (method === 'home') {
      this.effects.reset();
      this.view.clearToast();
    }
    if (['start', 'resume', 'home', 'selectUpgrade'].includes(method)) this.loop.resetClock();
    this.sync(0, true);
  }

  sync(dt, force = false) {
    for (const event of this.session.drainEvents()) {
      this.effects.handle(event);
      this.audio.handle(event);
      if (event.type === 'eliteSpawned')
        this.view.toast('Elite na arena! Os ataques dele causam mais dano.');
      if (event.type === 'invasion') this.view.toast('INVASÃO! A horda está mais intensa.');
      if (event.type === 'started') this.newRecord = false;
      if (event.type === 'ended') {
        this.newRecord = event.result.score > this.best;
        if (this.newRecord) {
          this.best = event.result.score;
          this.records.save(this.best);
        }
      }
    }
    const key = `${this.session.world.phase}:${this.session.world.player.level}`;
    if (key !== this.lastPhaseKey) {
      this.input.clear();
      this.lastPhaseKey = key;
      force = true;
    }
    this.uiClock += dt;
    if (force || this.uiClock >= 0.08) {
      this.view.render(this.session, this.best, this.newRecord, (id) =>
        this.command('selectUpgrade', id),
      );
      this.uiClock = 0;
    }
  }

  async share() {
    const result = this.session.world.result;
    if (!result) return;
    const text = `Fiz ${result.score} pontos e sobrevivi ${formatTime(result.elapsed)} no NEON RUSH. Consegue me superar? ${this.window.location.href}`;
    try {
      await this.window.navigator.clipboard.writeText(text);
      this.view.toast('Desafio copiado! Mande para seus amigos.');
    } catch {
      this.view.toast(`Seu recorde: ${result.score} pontos. Compartilhe o link do jogo.`);
    }
  }

  dispose() {
    this.loop.stop();
    this.input.dispose();
    this.view.dispose();
    this.audio.dispose();
    this.window.removeEventListener('resize', this.resize);
  }
}
