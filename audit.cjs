const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, 'original_html');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const table = fs.readFileSync(path.join(root, 'tables.js'), 'utf8');
function session(storage = new Map()) {
  const elements = new Map();
  const context = vm.createContext({
    window: { scrollTo() {} }, console,
    document: {
      getElementById(key) {
        if (!elements.has(key)) elements.set(key, { innerHTML: '', classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {} });
        return elements.get(key);
      }, querySelectorAll: () => []
    },
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    confirm: () => true, setTimeout: () => 0, clearTimeout() {}
  });
  vm.runInContext(table, context);
  // Expose original functions in memory; omit browser startup only.
  const prefix = source.slice(0, source.indexOf('load();render();document.addEventListener'));
  vm.runInContext(prefix + 'globalThis.audit={get state(){return state},newCircuit,calculate,load,persist,setField,editCircuit,saveCircuit,importJson};})();', context);
  return { api: context.audit, storage };
}
async function main() {
  const evidence = [];
  const { api } = session();
  const baseline = api.calculate(api.newCircuit());
  assert.ok(Math.abs(baseline.ib - 30000 / (380 * Math.sqrt(3))) < 1e-10);
  assert.ok(baseline.chosen);
  evidence.push({ test: 'Default 30 kVA / 380 V', current: baseline.ib, section: baseline.chosen.section, breaker: baseline.chosen.breaker, drop: baseline.chosen.dvPct });
  for (const installation of ['tray', 'overhead']) {
    assert.equal(api.calculate({ ...api.newCircuit(), installation }).chosen, null);
  }
  assert.equal(api.calculate({ ...api.newCircuit(), installation: 'buried', groupCount: 2 }).chosen, null);
  evidence.push({ test: 'Unsupported installation/grouping', result: 'Selection remains pending as expected' });
  for (const i2Factor of ['', 0, -1]) {
    const r = api.calculate({ ...api.newCircuit(), i2Factor });
    assert.ok(r.chosen);
    assert.equal(r.issues.length, 0);
    evidence.push({ test: 'Invalid I2/In accepted', input: i2Factor, breaker: r.chosen.breaker, issues: r.issues });
  }
  const c = { ...api.newCircuit(), powerFactor: 0.8, length: 200 };
  api.state.reactance = 0.5;
  const before = api.calculate(c);
  const backup = JSON.stringify({ format: 'VoltCalcGuiado-v2', circuits: [c], reactance: 0.5 });
  api.state.reactance = 0.08;
  await api.importJson({ size: backup.length, text: async () => backup });
  const after = api.calculate(api.state.circuits[0]);
  assert.equal(api.state.reactance, 0.08);
  evidence.push({ test: 'Backup ignores reactance', exportedReactance: 0.5, importedReactance: api.state.reactance, beforeSection: before.chosen?.section, afterSection: after.chosen?.section, beforeDrop: before.chosen?.dvPct, afterDrop: after.chosen?.dvPct });
  const first = session();
  first.api.state.circuits = [first.api.newCircuit()];
  first.api.editCircuit(first.api.state.circuits[0].id);
  first.api.setField('description', 'Edited before reload');
  const second = session(first.storage);
  second.api.load();
  assert.equal(second.api.state.editingId, null);
  second.api.saveCircuit();
  assert.equal(second.api.state.circuits.length, 2);
  evidence.push({ test: 'Reload loses editing identity', circuitsAfterSave: second.api.state.circuits.length, descriptions: second.api.state.circuits.map(x => x.description) });
  const threePhase = { ...api.newCircuit(), insulation: 'PVC', length: 0 };
  const mixed = api.calculate({ ...threePhase, loaded: 2 });
  assert.ok(mixed.chosen);
  evidence.push({ test: 'Balanced three-phase permits two loaded conductors', issues: mixed.issues, section: mixed.chosen.section, baselineSection: api.calculate(threePhase).chosen.section });
  const oneFile = fs.readFileSync(path.join(root, 'VoltCalc_Guiado_Abrir.html'), 'utf8');
  assert.ok(oneFile.includes(source.trim()));
  assert.ok(oneFile.includes(table.trim()));
  assert.ok(oneFile.includes(fs.readFileSync(path.join(root, 'styles.css'), 'utf8').trim()));
  evidence.push({ test: 'Single HTML vs separate assets', result: 'JS, CSS and tables match' });
  fs.writeFileSync(path.join(__dirname, 'evidencias.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
