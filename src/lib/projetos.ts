import catalogo from '../data/projetos.json';

export type Projeto = {
  slug: string;
  nome: string;
  categoria: string;
  visibilidade: 'publico' | 'privado';
  repo?: string;
  site?: string;
  links?: { rotulo: string; url: string }[];
  descricao: string;
  stack: string[];
  status: 'ativo' | 'pausado' | 'concluído';
  destaque: boolean;
};

export const PROJETOS = catalogo as Projeto[];

export const CATEGORIAS: { id: string; nome: string }[] = [
  { id: 'open-source', nome: 'Open source' },
  { id: 'produtos', nome: 'Produtos' },
  { id: 'dados-publicos', nome: 'Dados públicos' },
  { id: 'for6', nome: 'For6 Solutions' },
  { id: 'clientes', nome: 'Clientes' },
  { id: 'academico', nome: 'Acadêmico / IF Goiano' },
];

/** Seção editorial sem item no catálogo: o diário de bordo semanal. */
export const SEMANA = {
  slug: 'semana',
  nome: 'Diário da semana',
  descricao: 'Resumo semanal do que andou em todos os projetos, públicos e privados. Projetos privados aparecem só em alto nível.',
};

export const porSlug = (slug: string) => PROJETOS.find((p) => p.slug === slug);

export const nomeDoProjeto = (slug: string) =>
  slug === SEMANA.slug ? SEMANA.nome : porSlug(slug)?.nome ?? slug;

/** Links públicos do projeto, na ordem de exibição. */
export function linksDoProjeto(p: Projeto) {
  return [
    ...(p.site ? [{ rotulo: 'Site', url: p.site }] : []),
    ...(p.repo ? [{ rotulo: 'GitHub', url: `https://github.com/${p.repo}` }] : []),
    ...(p.links ?? []),
  ];
}
