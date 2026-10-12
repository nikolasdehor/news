---
version: alpha
name: news.dehor.com.br
description: Portfólio de 54 projetos e diário de bordo de Nikolas de Hor. Caderno técnico escuro por padrão (com tema claro), um único acento verde para interação e destaque, Geist + Geist Mono na interface e Lora no título editorial.
colors:
  primary: "#F0F0EE"
  secondary: "#8C8D88"
  tertiary: "#3FD17E"
  neutral: "#0E110F"
  on-tertiary: "#0E110F"
  surface: "#141814"
  surface-alt: "#1A1F1B"
  on-surface-variant: "#C8C8C4"
  text-faint: "#3E3E3A"
  border: "#242824"
  border-subtle: "#1C201C"
  accent-hover: "#5ADF94"
  accent-subtle: "#0F2518"
  accent-line: "#3FD17E"
  code-bg: "#1A1F1B"
  code-text: "#5FD99A"
  pre-bg: "#111411"
  pre-text: "#D4D4D0"
  error: "#ff6b6b"
  primary-light: "#1A1A18"
  secondary-light: "#6B6B66"
  tertiary-light: "#1A7A4A"
  neutral-light: "#FAFAF8"
  surface-light: "#FFFFFF"
  surface-alt-light: "#F4F4F2"
  on-surface-variant-light: "#3D3D3A"
  text-faint-light: "#BDBDB8"
  border-light: "#E8E8E4"
  border-subtle-light: "#F0F0EC"
  accent-hover-light: "#155F3A"
  accent-subtle-light: "#E8F4EE"
  accent-line-light: "#2D9962"
  code-bg-light: "#F0F0EC"
  code-text-light: "#2E6B45"
  pre-bg-light: "#1A1A18"
  pre-text-light: "#E8E8E4"
  error-light: "#c0392b"
  on-tertiary-light: "#FFFFFF"
typography:
  hero-title:
    fontFamily: Geist Variable
    fontSize: 84px
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: -0.035em
  project-title:
    fontFamily: Geist Variable
    fontSize: 68px
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: -0.035em
  featured-title:
    fontFamily: Geist Variable
    fontSize: 64px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: -0.035em
  stat-number:
    fontFamily: Geist Mono
    fontSize: 40px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: -0.04em
  section-title:
    fontFamily: Geist Variable
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.02em
  article-h1:
    fontFamily: Lora
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  article-title:
    fontFamily: Lora
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: -0.015em
  article-h2:
    fontFamily: Geist Variable
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.02em
  article-h3:
    fontFamily: Geist Variable
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.35
  card-title:
    fontFamily: Geist Variable
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.02em
  list-title:
    fontFamily: Geist Variable
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: -0.02em
  body-md:
    fontFamily: Geist Variable
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.65
  body-base:
    fontFamily: Geist Variable
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Geist Variable
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Geist Variable
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.08em
  wordmark:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1
  code:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  card: 12px
  pill: 999px
spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-5: 20px
  space-6: 24px
  space-8: 32px
  space-10: 40px
  space-12: 48px
  space-16: 64px
  space-20: 80px
  space-24: 96px
  gutter: 24px
  content-width: 880px
  wide-width: 1160px
  reading-width: 680px
  narrow-width: 560px
components:
  page:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.on-surface-variant}"
  wordmark:
    typography: "{typography.wordmark}"
    textColor: "{colors.primary}"
  nav-link:
    typography: "{typography.body-sm}"
    textColor: "{colors.secondary}"
  nav-link-hover:
    textColor: "{colors.tertiary}"
  featured-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: 24px
  featured-card-lead:
    backgroundColor: "{colors.accent-subtle}"
    rounded: "{rounded.card}"
    padding: 32px
  catalog-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: 16px 20px
  catalog-card-hover:
    backgroundColor: "{colors.surface-alt}"
  filter-chip:
    backgroundColor: transparent
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    height: 40px
  filter-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 44px
  badge:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 0.2em 0.65em
  badge-accent:
    backgroundColor: "{colors.accent-subtle}"
    textColor: "{colors.tertiary}"
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 20px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body-base}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  checkbox:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
  checkbox-checked:
    backgroundColor: "{colors.tertiary}"
  code-inline:
    backgroundColor: "{colors.code-bg}"
    textColor: "{colors.code-text}"
    typography: "{typography.code}"
    rounded: "{rounded.sm}"
  code-block:
    backgroundColor: "{colors.pre-bg}"
    textColor: "{colors.pre-text}"
    typography: "{typography.code}"
    rounded: "{rounded.lg}"
  theme-toggle:
    backgroundColor: transparent
    textColor: "{colors.text-faint}"
    rounded: "{rounded.md}"
    height: 36px
    width: 36px
  theme-toggle-hover:
    textColor: "{colors.tertiary}"
