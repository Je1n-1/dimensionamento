import { calc, prepare, prepareBoard } from "../core/api.js";
import { esc, fmt, state, ui, syncTechnical, viewKey } from "../core/state.js";
import { toast } from "../core/dom.js";
import { check, notice, stat } from "./components.js";

export function criterionChecks(c, r) {
  const b = r.chosen,
    p = r.protection || {};
  return [
    [
      "Capacidade de corrente corrigida",
      b && r.ib != null ? b.iz >= r.ib : null,
    ],
    [
      "Queda de tensão no percurso calculado",
      b && Number.isFinite(+c.maxDrop) ? b.dvPct <= +c.maxDrop : null,
    ],
    ["Ib ≤ In", p.loadOk ?? null],
    ["In ≤ Iz corrigida", p.cableOk ?? null],
    ["I₂ ≤ 1,45 × Iz (hipótese cadastrada)", p.conventionalOk ?? null],
    ["Capacidade de interrupção ≥ Ik informado", p.shortOk ?? null],
    ["Curvas reais, curto térmico e seletividade", null],
    ["Neutro, PE, DR/DPS e seccionamento", null],
  ];
}
export function circuitStatus(c, r) {
  if (r.pending) return "Cálculo indisponível";
  if (
    r.issues.length ||
    r.protection?.failed ||
    criterionChecks(c, r).some(([, ok]) => ok === false)
  )
    return "Revisão necessária";
  return r.chosen ? "Verificações parciais" : "Dimensionamento pendente";
}
function metrics(c, r) {
  return `${fmt(r.ib)} A · cabo ${fmt(r.chosen?.section)} mm² · ${c.breakerMode === "verify" ? "disjuntor informado" : "disjuntor sugerido"} ${fmt(r.protection?.nominal)} A · queda ${fmt(r.chosen?.dvPct)}%`;
}
export function reportView() {
  const rows = state.circuits.map((c) => ({ c, r: calc(c) }));
  const unsaved = state.editingId
    ? JSON.stringify(state.draft) !==
      JSON.stringify(state.circuits.find((c) => c.id === state.editingId))
    : !!state.draft.description;
  const verified = rows.reduce(
    (sum, { c, r }) =>
      sum + criterionChecks(c, r).filter(([, ok]) => ok === true).length,
    0,
  );
  return `${unsaved ? notice('Há alterações no editor que ainda não foram salvas no circuito. O relatório usa os circuitos salvos. <button class="btn secondary small" data-action="seeResult">Revisar rascunho</button>', "warn") : ""}<section class="panel card-section"><div class="card-title"><div><span class="eyebrow">Consolidação do projeto</span><h2>${esc(state.projectName)}</h2><p class="sub">Resultados dos circuitos salvos, critérios avaliados e verificações ainda necessárias.</p></div><div class="head-actions"><button class="btn primary" data-action="printBtn">Exportar PDF</button><button class="btn secondary" data-action="export">Backup JSON</button><button class="btn secondary" data-action="exportCsv">Exportar CSV</button></div></div>${notice("Verificações parciais com base histórica NBR 5410:1997. Um critério atendido não atesta conformidade integral da instalação.")}<div class="stats-row">${stat("Circuitos", rows.length)}${stat("Potência ativa instalada", fmt(ui.boardCache?.p) + " W")}${stat("Critérios atendidos no modelo", verified)}${stat("Circuitos com seleção pendente", rows.filter(({ r }) => !r.chosen).length)}</div><p class="hint">Imóvel: ${esc({ house: "Casa", apartment: "Apartamento", commercial: "Comercial", other: "Outro" }[state.context.propertyType])} · ${state.context.rooms.length} ambientes cadastrados · rede ${esc(state.supply.network)} V. Os totais incluem apenas os circuitos salvos; o inventário e a prévia ainda não aplicados não entram no cálculo.</p></section>${
    !rows.length
      ? `<section class="panel card-section"><h2>Seu relatório começa pelos circuitos</h2><p>Cadastre as cargas no Projeto e aplique uma proposta, ou crie circuitos manualmente.</p><button class="btn primary" data-page="project">Ir para Projeto</button></section>`
      : `<section class="panel card-section"><h2>Resultados consolidados</h2>${state.mode === "technical" ? `<div class="table-wrap"><table class="data-table board-table"><thead><tr><th>Circuito</th><th>Ib (A)</th><th>Cabo (mm²)</th><th>Disjuntor (A)</th><th>Queda (%)</th><th>Situação</th><th>Revisar</th></tr></thead><tbody>${rows.map(({ c, r }) => `<tr><td>${esc(c.description)}</td><td>${fmt(r.ib)}</td><td>${fmt(r.chosen?.section)}</td><td>${fmt(r.protection?.nominal)}</td><td>${fmt(r.chosen?.dvPct)}</td><td>${circuitStatus(c, r)}</td><td><button class="btn secondary small" data-result-id="${esc(c.id)}">Resultado</button></td></tr>`).join("")}</tbody></table></div>` : rows.map(({ c, r }) => `<article class="report-summary"><div><h3>${esc(c.number)} · ${esc(c.description)}</h3><p>${metrics(c, r)}</p></div><span class="tag pending">${circuitStatus(c, r)}</span><button class="btn secondary small" data-result-id="${esc(c.id)}">Revisar resultado</button></article>`).join("")}</section><section class="panel card-section"><h2>Itens verificados e pendências</h2><p class="hint">“Atende neste critério” exige resultado positivo do cálculo. Ausência de dados ou de implementação permanece pendente.</p>${rows
          .map(
            ({ c, r }) =>
              `<details class="details"><summary>${esc(c.description)} · ${circuitStatus(c, r)}</summary>${r.pending ? notice("Cálculo indisponível. Tente novamente com o servidor Python aberto.", "warn") : ""}${criterionChecks(
                c,
                r,
              )
                .map(([label, ok]) => check(label, "", ok))
                .join(
                  "",
                )}${[...new Set([...(r.issues || []), ...(r.selectionBlockers || []).map((x) => x.message), ...(r.notices || [])])].map((msg) => notice(esc(msg), "warn")).join("")}<button class="btn secondary small" data-result-id="${esc(c.id)}">Revisar este circuito</button></details>`,
          )
          .join("")}</section>`
  }`;
}

