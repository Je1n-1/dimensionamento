import { createEntity } from './core/model.js';
import { TopologyService, TOPOLOGY_MODELS, readTopologyForm } from './core/topology.js';
import { topologyForm, pathForm, pathRow } from './topology-view.js';
import { escapeHTML as esc } from './components.js';

export function createTopologyController({root, contract, store, repository, projects, render}) {
  const service = new TopologyService();
  let tab='consumers', analysis=null, busy=false, error='', editing=null;
  const dialog=document.createElement('dialog'); dialog.id='topology-dialog'; dialog.setAttribute('aria-labelledby','topology-dialog-title'); root.append(dialog);
  function view() {
    const p=store.snapshot();
    if (analysis?.projectId!==p?.id || analysis?.inputRevision!==p?.revision) analysis=null;
    return {tab, analysis, busy, error};
  }
  async function execute(operation, captured=store.snapshot()) {
    if (!captured || projects.view.unavailable) throw new Error('Abra um projeto disponível antes de editar os caminhos.');
    const result=await service.execute(contract,captured,operation);
    const current=store.snapshot();
    if (current?.id!==captured.id || current?.revision!==captured.revision || current?.storageRevision!==captured.storageRevision) throw new Error('O projeto mudou durante a operação. Reabra e tente novamente.');
    if (operation) {
      const saved=await repository.save(result.project,captured.storageRevision);
      // Preserve another project selected while storage was acquiring its lock.
      if (store.snapshot()?.id!==captured.id || store.snapshot()?.storageRevision!==captured.storageRevision) {
        throw new Error('A estrutura foi salva, mas o projeto aberto mudou. Reabra o projeto editado para consultar.');
      }
      store.setDraft(saved);
    }
    analysis=result.analysis;
    if (operation) await projects.refresh();
  }
  function open(action,collection,id) {
    const p=store.snapshot();
    if (!p || projects.view.unavailable) throw new Error('Abra um projeto disponível.');
    const item=id?p[collection]?.find(i=>i.id===id):null;
    if (id && !item) throw new Error('Item não encontrado.');
    editing={project:p,action,collection,id};
    const body=action==='path'?pathForm(p):action==='delete'?`<h2 id="topology-dialog-title">Excluir item?</h2><p>Excluir <strong>${esc(item.tag||item.label||'infraestrutura')}</strong>? Registros com vínculos serão preservados até que você remova os vínculos.</p>`:topologyForm(contract,p,collection,item||createEntity(contract,TOPOLOGY_MODELS[collection]));
    dialog.innerHTML=`<form id="topology-form">${body}<p id="topology-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" data-topology-cancel>Cancelar</button><button type="submit" class="button ${action==='delete'?'danger':'primary'}">${action==='delete'?'Excluir':'Salvar estrutura'}</button></div></form>`;
    dialog.showModal();
  }
  root.addEventListener('click', async event=>{
    const toggle=event.target.closest('[data-topology-tab]');
    if(toggle && !busy) { tab=toggle.dataset.topologyTab; error=''; render(); if(tab!=='topology' || !store.snapshot())return; }
    const control=event.target.closest('[data-topology-action]');
    if ((!control&&!toggle) || busy) return;
    const action=control?.dataset.topologyAction||'analyze';
    try {
      error='';
      if (['edit','delete','path'].includes(action)) return open(action,control.dataset.collection,control.dataset.id);
      busy=true; render();
      await execute(action==='points'?{action:'points'}:undefined);
    } catch(e) { error=e.message; }
    finally {busy=false; render();}
  });
  dialog.addEventListener('click',event=>{
    if(busy)return;
    if(event.target.closest('[data-topology-cancel]'))dialog.close();
    if(event.target.closest('[data-path-add]')) {
      const rows=dialog.querySelector('#path-rows');
      if(rows.children.length<100)rows.insertAdjacentHTML('beforeend',pathRow(editing.project,rows.children.length+1));
    }
    if(event.target.closest('[data-path-remove]')&&dialog.querySelectorAll('.path-row').length>1)event.target.closest('.path-row').remove();
  });
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('submit',async event=>{
    event.preventDefault(); if(busy)return;
    busy=true; dialog.querySelector('#topology-error').textContent='';
    const submit=event.submitter; submit.disabled=true;
    try {
      const f=new FormData(event.target), e=editing;
      let operation;
      if(e.action==='path')operation={action:'path',origin:f.get('origin'),prefix:f.get('prefix'),basis:f.get('basis'),kind:f.get('kind'),rows:f.getAll('destination').map((nodeId,i)=>({nodeId,distance:Number(f.getAll('distance')[i])}))};
      else if(e.action==='delete')operation={action:'delete',collection:e.collection,id:e.id};
      else operation={action:'save',collection:e.collection,id:e.id||undefined,data:readTopologyForm(contract,e.collection,f),...(e.collection==='cables'?{roles:f.getAll('roles')}:{})};
      await execute(operation,e.project); dialog.close(); error='';
    }catch(e){dialog.querySelector('#topology-error').textContent=e.message;}
    finally{busy=false;submit.disabled=false;render();}
  });
  return {view};
}
