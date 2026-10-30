import { createEntity } from './core/model.js';
import { upsertConsumer, upsertMotorBatch, removeConsumer, conductorLabel, copyConsumer, suggestedPowerBasis } from './core/consumers.js';
import { consumerForm, motorBatchRow } from './consumers-view.js';
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
  function open(id, remove = false, duplicate = false) {
    const project = store.snapshot();
    if (!project || projects.view.unavailable) return notify('Abra um projeto disponível antes de cadastrar consumidores.');
    const current = project.consumers.find(c => c.id === id);
    if (id && !current) return notify('O consumidor não está mais disponível. Reabra o projeto.');
    const copied = duplicate ? copyConsumer(contract,project,id) : null;
    const consumer = copied?.consumer || current || createEntity(contract,'Consumer');
    const motor = copied?.motor || project.motors.find(m => m.consumerId === id) || createEntity(contract,'Motor');
    editing = { project, consumer, motor, remove };
    dialog.innerHTML = remove ? `<form id="consumer-delete-form"><h2 id="consumer-dialog-title">Excluir consumidor?</h2><p>Excluir <strong>${esc(consumer.tag)}</strong> de ${esc(project.name)}?</p><p>Os dados específicos deste item serão removidos e os resultados do projeto serão invalidados. Itens com vínculos não serão excluídos.</p><p class="form-error" id="consumer-form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" data-consumer-cancel autofocus>Cancelar</button><button class="button danger" type="submit">Excluir consumidor</button></div></form>` : consumerForm(project,consumer,motor,Boolean(current));
    dialog.showModal();
    if (!remove) {
      if (duplicate) {
        dialog.querySelector('#consumer-dialog-title').textContent = 'Duplicar equipamento';
        dialog.querySelector('.dialog-note').textContent = 'Confira a tag, a distância e o trecho da cópia. O circuito e os resultados do original não serão copiados. A cópia só será criada ao salvar.';
      }
      dialog.querySelector(duplicate ? '[name="distance"]' : '[name="type"]').focus(); adapt();
    }
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
    form.elements.balanced.closest('.field').hidden = !['3F','3FN'].includes(form.elements.connection.value);
    form.elements.efficiency.closest('.field').hidden = form.elements.powerBasis.value !== 'mechanical';
    const allowed = {FN:['A','B','C'],FF:['AB','BC','CA'],'3F':['ABC'],'3FN':['ABC']}[form.elements.connection.value];
    for (const option of form.elements.phaseSet.options) option.disabled = Boolean(option.value && allowed && !allowed.includes(option.value));
    dialog.querySelector('#consumer-other-insulation').hidden = form.elements.insulation.value !== 'other';
    const connection = read('Consumer', editing.consumer, new FormData(form));
    dialog.querySelector('#consumer-connection-preview').textContent = conductorLabel(connection);
    dialog.querySelector('#consumer-type-hint').textContent = type === 'panel' ? 'Cada painel deve ter uma tag própria e quantidade 1. Depois de salvo, poderá ser escolhido como origem de outras cargas.' : editing.consumer.type && type !== editing.consumer.type ? 'Ao salvar a mudança de tipo, os dados específicos do tipo anterior serão removidos. Vínculos existentes podem impedir a alteração.' : 'Cada registro reúne equipamentos com os mesmos dados. Para valores diferentes, use registros separados.';
    adaptBatch();
  }
  function adaptBatch() {
    const form=dialog.querySelector('#consumer-form'); if(!form)return;
    const quantity=Number(form.elements.quantity.value), isMotor=form.elements.type.value==='motor';
    const multiple=isMotor&&quantity>1, valid=Number.isInteger(quantity)&&quantity<=150;
    const section=dialog.querySelector('#consumer-motor-batch'), rows=dialog.querySelector('#motor-batch-rows');
    section.hidden=!multiple; section.disabled=!multiple;
    for(const legend of form.querySelectorAll('[data-common-legend]'))legend.textContent=legend.dataset.commonLegend+(multiple?' · dados comuns':'');
    if(isMotor)form.elements.quantity.max='150'; else form.elements.quantity.removeAttribute('max');
    form.elements.tag.required=!multiple;
    form.elements.tag.closest('.field').querySelector('span').textContent=multiple?'Prefixo para novas tags (opcional)':'Identificador / tag *';
    form.querySelector('button[type="submit"]').lastChild.textContent=multiple?`Salvar ${quantity} motores`:'Salvar consumidor';
    if(multiple) {
      dialog.querySelector('#consumer-type-hint').textContent='Cadastro individual: cada cartão representa um motor. Os dados elétricos e de instalação abaixo dos cartões serão usados como base comum.';
      dialog.querySelector('#motor-batch-summary').textContent=valid?`${quantity} motores individuais serão salvos juntos. Nenhum registro é criado antes de salvar.`:'Informe uma quantidade inteira entre 2 e 150.';
      if(valid) {
        const used=new Set([...editing.project.consumers.filter(c=>c.id!==editing.consumer.id).map(c=>c.tag.toLocaleLowerCase()),...rows.querySelectorAll('[name$=".tag"]')].map(v=>typeof v==='string'?v:v.value.toLocaleLowerCase()));
        while(rows.children.length<quantity) {
          const index=rows.children.length, base=form.elements.tag.value.trim().slice(0,45)||'M';
          let tag=index===0&&editing.consumer.tag?editing.consumer.tag:`${base}${base==='M'?'':'-'}${index+1}`, suffix=2;
          while(used.has(tag.toLocaleLowerCase()))tag=`${base}-${index+1}-${suffix++}`;
          used.add(tag.toLocaleLowerCase());
          rows.insertAdjacentHTML('beforeend',motorBatchRow(editing.project,index,tag));
        }
      }
    }
    for(const [index,row] of [...rows.children].entries()) { row.hidden=!multiple||!valid||index>=quantity; row.disabled=row.hidden; }
    updateBatchHints();
  }
  function updateBatchHints() {
    const form=dialog.querySelector('#consumer-form');
    if(!form || dialog.querySelector('#consumer-motor-batch').hidden)return;
    for(const row of form.querySelectorAll('[data-motor-row]')) {
      if(row.hidden)continue;
      const prefix=`batch.${row.dataset.motorRow}.`;
      for(const control of row.querySelectorAll('[name]')) {
        const key=control.name.slice(prefix.length);
        if(key==='tag')continue;
        const common=form.elements.namedItem(key);
        if(!common)continue;
        const value=common.value.trim(), label=common.tagName==='SELECT'?common.selectedOptions[0]?.textContent:value;
        const description=value?`Comum: ${label}`:'Comum não informado';
        if(control.tagName==='SELECT')control.querySelector('option[value=""]').textContent=description;
        else control.placeholder=description;
      }
      const connection=row.querySelector('[name$=".connection"]').value||form.elements.connection.value;
      const phases=row.querySelector('[name$=".phaseSet"]');
      const effective=phases.value||form.elements.phaseSet.value;
      const allowed={FN:['A','B','C'],FF:['AB','BC','CA'],'3F':['ABC'],'3FN':['ABC']}[connection]||[];
      // Keep an existing incompatible selection in FormData until the user fixes it.
      for(const option of phases.options)option.disabled=Boolean(option.value&&connection&&!allowed.includes(option.value)&&option.value!==phases.value);
      const error=effective&&connection&&!allowed.includes(effective)?'As fases não correspondem à ligação deste motor. Escolha as fases individuais ou ajuste os dados comuns.':'';
      phases.setCustomValidity(error);
      let note=row.querySelector('[data-phase-error]');
      if(!note) {
        note=document.createElement('small'); note.dataset.phaseError=''; note.className='form-error';
        note.id=`motor-${row.dataset.motorRow}-phase-error`;
        phases.closest('.field').append(note); phases.setAttribute('aria-describedby',note.id);
      }
      note.textContent=error; note.hidden=!error;
    }
  }
  function batchOverrides(form,count) {
    if(!Number.isInteger(count)||count<2||count>150)throw Object.assign(new Error('Informe de 2 a 150 motores.'),{field:'quantity'});
    return Array.from({length:count},(_,index)=>{
      const row={consumer:{},motor:{}};
      for(const [kind,model,prefix] of [['consumer','Consumer',''],['motor','Motor','motor.']]) {
        for(const [key,spec] of Object.entries(contract.models[model])) {
          const raw=String(form.get(`batch.${index}.${prefix}${key}`)??'').trim();
          if(raw && ['string','number','boolean'].includes(spec.type))row[kind][key]=spec.type==='number'?Number(raw):spec.type==='boolean'?raw==='true':raw;
        }
      }
      return row;
    });
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
  dialog.addEventListener('change',event => {
    const form = dialog.querySelector('#consumer-form');
    const batch=event.target.closest('[data-motor-row]');
    if(batch && event.target.name.endsWith('.unit')) {
      const basis=batch.querySelector('[name$=".powerBasis"]');
      basis.value=suggestedPowerBasis(event.target.value,'motor')||'';
    }
    if(batch && event.target.name.endsWith('.connection')) {
      const phases=batch.querySelector('[name$=".phaseSet"]');
      phases.value=['3F','3FN'].includes(event.target.value)?'ABC':'';
    }
    if (form && event.target.name === 'unit') form.elements.powerBasis.value = suggestedPowerBasis(form.elements.unit.value,form.elements.type.value) || '';
    if (form && event.target.name === 'motor.currentPreference' && event.target.value === 'catalog') form.elements['motor.catalogId'].closest('details').open = true;
    if (form && event.target.name === 'connection') {
      const allowed = {FN:['A','B','C'],FF:['AB','BC','CA'],'3F':['ABC'],'3FN':['ABC']}[event.target.value] || [];
      if (!allowed.includes(form.elements.phaseSet.value)) form.elements.phaseSet.value = allowed.length === 1 ? allowed[0] : '';
    }
    invalidateNominalConfirmation(event); adapt();
  });
  dialog.addEventListener('cancel',event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('click',event => { if (event.target.closest('[data-consumer-cancel]') && !busy) dialog.close(); });
  dialog.addEventListener('input',event => { event.target.removeAttribute('aria-invalid'); invalidateNominalConfirmation(event); if(event.target.name==='quantity')adaptBatch(); else updateBatchHints(); });
  dialog.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    busy = true; dialog.classList.add('is-saving');
    dialog.querySelector('#consumer-form-error').textContent = '';
    const submit = event.submitter; if (submit) submit.disabled = true;
    try {
      if (store.snapshot()?.id !== editing.project.id) throw new Error('O projeto aberto mudou ou foi excluído. Cancele este formulário e reabra o projeto.');
      const data = new FormData(event.target);
      const consumer=read('Consumer',editing.consumer,data), motor=read('Motor',editing.motor,data,'motor.');
      const multiple=!editing.remove&&consumer.type==='motor'&&consumer.quantity>1;
      const next = editing.remove ? removeConsumer(contract,editing.project,editing.consumer.id) : multiple ? upsertMotorBatch(contract,editing.project,consumer,motor,batchOverrides(data,consumer.quantity)) : upsertConsumer(contract,editing.project,consumer,motor);
      // Persist the captured project revision first. Never publish an unsaved draft.
      const saved = await repository.save(next,editing.project.storageRevision);
      store.setDraft(saved); dialog.close(); await projects.refresh(); notify(editing.remove ? 'Consumidor excluído. Demais itens preservados.' : multiple ? `${consumer.quantity} motores salvos individualmente no projeto. Revise as condições de cada motor antes de dimensionar.` : 'Consumidor salvo no projeto. Cálculos pendentes.');
    } catch (error) {
      dialog.querySelector('#consumer-form-error').textContent = error.message;
      const field = error.field && (error.batchIndex!==undefined&&dialog.querySelector(`[name="batch.${error.batchIndex}.${error.field}"]`) || dialog.querySelector(`[name="${error.field}"]`));
      if (field) {
        field.closest('details')?.setAttribute('open','');
        field.setAttribute('aria-invalid','true'); field.focus();
      }
    } finally { busy = false; dialog.classList.remove('is-saving'); if (submit) submit.disabled = false; }
  });
  root.addEventListener('click',event => {
    const button = event.target.closest('[data-consumer-action]');
    if (!button || busy) return;
    open(button.dataset.consumerId,button.dataset.consumerAction === 'delete',button.dataset.consumerAction === 'copy');
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
