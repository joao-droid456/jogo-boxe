import { normalize } from '../core/math.js';

const MOVEMENT_KEYS = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
];

// Teclado e toque expõem o mesmo vetor para as regras do jogo.
export class InputController {
  constructor({ target, document, joystick, stick, dash, isPlaying, onDash, onPause }) {
    this.keys = new Set();
    this.axis = { x: 0, y: 0 };
    this.pointerId = null;
    this.joystick = joystick;
    this.stick = stick;
    this.disposers = [];
    this.listen(target, 'keydown', (event) => {
      if (MOVEMENT_KEYS.includes(event.code) || event.code === 'Space') event.preventDefault();
      if (isPlaying()) this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'Space' && isPlaying()) onDash();
      if (event.code === 'Escape' || event.code === 'KeyP') onPause(true);
    });
    this.listen(target, 'keyup', (event) => this.keys.delete(event.code));
    this.listen(target, 'blur', () => {
      this.clear();
      onPause(false);
    });
    this.listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.clear();
        onPause(false);
      }
    });
    this.listen(dash, 'pointerdown', (event) => {
      event.preventDefault();
      onDash();
    });
    this.listen(joystick, 'pointerdown', (event) => {
      if (this.pointerId !== null || !isPlaying()) return;
      this.pointerId = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      this.moveStick(event);
      event.preventDefault();
    });
    this.listen(joystick, 'pointermove', (event) => {
      if (event.pointerId === this.pointerId) this.moveStick(event);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.listen(joystick, type, (event) => {
        if (event.pointerId === this.pointerId) this.clear();
      });
    }
  }

  listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.disposers.push(() => target.removeEventListener(type, listener));
  }

  moveStick(event) {
    const rect = this.joystick.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy),
      radius = rect.width * 0.32;
    const scale = Math.min(radius, length) / (length || 1);
    this.axis = { x: (dx * scale) / radius, y: (dy * scale) / radius };
    this.stick.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  }

  read() {
    const pressed = (...codes) => (codes.some((code) => this.keys.has(code)) ? 1 : 0);
    return normalize(
      this.axis.x + pressed('KeyD', 'ArrowRight') - pressed('KeyA', 'ArrowLeft'),
      this.axis.y + pressed('KeyS', 'ArrowDown') - pressed('KeyW', 'ArrowUp'),
    );
  }

  clear() {
    const pointer = this.pointerId;
    this.pointerId = null;
    this.keys.clear();
    this.axis = { x: 0, y: 0 };
    this.stick.style.transform = 'translate(0, 0)';
    if (pointer !== null && this.joystick.hasPointerCapture(pointer))
      this.joystick.releasePointerCapture(pointer);
  }

  dispose() {
    this.clear();
    for (const remove of this.disposers) remove();
    this.disposers = [];
  }
}
