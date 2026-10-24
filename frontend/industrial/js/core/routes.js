export const ROUTES = Object.freeze([
  { id: 'projetos', title: 'Projetos', subtitle: 'Organização dos projetos', icon: 'folder', stage: 2 },
  { id: 'consumidores', title: 'Consumidores e cargas', subtitle: 'Cadastro de itens do projeto', icon: 'bolt', stage: 3 },
  { id: 'dimensionamento', title: 'Dimensionamento', subtitle: 'Cabos, métodos e critérios', icon: 'cable', stage: 6 },
  { id: 'infraestrutura', title: 'Infraestrutura', subtitle: 'Eletrodutos, eletrocalhas e leitos', icon: 'infrastructure', stage: 7 },
  { id: 'queda-de-tensao', title: 'Queda de tensão', subtitle: 'Análise e verificações', icon: 'voltage', stage: 8 },
  { id: 'visao-geral', title: 'Visão geral', subtitle: 'Resumo do projeto', icon: 'chart', stage: 9 },
  { id: 'relatorios', title: 'Relatórios', subtitle: 'Resultados e exportação', icon: 'report', stage: 10, auxiliary: true },
  { id: 'configuracoes', title: 'Configurações', subtitle: 'Referências e disponibilidade', icon: 'settings', auxiliary: true },
]);
export function resolveRoute(hash) {
  return ROUTES.find(route => route.id === hash.replace(/^#\/?/, '')) || ROUTES[0];
}
