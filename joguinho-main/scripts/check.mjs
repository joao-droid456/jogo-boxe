import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function filesAt(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? filesAt(join(directory, entry.name)) : [join(directory, entry.name)],
    ),
  );
  return files.flat();
}

const modules = (await filesAt('dist/js')).filter((file) => file.endsWith('.js'));
for (const file of modules) {
  // Importar valida sintaxe e ligações reais, sem executar o bootstrap do navegador.
  if (!file.endsWith('main.js')) await import(pathToFileURL(resolve(file)).href);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) throw new Error(`Dependência externa inesperada em ${file}`);
    await access(resolve(dirname(file), match[1]));
  }
}
const html = await readFile('dist/index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(https?:|data:)/.test(match[1])) continue;
  await access(resolve('dist', match[1]));
}
console.log(`OK: sintaxe, imports de ${modules.length} módulos e arquivos do HTML.`);
