import { GameApp } from './app.js';

const app = new GameApp({ window, document });
app.start();
window.addEventListener('pagehide', () => app.dispose(), { once: true });
// O navegador pode restaurar a página pelo histórico sem executar os módulos novamente.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});
