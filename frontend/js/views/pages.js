import { calc } from "../core/api.js";
import { DB, PREVIOUS, esc, fmt, state, ui } from "../core/state.js";
import { helpButton, notice } from "./components.js";
import {
  circuitView,
  conditionsView,
  connectionView,
  equipmentView,
  groupingView,
  installationView,
  intro,
  methodOf,
  protectionView,
  routeView,
  stepper,
  supplyView,
} from "./forms.js";
import { resultView, traceView } from "./results.js";

export function stepView(step) {
  return (
    intro(step) +
    [
      null,
      circuitView,
      () => supplyView() + connectionView() + equipmentView() + routeView(),
      installationView,
      groupingView,
      conditionsView,
      resultView,
    ][step]()
  );
}

export function wizardView() {
  return `<section class="panel wizard">${stepper()}<div class="step-body">${stepView(state.step)}</div>${state.draft.source && state.step < 6 ? '<p class="hint">Circuito importado: você pode salvar o cadastro ainda incompleto. Os cálculos que dependem dos dados ausentes continuarão pendentes.</p><button class="btn secondary small" data-action="saveCircuit">Salvar cadastro pendente</button>' : ""}${state.step < 6 ? "<div data-live-readiness></div>" : ""}<div class="helper-row"><span class="info-line">Os pontos de interrogação explicam cada escolha e seus efeitos.</span><div class="nav-buttons">${state.step > 1 ? '<button class="btn secondary" data-action="back">‹ Voltar</button>' : ""}${state.step < 6 ? '<button class="btn primary" data-action="next">Próximo passo →</button>' : ""}</div></div></section>`;
}

export function savedResults() {
  return state.circuits.map((c, i) => ({ c, i, r: calc(c) }));
}

export function loadsView() {
  return `<section class="panel card-section"><div class="card-title"><div><h2>Quadro de cargas ${helpButton("panelTotals")}</h2><p>Projeto: ${esc(state.projectName)} · rede ${esc(state.supply.network)} V · ${state.circuits.length} circuito(s).</p></div><div class="head-actions"><button class="btn secondary small" data-action="csvDialog">Importar CSV</button><button class="btn secondary small" data-action="example">Exemplo de 8 circuitos</button><button class="btn secondary small" data-action="export">Backup JSON</button><button class="btn primary small" data-action="new">+ Novo circuito</button></div></div><p class="hint">Fases R/S/T correspondem a A/B/C. Os totais utilizam os circuitos salvos; salve as alterações do editor para atualizar o quadro.</p>${window.VoltBoard.render(
    ui.boardCache,
    state.circuits,
    savedResults().map((x) => x.r),
    state.importInfo,
  )}${localStorage.getItem(PREVIOUS) ? '<button class="btn secondary small restore-project" data-action="restorePrevious">Restaurar projeto anterior à importação</button>' : ""}</section>`;
}

export function referenceView() {
  const c = state.draft,
    method = methodOf(c) || "B1",
    table = String(ui.tableShown);
  let headers, rows;
  if (table === "31" || table === "32") {
    const columns = DB.meta.columns,
      ins = table === "31" ? "PVC" : "EPR_XLPE";
    headers = [
      "Seção (mm²)",
      method + " / 2 carregados",
      method + " / 3 carregados",
    ];
    rows = Object.entries(DB.ampacities[ins][c.metal] || {}).map(([s, a]) => [
      s,
      a[columns.indexOf(method + "/2")],
      a[columns.indexOf(method + "/3")],
    ]);
  } else if (table === "35") {
    headers = ["Temperatura (°C)", "PVC", "EPR/XLPE"];
    const t = DB.temperature[method === "D" ? "soil" : "air"];
    rows = Object.keys(t.EPR_XLPE).map((k) => [k, t.PVC[k], t.EPR_XLPE[k]]);
  } else {
    headers = ["Circuitos", "Fator de agrupamento"];
    rows = Object.entries(DB.group1);
  }
  return `<section class="panel card-section"><h2>Tabela ${esc(table)} · referência histórica</h2>${table === "28" ? notice("A1/A2: parede termicamente isolante. B1/B2: conduto em condições aplicáveis. C: cabo diretamente na parede. D: condição enterrada. Confirme as condições completas na norma.") : `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${fmt(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`}${notice("Dados parciais da base histórica NBR 5410:1997. Não substituem a publicação e suas notas.", "warn")}</section>`;
}

export function overviewView() {
  const r = calc(state.draft);
  return `<section class="panel card-section"><h2>${{ sizing: "Dimensionamento explicado", protection: "Verificação de proteção", voltage: "Queda de tensão por percurso" }[state.page]}</h2><p class="sub">Circuito no editor: ${esc(state.draft.description || "Sem nome")}.</p>${state.page === "voltage" ? routeView() + '<div id="dependentResult">' + traceView(r) + "</div>" : state.page === "protection" ? protectionView() + '<div id="dependentResult">' + resultView() + "</div>" : resultView()}</section>`;
}
