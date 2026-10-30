export const REPORT_VERSION='industrial-report-1';
export const reportKey=p=>JSON.stringify({...p,results:[]});
export class ReportService {
  constructor(contract,transport=(...a)=>globalThis.fetch(...a)){this.contract=contract;this.transport=transport;}
  async generate(project,format='view') {
    const request={projectId:project.id,inputRevision:project.revision,domain:'reports',version:REPORT_VERSION};
    let response,body;
    try{response=await this.transport('/api/industrial/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request,project,format}),signal:AbortSignal.timeout(120000)});}
    catch{throw new Error('Não foi possível gerar o relatório. Confira o servidor Python; as entradas salvas foram preservadas.');}
    try{body=await response.json();}catch{throw new Error('Resposta de relatório inválida.');}
    if(!response.ok)throw new Error(body.error||'Não foi possível gerar o relatório.');
    const r=body.report;
    if(Object.keys(request).some(k=>body.request?.[k]!==request[k])||r?.projectId!==project.id||r.inputRevision!==project.revision||
      r.version!==REPORT_VERSION||r.status!=='partial'||!Array.isArray(r.sections)||!Array.isArray(r.diagram?.nodes)||
      !Array.isArray(r.diagram?.edges)||typeof r.inputDigest!=='string'||!/^[0-9a-f]{64}$/.test(r.inputDigest)||
      r.sections.some(s=>typeof s.title!=='string'||!Array.isArray(s.blocks)||s.blocks.some(b=>typeof b.title!=='string'||!Array.isArray(b.columns)||!Array.isArray(b.rows)||b.rows.some(row=>!Array.isArray(row)||row.length!==b.columns.length))))throw new Error('Relatório desatualizado ou incompatível.');
    if(r.versions?.contract!==this.contract.version||r.versions.engine!==this.contract.engineVersion||
      ['currentRules','topology','conductorRules','infrastructureRules','voltageRules','overview'].some(k=>r.versions[k]!==this.contract[k].version))throw new Error('Versões de cálculo incompatíveis. Atualize o servidor e a página.');
    if(format!=='view'&&(body.extension!==format||typeof body.content!=='string'||(format==='pdf'?body.mime!=='application/pdf':body.mime!=='text/csv;charset=utf-8')))throw new Error('Arquivo de relatório incompatível.');
    return body;
  }
}