---

## Overview

news.dehor.com.br é o portfólio dos 54 projetos de Nikolas de Hor (catálogo em `src/data/projetos.json`) e o diário de bordo deles. A direção é um **caderno técnico escuro**: grafite levemente esverdeado, tipografia com hierarquia forte, um único verde reservado para interação e destaque, e números reais calculados no build. O tema escuro é o padrão (script anti-FOUC em `Head.astro`); o claro é um off-white calcário com o mesmo sistema, ajustado para contraste AA.

Leitura de design (skills Taste/impeccable): portfólio de desenvolvedor para recrutadores, clientes e outros devs brasileiros; linguagem editorial-técnica; dials VARIANCE 6, MOTION 4, DENSITY 5 (mais denso que um portfólio comum, porque são 54 itens).

## Arquitetura de informação

- **Home** (`src/pages/index.astro`): intro (nome + robozinho + frase + 2 ações, painel com 4 números e o mapa do portfólio) -> **Em destaque** (6 itens com `destaque: true`, bento espelhado) -> **Todos os projetos** (grade densa por categoria com filtro) -> **Diário de bordo** (edição mais recente em destaque + lista) -> inscrição -> rodapé.
- **Ficha do projeto** (`src/pages/[project]/index.astro`): título grande + descrição + ações (links públicos e RSS) à esquerda, ficha técnica em `dl` à direita (status, categoria, código, stack, edições), lista de edições numeradas e "Mais em <categoria>" com até 3 vizinhos.
- **Post e /semana**: coluna de leitura de 680px (`src/styles/leitura.css`).

## Colors

Paleta quase acromática com um único acento semântico. O verde (`{colors.tertiary}`) marca: links, botão primário, filete do topo, cartões de destaque (fundo `{colors.accent-subtle}`), células de destaque no mapa e o estado "ativo". Nunca decoração solta.

- **Texto secundário** (`{colors.secondary}`) foi recalibrado: `#8C8D88` no escuro (5,7:1) e `#6B6B66` no claro (5,1:1). O valor antigo do claro (`#8A8A84`, 3,3:1) reprovava AA.
- **Texto sobre o verde** (`--color-on-accent`): `#0E110F` no escuro (9,6:1 sobre `#3FD17E`) e branco no claro. Vale para o botão primário, para o botão do formulário de inscrição e para a seleção de texto.
- **Mapa do portfólio**: destaque = verde cheio; ativo = cinza cheio; pausado = só contorno. A cor carrega estado, nunca categoria (a categoria é a linha).

## Typography

- **Geist Variable**: voz da interface. Nome no hero em 84px/600, tracking -0.035em; títulos de seção 30px/600; nomes no catálogo 17px/600.
- **Geist Mono**: dados e medidas, nunca fantasia: números do painel (com `tabular-nums`), stack, contagens, datas do diário, número das edições, wordmark.
- **Lora**: só a voz editorial: título do post, título da edição em destaque no diário e citações dentro do post.
- `text-wrap: balance` em títulos, `pretty` em parágrafos, `-webkit-font-smoothing: antialiased` no corpo. Sem eyebrow em caixa alta acima de títulos; a seção se apresenta pelo próprio título.
- Fontes mantidas (Geist + Geist Mono + Lora, self-hosted via @fontsource): Geist + Geist Mono é o par recomendado pela skill Taste para interface técnica e já é a identidade do site; Lora fica restrita ao texto que se lê. Testado preload da Geist: piorou o LCP mobile (2,0 s para 4,8 s), por isso não há preload.

## Layout

- Larguras: `{spacing.wide-width}` (1160px) para home, ficha, header e footer; `{spacing.reading-width}` (680px) para leitura; `{spacing.narrow-width}` (560px) para formulários.
- Ritmo vertical entre blocos: `clamp(3.5rem, 2rem + 5vw, 6rem)`.
- **Bento espelhado dos destaques** (grade de 3 colunas, `grid-auto-flow: dense`): o 1º e o 4º itens ocupam 2x2, o primeiro à esquerda e o segundo à direita. Em 960px vira 2 colunas (grandes em largura total); em 640px, 1 coluna.
- **Catálogo**: `repeat(auto-fill, minmax(248px, 1fr))`, 4 colunas no desktop. No celular os cartões viram linhas editoriais (fio de 1px no topo, sem fundo, descrição em 2 linhas, links externos ocultos porque estão na ficha).
- Filtro fixo (sticky) logo abaixo do header, rolagem horizontal no celular, sem barra de rolagem visível.
- 390px e 320px sem rolagem horizontal (`overflow-x: clip` em `html` e `body`).

