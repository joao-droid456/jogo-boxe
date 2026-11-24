import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get } from 'node:http';
import { createGameServer } from '../scripts/serve.mjs';

test('servidor entrega HTML e módulos com MIME correto e restringe acesso a dist', async () => {
  const server = createGameServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const read = (path) =>
    new Promise((resolve, reject) => {
      get({ hostname: '127.0.0.1', port: server.address().port, path }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (data) => {
          body += data;
        });
        response.on('end', () =>
          resolve({ status: response.statusCode, headers: response.headers, body }),
        );
      }).on('error', reject);
    });
  try {
    const html = await read('/');
    assert.equal(html.status, 200);
    assert(html.body.includes('type="module"'));
    const module = await read('/js/core/session.js');
    assert.equal(module.status, 200);
    assert(module.headers['content-type'].includes('text/javascript'));
    assert.equal((await read('/js/core/arquivo-inexistente.js')).status, 404);
    assert.equal((await read('/%2e%2e%2fpackage.json')).status, 404);
    assert.equal((await read('/%2e%2e%5cpackage.json')).status, 404);
    assert.equal((await read('/%')).status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
