import { state, ui, esc, fmt, CONNECTIONS } from "../core/state.js";
import { calc } from "../core/api.js";
import {
  icon,
  metric,
  cardTitle,
  phaseBadge,
  circuitMetrics,
} from "./visuals.js";
import { criterionChecks, circuitStatus } from "./report.js";
import { selectionReadiness, corrections, traceView } from "./results.js";
import { check, notice } from "./components.js";

export function phaseDistribution() {
  const panel = ui.boardCache;
  if (!panel?.complete)
    return `<div class="empty-state">${icon("chart")}<strong>Distribuição aguardando dados</strong><p>Revise as ligações e grandezas dos circuitos. Cargas incompletas não são contadas como zero.</p></div>`;
  const colors = { A: "#ff535e", B: "#ffcb33", C: "#3882ff" };
  let angle = 0;
  const stops = panel.phases
    .map((p) => {
      const start = angle;
      angle += panel.p ? (p.p / panel.p) * 360 : 0;
      return `${colors[p.phase]} ${start}deg ${angle}deg`;
    })
    .join(",");
  return `<div class="distribution-content"><div class="phase-bars">${panel.phases.map((p) => `<div class="phase-bar-row">${phaseBadge(p.phase)}<div><b>Fase ${p.label}</b><span>${fmt(p.p)} W</span><div class="phase-track"><div class="phase-fill phase-${p.phase}" style="width:${panel.maxCurrent ? (p.current / panel.maxCurrent) * 100 : 0}%"></div></div></div><strong>${fmt(p.current)} A<small>${p.count} circuito(s)</small></strong></div>`).join("")}</div><div class="donut-area"><strong>Distribuição da potência ativa</strong><div class="phase-donut" style="background:conic-gradient(${panel.p ? stops : "#e6edf8 0deg 360deg"})"><div><b>${fmt(panel.p / 1000)} kW</b><small>Total</small></div></div>${panel.phases.map((p) => `<div class="donut-legend">${phaseBadge(p.phase)} Fase ${p.label}<span>${panel.p ? fmt((p.p / panel.p) * 100, 1) : "0"}%</span></div>`).join("")}</div></div>`;
}
export function circuitFilterBar() {
  return `<div class="circuit-filters"><label>${icon("search")}<input data-circuit-search value="${esc(ui.circuitSearch || "")}" aria-label="Buscar circuito" placeholder="Buscar circuito, ambiente ou equipamento…"></label><select data-circuit-phase aria-label="Filtrar fase"><option value="">Todas as fases</option>${["A", "B", "C"].map((p) => `<option value="${p}" ${ui.circuitPhase === p ? "selected" : ""}>Fase ${{ A: "R", B: "S", C: "T" }[p]} (${p})</option>`).join("")}</select><select data-circuit-status aria-label="Filtrar situação"><option value="">Todos os status</option><option value="pending" ${ui.circuitStatus === "pending" ? "selected" : ""}>Seleção pendente</option><option value="sized" ${ui.circuitStatus === "sized" ? "selected" : ""}>Com seleção preliminar</option></select></div>`;
}
export function filterCircuitRows() {
  const query = (ui.circuitSearch || "").toLocaleLowerCase("pt-BR");
  let visible = 0;
  document.querySelectorAll("[data-circuit-id]").forEach((row) => {
    const c = state.circuits.find((c) => c.id === row.dataset.circuitId);
    if (!c) return;
    const r = calc(c),
      text = [c.description, c.number, ...c.loads.map((l) => l.description)]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
    const match =
      text.includes(query) &&
      (!ui.circuitPhase || String(c.phaseSet).includes(ui.circuitPhase)) &&
      (!ui.circuitStatus ||
        (ui.circuitStatus === "pending" ? !r.chosen : !!r.chosen));
    row.hidden = !match;
    if (match) visible++;
  });
  const empty = document.getElementById("filterEmpty");
  if (empty) empty.hidden = visible > 0;
}
export function dashboardView() {
  const p = ui.boardCache;
  const pending = state.circuits.filter(
    (c) => !calc(c).chosen || calc(c).protection.failed,
  );
  return `<div class="metric-grid">${metric("Potência instalada (total)", fmt(p?.p) + " W", "Soma das potências dos circuitos", "bolt")}${metric("Soma em VA (total)", fmt(p?.sumVA) + " VA", "Considerando os fatores de potência", "layers", "purple")}${metric("Maior corrente de fase", fmt(p?.maxCurrent) + " A", p?.complete ? "Fase " + p.maxPhases.join(" / ") : "Grandezas a conferir", "chart", "green")}${metric("Diferença entre as fases", fmt(p?.spread) + " A", "Diferença entre maior e menor corrente", "warning", "amber")}</div><div class="board-composition"><div><section class="panel design-card">${cardTitle(1, "Distribuição de cargas por fase", "Visualize a potência e a corrente em cada fase do quadro de cargas.")}${phaseDistribution()}</section><section class="panel design-card circuit-list">${cardTitle(3, "Lista de circuitos do quadro de cargas", "Confira as cargas, os resultados e as verificações de cada circuito.")}<div class="card-title">${circuitFilterBar()}<button class="btn primary small" data-action="new">${icon("plus")} Novo circuito</button></div><div class="table-wrap"><table class="data-table compact-board"><thead><tr><th>Circuito</th><th>Fase</th><th>Potência (W)</th><th>Corrente (A)</th><th>Cabo (mm²)</th><th>Disjuntor (A)</th><th>Status</th><th>Ações</th></tr></thead><tbody>${state.circuits
    .map((c) => {
      const r = calc(c);
      return `<tr data-circuit-id="${esc(c.id)}"><td><strong>${esc(c.number)} ${esc(c.description || "Sem nome")}</strong><small>${esc(CONNECTIONS.find((x) => x[0] === c.connection)?.[1] || "Ligação a confirmar")}</small></td><td>${phaseBadge(c.phaseSet)}</td><td>${fmt(r.totals.p)}</td><td>${fmt(r.ib)}</td><td>${fmt(r.chosen?.section)}</td><td>${fmt(r.protection?.nominal)}</td><td><span class="status-pill ${r.chosen && !r.protection.failed ? "partial" : "pending"}">${r.chosen && !r.protection.failed ? "Parcial" : "Revisar"}</span></td><td><div class="row-actions"><button data-edit="${esc(c.id)}" aria-label="Editar ${esc(c.description)}" title="Editar circuito">${icon("edit")}</button><button data-result-id="${esc(c.id)}" aria-label="Resultado de ${esc(c.description)}" title="Resultado">${icon("report")}</button></div></td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div><p id="filterEmpty" class="empty-state" ${state.circuits.length ? "hidden" : ""}>Nenhum circuito encontrado. Cadastre as cargas em Projeto ou adicione um circuito.</p></section></div><aside><section class="panel design-card">${cardTitle(2, "Distribuição e verificações", "Revise os circuitos antes de consolidar o projeto.")}<div class="review-count"><span class="metric-icon amber">${icon("warning")}</span><div><strong>${pending.length} circuito(s) a revisar</strong><p>Seleção pendente ou proteção incompatível</p></div></div><div class="design-callout blue">${icon("info")}<div><strong>Como interpretar a distribuição?</strong><p>A diferença entre fases é informativa. Os valores consideram as cargas ligadas e não dimensionam o alimentador.</p></div></div><button class="btn primary wide" data-action="editPhases">${icon("scale")} Editar distribuição de fases ${icon("arrow")}</button><div class="design-callout amber">${icon("shield")}<div><strong>Verificações parciais</strong><p>Consulte Resultado em cada circuito para ver proteção, queda de tensão e dados ainda necessários.</p></div></div><h3>Outras ações</h3><button class="action-row" data-action="csvDialog">${icon("board")}<span><strong>Importar quadro de cargas</strong><small>Adicionar dados a partir de um CSV</small></span>${icon("arrow")}</button><button class="action-row" data-page="report">${icon("report")}<span><strong>Ver relatório consolidado</strong><small>Resultados e exportações PDF, JSON e CSV</small></span>${icon("arrow")}</button></section></aside></div>`;
}

export function technicalSummary(c) {
  if (!c)
    return `<div class="empty-state">${icon("report")}<strong>Selecione um circuito</strong><p>Edite as células ou adicione seu primeiro circuito.</p></div>`;
  const r = calc(c),
    index = state.circuits.findIndex((x) => x.id === c.id);
  return `<div class="drawer-heading"><strong>Circuito ${esc(c.number || String(index + 1))}</strong><span class="status-pill pending">${r.chosen ? "Parcial" : "Pendente"}</span></div><h2>${esc(c.description || "Sem nome")}</h2><p class="muted">${c.loads.length} grupo(s) de cargas</p><div class="drawer-tabs"><button class="active" data-grid-open="${index}" data-grid-detail="0">Resumo</button><button data-grid-open="${index}" data-grid-detail="2">Editar</button><button data-result-id="${esc(c.id)}">Verificações</button></div><dl class="detail-list">${[
    [
      "plug",
      "Ligação",
      CONNECTIONS.find((x) => x[0] === c.connection)?.[1] || "Pendente",
    ],
    ["chart", "Fases", c.phaseSet],
    ["bolt", "Potência instalada", fmt(r.totals.p) + " W"],
    ["chart", "Corrente de projeto (Ib)", fmt(r.ib) + " A"],
    ["cable", "Seção do cabo", fmt(r.chosen?.section) + " mm²"],
    ["shield", "Disjuntor", fmt(r.protection?.nominal) + " A"],
    ["chart", "Maior queda estimada", fmt(r.chosen?.dvPct) + "%"],
  ]
    .map(
      ([ic, k, v]) => `<div><dt>${icon(ic)}${k}</dt><dd>${esc(v)}</dd></div>`,
    )
    .join(
      "",
    )}</dl><div class="design-callout ${r.chosen ? "blue" : "amber"}">${icon("info")}<div><strong>${r.chosen ? "Resultado preliminar" : "Dados a revisar"}</strong><p>${esc(r.selectionBlockers?.[0]?.message || "Veja os critérios efetivamente verificados e as pendências complementares.")}</p></div></div><button class="btn primary wide" data-result-id="${esc(c.id)}">Abrir resultado completo ${icon("arrow")}</button>`;
}

export function resultDashboard() {
  const c = state.draft,
    r = calc(c),
    b = r.chosen,
    p = r.protection || {},
    tab = ui.resultTab || "sizing";
  if (r.pending)
    return notice(ui.serviceError || "Calculando no servidor Python…");
  const criteria = `<div class="result-method-cards">${[
    [
      "1",
      "Corrente de projeto (Ib)",
      fmt(r.ib) + " A",
      "Corrente calculada para as cargas e a ligação informadas.",
    ],
    [
      "2",
      "Capacidade corrigida (Iz)",
      fmt(b?.iz) + " A",
      `Método ${esc(r.method || "pendente")} · tabela ${r.table || "—"}`,
    ],
    [
      "3",
      "Fatores de correção",
      fmt(r.combinedFactor),
      `Temperatura: ${fmt(r.fct)} · agrupamento: ${fmt(r.fca)}`,
    ],
  ]
    .map(
      ([n, t, v, h]) =>
        `<article><span class="number-badge">${n}</span><div><h3>${t}</h3><strong>${v}</strong><small>${h}</small></div></article>`,
    )
    .join("")}</div>`;
  const sizing = `${criteria}${
    b
      ? `<div class="design-callout green">${icon("check")}<div><strong>Seção selecionada: ${fmt(b.section)} mm²</strong><p>Critério(s) determinante(s): ${esc(r.determining.join("; "))}.</p></div></div><h3>Verificação das seções disponíveis</h3><div class="table-wrap"><table class="data-table candidates"><thead><tr><th>Seção (mm²)</th><th>Iz tabela (A)</th><th>Iz corrigida (A)</th><th>Ib ≤ Iz</th><th>Situação</th></tr></thead><tbody>${(
          r.all || []
        )
          .filter((row) => row.section <= b.section * 2 || row.section <= 6)
          .slice(0, 9)
          .map(
            (row) =>
              `<tr class="${row.section === b.section ? "selected-row" : ""}"><td>${fmt(row.section)}</td><td>${fmt(row.itab)}</td><td>${fmt(row.iz)}</td><td><span class="${row.ampOk ? "text-ok" : "text-bad"}">${row.ampOk ? "✓ Sim" : "× Não"}</span></td><td>${row.section === b.section ? '<span class="status-pill partial">Selecionada</span>' : row.ampOk && row.dropOk && row.breaker ? "Atende aos critérios calculados" : !row.ampOk ? "Capacidade insuficiente" : !row.dropOk ? "Queda acima do limite" : "Proteção incompatível"}</td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : selectionReadiness(r)
  }<details class="details"><summary>Entenda a capacidade tabelada necessária</summary>${corrections(r)}</details>`;
  const protection = `${criterionChecks(c, r)
    .map(([label, ok]) => check(label, "", ok))
    .join(
      "",
    )}<button class="btn secondary small" data-review-step="5">${icon("edit")} Editar proteção</button>${selectionReadiness(r)}`;
  const norm = `<div class="design-callout amber">${icon("book")}<div><strong>Base histórica NBR 5410:1997</strong><p>Verificações parciais. Esta ferramenta não atesta conformidade integral ou atendimento à edição atual.</p></div></div>${r.notices.map((msg) => notice(esc(msg))).join("")}`;
  const index = state.circuits.findIndex((x) => x.id === c.id);
  return `<div class="result-circuit-picker"><span>Circuito atual</span><select data-result-circuit aria-label="Circuito atual">${index < 0 ? '<option value="">Rascunho atual</option>' : ""}${state.circuits.map((circuit) => `<option value="${esc(circuit.id)}" ${circuit.id === c.id ? "selected" : ""}>${esc(circuit.number)} — ${esc(circuit.description)}</option>`).join("")}</select></div><div class="result-hero"><div class="result-identity"><span class="metric-icon blue">${icon("plug")}</span><div><h2>${esc(c.number)} ${esc(c.description || "Circuito sem nome")}</h2><p>${esc(CONNECTIONS.find((x) => x[0] === c.connection)?.[1] || "Ligação a confirmar")}</p></div></div>${metric("Corrente de carga", fmt(r.ib) + " A", `Potência: ${fmt(r.totals.p)} W · ${fmt(r.voltage)} V`, "bolt")}${metric("Cabo sugerido", fmt(b?.section) + " mm²", `${c.metal === 'Cu' ? 'Cobre' : 'Alumínio'} · ${esc(c.insulation)}`, "cable", "green")}${metric(c.breakerMode === "verify" ? "Disjuntor informado" : "Disjuntor sugerido", fmt(p.nominal) + " A", `Curva ${esc(c.breakerCurve)} · verificar dispositivo`, "shield", "purple")}${metric("Queda de tensão", fmt(b?.dvPct) + "%", `Limite informado: ${fmt(c.maxDrop)}%`, "chart", "green")}<div class="overall-status"><span class="metric-icon amber">${icon("info")}</span><div><small>Status geral</small><strong>${p.failed ? "Revisar" : b ? "Parcial" : "Pendente"}</strong><p>Consulte os critérios e pendências.</p></div></div></div><div class="result-tabs">${[
    ["sizing", "Dimensionamento", "board"],
    ["protection", "Proteção", "shield"],
    ["voltage", "Queda de tensão", "chart"],
    ["norm", "Referências", "book"],
  ]
    .map(
      ([key, label, ic]) =>
        `<button data-result-tab="${key}" class="${tab === key ? "active" : ""}" aria-pressed="${tab === key}">${icon(ic)}${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="result-composition"><section class="panel design-card"><h2>${icon(tab === "voltage" ? "chart" : "board")} ${{ sizing: "Resultados do dimensionamento do condutor", protection: "Verificações da proteção", voltage: "Queda de tensão por percurso", norm: "Referências e limitações" }[tab]}</h2><p class="muted">Resultados calculados a partir das condições informadas.</p>${{ sizing, protection, voltage: traceView(r), norm }[tab]}</section><aside><section class="panel design-card"><div class="card-title"><h2>${icon("report")} Dados do circuito</h2><button class="btn secondary small" data-review-step="2">${icon("edit")} Editar</button></div><dl class="circuit-data">${[
    ["Potência instalada", fmt(r.totals.p) + " W"],
    ["Tensão", fmt(r.voltage) + " V"],
    ["Fases", c.phaseSet],
    ["Método de referência", r.method || "Pendente"],
    ["Condutor", c.metal + " · " + c.insulation],
    ["Grupos de cargas", c.loads.length],
    ["Temperatura", fmt(c.temperature) + " °C"],
    ["Circuitos agrupados", fmt(c.groupCount, 0)],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join(
      "",
    )}</dl></section><section class="panel design-card formula-panel"><h2>${icon("book")} Critérios e fórmulas principais</h2><div class="formula-grid">${[
    [
      "bolt",
      "Capacidade de condução",
      "Ib ≤ Iz corrigida",
      "Capacidade após as correções",
    ],
    [
      "settings",
      "Fatores de correção",
      "Iz,corr = Iz × FCT × FCA",
      "Temperatura e agrupamento",
    ],
    [
      "shield",
      "Coordenação da proteção",
      "Ib ≤ In ≤ Iz,corr",
      "Verificação de sobrecarga",
    ],
    [
      "chart",
      "Queda de tensão",
      "ΔV% = (ΔV / V) × 100",
      "Comparação com o limite informado",
    ],
  ]
    .map(
      ([ic, label, formula, help]) =>
        `<article>${icon(ic)}<div><strong>${label}</strong><code>${formula}</code><small>${help}</small></div></article>`,
    )
    .join(
      "",
    )}</div></section></aside></div><div class="result-actions"><button class="btn secondary" data-page="loads">← Voltar para circuitos</button><div><button class="btn secondary" data-page="report">${icon("report")} Ver relatório</button><button class="btn primary" data-action="saveCircuit">${icon("check")} ${state.editingId ? "Atualizar circuito" : "Aplicar ao projeto"}</button></div></div>`;
}
