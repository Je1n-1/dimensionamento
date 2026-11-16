import {consumerWorkflow} from './core/workflow.js';
import {escapeHTML as esc} from './components.js';

const edit = (label, collection, id) => `<button type="button" class="button" data-topology-action="edit" data-collection="${collection}" data-id="${esc(id)}">${esc(label)}</button>`;

export function consumerLinks(project, consumer) {
  const w = consumerWorkflow(project, consumer);
  return `<details class="consumer-missing workflow-links">
    <summary>${w.linked ? 'Ver vínculos e próximos passos' : 'Como preparar esta carga'}</summary>
    <p><strong>${esc(consumer.tag)}</strong> · ${w.linked ? 'Vínculos cadastrados; validação e cálculos separados.' : 'Cadastro salvo; estrutura ainda não vinculada.'}</p>
    ${w.panels.length ? `<p>Quadro(s) de origem dos circuitos: ${w.panels.map(p => esc(p.tag)).join(', ')}.</p>` : ''}
    ${w.issues.length ? `<ul>${w.issues.map(i => `<li>${esc(i.message)}</li>`).join('')}</ul>` : '<p>Comprimento, método e temperatura são consultados nos trechos; material e isolação, nos condutores. Não é necessário repeti-los no planejamento da carga.</p>'}
    <div class="actions">
      ${w.circuits.map(c => edit(`Circuito ${c.tag}`, 'circuits', c.id)).join('')}
      ${w.segments.map(s => edit(`Trecho ${s.tag}`, 'segments', s.id)).join('')}
      ${w.segments.map(s => `<button type="button" class="button" data-conductor-action="edit" data-collection="segments" data-id="${esc(s.id)}">Condições térmicas ${esc(s.tag)}</button>`).join('')}
      ${w.cables.map(f => `<button type="button" class="button" data-conductor-action="edit" data-collection="cables" data-id="${esc(f.id)}">Condições ${esc(f.tag)}</button>`).join('')}
      ${!w.linked && consumer.type !== 'panel' ? `<button type="button" class="button" data-topology-action="prepare" data-consumer-id="${esc(consumer.id)}">Preparar circuito independente</button>` : ''}
      <button type="button" class="button" data-topology-tab="topology">Caminhos compartilhados / verificar estrutura</button>
    </div>
    <p>Os atalhos editam os registros usados no cálculo. Planejamento não é sincronizado automaticamente. Confirmações térmicas, corrente, proteção e demais critérios continuam sujeitos à análise.</p>
  </details>`;
}
