import { topologyView, topologyTabs } from './topology-view.js';
import { projectsView } from './projects-view.js';
import { consumersView } from './consumers-view.js';
import { icon, metric, action, panel, table, emptyState, badge, notice, field, escapeHTML as esc } from './components.js';

const intro = {
  projetos: ['Projetos', 'Organize seus estudos e acompanhe cada instalação industrial em um só lugar.'],
  consumidores: ['Consumidores e cargas', 'Cadastre motores, painéis e outros consumidores. Cada item terá seus dados elétricos, condições de instalação e origem identificados.'],
  dimensionamento: ['Dimensionamento de condutores', 'Consulte cabos, métodos de instalação e critérios por consumidor. A verificação da proteção elétrica terá um serviço independente.'],
  infraestrutura: ['Infraestrutura e ocupação', 'Organize os cabos por trecho e ramal para verificar a ocupação de eletrodutos, eletrocalhas e leitos.'],
  'queda-de-tensao': ['Análise de queda de tensão', 'Acompanhe o percurso elétrico e a contribuição de cada trecho até os pontos de consumo.'],
  'visao-geral': ['Visão geral do projeto', 'Revise a topologia, os resultados e as pendências ao final do fluxo de dimensionamento.'],
  relatorios: ['Relatórios', 'Reúna entradas, referências, resultados e verificações em um documento consolidado.'],
  configuracoes: ['Configurações e referências', 'Consulte a base prevista e os limites de funcionamento desta etapa.'],
};
const definitions = {
  dimensionamento: {
    metrics: [['Item selecionado', 'motor'], ['Corrente de projeto', 'bolt'], ['Cabo sugerido', 'cable'], ['Método de instalação', 'settings']],
    columns: ['Nº', 'Tipo', 'Tag / descrição', 'Potência', 'Fases', 'Corrente (A)', 'Cabo (mm²)', 'Método', 'Isolação', 'ΔV (%)', 'Status'],
    title: 'Consumidores e circuitos dimensionados', description: 'Nenhum cálculo de condutor foi executado. Serviço previsto para a Etapa 6.',
    side: ['Detalhes do dimensionamento', 'cable', 'Selecione um consumidor', 'Os detalhes serão apresentados após o cadastro e a implementação do cálculo.'],
  },
  infraestrutura: {
    metrics: [['Trechos analisados', 'nodes'], ['Maior ocupação', 'chart'], ['Infraestrutura sugerida', 'infrastructure'], ['Itens com ajuste', 'shield']],
    columns: ['Nº', 'Trecho / ramal', 'Cargas atendidas', 'Método', 'Qtd. de cabos', 'Seção dos cabos (mm²)', 'Infraestrutura', 'Dimensão', 'Ocupação', 'Status'],
    title: 'Infraestrutura por trecho e ramal', description: 'A ocupação dependerá da topologia e das dimensões externas dos cabos. Etapa 7.',
    side: ['Recomendação por trecho', 'infrastructure', 'Nenhuma recomendação calculada', 'As dimensões e os critérios aplicáveis serão informados por trecho, com identificação da fonte.'],
  },
  'queda-de-tensao': {
    metrics: [['Maior queda percentual', 'voltage'], ['Maior distância', 'nodes'], ['Itens verificados', 'shield']],
    columns: ['Nº', 'Tag / descrição', 'Trecho', 'Distância total (m)', 'Corrente (A)', 'Cabo (mm²)', 'Tensão (V)', 'Queda (V)', 'Queda (%)', 'Limite (%)', 'Resultado'],
    title: 'Análise por consumidor', description: 'A queda acumulada por percurso será calculada na Etapa 8.',
    side: ['Detalhes do percurso', 'voltage', 'Nenhum percurso analisado', 'A análise exibirá a contribuição dos trechos e a referência do limite adotado.'],
  },
};

