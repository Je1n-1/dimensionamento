import {ConductorService,serviceRequest} from './core/services.js';
import {conductorForm,readConductorForm} from './conductors-view.js';

export function createConductorController({root,contract,store,repository,projects,render}) {
  const service=new ConductorService();let analysis=null,selected=null,busy=false,error='',editing=null;
  const dialog=document.createElement('dialog');dialog.id='conductor-dialog';dialog.setAttribute('aria-labelledby','conductor-dialog-title');root.append(dialog);
  function view() {
    const p=store.snapshot();
    if(analysis?.projectId!==p?.id||analysis?.inputRevision!==p?.revision)analysis=null;
    return {analysis,selected,busy,error};
  }
  async function execute(captured,operation) {
    if(!captured||projects.view.unavailable)throw new Error('Abra um projeto disponível.');
    const answer=await service.calculate(serviceRequest(contract,captured,'conductors'),captured,operation);
    const visible=store.snapshot();
    if(visible?.id!==captured.id||visible.revision!==captured.revision||visible.storageRevision!==captured.storageRevision)throw new Error('O projeto mudou durante o cálculo. Tente novamente.');
    if(operation) {
      const saved=await repository.save(answer.project,captured.storageRevision);
      const now=store.snapshot();
      if(now?.id!==captured.id||now.revision!==captured.revision||now.storageRevision!==captured.storageRevision)throw new Error('Condições salvas. O projeto aberto mudou; reabra o projeto editado.');
      store.setDraft(saved);await projects.refresh();
    }
    analysis=answer.analysis;
  }
  root.addEventListener('click',async event=>{
    const control=event.target.closest('[data-conductor-action]');if(!control||busy)return;
    const {conductorAction:action,id,collection}=control.dataset;
    try {
      error='';const p=store.snapshot();
      if(action==='select'){selected=id;render();return;}
      if(action==='edit') {
        if(!p||projects.view.unavailable)throw new Error('Abra um projeto disponível.');
        const item=p[collection]?.find(i=>i.id===id);if(!item)throw new Error('Item não encontrado.');
        editing={project:p,collection,id};
        dialog.innerHTML=`<form id="conductor-form">${conductorForm(contract,p,collection,item)}<p class="form-error" id="conductor-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" data-conductor-cancel>Cancelar</button><button type="submit" class="button primary">Salvar condições</button></div></form>`;
        dialog.showModal();return;
      }
      busy=true;render();await execute(p);
    }catch(e){error=e.message;}finally{busy=false;render();}
  });
  dialog.addEventListener('click',e=>{if(!busy&&e.target.closest('[data-conductor-cancel]'))dialog.close();});
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;event.submitter.disabled=true;
    try {
      const operation={collection:editing.collection,id:editing.id,data:readConductorForm(contract,editing.collection,new FormData(event.target))};
      await execute(editing.project,operation);dialog.close();error='';
    }catch(e){dialog.querySelector('#conductor-error').textContent=e.message;}
    finally{busy=false;event.submitter.disabled=false;render();}
  });
  return {view};
}