## Elevation & Depth

Plano por decisão: profundidade vem da troca de superfície (`surface` -> `surface-alt`) e de fios de 1px. Nenhuma sombra de elevação. O header (e o filtro do catálogo) usam fundo a 92-94% com `backdrop-filter: blur(12px)`; é o único vidro do sistema e existe porque o conteúdo passa por baixo.

## Shapes

Regra única de raio: cartões 12px (`{rounded.card}`), botões e toggle 6px (`{rounded.md}`), selos 4px (`{rounded.sm}`), filtros em pílula (`{rounded.pill}`, controles pequenos). Células do mapa 3px.

## Components

- **Botão primário/secundário** (`.botao`, `.botao--primario`): 44px de altura, `scale(0.97)` no `:active`, transições só de cor, borda e transform.
- **Cartão de destaque** (`FeaturedProject.astro`): categoria, nome, descrição, stack em mono e links. Link esticado cobre o cartão; links externos ficam numa camada acima.
- **Item do catálogo** (`ProjectItem.astro`): nome, descrição (3 linhas), stack, selos de `pausado`/`privado`/edições e links públicos.
- **Filtro** (`.filtro`): sem JS são âncoras para cada categoria; com JS viram filtro (`aria-current`, `hidden` nos grupos, `role="status"` anunciando "Mostrando N projetos", hash na URL compartilhável, `hashchange` tratado).
- **Mapa do portfólio** (`.mapa`): uma linha por categoria, um quadrado por projeto. É visual (`aria-hidden`, links com `tabindex="-1"` e `title`); o conteúdo acessível é o catálogo.
- **Robozinho** (`Robo.astro`): pixel art 11x9 portado do mascote de `dehor.dev` (modos idle e greet) como SVG estático. Segue o nome no hero, na linha de base, e leva a https://dehor.dev. O teal original virou o verde do site (trava de acento único). Link com `aria-label`; o SVG é `aria-hidden`. Pisca a cada ~5 s e a antena pulsa em `steps()`; no hover/foco troca para a expressão de "oi".
- **Ficha técnica** (`.ficha__dados`): `dl` em cartão; o status ativo leva o único ponto colorido do sistema (estado real).
- **Edições** (`.edicao`): número da edição em mono verde, título, resumo e data; linha inteira clicável.
- **Estado vazio**: painel com texto e uma ação clara (diário da semana ou todos os projetos).

## Motion

CSS puro, sem GSAP: a página não tem cena de rolagem que justifique a biblioteca, e CSS cobre o único momento autoral sem custo de JS. Momento único de entrada: as células do mapa acendem em cascata (`opacity` + `scale`, 420ms, `cubic-bezier(0.23, 1, 0.32, 1)`, 16ms entre células). Robozinho: piscar e antena. Interações: 120-200ms só em cor, borda e transform. Tudo atrás de `prefers-reduced-motion: no-preference`; filtro sem animação (ação frequente).

## Do's and Don'ts

- Do usar o verde só para interação, destaque e estado ativo.
- Do usar mono só para dados (números, stack, datas, edições).
- Do manter o catálogo e o mapa derivados de `projetos.json`; nada de número inventado. Estrelas do GitHub não aparecem porque o catálogo não tem esse dado e não há chamada em runtime.
- Don't usar eyebrow em caixa alta acima de títulos, nem travessão (em dash) em texto da interface.
- Don't introduzir sombra de elevação nem um segundo acento.
- Don't mostrar repositório de projeto privado (regra mantida via `linksDoProjeto`).

## Arquivos

- `src/styles/global.css`: ponto de entrada único (fontes + `base.css` + `leitura.css` + `portfolio.css` + `ficha.css`, nessa ordem).
- `src/styles/base.css`: tokens, reset, header, footer, utilitários.
- `src/styles/leitura.css`: post, prosa, rodapé do post.
- `src/styles/portfolio.css`: home e componentes compartilhados (botão, stack, grade, cartões).
- `src/styles/ficha.css`: ficha do projeto, edições e estado vazio.

## Observações (não normativas)

- O script de sincronização e os resumos antigos usam hífen ou vírgula no lugar de travessão.
- Tokens `--shadow-sm`/`--shadow-md` e `--text-4xl` seguem órfãos.
