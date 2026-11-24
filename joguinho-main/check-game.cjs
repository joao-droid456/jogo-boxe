// Compatibilidade com o workflow antigo. Importa testes sem reescrever o jogo.
const { readdirSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const directory = path.join(__dirname, 'tests');
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.test.js'))
    .sort()) {
    await import(pathToFileURL(path.join(directory, file)).href);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
