# Resumo semanal com revisão

O workflow sync-releases executa segunda-feira às 09:00 em America/Sao_Paulo
(12:00 UTC), e aceita execução manual. Somente prepara PR **draft**; não publica
nem envia emails. A newsletter existente continua acionada por push de conteúdo
na main. Merge de post com draft:false publica e pode enviar aos inscritos: essa
é uma decisão explícita posterior, fora da autorização para preparar rascunhos.

## Coleta e seleção

`scripts/news-projects.mjs` habilita apenas Fiscal e Jurídico. As opções Agro,
Transcreve e Verboo estão desabilitadas e não mudam assinaturas/audiências.
Repositórios devem retornar private:false antes de qualquer coleta. Não usamos
commits, repositórios privados, dados de clientes, nem serviços pagos.

Paginação completa de releases públicas (sem prereleases) e PRs fechadas/mergeadas.
Janela: (sourceUntil da última edição publicada, instante de coleta], usando
pubDate como baseline para edições antigas. A primeira retomada recupera todo o
intervalo desde junho; depois resume semanalmente. Datas no texto usam São Paulo.
Releases e PRs são seções distintas: merge não comprova disponibilidade em pacote.

Correções, funcionalidades, performance e segurança são selecionadas; dependabot,
chore/build/ci/docs/test/style/refactor rotineiros são omitidos. Labels news:include
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