function stageLine(stage) {
  return `<div class="stage-line">${badge('Próxima funcionalidade', 'blue')}<span>Funcionalidades desta página previstas para a <strong>Etapa ${stage}</strong>.</span>${badge('Não implementado')}</div>`;
}
function dataPage(route) {
  const def = definitions[route.id];
  const filters = `<div class="filters">${field('Tipo', { id: 'filter-type', options: ['Todos os tipos'], disabled: true })}${field('Ambiente', { id: 'filter-environment', options: ['Todos os ambientes'], disabled: true })}${field('Pesquisar', { id: 'filter-search', placeholder: 'Tag, descrição ou trecho…', disabled: true })}</div>`;
  const controls = badge('Não calculado');
  const content = panel(def.title, 'list', filters + table(def.columns, def.title, def.description), controls);
  const side = def.side ? `<aside class="detail-column">${panel(def.side[0], def.side[1], emptyState(def.side[2], def.side[3], def.side[1]))}
    ${panel('Critérios e referências', 'report', `<div class="panel-body">${notice('Verificações pendentes', route.id === 'dimensionamento'
      ? 'A seleção do condutor não comprova proteção, curto-circuito, coordenação ou partida. Esses critérios permanecerão identificados separadamente.'
      : 'Nenhum resultado ou atendimento normativo foi declarado. As referências e condições serão verificadas na etapa de cálculo.')}</div>`)}</aside>` : '';
  return `<div class="metric-grid count-${def.metrics.length}">${def.metrics.map(([label, symbol]) => metric(label, symbol, 'Não calculado')).join('')}</div>
    <div class="${def.side ? 'workspace-grid' : 'workspace-full'}">${content}${side}</div>`;
}
function overviewPage() {
  return `<div class="metric-grid">${[['Total de consumidores', 'report'], ['Potência instalada total', 'bolt'], ['Trechos do projeto', 'nodes'], ['Status geral', 'shield']].map(([label, symbol]) => metric(label, symbol, 'Pendente de dados')).join('')}</div>
  <div class="workspace-grid overview-grid">
    ${panel('Mapa resumido de trechos', 'nodes', `<div class="map-placeholder">${emptyState('A topologia aparecerá aqui', 'O mapa completo será implementado na Etapa 9, após o cadastro e a análise dos trechos.', 'nodes')}</div>`)}
    ${panel('Trechos do projeto', 'list', table(['Trecho', 'Comprimento (m)', 'Método', 'Cabos', 'Cargas atendidas', 'Infraestrutura', 'Status'], 'Trechos do projeto', 'Nenhuma topologia carregada.'))}
  </div>${notice('Projeto ainda não verificado', 'Nenhum cálculo industrial foi executado. Não há declaração de conformidade ou aprovação técnica nesta etapa.', 'amber')}`;
}
function reportPage() {
  return `${panel('Resumo consolidado', 'report', emptyState('Nenhum relatório disponível', 'O relatório reunirá os resultados efetivos, as fontes e todas as pendências. Exportações previstas para a Etapa 10.', 'report'), `<div class="actions">${['PDF', 'JSON', 'CSV'].map(format => action(format, 'export', { stage: 10 })).join('')}</div>`)}
  ${panel('Itens verificados e pendências', 'shield', table(['Critério', 'Resultado', 'Referência', 'Pendência'], 'Verificações do projeto', 'Nenhum critério industrial foi calculado.'))}`;
}
function settingsPage(contract) {
  return `<div class="settings-grid">${panel('Referência normativa prevista', 'shield', `<div class="panel-body"><span class="eyebrow">BASE INDUSTRIAL ISOLADA</span><h3>${esc(contract.rules.label)}</h3>${badge('Cobertura normativa parcial', 'amber')}
    <p>A edição identifica o escopo planejado. Correntes disponíveis na Etapa 4, incluindo o limite inferior de Ib de motor no escopo de 6.5.1.3.1. Tabelas de condutores e demais critérios continuam pendentes. A base geral não é declarada implementada.</p>
    <dl class="key-values"><div><dt>Identificação</dt><dd>${esc(contract.rules.id)}</dd></div><div><dt>Versão do registro</dt><dd>${esc(contract.rules.version)}</dd></div><div><dt>Base residencial de 1997</dt><dd>Não utilizada pelo módulo industrial</dd></div></dl></div>`)}
    ${panel('Dados e armazenamento', 'folder', `<div class="panel-body">${notice('Armazenamento local do navegador', 'Projetos industriais são gravados separadamente em localStorage, com controle de revisão e bloqueio entre abas.')}
    <p>O catálogo pertence a este navegador e endereço. Abrir ou fechar um projeto registra a seleção atual. Nenhuma chave residencial é lida ou alterada.</p><dl class="key-values"><div><dt>Contrato de dados</dt><dd>Versão ${contract.version}</dd></div><div><dt>Serviços de cálculo</dt><dd>Potências e correntes disponíveis; demais serviços pendentes</dd></div></dl></div>`)}</div>`;
}
export function pageView(route, contract, projectView = {}, consumerView = {}, topologyState) {
  const [title, description] = intro[route.id];
  const buttons = route.id === 'projetos' ? `<div class="actions">${action('Novo projeto', 'plus', { action: 'new-project', primary: true })}${action('Importar projeto', 'export', { stage: 10 })}</div>` : '';
  let content;
  if (route.id === 'projetos') content = projectsView(projectView);
  else if (route.id === 'consumidores') content = (topologyState ? topologyTabs(topologyState.tab) : '') + (topologyState?.tab === 'topology' ? topologyView(consumerView.project, topologyState) : consumersView(consumerView.project, consumerView.query));
  else if (definitions[route.id]) content = dataPage(route);
  else if (route.id === 'visao-geral') content = overviewPage();
  else if (route.id === 'relatorios') content = reportPage();
  else content = settingsPage(contract);
  return `<div class="breadcrumb"><a href="#/projetos">Início</a><span aria-hidden="true">›</span><span>${esc(route.title)}</span></div>
    <header class="page-heading"><span class="page-icon">${icon(route.icon)}</span><div><h1 id="page-title" tabindex="-1">${esc(title)}</h1><p>${esc(description)}</p></div>${buttons}</header>
    ${route.stage && !['projetos','consumidores'].includes(route.id) ? stageLine(route.stage) : ''}${content}`;
}