// Spreadsheet formula prefixes are escaped even in quoted CSV cells.
export function csvCell(value) {
  const raw = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw).replaceAll('"', '""') +
    '"'
  );
}
export async function exportCsv() {
  syncTechnical();
  if (!state.circuits.length)
    return toast("Adicione circuitos antes de exportar o CSV.");
  const key = viewKey();
  if (!(await prepare(state.circuits)) || !(await prepareBoard()))
    return toast(ui.serviceError);
  if (key !== viewKey()) return toast("Os dados mudaram. Exporte novamente.");
  const numeric = (x) => (x == null ? "" : String(x).replace(".", ","));
  const data = [
    [
      "Circuito",
      "Descrição",
      "Ligação",
      "Fases",
      "Tensão (V)",
      "Potência (W)",
      "Potência (VA)",
      "Corrente (A)",
      "Cabo (mm²)",
      "Disjuntor (A)",
      "Queda (%)",
      "Situação",
      "Critérios atendidos",
      "Pendentes / não atendidos",
    ],
  ];
  for (const c of state.circuits) {
    const r = calc(c),
      checks = criterionChecks(c, r);
    data.push([
      c.number,
      c.description,
      c.connection,
      c.phaseSet,
      ...[
        r.voltage,
        r.totals.p,
        r.totals.s,
        r.ib,
        r.chosen?.section,
        r.protection?.nominal,
        r.chosen?.dvPct,
      ].map(numeric),
      circuitStatus(c, r),
      checks
        .filter(([, ok]) => ok === true)
        .map(([s]) => s)
        .join("; "),
      [
        ...checks
          .filter(([, ok]) => ok !== true)
          .map(([s, ok]) => s + (ok === false ? ": não atende" : ": pendente")),
        ...(r.issues || []),
      ].join("; "),
    ]);
  }
  const href = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + data.map((row) => row.map(csvCell).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = href;
  a.download = "VoltCalc_resultados.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
