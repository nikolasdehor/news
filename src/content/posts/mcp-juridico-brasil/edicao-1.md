---
title: "Edição 1: consultar processo judicial virou uma tool MCP"
description: "Como nasceu o servidor MCP que conecta qualquer IA ao DataJud CNJ e aos 91 tribunais brasileiros - com cálculo de prazos, monitoramento e o que ainda está em construção."
pubDate: 2026-06-22T12:00:00-03:00
project: "mcp-juridico-brasil"
tags: ["mcp", "legaltech", "datajud", "cnj", "processo-judicial", "prazo-processual", "advocacia", "python", "open-source", "model-context-protocol"]
draft: false
---

Quando lancei o [MCP Fiscal Brasil](https://github.com/DeHor-Labs/mcp-fiscal-brasil) para dados tributários, a pergunta que apareceu com mais frequência foi: "e o jurídico?". Faz sentido. Advogados, departamentos jurídicos e estudantes de direito já usam assistentes de IA no dia a dia, mas esbarram sempre no mesmo problema: a IA não tem acesso direto ao andamento real do processo. Ela sabe o que foi treinada para saber - não o que aconteceu na audiência de ontem.

O `mcp-juridico-brasil` é minha tentativa de resolver isso. Hoje, 22 de junho de 2026, a versão `0.1.0` está publicada no PyPI. Aqui é o diário honesto de como chegamos até aqui.

---

## O ponto de partida: o DataJud CNJ existe e é gratuito

O Conselho Nacional de Justiça (CNJ) mantém o [DataJud](https://datajud-wiki.cnj.jus.br/api-publica/acesso/) - uma base unificada de dados judiciais com cobertura de **91 tribunais brasileiros** em todas as justiças: Federal, Estadual, do Trabalho, Militar, Eleitoral e Superior. A API é pública, sem cobrança, e só precisa de uma chave gratuita que qualquer pessoa pode solicitar no próprio portal.

Isso muda o cenário inteiro. Não preciso raspar HTML de sites de tribunais nem depender de credencial ICP-Brasil para o módulo básico. A fundação é sólida e já estava lá.

A proposta do servidor não é ser um catálogo genérico de dados públicos. É ser uma **vertical processual**: transformar consultas judiciais fragmentadas em tools seguras, componíveis e prontas para agentes de IA.

---

## O que funciona hoje (v0.1.0)

### Consulta e monitoramento via DataJud

A Fase 1 cobre o ciclo básico de acompanhamento processual. Com a chave do DataJud configurada, qualquer assistente MCP-compatível (Claude Desktop, Cursor, VS Code + Continue) consegue:

- **`buscar_processo_por_numero`** - consulta completa de um processo pelo número CNJ unificado (NNNNNNN-DD.AAAA.J.TT.OOOO), retornando dados cadastrais, classe, assunto, órgão julgador, valor da causa e situação atual
- **`listar_movimentacoes`** - histórico de andamentos com filtro por data e cursor de navegação por offset
- **`resumir_andamento`** - retorna dados do processo mais instrução estruturada para o modelo resumir partes, fase atual, últimas movimentações e próximos passos
- **`monitorar_processo`** - polling com snapshot em memória: verifica atualizações desde uma data de referência e retorna flag de atualização e diff de movimentações novas
- **`listar_processos_monitorados`** - lista os processos com snapshot salvo na sessão atual
- **`listar_tribunais`** - retorna todas as 91 siglas suportadas (Portaria CNJ 160/2020)

E também um **resource MCP**: `processo://{numero}/snapshot` - o último snapshot capturado de um processo monitorado, acessível diretamente por clients que suportam resources.

### Cálculo de prazos processuais (offline, sem API)

A Fase 2 adicionou a tool mais artesanal do projeto: **`calcular_proximo_prazo`**.

Ela faz o cálculo de prazo em dias úteis conforme os artigos 219, 220 e 224 do CPC. Considera:
- Feriados nacionais e estaduais (via `workalendar`)
- Recesso forense nacional (art. 220 do CPC - 20 de dezembro a 20 de janeiro)
- Fins de semana

A tool retorna a data de vencimento, os dias úteis percorridos e a lista de dias não computados com justificativa para cada um. Tudo offline - sem chamada de API, sem latência externa. Útil para o advogado perguntar ao assistente: "prazo de 15 dias úteis a partir de hoje, para o TJGO" e receber a data certa, com o raciocínio explicado.

Esse cálculo é trabalhoso porque o calendário forense brasileiro tem particularidades estaduais e o CPC tem regras específicas de contagem. A implementação usa `workalendar` como base e aplica as regras processuais por cima.

---

## O que está em construção (módulos com mocks)

Dois módulos estão estruturados no código mas **não fazem chamadas reais ainda**: dependem de credencial ou credenciamento que ainda não tenho.

### Providers comerciais (Judit, Escavador, TrackJud)

O módulo `comercial/` contém a estrutura para integrar com providers que oferecem dados enriquecidos além do DataJud: partes completas, CPF/CNPJ de partes, histórico ampliado, etc. A arquitetura está definida (interface `ProcessoProvider`, autenticação via `JURIDICO_PROVIDER_API_KEY`, sem hardcode de credencial), mas cada provider tem uma marca explícita no código dos pontos que precisam de validação com credencial real antes de ir para produção.

Esses providers têm planos pagos. Quando tiver testado com credencial real, documento aqui o que funciona de verdade.

### Intimações via DJe (Domicílio Judicial Eletrônico)

O módulo `dje/` cobre o Domicílio Judicial Eletrônico - o sistema oficial de comunicações processuais. A tool `confirmar_leitura_intimacao` tem dois níveis de proteção porque a confirmação de leitura de uma intimação **tem efeito jurídico real e inicia a contagem do prazo**. Isso é irreversível.

O acesso ao DJe exige credenciamento ICP-Brasil (certificado digital). Até ter isso, o módulo opera com mocks e não deve ser usado em produção.

O aviso está explícito no código:

> *A confirmação de leitura de uma intimação via API DJe tem efeito jurídico real e inicia a contagem oficial do prazo processual. Esta operação é irreversível e requer confirmação explícita em dois níveis: parâmetro `confirmar=True` na chamada da tool + variável de ambiente `DJE_PERMITIR_CONFIRMACAO_LEITURA=true`.*

Quando é só leitura - listar intimações, ler o texto - o risco é menor. Mas ainda depende da credencial.

---

## Números da v0.1.0

- **7 tools ativas** contra o DataJud e o calendário forense (offline)
- **2 módulos com mocks** (comercial e DJe) - estrutura pronta, integração real pendente de credencial
- **1 resource MCP** para snapshots de processos monitorados
- **231 testes**, cobertura de **92%**
- Python 3.10+, MIT, publicado no PyPI

---

## Como instalar

Sem instalar nada permanentemente:

```bash
uvx mcp-juridico-brasil
```

Ou permanente:

```bash
pip install mcp-juridico-brasil
```

Configuração mínima no `claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "juridico-brasil": {
      "command": "uvx",
      "args": ["mcp-juridico-brasil"],
      "env": {
        "DATAJUD_API_KEY": "sua-chave-aqui"
      }
    }
  }
}
```

A chave do DataJud é solicitada no [portal do CNJ](https://datajud-wiki.cnj.jus.br/api-publica/acesso/) - processo simples, sem cobrança.

---

## O que vem a seguir

O roadmap é honesto sobre o que ainda falta:

- **v0.3.x** - Webhook push de atualizações, persistência em banco de dados e alertas por prazo
- **v0.4.x** - Intimações via DJe com credencial real (ICP-Brasil), parsing de publicações e extração estruturada
- **v1.0.0** - Suite processual completa com auditoria LGPD, contratos de API estáveis e cobertura ampliada

---

## Projeto irmão

Este servidor faz par com o **MCP Fiscal Brasil**, que conecta IAs ao sistema fiscal brasileiro (NF-e, SPED, CNPJ, Simples Nacional, Reforma Tributária 2026):

[github.com/DeHor-Labs/mcp-fiscal-brasil](https://github.com/DeHor-Labs/mcp-fiscal-brasil)

---

## Links

- **Repositório:** [github.com/DeHor-Labs/mcp-juridico-brasil](https://github.com/DeHor-Labs/mcp-juridico-brasil)
- **PyPI:** [pypi.org/project/mcp-juridico-brasil](https://pypi.org/project/mcp-juridico-brasil)
- **Issues e contribuições:** [github.com/DeHor-Labs/mcp-juridico-brasil/issues](https://github.com/DeHor-Labs/mcp-juridico-brasil/issues)

---

*Nikolas de Hor - Goiânia, GO*
