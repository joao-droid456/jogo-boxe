import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentCircleHit } from '../dist/js/core/math.js';

test('colisão contínua detecta travessia e ignora alvos fora do segmento', () => {
  const start = { x: 0, y: 0 },
    end = { x: 100, y: 0 };
  assert.equal(segmentCircleHit(start, end, { x: 50, y: 0 }, 10), 0.4);
  assert.equal(segmentCircleHit(start, end, { x: 50, y: 30 }, 10), null);
  assert.equal(segmentCircleHit(start, end, { x: -50, y: 0 }, 10), null);
  assert.equal(segmentCircleHit(start, start, start, 10), 0);
});
