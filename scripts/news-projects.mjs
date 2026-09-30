export const PROJECTS = [
  {
    /** Identificador do repositorio no GitHub (owner/repo) */
    enabled: true,
    repo: 'DeHor-Labs/mcp-fiscal-brasil',
    /** Slug usado no diretorio de posts e no campo `project` do frontmatter */
    slug: 'mcp-fiscal-brasil',
    /** Nome de exibicao com capitalizacao correta (siglas, acentos etc.) */
    displayName: 'MCP Fiscal Brasil',
    /** Imagem OG padrao do projeto (relativa a /public) */
    ogImage: '/og/mcp-fiscal-brasil.png',
    /** Tags base que todo post deste projeto recebe */
    baseTags: ['mcp', 'python', 'fiscal', 'brasil', 'open-source'],
    /** Links de referencia do projeto */
    links: {
      repo: 'https://github.com/DeHor-Labs/mcp-fiscal-brasil',
      docs: 'https://dehor-labs.github.io/mcp-fiscal-brasil/',
      pypi: 'https://pypi.org/project/mcp-fiscal-brasil/',
    },
  },
  {
    enabled: true,
    repo: 'DeHor-Labs/mcp-juridico-brasil',
    slug: 'mcp-juridico-brasil',
    displayName: 'MCP Jurídico Brasil',
    ogImage: '/og/mcp-juridico-brasil.png',
    baseTags: ['mcp', 'python', 'juridico', 'brasil', 'open-source'],
    links: {
      repo: 'https://github.com/DeHor-Labs/mcp-juridico-brasil',
      docs: 'https://dehor-labs.github.io/mcp-juridico-brasil/',
      pypi: 'https://pypi.org/project/mcp-juridico-brasil/',
    },
  },
];
export const OPTIONAL_PROJECTS = ["DeHor-Labs/mcp-agro-brasil", "DeHor-Labs/transcreve-ai", "nikolasdehor/verboo-bridge"]; // Disabled; require public verification and editorial opt-in.
