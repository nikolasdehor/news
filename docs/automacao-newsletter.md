# Automação de rascunhos de newsletter

Este repositório tem um workflow que monitora releases de projetos open source e
gera rascunhos de post automaticamente, sem flood e sem duplicata.

---

## Como funciona

1. O workflow `.github/workflows/sync-releases.yml` roda a cada 6 horas (cron)
   e pode ser disparado manualmente pelo botão "Run workflow" no GitHub Actions.

2. O script `scripts/sync-releases.mjs` consulta a API pública do GitHub para
   cada projeto monitorado e verifica quais tags de release ainda não foram cobertas.

3. O arquivo `.github/synced-releases.json` é o estado anti-flood: toda tag já
   coberta por um post (manual ou automático) fica registrada ali. O script ignora
   essas tags em todas as rodadas futuras.

4. Para cada tag nova encontrada, o script gera um arquivo `.md` em
   `src/content/posts/<slug>/novidades-<versão>.md` com:
   - Frontmatter válido para o schema Astro (`title`, `description`, `pubDate`,
     `project`, `tags`, `ogImage`, `draft: true`)
   - Um comentário HTML no topo avisando que é rascunho a revisar
   - Corpo com parágrafo de abertura, seção "O que mudou" com as release notes
     originais e seção de links (repo, docs, PyPI, release no GitHub)

5. Se algum rascunho foi gerado, o workflow abre (ou atualiza, via force-push)
   um PR na branch estável `auto/rascunho-releases` com label `rascunho-auto`.
   Usar um nome de branch fixo garante que `peter-evans/create-pull-request`
   atualize o PR existente em vez de abrir um novo a cada rodada do cron.

   **Importante:** o estado atualizado (`.github/synced-releases.json`) vai no
   commit do PR, mas a branch de trabalho é `auto/rascunho-releases`, não
   `main`. Enquanto o PR não for mergeado, a próxima rodada do cron faz
   force-push na mesma branch e atualiza o PR existente - sem flood de PRs.
   Após o merge, o estado em `main` passa a cobrir as tags geradas e o script
   não as processa novamente.

6. Se não há releases novos, o workflow encerra sem abrir PR.

---

## Fluxo de revisão (PR para publicação)

```
release no GitHub
      |
      v
workflow detecta tag nova
      |
      v
script gera .md com draft: true
      |
      v
PR aberto com label rascunho-auto
      |
      v
você revisa: ajusta tom, completa seções, muda draft: false
      |
      v
merge na main -> deploy automático publica o post
```

---

## Como adicionar um novo projeto monitorado

Edite a constante `PROJECTS` em `scripts/sync-releases.mjs`:

```js
const PROJECTS = [
  {
    repo: 'DeHor-Labs/mcp-fiscal-brasil',
    slug: 'mcp-fiscal-brasil',
    ogImage: '/og/mcp-fiscal-brasil.png',
    baseTags: ['mcp', 'python', 'fiscal', 'brasil', 'open-source'],
    links: {
      repo: 'https://github.com/DeHor-Labs/mcp-fiscal-brasil',
      docs: 'https://dehor-labs.github.io/mcp-fiscal-brasil/',
      pypi: 'https://pypi.org/project/mcp-fiscal-brasil/',
    },
  },
  // Novo projeto:
  {
    repo: 'DeHor-Labs/mcp-juridico-brasil',
    slug: 'mcp-juridico-brasil',
    ogImage: '/og/mcp-juridico-brasil.png',
    baseTags: ['mcp', 'python', 'juridico', 'brasil', 'open-source'],
    links: {
      repo: 'https://github.com/DeHor-Labs/mcp-juridico-brasil',
      docs: 'https://dehor-labs.github.io/mcp-juridico-brasil/',
      pypi: 'https://pypi.org/project/mcp-juridico-brasil/',
    },
  },
];
```

Depois, pré-popule o estado com as tags já existentes para evitar flood inicial:

```bash
# Listar tags publicadas do novo projeto
gh api repos/DeHor-Labs/mcp-juridico-brasil/releases \
  --jq '[.[] | select(.draft==false and .prerelease==false and .published_at!=null) | .tag_name]'

# Adicionar manualmente em .github/synced-releases.json:
# "mcp-juridico-brasil": ["v0.1.0", "v0.2.0", ...]
```

---

## Convenção de slug dos posts

| Tag do release | Slug do arquivo |
|----------------|-----------------|
| `v0.6.0`       | `novidades-v0-6-0.md` |
| `v1.0.0-rc.1`  | `novidades-v1-0-0-rc-1.md` |
| `v2.0.0`       | `novidades-v2-0-0.md` |

A convenção `novidades-<versão>` garante que:
- Posts manuais de retrospectiva (ex: `edicao-1.md`) não colidem com posts automáticos
- Rodar o workflow duas vezes para a mesma tag não gera duplicata (arquivo já existe)
- O slug é legível na URL e deriva diretamente da tag sem ambiguidade

---

## Teste local

```bash
# Simular sem escrever nada (DRY_RUN)
DRY_RUN=true node scripts/sync-releases.mjs

# Rodar de verdade (usa GITHUB_TOKEN se disponível)
GITHUB_TOKEN=$(gh auth token) node scripts/sync-releases.mjs
```

Exit codes do script:
- `0` - nada novo, tudo já coberto
- `2` - rascunhos gerados (o workflow abre PR neste caso)
- `1` - erro fatal

---

## Permissões necessárias no repositório

O workflow usa o `GITHUB_TOKEN` nativo (sem PAT cross-conta) porque:

- A leitura dos releases de `DeHor-Labs/mcp-fiscal-brasil` é feita pela API pública
  do GitHub (repositório público, sem autenticação obrigatória)
- A criação de branch, commit e PR é feita no próprio repo `nikolasdehor/news`,
  onde o `GITHUB_TOKEN` tem permissão por padrão

A opção **Allow GitHub Actions to create and approve pull requests** já está
habilitada neste repositório (configurada via `gh api` no deploy inicial).
