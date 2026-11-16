const {chromium}=require('C:/Users/jeanm/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const fixture=JSON.parse(execFileSync('python',['-c',"import sys,json;sys.path.insert(0,'tests');from industrial.test_infrastructure import fixture;p=fixture();p.update(name='QA Etapa 7 — dados sintéticos',storageRevision=1,createdAt='2026-10-28T10:00:00Z',updatedAt='2026-10-28T10:00:00Z');print(json.dumps(p))"],{encoding:'utf8'}));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Isolated ephemeral profile only. The main user's browser and storage are never accessed.
  await page.goto('http://127.0.0.1:8001/industrial/');
  await page.evaluate(p=>localStorage.setItem('voltcalc_industrial_projects_v1',JSON.stringify({format:'voltcalc-industrial-projects',version:1,currentId:p.id,projects:[p]})),fixture);
  await page.goto('http://127.0.0.1:8001/industrial/#/infraestrutura');await page.reload();
  await page.getByRole('button',{name:'Calcular ocupação',exact:true}).click();
  await page.getByText('30,72 %',{exact:true}).first().waitFor();
  assert.equal(await page.locator('.infrastructure-workspace tbody tr').count(),3);
  await page.getByRole('button',{name:'Editar infraestrutura',exact:true}).click();
  await page.getByLabel('Diâmetro interno útil (mm)',{exact:true}).fill('10');
  await page.getByRole('button',{name:'Salvar dados físicos',exact:true}).click();
  await page.locator('#infra-dialog').waitFor({state:'hidden'});
  await page.locator('.infrastructure-workspace tbody tr').first().getByText('Revisar',{exact:true}).waitFor();
  await page.reload();
  await page.getByRole('button',{name:'Editar infraestrutura',exact:true}).click();
  assert.equal(await page.getByLabel('Diâmetro interno útil (mm)',{exact:true}).inputValue(),'10');
  await page.getByLabel('Diâmetro interno útil (mm)',{exact:true}).fill('25');
  await page.getByRole('button',{name:'Salvar dados físicos',exact:true}).click();
  await page.locator('#infra-dialog').waitFor({state:'hidden'});
  await page.getByText('30,72 %',{exact:true}).first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
  await page.screenshot({path:'docs/industrial/evidencias/etapa07_infraestrutura_desktop.png',fullPage:true});
  // Missing diameter blocks the calculation; cancel does not mutate data.
  await page.getByRole('button',{name:'Informar diâmetro',exact:true}).first().click();
  await page.getByLabel('Diâmetro externo de projeto (mm), considerando tolerância do fabricante',{exact:true}).fill('');
  await page.getByRole('button',{name:'Salvar dados físicos',exact:true}).click();
  await page.locator('#infra-dialog').waitFor({state:'hidden'});
  await page.locator('.infrastructure-workspace tbody tr').first().getByText('Pendente',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Informar diâmetro',exact:true}).first().click();
  await page.getByLabel('Diâmetro externo de projeto (mm), considerando tolerância do fabricante',{exact:true}).fill('4');
  await page.getByRole('button',{name:'Salvar dados físicos',exact:true}).click();
  await page.locator('#infra-dialog').waitFor({state:'hidden'});
  // Rectangular form is contextual and checks actual width, without a default % limit.
  await page.getByRole('button',{name:'Editar infraestrutura',exact:true}).click();
  await page.getByLabel('Tipo de infraestrutura',{exact:true}).selectOption('ladder');
  await page.getByLabel('Largura interna útil (mm)',{exact:true}).fill('100');
  await page.getByLabel('Altura interna útil (mm)',{exact:true}).fill('30');
  await page.getByLabel('Arranjo físico',{exact:true}).selectOption('single_layer');
  await page.getByLabel('Espaçamento livre entre cabos (mm)',{exact:true}).fill('2');
  await page.locator('[name="limitSource.kind"]').selectOption('manual');
  await page.locator('[name="limitSource.reference"]').fill('Critério sintético QA: camada única com espaçamento de 2 mm');
  await page.locator('[name="arrangementConfirmed"]').check();
  await page.getByRole('button',{name:'Salvar dados físicos',exact:true}).click();
  await page.locator('#infra-dialog').waitFor({state:'hidden'});
  await page.getByText('70 × 4 mm',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Editar infraestrutura',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
  assert.equal(await page.locator('#infra-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  await page.screenshot({path:'docs/industrial/evidencias/etapa07_infraestrutura_mobile.png'});
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.deepEqual(errors,[]);
  fs.writeFileSync('tmp/industrial-stage7-browser-tests.json',JSON.stringify({status:'passed',errors,checks:['calculation','insufficient diameter','save and reload','missing diameter','rectangular layout','mobile without overflow','cancel']},null,2));
  console.log('Browser Etapa 7: cálculo, edição, persistência, pendências e responsividade OK.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
