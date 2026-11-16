import {ReportService,reportKey} from './core/reports.js';
import {projectBackup,readProjectBackup,downloadFile,fileStem,MAX_PROJECT_BYTES} from './core/project-files.js';
import {escapeHTML as esc} from './components.js';

export function createReportController({root,contract,previousContract,store,repository,projects,render}) {
  const service=new ReportService(contract);
  let state={key:null,report:null,busy:false,error:'',message:'',attempted:false},ticket=0,imported=null,importBusy=false;
  let pdfDetail='summary';
  const dialog=document.createElement('dialog');dialog.id='import-project-dialog';dialog.setAttribute('aria-labelledby','import-project-title');root.append(dialog);
  function same(project){const current=store.snapshot();return current&&reportKey(current)===reportKey(project);}
  async function generate(project,format='view') {
    if(!same(project))return;
    const turn=++ticket;state.busy=true;state.error='';state.message='';state.attempted=true;render();
    try {
      const selectedDetail=pdfDetail;
      const body=await service.generate(project,format,selectedDetail);
      if(turn!==ticket||!same(project))return;
      state.report=body.report;
      if(format!=='view') {
        const data=format==='pdf'?Uint8Array.from(atob(body.content),c=>c.charCodeAt(0)):body.content;
        const suffix=format==='pdf'?(selectedDetail==='summary'?'-resumo':'-memoria-completa'):'';
        downloadFile(data,body.mime,`${fileStem(project)}-r${project.revision}${suffix}.${body.extension}`);
        state.message='Arquivo gerado. Confira os downloads do navegador. Pendências permanecem explícitas no relatório.';
      }
    }catch(error){if(turn===ticket&&same(project))state.error=error.message;}
    finally{if(turn===ticket){state.busy=false;render();}}
  }
  function view() {
    const p=store.snapshot(),key=p?reportKey(p):null;
    if(state.key!==key){ticket++;state={key,report:null,busy:false,error:'',message:'',attempted:false};}
    if(p&&location.hash==='#/relatorios'&&!state.attempted&&!projects.view.unavailable) {
      state.attempted=true;queueMicrotask(()=>generate(p));
    }
    return {...state,pdfDetail};
  }
  function openImport() {
    imported=null;
    dialog.innerHTML=`<form><h2 id="import-project-title">Importar projeto industrial</h2><p>Selecione um backup JSON do VoltCalc Industrial (até 4 MB). Será criada uma cópia independente. Os projetos existentes serão preservados e os resultados serão recalculados.</p><label class="field">Arquivo JSON<input name="projectFile" type="file" accept=".json,application/json" required></label><div id="import-preview" aria-live="polite"></div><p class="form-error" id="import-error" role="alert"></p><div class="dialog-actions"><button class="button" type="button" data-import-cancel>Cancelar</button><button class="button primary" type="submit" disabled>Criar cópia importada</button></div></form>`;
    dialog.showModal();
  }
  dialog.addEventListener('change',async e=>{
    if(e.target.name!=='projectFile'||importBusy)return;
    const file=e.target.files[0];imported=null;dialog.querySelector('[type=submit]').disabled=true;dialog.querySelector('#import-preview').textContent='';dialog.querySelector('#import-error').textContent='';
    if(!file)return;
    try {
      if(file.size>MAX_PROJECT_BYTES)throw new Error('O arquivo excede 4 MB.');
      const project=readProjectBackup(contract,previousContract,await file.text());
      if(e.target.files[0]!==file||!dialog.open)return;
      imported=project;
      dialog.querySelector('#import-preview').innerHTML=`<h3>${esc(project.name)}</h3><p>${project.consumers.length} consumidores · ${project.panels.length} quadros · ${project.segments.length} trechos. Posições do mapa e referências serão mantidas.</p>`;
      dialog.querySelector('[type=submit]').disabled=false;
    }catch(error){if(e.target.files[0]===file&&dialog.open)dialog.querySelector('#import-error').textContent=error.message;}
  });
  dialog.addEventListener('submit',async e=>{
    e.preventDefault();if(!imported||importBusy)return;
    importBusy=true;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=true);
    try {
      const saved=await repository.importProject(imported);
      store.setDraft(saved);dialog.close();await projects.refresh();location.hash='#/relatorios';render();
    }catch(error){dialog.querySelector('#import-error').textContent=error.message;}
    finally{importBusy=false;dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);}
  });
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-import-cancel]')&&!importBusy)dialog.close();});
  dialog.addEventListener('cancel',e=>{if(importBusy)e.preventDefault();});
  root.addEventListener('change',e=>{
    if(e.target.matches('[data-report-detail]')&&!state.busy&&['summary','full'].includes(e.target.value)){
      pdfDetail=e.target.value;render();
    }
  });
  root.addEventListener('click',e=>{
    const button=e.target.closest('[data-report-action],[data-action="export-report"],[data-action="import-project"]');if(!button)return;
    if(button.dataset.action==='import-project'){if(!projects.view.unavailable)openImport();return;}
    if(state.busy)return;
    const p=store.snapshot();if(!p){location.hash='#/relatorios';return;}
    const action=button.dataset.reportAction||(button.dataset.action==='export-report'?'pdf':'');
    if(button.dataset.action==='export-report')location.hash='#/relatorios';
    if(action==='json') {
      try{downloadFile(projectBackup(contract,p),'application/json',`${fileStem(p)}-backup.json`);state.message='Backup JSON gerado. Guarde o arquivo para recuperar este projeto em outro navegador ou endereço.';state.error='';}
      catch(error){state.error=error.message;}render();return;
    }
    generate(p,action==='refresh'?'view':action);
  });
  return {view};
}
