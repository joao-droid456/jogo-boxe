// Ajusta apenas o custo gráfico, com janelas longas para evitar oscilações.
export class RenderQuality {
  constructor() {
    this.level = 0;
    this.resetSamples();
    this.last = null;
  }

  get scale() {
    return [1, 0.8, 0.65][this.level];
  }

  resetSamples() {
    this.duration = 0;
    this.frames = 0;
    this.fastDuration = 0;
  }

  observe(timestamp, playing) {
    const delta = this.last === null ? 0 : timestamp - this.last;
    this.last = timestamp;
    if (!playing) {
      this.resetSamples();
      return false;
    }
    // Ignora retomadas de aba e primeiras amostras, que não medem renderização contínua.
    if (delta <= 0 || delta > 250) return false;
    this.duration += delta;
    this.frames++;
    if (this.duration < 1500 || this.frames < 30) return false;
    const average = this.duration / this.frames;
    this.fastDuration = average < 18 ? this.fastDuration + this.duration : 0;
    let next = this.level;
    if (average > 24) next = Math.min(2, this.level + 1);
    else if (this.fastDuration >= 10000) {
      next = Math.max(0, this.level - 1);
      this.fastDuration = 0;
    }
    this.duration = 0;
    this.frames = 0;
    if (next === this.level) return false;
    this.level = next;
    return true;
  }
}
