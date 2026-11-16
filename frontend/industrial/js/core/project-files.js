import {validateEntity} from './model.js';
import {migrateProject} from './migrations.js';

export const MAX_PROJECT_BYTES=4000000;
const keys=['format','version','exportedAt','contractVersion','project'];
export function projectBackup(contract,project,now=new Date().toISOString()) {
  if(validateEntity(contract,'Project',project).length||!project.name.trim())throw new Error('Projeto inválido para exportação.');
  const copy=structuredClone(project);
  // The backup restores inputs; numeric results must be recomputed by the current engine.
  copy.results=[];
  const result=JSON.stringify({format:'voltcalc-industrial-project',version:1,exportedAt:now,contractVersion:contract.version,project:copy},null,2);
  if(new TextEncoder().encode(result).length>MAX_PROJECT_BYTES)throw new Error('O projeto excede o limite de intercâmbio de 4 MB.');
  return result;
}
export function readProjectBackup(contract,previousContract,text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_PROJECT_BYTES)throw new Error('Arquivo inválido ou maior que 4 MB.');
  let data;
  try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('O arquivo não contém JSON válido.');}
  if(!data||Array.isArray(data)||Object.keys(data).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(data,k))||
    data.format!=='voltcalc-industrial-project'||data.version!==1||data.contractVersion!==data.project?.schemaVersion||
    typeof data.exportedAt!=='string'||!Number.isFinite(Date.parse(data.exportedAt)))throw new Error('Formato de backup industrial não reconhecido.');
  const project=migrateProject(data.project,contract,previousContract);
  if(validateEntity(contract,'Project',project).length||!project.name.trim())throw new Error('O projeto contém campos ou vínculos inválidos.');
  project.results=[];
  return project;
}
export function downloadFile(content,mime,name) {
  const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export const fileStem=p=>(p.name||'projeto').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,80)||'projeto';
