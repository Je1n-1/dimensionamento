import {InfrastructureService,serviceRequest} from './core/services.js';
import {createEntity,validateEntity} from './core/model.js';
import {infrastructureForm,readInfrastructureForm} from './infrastructure-view.js';

export function createInfrastructureController({root,contract,store,repository,projects,render}) {
  const service=new InfrastructureService();let analysis=null,selected=null,busy=false,error='',editing=null;
  const dialog=document.createElement('dialog');dialog.id='infra-dialog';dialog.setAttribute('aria-labelledby','infra-dialog-title');root.append(dialog);
  function view() {
    const p=store.snapshot();
    if(analysis?.projectId!==p?.id||analysis?.inputRevision!==p?.revision)analysis=null;
    return {analysis,selected,busy,error};
  }
  async function execute(captured,operation) {
    if(!captured||projects.view.unavailable)throw new Error('Abra um projeto disponível.');
    const answer=await service.calculate(serviceRequest(contract,captured,'infrastructure'),captured,operation);
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
  function adapt() {
    const type=dialog.querySelector('[name="type"]')?.value;
    dialog.querySelectorAll('[data-infra-fields]').forEach(s=>s.hidden=s.dataset.infraFields==='conduit'?type!=='conduit':!['tray','solid_tray','perforated_tray','ladder'].includes(type));
  }
  root.addEventListener('click',async e=>{
    const control=e.target.closest('[data-infra-action]');if(!control||busy)return;
    const {infraAction:action,id,collection}=control.dataset;
    try {
      error='';const p=store.snapshot();
      if(action==='select'){selected=id;render();return;}
      if(action==='edit') {
        if(!p||projects.view.unavailable)throw new Error('Abra um projeto disponível.');
        let item=p[collection]?.find(i=>i.id===id),itemId=id;
        if(!item&&collection==='infrastructures'&&p.segments.some(s=>s.id===id)) {
          item=createEntity(contract,'Infrastructure',{segmentId:id});itemId=null;
        }
        if(!item)throw new Error('Item não encontrado.');
        editing={project:p,collection,id:itemId,item};
        dialog.innerHTML=`<form id="infra-form">${infrastructureForm(contract,p,collection,item)}<p id="infra-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" data-infra-cancel>Cancelar</button><button type="submit" class="button primary">Salvar dados físicos</button></div></form>`;
        adapt();dialog.showModal();return;
      }
      busy=true;render();await execute(p);
    }catch(err){error=err.message;}finally{busy=false;render();}
  });
  dialog.addEventListener('change',adapt);
  dialog.addEventListener('click',e=>{if(!busy&&e.target.closest('[data-infra-cancel]'))dialog.close();});
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;busy=true;const submit=e.submitter;submit.disabled=true;
    try {
      const data=readInfrastructureForm(contract,editing.collection,new FormData(e.target),editing.item);
      await execute(editing.project,{collection:editing.collection,id:editing.id,data});dialog.close();error='';
    }catch(err){dialog.querySelector('#infra-error').textContent=err.message;}
    finally{busy=false;submit.disabled=false;render();}
  });
  return {view};
}
