import {VoltageService,serviceRequest} from './core/services.js';
import {validateEntity} from './core/model.js';
import {voltageForm,readVoltageForm} from './voltage-view.js';

export function createVoltageController({root,contract,store,repository,projects,render}) {
  const service=new VoltageService();
  let analysis=null,selected=null,busy=false,error='',editing=null;
  const dialog=document.createElement('dialog');
  dialog.id='voltage-dialog';dialog.setAttribute('aria-labelledby','voltage-dialog-title');root.append(dialog);
  function view() {
    const p=store.snapshot();
    if(analysis?.projectId!==p?.id||analysis?.inputRevision!==p?.revision)analysis=null;
    return {analysis,selected,busy,error};
  }
  async function execute(captured,operation) {
    if(!captured||projects.view.unavailable)throw new Error('Abra um projeto disponível.');
    const answer=await service.calculate(serviceRequest(contract,captured,'voltage'),captured,operation);
    if(validateEntity(contract,'Project',answer.project).length)throw new Error('Resposta contém projeto inválido. Nenhum dado foi salvo.');
    const unchanged=()=>{const p=store.snapshot();return p?.id===captured.id&&p.revision===captured.revision&&p.storageRevision===captured.storageRevision;};
    if(!unchanged())throw new Error('O projeto mudou durante a análise; tente novamente.');
    if(operation) {
      const saved=await repository.save(answer.project,captured.storageRevision);
      if(!unchanged())throw new Error('Dados salvos no projeto de origem. Reabra-o para continuar.');
      store.setDraft(saved);await projects.refresh();
    }
    analysis=answer.analysis;
  }
  root.addEventListener('click',async e=>{
    const control=e.target.closest('[data-voltage-action]');if(!control||busy)return;
    const {voltageAction:action,id,collection}=control.dataset;
    try {
      error='';const p=store.snapshot();
      if(action==='select'){selected=id;render();return;}
      if(action==='edit') {
        if(!p||projects.view.unavailable)throw new Error('Abra um projeto disponível.');
        const item=collection==='project'?p:p[collection]?.find(i=>i.id===id);
        if(!item)throw new Error('Item não encontrado.');
        editing={project:p,collection,id:item.id,item};
        dialog.innerHTML=`<form>${voltageForm(contract,p,collection,item)}
          <p id="voltage-error" class="form-error" role="alert"></p>
          <div class="dialog-actions"><button type="button" class="button" data-voltage-cancel>Cancelar</button><button type="submit" class="button primary">Salvar e analisar</button></div></form>`;
        dialog.showModal();return;
      }
      busy=true;render();await execute(p);
    }catch(err){error=err.message;}finally{busy=false;render();}
  });
  dialog.addEventListener('click',e=>{if(!busy&&e.target.closest('[data-voltage-cancel]'))dialog.close();});
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;busy=true;const submit=e.submitter;submit.disabled=true;
    try {
      const data=readVoltageForm(contract,editing.collection,new FormData(e.target),editing.item);
      await execute(editing.project,{collection:editing.collection,id:editing.id,data});dialog.close();error='';
    }catch(err){dialog.querySelector('#voltage-error').textContent=err.message;}
    finally{busy=false;submit.disabled=false;render();}
  });
  return {view};
}
