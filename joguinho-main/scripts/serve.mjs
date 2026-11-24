import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Serve apenas dist/. Nunca expõe .git ou arquivos do servidor.
export function createGameServer() {
  return createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(resolve(root) + sep) || !mimeTypes[extname(file)]) {
        response.writeHead(404).end('Não encontrado.');
        return;
      }
      const content = await readFile(file);
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(file)],
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404).end('Arquivo indisponível.');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = createGameServer();
  const port = Number(process.env.PORT || 5173);
  server.on('error', (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `Porta ${port} ocupada. Use outra porta com a variável PORT.`
        : error.message,
    );
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(`NEON RUSH: ${url}\nCtrl+C para encerrar.`);
    if (process.argv.includes('--open') && process.platform === 'win32') {
      const browser = spawn('explorer.exe', [url], { stdio: 'ignore' });
      browser.on('error', () => console.log('Abra o endereço acima no navegador.'));
    }
  });
}
