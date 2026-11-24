# NEON RUSH

Arena de sobrevivência para celular e PC, feita com JavaScript modular, HTML, CSS e Canvas. Sobreviva por cinco minutos, colete energia e escolha melhorias.

Escolha um dos quatro estilos de boxe antes de entrar na arena:

- **Direto:** soco reto e pesado de alcance médio, no alvo mais próximo, com nocaute forte.
- **Jab elástico:** estilo Mashiba, braços disparam até o inimigo, chicoteiam de volta e evoluem para três golpes por rajada. Tem o maior alcance.
- **Dempsey Roll:** a arrancada atravessa a horda aplicando um soco forte em cada inimigo cruzado; entre arrancadas, os punhos martelam quem chega colado. Nada gira ao redor do jogador.
- **Uppercut:** o punho sobe colado ao corpo e arremessa todos os inimigos próximos. É o golpe mais forte, mas o alcance é o mais curto.

Só o estilo escolhido começa equipado. Durante a partida, as cartas permitem adicionar estilos ao arsenal e evoluir cada um até o nível 3. Uma partida pode combinar os quatro.

Direto, Jab, Roll e Uppercut só gastam a recarga quando há alvo ao alcance. Se a área estiver vazia, ficam prontos para atacar assim que um inimigo entrar.

Há ainda cinco melhorias com três níveis cada: **Alcance de campeão**, **Ritmo de luta**, **Atordoamento**, **Segundo fôlego** e **Guarda alta**. As três primeiras melhoram todos os golpes; segundo fôlego cura por nocautes, e a guarda bloqueia um golpe antes de recarregar.

Além das melhorias básicas, existem três poderes com três níveis cada:

- **Sequência de golpes:** jabs elásticos automáticos atingem vários inimigos ao redor.
- **Choque de ombro:** a arrancada causa dano em quem atravessar e recarrega mais rápido.
- **Adrenalina:** cada nocaute acelera temporariamente todos os golpes.

Enquanto houver algum poder especial disponível, pelo menos uma das três cartas de evolução oferece um deles. Os poderes equipados aparecem no HUD, e as cartas mostram o próximo nível e seu efeito.

Cristais de energia aparecem após eliminar inimigos. Ficam no chão por pelo menos 0,3 segundo antes de o ímã agir, têm contorno claro e continuam visíveis na qualidade gráfica baixa. Cristais maiores valem mais experiência.

## Dificuldade

Elites começam a chegar após 45 segundos, com intervalo mínimo de 45 segundos e no máximo três vivos. São maiores, têm contorno dourado e barra de vida, causam dois pontos de dano e deixam mais experiência. Precisam de uma vaga no limite normal da horda para aparecer.

A partir de um minuto, os primeiros 12 segundos de cada minuto são uma **invasão**, com aparições mais frequentes e aviso na tela. Os cinco minutos de duração e o teto de 200 inimigos permanecem.

A horda cresce gradualmente até 200 inimigos simultâneos. Golpes, cristais, partículas e a resolução do Canvas têm limites; objetos fora da tela continuam na simulação, mas não são desenhados. Halos e cristais usam imagens em cache; o boxeador e os inimigos mantêm corpos e contornos vetoriais. O movimento é interpolado entre os passos da simulação, e a qualidade gráfica reduz resolução e partículas quando a taxa de quadros fica baixa por um período contínuo, preservando a nitidez mínima e o brilho dos atores. O texto da interface mantém sua resolução normal.

## Jogar e desenvolver

Use Node.js 24 ou superior. Não é necessário instalar dependências.

```powershell
cd C:\Users\476849624\Documents\codex\neon-rush
npm.cmd start
```

Abra **http://localhost:5173**. No Windows, `JOGAR.bat` inicia o servidor e abre o navegador. Mantenha o terminal aberto durante a partida e use Ctrl+C para encerrar.

Os módulos precisam ser servidos por HTTP: abrir `dist/index.html` diretamente como arquivo não carrega esta versão. Isso não afeta o GitHub Pages, que já serve por HTTPS.

Para encerrar uma tentativa, abra a pausa pelo botão **Ⅱ** (ou P/Esc no PC) e escolha **Sair da partida**. A opção também aparece durante a escolha de melhorias. Você volta à tela inicial com a arma selecionada e o recorde preservados; o progresso da tentativa é descartado.

**PC:** WASD ou setas para mover; espaço para arrancada; P/Esc para pausar. **Celular:** controle virtual e botão de arrancada. Os ataques são automáticos. Trocar de aba pausa a partida. O recorde fica salvo no navegador do aparelho.

## Estrutura e evolução

Leia [ARCHITECTURE.md](ARCHITECTURE.md) para entender o fluxo e acrescentar conteúdo. Comece pelos catálogos de [inimigos](dist/js/content/enemies.js) e [melhorias](dist/js/content/upgrades.js). Os valores gerais ficam em [config.js](dist/js/core/config.js).

O núcleo não depende das telas, áudio ou armazenamento. O loop usa passos fixos, e os golpes usam testes contínuos de segmento contra círculo. A interface e os efeitos consomem o estado e os eventos da partida.

## Verificar

```powershell
npm.cmd run check
npm.cmd test
```

Para simular cinco minutos e medir o custo de CPU das regras, execute `node scripts/benchmark.mjs`. Use `node scripts/benchmark.mjs --stress` para carga artificial com 200 inimigos, 700 cristais e efeitos no limite. Essas medições não representam FPS nem desempenho gráfico no celular.

Acrescente `--powers` para simular com os três poderes no nível máximo. Braços elásticos, ondas do Uppercut e partículas compartilham os limites visuais existentes.

Use `--starter=roll`, `--starter=jab` ou `--starter=upper` para testar outro estilo inicial. `--arsenal` equipa os quatro estilos, poderes e passivas no nível máximo; pode combinar com `--stress` para testar o limite de carga. Há no máximo 16 animações de braço.

`node check-game.cjs` continua disponível para compatibilidade com o workflow anterior. A suíte inclui testes de regras, integração com navegador simulado e servidor HTTP local. Testes em navegador real e em celular ainda são necessários para conferir aparência e sensação dos controles.

## Publicar no GitHub Pages

No repositório, selecione **Settings → Pages → Source → GitHub Actions**. O workflow `.github/workflows/pages.yml` verifica o projeto e publica somente `dist/` quando a branch `main` recebe atualizações. A URL aparece na execução do workflow e em Settings → Pages.

Não precisa de instalação, build, API ou servidor Node na hospedagem. Envie a pasta `dist/` completa, incluindo `js/`.

A pasta `.openai/` pertence à tentativa anterior de hospedagem Sites e é ignorada pelo Git. Não é necessária para GitHub Pages.

O jogo não faz chamadas de IA, não tem multiplayer nem ranking online. As fontes do Google são opcionais, com alternativas locais.
