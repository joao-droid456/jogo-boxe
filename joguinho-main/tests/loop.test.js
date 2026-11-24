import test from 'node:test';
import assert from 'node:assert/strict';
import { GameLoop } from '../dist/js/core/loop.js';
import { GameSession } from '../dist/js/core/session.js';

function simulate(fps) {
  const game = new GameSession({ random: () => 0.5 });
  game.start();
  game.world.spawnClock = 100;
  const loop = new GameLoop({
    update: (dt) => game.update(dt, { x: 1, y: 0 }),
    render() {},
    isPlaying: () => true,
    requestFrame: () => 1,
    cancelFrame() {},
  });
  loop.start();
  for (let i = 0; i <= fps * 2; i++) loop.tick((i * 1000) / fps);
  loop.stop();
  return game.world;
}

test('30, 60 e 120 FPS produzem o mesmo movimento e tempo de simulação', () => {
  const at30 = simulate(30),
    at60 = simulate(60),
    at120 = simulate(120);
  assert.deepEqual(at30, at60);
  assert.deepEqual(at60, at120);
});

test('loop limita atrasos e start repetido não cria outro agendamento', () => {
  let updates = 0,
    requests = 0,
    cancelled = 0;
  const loop = new GameLoop({
    update() {
      updates++;
    },
    render() {},
    isPlaying: () => true,
    requestFrame() {
      return ++requests;
    },
    cancelFrame() {
      cancelled++;
    },
  });
  loop.start();
  loop.start();
  assert.equal(requests, 1);
  loop.tick(0);
  loop.tick(60000);
  assert.equal(updates, 6);
  loop.stop();
  assert.equal(cancelled, 1);
  loop.tick(70000);
  assert.equal(updates, 6);
});

test('loop fornece a fração entre passos para suavizar quadros intermediários', () => {
  const alphas = [];
  const loop = new GameLoop({
    update() {},
    render: (_, alpha) => alphas.push(alpha),
    isPlaying: () => true,
    requestFrame: () => 1,
    cancelFrame() {},
  });
  loop.start();
  loop.tick(0);
  loop.tick(1000 / 120);
  loop.tick(1000 / 60);
  assert.equal(alphas[0], 0);
  assert(Math.abs(alphas[1] - 0.5) < 1e-9);
  assert(Math.abs(alphas[2]) < 1e-9);
  loop.stop();
});
