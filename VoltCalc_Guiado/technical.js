/* Grid data operations. Electrical values are supplied by Python. */
(()=>{
'use strict';
const M=window.VoltModel;
const col=(key,label,options,load=false)=>({key,label,options,load});
const columns={
 loads:[col('number','ID'),col('description','Circuito'),col('connection','Ligação',[['fn','F–N'],['ff','F–F'],['tri','3F equilibrado']]),col('phaseSet','Fases',['A','B','C','AB','BC','CA','ABC']),col('quantity','Qtd.',null,true),col('power','Potência unit.',null,true),col('unit','Unidade',['W','kW','VA','kVA','CV','HP'],true),col('powerFactor','FP',null,true),col('distance','Distância (m)',null,true)],
 installation:[col('number','ID'),col('description','Circuito'),col('type','Uso',[['lighting','Iluminação'],['sockets','Tomadas'],['motor','Motor'],['shower','Chuveiro'],['transformer','Transformador'],['other','Outros']]),col('installation','Instalação',[['embedded','Embutido'],['conduit','Aparente'],['surface','Sobre a parede'],['buried','Enterrado'],['tray','Bandeja'],['overhead','Ao ar livre']]),col('cableForm','Cabo',[['single','Unipolares'],['multi','Multipolar']]),col('wall','Parede',[['masonry','Alvenaria'],['thermal','Isolante térmica']]),col('metal','Metal',['Cu','Al']),col('insulation','Isolação',['PVC','EPR','XLPE'])],
 conditions:[col('number','ID'),col('description','Circuito'),col('temperature','Temp. (°C)'),col('groupCount','Agrupados'),col('groupLayout','Disposição',[['bundle','Em feixe'],['spaced','Espaçados'],['unknown','A confirmar']]),col('maxDrop','Queda máx. (%)'),col('breakerMode','Disjuntor',[['auto','Sugerir'],['verify','Verificar']]),col('breakerCurrent','In informado (A)'),col('i2Factor','I₂/In')]
};
const textKeys=new Set(['number','description']);
function options(c){return (c.options||[]).map(v=>Array.isArray(v)?v:[v,v]);}
function set(c,column,value,strict=true){
 if(column.load&&c.loads.length!==1)throw Error('Circuito com vários grupos: edite os equipamentos em Detalhes. Nenhum grupo foi substituído.');
 let v=String(value).trim();
 if(column.options){const found=options(column).find(([key,label])=>key.toLowerCase()===v.toLowerCase()||label.toLowerCase()===v.toLowerCase());if(!found&&v!=='')throw Error(`${column.label}: opção desconhecida “${v}”.`);v=found?found[0]:'';}
 else if(!textKeys.has(column.key)&&v!==''){if(strict&&!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(v))throw Error(`${column.label}: use um número sem separador de milhar.`);v=v.replace(',','.');if(strict&&!Number.isFinite(+v))throw Error('Número fora da faixa.');}
 if(textKeys.has(column.key)&&v.length>70)throw Error('Texto maior que 70 caracteres.');
 (column.load?c.loads[0]:c)[column.key]=v;
 if(column.key==='connection'){c.phaseSet=v==='tri'?'ABC':v==='ff'?'AB':'A';c.legacyLoaded=null;}
 if(column.key==='installation'){c.methodOverride='';c.unknownInstallation=false;}
}
function paste(circuits,view,row,column,text){
 const rows=text.replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(s=>s.split('\t'));
 if(!rows.length||row+rows.length>300)throw Error('A grade aceita no máximo 300 circuitos.');
 if(rows.some(r=>column+r.length>columns[view].length))throw Error('A colagem ultrapassa as colunas desta aba. Copie apenas os dados, sem cabeçalho.');
 const next=structuredClone(circuits);
 rows.forEach((cells,i)=>{if(!next[row+i])next[row+i]=M.newCircuit();cells.forEach((value,j)=>set(next[row+i],columns[view][column+j],value));});
 return next;
}
window.VoltGrid={columns,options,set,paste};
})();
