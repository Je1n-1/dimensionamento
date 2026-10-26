import { createEntity } from './core/model.js';
import { upsertConsumer, removeConsumer, conductorLabel } from './core/consumers.js';
import { consumerForm } from './consumers-view.js';
import { escapeHTML as esc } from './components.js';

export function createConsumerController({ root, contract, repository, store, projects, render }) {
  let projectId, query = {}, editing, busy = false;
  const dialog = document.createElement('dialog'); dialog.id = 'consumer-dialog'; dialog.setAttribute('aria-labelledby','consumer-dialog-title'); root.append(dialog);
  const status = document.createElement('div'); status.className = 'project-feedback'; status.setAttribute('role','status'); status.hidden = true; root.append(status);
  let timer;
  function notify(message) { clearTimeout(timer); status.textContent = message; status.hidden = false; timer = setTimeout(() => {status.hidden = true;},7000); }
  function view() {
    const project = store.snapshot();
    if (projectId !== project?.id) { projectId = project?.id; query = {}; }
    return { project, query };
  }
  function open(id, remove = false) {
    const project = store.snapshot();
    if (!project || projects.view.unavailable) return notify('Abra um projeto disponível antes de cadastrar consumidores.');
    const current = project.consumers.find(c => c.id === id);
    if (id && !current) return notify('O consumidor não está mais disponível. Reabra o projeto.');
    const consumer = current || createEntity(contract,'Consumer');
    const motor = project.motors.find(m => m.consumerId === id) || createEntity(contract,'Motor');
    editing = { project, consumer, motor, remove };
    dialog.innerHTML = remove ? `<form id="consumer-delete-form"><h2 id="consumer-dialog-title">Excluir consumidor?</h2><p>Excluir <strong>${esc(consumer.tag)}</strong> de ${esc(project.name)}?</p><p>Os dados específicos deste item serão removidos e os resultados do projeto serão invalidados. Itens com vínculos não serão excluídos.</p><p class="form-error" id="consumer-form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" data-consumer-cancel autofocus>Cancelar</button><button class="button danger" type="submit">Excluir consumidor</button></div></form>` : consumerForm(project,consumer,motor,Boolean(current));
    dialog.showModal();
    if (!remove) { dialog.querySelector('[name="type"]').focus(); adapt(); }
  }
  function read(model, original, form, prefix = '') {
    const next = structuredClone(original);
    for (const [key,spec] of Object.entries(contract.models[model])) {
      const name = prefix + key;
      if (spec.type === 'object') next[key] = read(spec.model, next[key], form, name+'.');
      else if (form.has(name)) {
        const raw = String(form.get(name)).trim();
        next[key] = raw === '' && spec.nullable ? null : spec.type === 'number' ? (raw === '' ? null : Number(raw)) : spec.type === 'boolean' ? raw === 'true' : raw === '' && spec.nullable ? null : raw;
      }
    }
    return next;
  }
  function adapt() {
    const form = dialog.querySelector('#consumer-form'); if (!form) return;
    const type = form.elements.type.value, motor = dialog.querySelector('#consumer-motor-fields');
    motor.hidden = type !== 'motor'; motor.disabled = type !== 'motor';
    dialog.querySelector('#consumer-other-insulation').hidden = form.elements.insulation.value !== 'other';
    const connection = read('Consumer', editing.consumer, new FormData(form));
    dialog.querySelector('#consumer-connection-preview').textContent = conductorLabel(connection);
    dialog.querySelector('#consumer-type-hint').textContent = type === 'panel' ? 'Cada painel deve ter uma tag própria e quantidade 1. Depois de salvo, poderá ser escolhido como origem de outras cargas.' : editing.consumer.type && type !== editing.consumer.type ? 'Ao salvar a mudança de tipo, os dados específicos do tipo anterior serão removidos. Vínculos existentes podem impedir a alteração.' : 'Cada registro reúne equipamentos com os mesmos dados. Para valores diferentes, use registros separados.';
  }
  function invalidateNominalConfirmation(event) {
    const nominalInputs = ['power','unit','powerBasis','voltage','frequency','connection',
      'motor.poles','motor.plateCurrent','motor.catalogCurrent','motor.catalogId','motor.currentPreference',
      'motor.source.manufacturer','motor.source.model','motor.source.edition','motor.source.reference'];
    if (nominalInputs.includes(event.target.name)) {
      const confirmation = dialog.querySelector('[name="motor.nominalConditionsConfirmed"]');
      if (confirmation) confirmation.value = '';
    }
  }
  dialog.addEventListener('change',event => { invalidateNominalConfirmation(event); adapt(); });
  dialog.addEventListener('cancel',event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('click',event => { if (event.target.closest('[data-consumer-cancel]') && !busy) dialog.close(); });
  dialog.addEventListener('input',event => { event.target.removeAttribute('aria-invalid'); invalidateNominalConfirmation(event); });
  dialog.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    busy = true; dialog.classList.add('is-saving');
    dialog.querySelector('#consumer-form-error').textContent = '';
    const submit = event.submitter; if (submit) submit.disabled = true;
    try {
      if (store.snapshot()?.id !== editing.project.id) throw new Error('O projeto aberto mudou ou foi excluído. Cancele este formulário e reabra o projeto.');
      const data = new FormData(event.target);
      const next = editing.remove ? removeConsumer(contract,editing.project,editing.consumer.id) : upsertConsumer(contract,editing.project,read('Consumer',editing.consumer,data),read('Motor',editing.motor,data,'motor.'));
      // Persist the captured project revision first. Never publish an unsaved draft.
      const saved = await repository.save(next,editing.project.storageRevision);
      store.setDraft(saved); dialog.close(); await projects.refresh(); notify(editing.remove ? 'Consumidor excluído. Demais itens preservados.' : 'Consumidor salvo no projeto. Cálculos pendentes.');
    } catch (error) {
      dialog.querySelector('#consumer-form-error').textContent = error.message;
      const field = error.field && dialog.querySelector(`[name="${error.field}"]`);
      if (field) { field.setAttribute('aria-invalid','true'); field.focus(); }
    } finally { busy = false; dialog.classList.remove('is-saving'); if (submit) submit.disabled = false; }
  });
  root.addEventListener('click',event => {
    const button = event.target.closest('[data-consumer-action]');
    if (!button || busy) return;
    open(button.dataset.consumerId,button.dataset.consumerAction === 'delete');
  });
  root.addEventListener('input',event => {
    if (event.target.id === 'consumer-search') { query.search = event.target.value; render(false,{consumerFilterOnly:true}); }
  });
  root.addEventListener('change',event => {
    const key = { 'consumer-filter-type':'type','consumer-filter-environment':'environment','consumer-filter-segment':'segment' }[event.target.id];
    if (key) { query[key] = event.target.value; render(false,{consumerFilterOnly:true}); }
  });
  return { view };
}
