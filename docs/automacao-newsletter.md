# Resumo semanal com revisão

O workflow sync-releases executa segunda-feira às 09:00 em America/Sao_Paulo
(12:00 UTC), e aceita execução manual. Somente prepara PR **draft**; não publica
nem envia emails. A newsletter existente continua acionada por push de conteúdo
na main. Merge de post com draft:false publica e pode enviar aos inscritos: essa
é uma decisão explícita posterior, fora da autorização para preparar rascunhos.

## Coleta e seleção

`scripts/news-projects.mjs` lê o catálogo `src/data/projetos.json` e monitora só
os itens públicos com repositório. Projetos novos sem edição publicada usam a
baseline `since` de `.github/synced-releases.json` (e as tags já existentes em
`covered`), para não gerar flood histórico. Isso não muda assinaturas/audiências.
Repositórios devem retornar private:false antes de qualquer coleta. Não usamos
commits, repositórios privados, dados de clientes, nem serviços pagos.

Paginação completa de releases públicas (sem prereleases) e PRs fechadas/mergeadas.
Janela: (sourceUntil da última edição publicada, instante de coleta], usando
pubDate como baseline para edições antigas. A primeira retomada recupera todo o
intervalo desde junho; depois resume semanalmente. Datas no texto usam São Paulo.
Releases estáveis e PRs são seções distintas: merge não comprova disponibilidade em pacote.
Pré-releases de teste não qualificam como lançamento estável e ficam contadas no relatório.
Janela maior que oito dias recebe título de retrospectiva; demais títulos indicam datas reais.
Nenhuma ausência de novidade cria edição vazia. O cron define a cadência semanal;
não há espera artificial de sete dias depois de uma edição manual fora da segunda-feira.

PRs precisam de título convencional feat/fix/perf/security e paths funcionais alterados.
Docs/testes/CI e manifests de dependências isolados não qualificam; correções de
segurança explicitadas no título com manifests alterados qualificam. Dependabot e
títulos genéricos não têm fallback permissivo. Labels news:include
ou news:exclude permitem decisão editorial explícita. Revisores devem confirmar
os títulos públicos antes de publicar; o gerador não inventa resultados.

## Deduplicação e revisão

IDs estáveis repo:release:ID e repo:pr:NUMBER ficam em comentários source-id.
Só draft:false conta como publicado. sourceSince/sourceUntil registram o corte.
O estado legado de tags é somente leitura (baseline das edições existentes).
Nenhuma geração marca publicação. Um rascunho no projeto bloqueia outro; uma PR
aberta na branch auto/rascunho-releases bloqueia substituição e preserva edições.
Após rejeitar/fechar uma PR, as mesmas fontes continuam elegíveis na próxima coleta.
Após merge de draft:true, revise esse rascunho existente para publicar; ele bloqueia
novas edições até decisão editorial. Sem novidades não há commit de status/deploy.

## Observabilidade

.sync/report.json (ignorado pelo Git) registra tentativa, projetos, janela,
fontes, erros e sucesso. Actions guarda o relatório como artifact por 90 dias.
A última tentativa corresponde ao run mais recente; a última coleta bem-sucedida
é o artifact do último run com status success. Falha parcial ou API/rate limit
termina exit 1 e não grava conteúdo nem avança corte; consultar logs e retry-after
ou reset da API. Run bloqueado por PR pendente aparece no summary e não afirma
coleta bem-sucedida. GitHub pode atrasar cron; ele não garante horário exato.

## Validação segura

`node --test tests/*.test.mjs` usa fixtures e não acessa inscritos.
`npm run build` valida Astro. Não há comandos lint/typecheck no projeto original.
`DRY_RUN=true node scripts/sync-releases.mjs` consulta apenas GitHub público;
não grava posts (grava relatório diagnóstico local). Exit 0: sem novo arquivo;
2: rascunhos; 1: falha acionável. Nunca testar send-newsletter contra inscritos.

## Correção editorial sem reenvio

O envio deduplica pela chave projeto/slug em .github/sent-broadcasts.json; editar
título/corpo não muda essa chave. Manter slugs, IDs e estado sent intactos. Estado
sent ausente ou inválido agora interrompe o script em vez de presumir lista vazia.
O teste de segurança usa o script real com fetch bloqueado e quatro slugs enviados:
correções dos posts30/09 produzem zero chamadas e nenhuma escrita de estado.
O workflow atual ainda é acionado por push de conteúdo na main, mas este conjunto
de correções resulta em no-op de envio; nenhum dispatch é necessário.

index.md e llms-full.txt passam a ser gerados dos posts publicados a cada build,
sem rascunhos, cidade antiga ou snapshots de features apresentados como estado
atual. llms.txt permanece experimental e aponta para fontes e páginas públicas.

## Diário da semana (todos os projetos)

`scripts/weekly-digest.mjs` roda no Mac (launchd `br.com.dehor.news-weekly`, segunda
09:00, log em `~/Library/Logs/news-weekly.log`), não no Actions, porque usa o `gh`
local para ler repositórios privados e o `claude -p` autenticado por OAuth (o script
remove `ANTHROPIC_API_KEY` do ambiente e roda em `--safe-mode`, sem ferramentas).
Os repositórios privados ficam fora do catálogo público, em `.digest-sources.json`
(gitignored). Coleta commits da branch padrão e PRs mergeadas dos últimos 7 dias;
semana sem atividade não gera post. Um segundo `claude -p` revisa privacidade e uma
varredura determinística procura chaves, JWT, IPs, e-mails, CPF, telefones e nomes
de repositórios privados. Aprovado: PR `auto/semana-WW` com merge. Reprovado: PR
aberta sem merge, com os problemas no corpo. `--dry-run` só imprime o markdown.
O projeto `semana` não tem audience no Resend: o envio de newsletter o ignora.
