export class RecordStore {
  constructor(storage, key = 'neon-rush-best') {
    this.storage = storage;
    this.key = key;
  }

  read() {
    try {
      const value = Number(this.storage?.getItem(this.key));
      return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    } catch {
      return 0;
    }
  }

  save(score) {
    try {
      this.storage?.setItem(this.key, String(score));
    } catch {
      // A partida continua mesmo com armazenamento bloqueado ou cheio.
    }
  }
}
