import {OverviewService,diagramPositions,diagramBounds} from './core/overview.js';
import {overviewForm,mapScene} from './overview-view.js';

export function createOverviewController({root,contract,store,repository,projects,render}) {
  const service=new OverviewService();
  let state={analysis:null,selected:null,camera:null,positions:{},moving:false,busy:false,error:'',message:''},projectId=null,editing=null,drag=null,ignoreClick=false;
  const dialog=document.createElement('dialog');dialog.id='overview-dialog';dialog.setAttribute('aria-labelledby','overview-dialog-title');root.append(dialog);
  function view() {
    const p=store.snapshot();
    if(projectId!==p?.id){projectId=p?.id;state={...state,selected:null,camera:null,positions:{},analysis:null,error:'',message:''};}
    if(state.analysis?.inputRevision!==p?.revision)state.analysis=null;
    return state;
  }
  async function execute(captured,operation) {
    if(!captured||projects.view.unavailable)throw new Error('Abra um projeto disponível.');
    const same=()=>{const p=store.snapshot();return p?.id===captured.id&&p.revision===captured.revision&&p.storageRevision===captured.storageRevision;};
    if(!same())throw new Error('O projeto mudou. Reabra o formulário.');
    const response=await service.execute(contract,captured,operation);
    if(!same())throw new Error('O projeto mudou durante a operação; tente novamente.');
    if(operation) {
      const saved=await repository.save(response.project,captured.storageRevision);
      if(!same())throw new Error('Alteração salva no projeto de origem. Reabra-o para continuar.');
      store.setDraft(saved);await projects.refresh();
      if(operation.action==='segment')state.analysis=null;
      state.message=operation.action==='positions'?'Posição gráfica salva. Distâncias físicas preservadas.':'Conexão e distância salvas. Revise as condições afetadas e atualize as análises.';
    }else{state.analysis=response.analysis;state.message='Análises atualizadas para a revisão atual.';}
  }
  async function perform(captured,operation) {
    state.busy=true;state.error='';render();
    try{await execute(captured,operation);}catch(e){state.error=e.message;}
    finally{state.positions={};state.busy=false;render();}
  }
  const bounds=()=>state.camera||diagramBounds(diagramPositions(store.snapshot(),state.positions));
  function select(kind,id){state.selected={kind,id};render();}
  root.addEventListener('click',async event=>{
    const map=event.target.closest('[data-map-id]'),button=event.target.closest('[data-overview-action]');
    if(state.busy||(!map&&!button))return;
    if(map){if(Date.now()<ignoreClick)return;select(map.dataset.mapKind,map.dataset.mapId);return;}
    const {overviewAction:action,id,kind}=button.dataset,p=store.snapshot();if(!p)return;
    state.error='';state.message='';
    if(action==='select'){select(kind,id);return;}
    if(action==='fit'){state.camera=null;render();return;}
    if(action==='zoom-in'||action==='zoom-out'){
      const box=bounds(),scale=action==='zoom-in'?.8:1.25,width=Math.min(10000000,Math.max(160,box.width*scale)),ratio=width/box.width;
      state.camera={x:box.x+(box.width-width)/2,y:box.y+box.height*(1-ratio)/2,width,height:box.height*ratio};render();return;
    }
    if(action==='move'){state.moving=!state.moving;render();return;}
    if(action==='arrange'){
      if(p.nodes.length)await perform(p,{action:'positions',positions:p.nodes.map(n=>({id:n.id,position:null}))});
      state.camera=null;render();return;
    }
    if(action==='segment'||action==='position'){
      editing={project:p,kind:action,id};
      dialog.innerHTML=`<form>${overviewForm(p,action,id)}<p class="form-error" role="alert" id="overview-error"></p><div class="dialog-actions"><button type="button" class="button" data-overview-cancel>Cancelar</button><button type="submit" class="button primary">Salvar alteração</button></div></form>`;
      dialog.showModal();return;
    }
    if(action==='save'){
      state.busy=true;render();
      try {
        const saved=await repository.save(p,p.storageRevision);
        const now=store.snapshot();
        if(now?.id===p.id&&now.revision===p.revision&&now.storageRevision===p.storageRevision){store.setDraft(saved);await projects.refresh();state.message='Projeto salvo neste navegador.';}
        else throw new Error('Projeto de origem salvo. Reabra-o para continuar.');
      }catch(e){state.error=e.message;}finally{state.busy=false;render();}
      return;
    }
    if(action==='calculate')await perform(p);
  });
  dialog.addEventListener('click',e=>{if(!state.busy&&e.target.closest('[data-overview-cancel]'))dialog.close();});
  dialog.addEventListener('cancel',e=>{if(state.busy)e.preventDefault();});
  dialog.addEventListener('submit',async e=>{
    e.preventDefault();if(state.busy)return;state.busy=true;e.submitter.disabled=true;
    try {
      const f=new FormData(e.target),{project,kind,id}=editing;
      const operation=kind==='position'?{action:'positions',positions:[{id,position:{x:Number(f.get('x')),y:Number(f.get('y'))}}]}:
        {action:'segment',id,data:{fromNodeId:f.get('fromNodeId'),toNodeId:f.get('toNodeId'),length:Number(f.get('length')),notes:String(f.get('notes')||'').trim()}};
      await execute(project,operation);dialog.close();state.error='';
    }catch(error){dialog.querySelector('#overview-error').textContent=error.message;}
    finally{state.busy=false;e.submitter.disabled=false;render();}
  });
  function point(svg,event){const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  root.addEventListener('pointerdown',e=>{
    const svg=e.target.closest('#overview-map');if(!svg||state.busy||e.button!==0||drag)return;
    const node=e.target.closest('[data-map-kind="node"]'),element=e.target.closest('[data-map-id]');
    if(element&&!(node&&state.moving))return;
    const p=store.snapshot(),start=point(svg,e);
    drag={svg,p,id:node?.dataset.mapId,kind:node?'node':'pan',start,clientX:e.clientX,clientY:e.clientY,camera:{...bounds()},position:node?diagramPositions(p)[node.dataset.mapId]:null,moved:false,pointerId:e.pointerId};
    svg.setPointerCapture(e.pointerId);e.preventDefault();
  });
  root.addEventListener('pointermove',e=>{
    if(!drag||drag.pointerId!==e.pointerId)return;
    const d=drag,scale=d.svg.getScreenCTM();
    // Use scale only: panning changes translation, not the delta's coordinate system.
    const dx=(e.clientX-d.clientX)/scale.a,dy=(e.clientY-d.clientY)/scale.d;
    if(Math.abs(e.clientX-d.clientX)+Math.abs(e.clientY-d.clientY)>4)d.moved=true;
    if(d.kind==='pan') {
      state.camera={...d.camera,x:d.camera.x-dx,y:d.camera.y-dy};
      d.svg.setAttribute('viewBox',`${state.camera.x} ${state.camera.y} ${state.camera.width} ${state.camera.height}`);
    }else {
      state.positions[d.id]={x:Math.max(-1e7,Math.min(1e7,d.position.x+dx)),y:Math.max(-1e7,Math.min(1e7,d.position.y+dy))};
      d.svg.innerHTML=mapScene(d.p,state);
    }
  });
  root.addEventListener('pointerup',async e=>{
    if(!drag||drag.pointerId!==e.pointerId)return;const d=drag;drag=null;d.svg.releasePointerCapture(e.pointerId);
    ignoreClick=d.moved?Date.now()+250:0;
    if(d.kind==='node'&&d.moved){state.selected={kind:'node',id:d.id};await perform(d.p,{action:'positions',positions:[{id:d.id,position:state.positions[d.id]}]});}
    else{state.positions={};if(!d.moved&&d.id)select('node',d.id);}
  });
  root.addEventListener('pointercancel',()=>{if(!drag)return;state.camera=drag.camera;drag=null;state.positions={};render();});
  root.addEventListener('keydown',e=>{
    const svg=e.target.closest('#overview-map');if(!svg||state.busy)return;
    const element=e.target.closest('[data-map-id]');
    if(element&&(e.key==='Enter'||e.key===' ')){e.preventDefault();select(element.dataset.mapKind,element.dataset.mapId);return;}
    const delta={ArrowLeft:[-60,0],ArrowRight:[60,0],ArrowUp:[0,-60],ArrowDown:[0,60]}[e.key];
    if(delta){e.preventDefault();const b=bounds();state.camera={...b,x:b.x+delta[0],y:b.y+delta[1]};svg.setAttribute('viewBox',`${state.camera.x} ${state.camera.y} ${b.width} ${b.height}`);}
  });
  return {view};
}
