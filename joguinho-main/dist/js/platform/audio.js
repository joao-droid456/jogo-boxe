const SOUNDS = {
  started: [600, 0.16],
  damaged: [90, 0.2, 'sawtooth', 0.07],
  energy: [900, 0.025, 'sine', 0.012],
  dash: [180, 0.15, 'sawtooth'],
  level: [1000, 0.2],
  upgradeSelected: [850, 0.15],
  cross: [320, 0.05, 'triangle', 0.022],
  crossHit: [180, 0.07, 'square', 0.025],
  jab: [520, 0.05, 'square', 0.018],
  jabHit: [280, 0.045, 'triangle', 0.016],
  rollHit: [640, 0.03, 'triangle', 0.012],
  rollPunch: [210, 0.05, 'square', 0.02],
  upper: [140, 0.18, 'sine', 0.035],
  shoulderHit: [220, 0.06, 'triangle', 0.022],
  healed: [900, 0.18, 'sine', 0.025],
  shieldBreak: [240, 0.1, 'triangle', 0.03],
  eliteSpawned: [180, 0.25, 'triangle', 0.035],
  invasion: [240, 0.2, 'triangle', 0.03],
};

export class AudioService {
  constructor(contextFactory) {
    this.contextFactory = contextFactory;
    this.muted = true;
    this.context = null;
    this.activeVoices = new Set();
    this.lastPlayed = new Map();
  }

  toggle() {
    this.muted = !this.muted;
    this.play(700, 0.1);
    return this.muted;
  }

  handle(event) {
    if (this.muted) return;
    // Coletar dezenas de cristais em um passo não cria dezenas de osciladores.
    const now = this.context?.currentTime ?? 0;
    const interval =
      event.type === 'energy' ? 0.06 : event.type === 'jabHit' ? 0.05 : 0.08;
    if (now - (this.lastPlayed.get(event.type) ?? -Infinity) < interval) return;
    this.lastPlayed.set(event.type, now);
    if (event.type === 'ended') this.play(event.result.won ? 900 : 100, 0.4, 'sawtooth', 0.05);
    else if (SOUNDS[event.type]) this.play(...SOUNDS[event.type]);
  }

  play(frequency, duration = 0.06, type = 'sine', volume = 0.035) {
    if (this.muted) return;
    if (this.activeVoices.size >= 8) return;
    try {
      this.context ??= this.contextFactory();
      const context = this.context;
      if (context.state === 'suspended') Promise.resolve(context.resume()).catch(() => {});
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, frequency / 2),
        context.currentTime + duration,
      );
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.activeVoices.add(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.activeVoices.delete(oscillator);
      };
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      /* Áudio é opcional. */
    }
  }

  dispose() {
    this.context?.close()?.catch(() => {});
    this.context = null;
    this.activeVoices.clear();
    this.lastPlayed.clear();
  }
}
