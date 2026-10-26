import { panel, badge, escapeHTML as esc } from './components.js';
import { currentResult } from './core/currents.js';

const format = value => Number.isFinite(value) ? new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(value) : 'Pendente';
const sourceLabel = {plate:'Placa informada',catalog:'Catálogo',formula:'Fórmula · estimativa'};
const labels = {
  mechanical_w:'Potência mecânica por equipamento', electrical_w:'Potência ativa elétrica por equipamento',
  apparent_va:'Potência aparente por equipamento', electrical_total_w:'Potência ativa do registro (quantidade incluída)',
  apparent_total_va:'Potência aparente do registro (quantidade incluída)', nominal_a:'Corrente nominal (In)',
  calculated_a:'Corrente calculada pela fórmula', selected_a:'Corrente da fonte selecionada',
  design_minimum_a:'Corrente de projeto — limite inferior (Ib mínimo)', starting_a:'Corrente de partida informada', measured_a:'Corrente medida informada',
};

export function currentsView(project, consumers = project.consumers) {
  if (!project.consumers.length) return '';
  const rows = consumers.map(c => {
    const result = currentResult(project,c.id);
    const selected = result?.measurements.find(m => m.code === 'selected_a')?.value;
    const design = result?.measurements.find(m => m.code === 'design_minimum_a')?.value;
    const apparent = result?.measurements.find(m => m.code === 'apparent_total_va')?.value;
    return `<article class="current-item">
      <div class="current-heading"><div><strong>${esc(c.tag)}</strong><span>${esc(c.description)}</span></div>
        ${badge(result?.status === 'calculated' ? 'Corrente obtida' : result ? 'Dados pendentes' : 'Não calculado', result?.status === 'calculated' ? 'blue' : 'amber')}</div>
      <div class="current-key-values"><div><small>Corrente por equipamento</small><strong>${format(selected)}${Number.isFinite(selected) ? ' A' : ''}</strong><span>${esc(sourceLabel[result?.currentSource] || 'Fonte ainda não disponível')}</span></div>
        <div><small>${c.type === 'motor' ? 'Ib mínimo do motor' : 'Potência aparente do registro'}</small><strong>${c.type === 'motor' ? format(design) + (Number.isFinite(design) ? ' A' : '') : format(apparent) + (Number.isFinite(apparent) ? ' VA' : '')}</strong><span>${c.type === 'motor' ? 'Condições específicas de 6.5.1.3.1' : esc(c.quantity) + ' equipamento(s) incluído(s)'}</span></div></div>
      ${result ? `<details class="current-detail"><summary>Ver grandezas, fórmulas e pendências</summary>
        <p class="current-pending">${esc(result.reason)}</p>
        <dl class="key-values">${result.measurements.filter(m => m.code !== 'selected_a').map(m => `<div><dt>${esc(labels[m.code] || m.code)}</dt><dd>${format(m.value)}${m.value === null ? '' : ' '+esc(m.unit)}</dd></div>`).join('')}</dl>
        <h4>Origem e memória de cálculo</h4><pre>${esc(result.trace)}</pre>
        <p>Cabo, proteção, partida e conformidade geral: <strong>não verificados</strong>.</p>
      </details>` : '<p class="field-hint">Calcule novamente após editar os dados. Resultados anteriores não são exibidos como atuais.</p>'}
    </article>`;
  }).join('');
  return `<section id="current-results" tabindex="-1" aria-label="Potências e correntes">${panel('Potências e correntes por consumidor','bolt',
    `<div class="panel-body"><p class="field-hint">Correntes por equipamento. Potências do registro incluem a quantidade. O cálculo não define cabos, disjuntores ou correntes de alimentadores.</p><div class="current-grid">${rows || '<p>Nenhum consumidor corresponde aos filtros.</p>'}</div></div>`)}</section>`;
}
