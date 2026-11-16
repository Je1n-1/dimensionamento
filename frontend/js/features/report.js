import { coverageView } from "../views/coverage.js";
import { prepare, prepareBoard } from "../core/api.js";
import { toast } from "../core/dom.js";
import {
  $,
  esc,
  fmt,
  state,
  ui,
  viewKey,
  syncTechnical,
} from "../core/state.js";
import { savedResults } from "../views/pages.js";
import { resultView } from "../views/results.js";

export async function report() {
  syncTechnical();
  const snapshot = viewKey();
  if (!(await prepare(state.circuits)) || !(await prepareBoard())) {
    toast(ui.serviceError);
    return;
  }
  if (snapshot !== viewKey()) {
    toast("Os dados mudaram. Exporte novamente.");
    return;
  }
  const saved = state.draft;
  $("printArea").innerHTML =
    `<h1>VoltCalc — Memorial preliminar</h1><p>Projeto: ${esc(state.projectName)} · ${new Date().toLocaleDateString("pt-BR")}<br>Base histórica NBR 5410:1997 · motor Python v3<br>Ambientes: ${esc(state.context.rooms.join(", ") || "Não informados")}<br>Alimentação: ${esc(state.supply.phases)}, rede ${esc(state.supply.network)}. Reatância: ${fmt(state.reactance, 3)} Ω/km.</p><p class="report-warning">Verificações parciais. Este relatório não atesta conformidade integral.</p>${coverageView()}${window.VoltBoard.render(
      ui.boardCache,
      state.circuits,
      savedResults().map((x) => x.r),
      state.importInfo,
      false,
    )}${
      savedResults()
        .map(({ c, r }, i) => {
          state.draft = c;
          return `<section class="report-circuit"><h2>${i + 1}. ${esc(c.description)}</h2><p>Ligação: ${esc(c.connection)} · fases ${esc(c.phaseSet)} · ${fmt(r.voltage)} V · ${fmt(r.loaded, 0)} carregados.<br>${esc(c.metal)} / ${esc(c.insulation)} · método ${esc(r.method)} · ${fmt(c.temperature)} °C · ${fmt(c.groupCount, 0)} circuito(s) agrupado(s) · limite ${fmt(c.maxDrop)}%.</p><table><thead><tr><th>Grupo</th><th>Qtd.</th><th>Potência unitária</th><th>FP</th><th>Distância de ida</th></tr></thead><tbody>${c.loads.map((l) => `<tr><td>${esc(l.description)}</td><td>${fmt(l.quantity, 0)}</td><td>${fmt(l.power)} ${esc(l.unit)}</td><td>${fmt(l.powerFactor)}</td><td>${fmt(l.distance)} m</td></tr>`).join("")}</tbody></table>${resultView()}</section>`;
        })
        .join("") ||
      "<p>Nenhum circuito salvo. Salve os circuitos antes de emitir o memorial.</p>"
    }`;
  state.draft = saved;
  $("printArea")
    .querySelectorAll("details")
    .forEach((d) => (d.open = true));
  window.print();
}
