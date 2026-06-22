---
title: "Edição 1: de zero a 44 tools - o que o MCP Fiscal Brasil entregou nos primeiros três meses"
description: "Do protótipo de uma linha ao servidor MCP fiscal mais completo do Brasil - um relato honesto de tudo que foi construído, corrigido e aprendido entre março e junho de 2026."
pubDate: 2026-06-22
project: "mcp-fiscal-brasil"
tags: ["mcp", "python", "fiscal", "brasil", "nfe", "sped", "cnpj", "open-source", "reforma-tributaria", "tributario", "devtools", "ia", "automacao"]
ogImage: "/og/mcp-fiscal-brasil.png"
draft: false
---

Sou desenvolvedor em Goiânia e mantenho o [mcp-fiscal-brasil](https://github.com/DeHor-Labs/mcp-fiscal-brasil), um servidor [Model Context Protocol](https://modelcontextprotocol.io) que dá a assistentes de IA acesso a dados fiscais brasileiros em linguagem natural. Este é o primeiro post do diário de bordo do projeto - e, para começar, faz sentido contar de onde saímos e onde chegamos.

Hoje o projeto está na **v0.5.1**. Isso merece um contexto.

---

## Como tudo começou (v0.1.0 - março de 2026)

A v0.1.0 saiu em 27 de março de 2026 com 41 arquivos Python e uma proposta simples: CNPJ, CPF, NFe, NFSe, SPED e eSocial acessíveis via MCP. O suficiente pra mostrar que a ideia funcionava. O núcleo estava lá - HTTP client compartilhado, validadores, parsing XML - mas o projeto era pequeno, sem refinamento.

O que existia naquele ponto:

- 8 módulos fiscais básicos
- 14 tools MCP iniciais
- CI com GitHub Actions, lint e publicação no PyPI
- Uma suite de testes de ~70 casos

---

## A virada (v0.2.0 - maio de 2026)

A v0.2.0 foi onde o projeto ganhou forma de verdade. Cinco frentes em paralelo:

**Infraestrutura production-grade.** Cada módulo antes tinha seu próprio cliente HTTP. Refatorei tudo para um núcleo comum em `_core/`: HTTP com `httpx` + `tenacity` (retry exponencial), cache pluggável (memória, SQLite ou Redis), rate-limit por host via `aiolimiter`, logs JSON estruturados com `structlog` e configuração via `pydantic-settings`. A complexidade infraestrutural deixou de ficar espalhada e passou a ser compartilhada e testada uma vez só.

**8 novas fontes de dados.** Adicionei módulos completos para CNAE, CPF, Simples Nacional, MEI, IBGE, CEP, Empresa consolidada e Certidões, cada um com `client.py`, `schemas.py` pydantic e testes.

**Tools agênticas - o salto qualitativo.** Tools de baixo nível são úteis, mas exigem que o agente saiba compor várias chamadas. O módulo `agentic/` criou tools de alto nível que respondem perguntas completas em uma única chamada:

| Tool | O que faz |
|------|-----------|
| `analyze_cnpj_compliance` | Consolida CNPJ + Simples + MEI + CNAE, retorna score 0-100 e risco classificado |
| `compare_tax_regimes` | Compara MEI, Simples, Lucro Presumido e Lucro Real com alíquota efetiva estimada |
| `risk_score_supplier` | Due diligence de fornecedor com recomendação (aprovar/investigar/recusar) |
| `validate_nfe_full` | Parse XML + validação de chave + situação do emissor |
| `summarize_sped` | Sumário executivo de arquivo SPED |
| `consultar_empresas_lote` | Triagem em lote de fornecedores com score e erros por CNPJ |

**Múltiplas interfaces.** Além do servidor MCP: CLI standalone (`mcp-fiscal`), REST API com Web UI demo (`mcp-fiscal-api`), e wrapper Node.js em preview. A v0.2.0 também publicou o site de documentação em [dehor-labs.github.io/mcp-fiscal-brasil](https://dehor-labs.github.io/mcp-fiscal-brasil/).

**Docker e release.** Dockerfile multi-stage com usuário não-root, healthcheck e cache de pip. A suite de testes saltou de ~70 para 117 casos.

---

## Onda 1 - tabelas fiscais offline e indexadores BCB (v0.3.0 - junho de 2026)

Em junho chegou a Onda 1, com um foco específico: dados que devem funcionar **offline**, sem depender de API externa nenhuma.

**Tabelas fiscais embutidas no pacote.** O banco SQLite com a TIPI completa vem dentro do wheel. Isso significa que você consulta NCM, CFOP, CST/CSOSN, CEST e alíquota de ICMS interestadual sem fazer nenhuma requisição de rede:

| Tool | O que faz |
|------|-----------|
| `consultar_ncm` | Lookup de código NCM na TIPI (offline) |
| `consultar_cfop` | Descrição e natureza de operação por código CFOP |
| `validar_cst` | Validação de Código de Situação Tributária (CST/CSOSN) |
| `consultar_cest` | Consulta de código CEST por produto |
| `consultar_aliquota_icms` | Alíquota interestadual ICMS/DIFAL por par de UFs |

**Indexadores do Banco Central.** Quatro tools para cálculos financeiros que aparecem todo dia em contextos fiscais:

| Tool | O que faz |
|------|-----------|
| `taxa_selic` | Taxa Selic vigente via SGS/BCB |
| `ipca_periodo` | IPCA acumulado em intervalo de datas |
| `ptax_data` | Cotação PTAX de compra/venda em data específica |
| `calcular_correcao_monetaria` | Correção monetária entre duas datas pelo IPCA |

**Novos módulos expostos no MCP.** CEP, CNAE, IBGE, MEI e consulta consolidada de empresa, que antes existiam no SDK, passaram a ser acessíveis como tools MCP.

O total de tools subiu de 20 para **36**. A suite de testes chegou a 327 casos.

A v0.3.0 também corrigiu um bug importante: a inversão das alíquotas de ICMS interestadual. Operações com origem em Sul/Sudeste (exceto ES) para destinos N/NE/CO/ES devolviam 12% quando deveriam retornar 7%, e vice-versa. Corrigido de acordo com a Resolução do Senado Federal n. 22/1989.

A v0.3.1 (dois dias depois) corrigiu o `mcp-name` para o formato exato `io.github.DeHor-Labs/mcp-fiscal-brasil`, necessário para validação de ownership no registry oficial MCP.

---

## Onda 2 - NF-e completa e Reforma Tributária 2026 (v0.4.0 - junho de 2026)

A Onda 2 entregou dois módulos grandes que estavam no roadmap desde o início.

**NF-e completa: parse, DANFE, assinatura, distribuição e manifestação.** O módulo `nfe` saiu do básico (validar chave, consultar status SEFAZ) para cobrir todo o ciclo documental:

| Tool | O que faz |
|------|-----------|
| `parse_nfe_xml` | Parseia XML bruto de NF-e/NFC-e e retorna dados estruturados (emitente, destinatário, itens, totais, protocolo) |
| `gerar_danfe` | Gera DANFE PDF (A4, modelo 55) a partir do XML - retorna base64, offline |
| `validar_assinatura_nfe` | Valida assinatura XMLDSig e extrai dados do certificado (titular, CNPJ/CPF, validade, AC) |
| `baixar_nfe_distribuicao` | Baixa documentos via NFeDistribuicaoDFe - requer certificado A1 local, autenticação mTLS |
| `manifestar_nfe` | Registra manifestação do destinatário via NFeRecepcaoEvento (Ciência, Confirmação, Desconhecimento, Operação não Realizada) |

As duas últimas tools - distribuição e manifestação - são opt-in: exigem um certificado digital A1 (`.pfx`/`.p12`) instalado localmente. O certificado e a senha nunca saem do computador do usuário: autenticação mTLS e assinatura XMLDSig são feitas localmente.

Do ponto de vista de segurança, toda entrada XML externa passa por `parse_xml()` com `lxml` configurado sem resolução de entidades externas e sem acesso à rede, antes de chegar a qualquer biblioteca de geração de PDF.

**Simulador da Reforma Tributária IBS/CBS.** A LC 214/2025 criou o IBS e o CBS, que vão substituir gradualmente ICMS, ISS, PIS e COFINS entre 2026 e 2033. Adicionei `simular_transicao_reforma_tributaria`: informa o valor bruto, as alíquotas atuais e o CNAE, e recebe uma tabela anual com as alíquotas IBS/CBS por fase, a carga comparada (atual vs. nova) e a economia ou custo estimado por ano. Funciona offline, sem API key. Fonte: LC 214/2025 e Resolução Comite Gestor CG-IBS n. 1/2025.

O total de tools subiu de 36 para **42**.

---

## Correções e endurecimento (v0.5.0 e v0.5.1 - junho de 2026)

A v0.5.0 adicionou dois itens que estavam pendentes:

**Cálculo de tributos de importação por NCM.** O módulo `importacao` entregou duas tools:

- `consultar_aliquotas_importacao` - retorna a alíquota IPI do banco NCM/TIPI embutido, os defaults de PIS/COFINS-importação (2,1% e 9,65%, conforme Lei 10.865/2004) e o aviso sobre a alíquota II (TEC), que não está disponível offline e deve ser informada pelo usuário.
- `calcular_tributos_importacao` - calcula a cascata completa de tributos de importação: II, IPI, PIS/COFINS-importação, ICMS grossed-up, AFRMM e taxa Siscomex, a partir do valor aduaneiro, alíquota II informada, UF importadora e modal. Retorna breakdown por tributo com base, alíquota, valor, fundamento legal, avisos e disclaimers obrigatórios. Offline. Escopo MVP: fora de antidumping, regimes especiais, acordos bilaterais e alíquotas diferenciadas de PIS/COFINS.

**Circuit breaker para NFS-e Nacional.** Após 5 falhas consecutivas no client da NFS-e Nacional (ADN), novas chamadas são bloqueadas por 60 segundos sem tocar a API. O estado é resetado automaticamente após o cooldown ou em caso de sucesso. Evita sobrecarregar o serviço em instabilidades.

**Fixes no parser SPED.** O parser agora extrai corretamente os valores de PIS (M210), COFINS (M610) e ICMS (E110) como valores a recolher do período, garantindo comparabilidade entre os três tributos. A chave `icms_total` foi substituída por duas chaves distintas: `icms_a_recolher` (valor líquido após créditos) e `icms_total_debitos` (total bruto de débitos). A tool `listar_registros_sped` passou a retornar `campos` como `list[str]` em vez da string bruta com separadores `|`.

**Segurança.** A v0.5.0 também corrigiu um finding CodeQL de severidade alta: validação de caminhos de arquivo contra path injection em ferramentas que recebem caminhos de NFe/SPED.

**Infraestrutura de release.** A série v0.5.x trouxe automação completa do ciclo de release: release-please para Release PRs automáticos e publicação encadeada no PyPI, CodeQL focado em `security-extended` com workflow dispatch para reverificação manual, Dependabot com auto-aprovação e auto-merge de patches e minors (incluindo vulnerabilidades), e actions fixadas por SHA para segurança da cadeia de suprimentos.

A v0.5.1 (um dia depois da v0.5.0) foi de polimento das notas de release em pt-BR e sincronização de metadados JSON.

---

## O que existe hoje na v0.5.1

Um resumo do estado atual, sem enrolação:

**Tools MCP disponíveis: 44** (distribuídas em módulos funcionais, de orientação e com certificado A1)

**Módulos ativos:**

| Módulo | Tipo |
|--------|------|
| CNPJ (consulta, Simples, lote) | Online - BrasilAPI/ReceitaWS |
| CPF (validação) | Offline |
| NFe (validar chave, status SEFAZ, consulta, parse, DANFE, assinatura, distribuição, manifestação) | Offline + SEFAZ (mTLS opt-in) |
| NFSe (orientação de portal) | Orientação |
| SPED (análise, listagem de registros) | Offline |
| eSocial (catálogo de eventos, validação estrutural) | Offline |
| Tabelas fiscais (NCM/TIPI, CFOP, CST, CEST, ICMS interestadual) | Offline - SQLite embutido |
| BCB (Selic, IPCA, PTAX, correção monetária) | Online - SGS/BCB |
| Importação (alíquotas, cálculo de tributos por NCM) | Offline/MVPOnline |
| Reforma Tributária IBS/CBS 2026-2033 | Offline - LC 214/2025 |
| CEP, CNAE, IBGE, MEI, Empresa consolidada | Online - BrasilAPI/IBGE |
| Certidões (CND, FGTS, CNDT) | Orientação |
| Tools agênticas (compliance, lote, regimes, NFe full, SPED, due diligence) | Composição |

**Formas de usar:**

- **Servidor MCP** - para Claude Desktop, Claude Code, Cursor, VS Code + Continue, qualquer cliente MCP
- **SDK Python** - importação direta via `FiscalBrasil` em FastAPI, Django, scripts
- **CLI standalone** - `mcp-fiscal cnpj/compliance/regimes/supplier`
- **REST API + Web UI demo** - `mcp-fiscal-api` com FastAPI e htmx

**Instalação em uma linha:**

```bash
uvx mcp-fiscal-brasil
```

Sem API key, sem cadastro, sem configuração obrigatória. Tudo que exige autenticação (certificado A1 para SEFAZ, alíquota II para importação) é opt-in e documentado.

**Testes: 327+ casos.** Cobertura de 80%+ no código de módulos.

---

## O que vem a seguir

O roadmap está sendo ajustado à medida que o projeto cresce. Com base no estado atual e nas issues abertas, as prioridades próximas são:

- **Cobertura de NFC-e (modelo 65)** no DANFE - a v0.4.0 documentou a limitação, a biblioteca `brazilfiscalreport` v1.0.0 ainda não suporta
- **Expansão da NFS-e** - hoje retorna orientação de portal; objetivo é suporte direto em municípios com API ABRASF pública
- **Cache persistente opcional** - Redis ou SQLite para ambientes de produção com volume alto
- **Mais testes de integração** para os módulos online com mocks de API

Se você tem um caso de uso específico ou achou um bug, abra uma issue no GitHub. Issues com contexto real (versão, exemplo de XML sem dados pessoais, comportamento esperado vs. obtido) entram no roadmap de verdade.

---

## Por que open source

Eu mantenho este projeto sozinho. Trabalho de outra coisa pra pagar as contas. Faço isso porque acredito que automação fiscal não deveria ser refém de SaaS caros. PMEs brasileiras pagam fortunas por sistemas que só consultam CNPJ. Com o `mcp-fiscal-brasil`, qualquer desenvolvedor pode integrar consultas fiscais em qualquer aplicação, gratuitamente.

Se o projeto é útil pra você, a forma mais simples de ajudar é deixar uma estrela no GitHub. Isso aumenta a visibilidade e ajuda outras pessoas a encontrarem o projeto.

Abraço de Goiânia.

- Nikolas de Hor

---

## Links

- **Repositório**: https://github.com/DeHor-Labs/mcp-fiscal-brasil
- **Documentação**: https://dehor-labs.github.io/mcp-fiscal-brasil/
- **PyPI**: https://pypi.org/project/mcp-fiscal-brasil/
- **CHANGELOG completo**: https://github.com/DeHor-Labs/mcp-fiscal-brasil/blob/main/CHANGELOG.md
- **MCP Spec**: https://modelcontextprotocol.io
