import { CONFIG } from './config.js';

// A simulação usa passos fixos; desenhar a 30, 60 ou 120 FPS não altera as regras.
export class GameLoop {
  constructor({ update, render, isPlaying, requestFrame, cancelFrame }) {
    Object.assign(this, { update, render, isPlaying, requestFrame, cancelFrame });
    this.running = false;
    this.last = null;
    this.accumulator = 0;
    this.frameId = null;
    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = null;
    this.accumulator = 0;
    this.frameId = this.requestFrame(this.tick);
  }

  resetClock() {
    this.last = null;
    this.accumulator = 0;
  }

  tick(timestamp) {
    if (!this.running) return;
    const delta =
      this.last === null
        ? 0
        : Math.max(0, Math.min(CONFIG.maxFrameTime, (timestamp - this.last) / 1000));
    this.last = timestamp;
    if (this.isPlaying()) {
      this.accumulator += delta;
      while (this.accumulator + 1e-10 >= CONFIG.step && this.isPlaying()) {
        this.accumulator -= CONFIG.step;
        this.update(CONFIG.step);
      }
    }
    if (!this.isPlaying()) this.accumulator = 0;
    const alpha = this.isPlaying() ? Math.max(0, Math.min(1, this.accumulator / CONFIG.step)) : 1;
    this.render(timestamp, alpha);
    if (this.running) this.frameId = this.requestFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
    this.resetClock();
  }
}
