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
