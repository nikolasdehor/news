# news.dehor.com.br

Blog de novidades e hub dos projetos open source de Nikolas de Hor.

Publicado em [news.dehor.com.br](https://news.dehor.com.br) via Vercel. Desenvolvido com [Astro](https://astro.build).

## Rodando localmente

```sh
npm install
npm run dev
```

O servidor de desenvolvimento sobe em `http://localhost:4321`.

## Build de producao

```sh
npm run build
npm run preview
```

O fluxo de inscrição exige `RESEND_API_KEY`, `NEWSLETTER_CONFIRMATION_SECRET`
(mínimo de 32 caracteres), `NEWSLETTER_FROM_EMAIL` e `DATABASE_URL`. Fora da
Vercel, configure também `NEWSLETTER_PUBLIC_URL` com a origem pública local;
previews da Vercel usam `VERCEL_URL` automaticamente. Antes do deploy, aplique
`db/migrations/001_newsletter_confirmation_nonces.sql` no Postgres; ela cria
tanto os nonces quanto os locks de sincronização por contato e é idempotente.
O contato só é inscrito depois de abrir o link recebido por e-mail e confirmar no botão.

## Estrutura de pastas

```
/
├── public/             # Assets estaticos (imagens, favicon)
├── src/
│   ├── components/     # Componentes Astro reutilizaveis
│   ├── layouts/        # Layouts de pagina
│   └── pages/          # Paginas do site (rota = arquivo)
├── astro.config.mjs    # Configuracao do Astro
└── package.json
```

## Deploy

O auto-deploy esta ligado no Vercel: qualquer push na branch `main` dispara um novo deploy automaticamente para [news.dehor.com.br](https://news.dehor.com.br).
