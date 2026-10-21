import { calc, prepare } from "../core/api.js";
import { closeModal, modal, toast } from "../core/dom.js";
import {
  G,
  LABELS,
  M,
  esc,
  fmt,
  requestRender,
  state,
  syncTechnical,
  ui,
} from "../core/state.js";
import { persist } from "../core/storage.js";
import { paintDiagnostics } from "../views/diagnostics.js";
import {
  circuitView,
  conditionsView,
  connectionView,
  equipmentView,
  groupingView,
  installationView,
  routeView,
  supplyView,
} from "../views/forms.js";
import { gridResult, resultView } from "../views/results.js";

let gridRefresh = 0;

export function enterTechnical() {
  if (state.editingId) {
    const i = state.circuits.findIndex((c) => c.id === state.editingId);
    if (i >= 0) state.circuits[i] = structuredClone(state.draft);
  } else if (
    state.draft.description ||
    !state.circuits.length ||
    JSON.stringify({
      ...state.draft,
      id: "",
      loads: state.draft.loads.map((l) => ({ ...l, id: "" })),
    }) !==
      JSON.stringify({
        ...M.newCircuit(),
        id: "",
        loads: [{ ...M.newLoad(), id: "" }],
      })
  ) {
    if (state.circuits.length >= 300)
      return toast(
        "Limite de 300 circuitos. Salve o rascunho em outro projeto.",
      );
    state.circuits.push(structuredClone(state.draft));
    state.editingId = state.draft.id;
  } else {
    state.draft = structuredClone(state.circuits[0]);
    state.editingId = state.draft.id;
  }
  state.mode = "technical";
  state.page = "wizard";
  persist();
  requestRender();
}

export function gridCell(c, column, row, j) {
  const value = (column.load ? c.loads[0] : c)?.[column.key] ?? "";
  if (column.load && c.loads.length !== 1)
    return `<td><button class="grid-groups" data-grid-open="${row}" data-grid-detail="2">${c.loads.length} grupos</button></td>`;
  const attrs = `data-grid-row="${row}" data-grid-col="${j}" aria-describedby="grid-diagnostic-${row}-${j}" aria-label="Linha ${row + 1}: ${esc(column.label)}"`;
  const input = column.options
    ? `<select ${attrs}>${G.options(column).some(([v]) => v === value) ? "" : '<option value="">Pendente</option>'}${G.options(
        column,
      )
        .map(
          ([v, label]) =>
            `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(label)}</option>`,
        )
        .join("")}</select>`
    : `<input ${attrs} value="${esc(value)}" ${["number", "description"].includes(column.key) ? 'maxlength="70"' : 'inputmode="decimal"'}>`;
  return `<td>${input}<span id="grid-diagnostic-${row}-${j}" class="grid-cell-error" data-grid-error="${row}-${j}"></span></td>`;
}

export function technicalView() {
  return `<section class="panel card-section grid-panel"><div class="card-title"><div><span class="eyebrow">Modo técnico</span><h2>Planilha de circuitos</h2><p>Edição salva neste navegador. Resultados recalculados pelo Python.</p></div><div class="head-actions"><button class="btn secondary small" data-action="export">Backup JSON</button><button class="btn secondary small" data-page="loads">Quadro de cargas</button><button class="btn primary small" data-grid-action="add">+ Circuito</button></div></div>${supplyView()}<div class="grid-toolbar"><div class="grid-tabs">${[
    ["loads", "Cargas"],
    ["installation", "Instalação"],
    ["conditions", "Condições e proteção"],
  ]
    .map(
      ([key, label]) =>
        `<button class="btn small ${ui.gridTab === key ? "primary" : "secondary"}" data-grid-tab="${key}" aria-pressed="${ui.gridTab === key}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="grid-tabs"><button class="btn secondary small" data-grid-action="duplicate">Duplicar selecionados</button><button class="btn secondary small" data-grid-action="bulk">Aplicar condições…</button></div></div><p class="hint">Role a tabela para ver todas as colunas. Cole células do Excel a partir de uma célula (sem cabeçalho, números sem separador de milhar). Tab avança; Enter desce. A aba Cargas edita o grupo único; vários grupos ficam em Detalhes. In informado só é usado em Verificar.</p><div class="table-wrap grid-scroll"><table class="circuit-grid"><caption class="sr-only">Circuitos editáveis — ${state.circuits.length} linhas</caption><thead><tr><th><input type="checkbox" data-grid-all aria-label="Selecionar todos os circuitos" ${state.circuits.length && state.circuits.every((c) => ui.gridSelection.has(c.id)) ? "checked" : ""}></th><th>Editar</th>${G.columns[ui.gridTab].map((c) => `<th>${esc(c.label)}</th>`).join("")}<th>Pré-dimensionamento</th></tr></thead><tbody>${state.circuits.map((c, i) => `<tr class="${state.editingId === c.id ? "grid-active" : ""}"><td><input type="checkbox" data-grid-select="${esc(c.id)}" aria-label="Selecionar circuito ${i + 1}" ${ui.gridSelection.has(c.id) ? "checked" : ""}></td><td><button class="btn secondary small" data-grid-open="${i}" data-grid-detail="2">Detalhes</button><button class="btn ghost small" data-grid-open="${i}" data-grid-detail="6">Resultado</button></td>${G.columns[ui.gridTab].map((column, j) => gridCell(c, column, i, j)).join("")}<td class="grid-result" data-grid-result="${i}">${gridResult(c)}</td></tr>`).join("")}</tbody></table></div><p class="hint">As condições iniciais são hipóteses editáveis. Corrija as células destacadas; instalações fora das tabelas permanecem pendentes.</p></section>${ui.gridDetails ? `<section class="panel card-section grid-detail"><div class="card-title"><h2>${esc(state.draft.number || "Circuito")} · ${esc(state.draft.description || "Sem nome")}</h2><button class="btn secondary small" data-grid-detail="0">Fechar detalhes</button></div><div class="grid-tabs">${LABELS.map((label, i) => `<button class="btn small ${ui.gridDetails === i + 1 ? "primary" : "secondary"}" data-grid-detail="${i + 1}">${label}</button>`).join("")}</div><div class="grid-detail-body">${[circuitView, () => connectionView() + equipmentView() + routeView(), installationView, groupingView, conditionsView, resultView][ui.gridDetails - 1]()}</div></section>` : ""}`;
}

export async function refreshGrid() {
  const version = ++gridRefresh;
  await prepare(state.circuits);
  if (version === gridRefresh) paintDiagnostics();
}

export function selectGridRow(row) {
  syncTechnical();
  const c = state.circuits[row];
  if (!c) return;
  state.draft = structuredClone(c);
  state.editingId = c.id;
  state.selected = c.id;
}

export function gridInput(target) {
  const row = +target.dataset.gridRow,
    col = +target.dataset.gridCol,
    c = state.circuits[row];
  try {
    const next = structuredClone(c);
    G.set(next, G.columns[ui.gridTab][col], target.value, false);
    syncTechnical();
    if (state.editingId !== next.id && ui.gridDetails) {
      ui.gridDetails = 0;
      document.querySelector(".grid-detail")?.remove();
    }
    state.circuits[row] = next;
    state.draft = structuredClone(next);
    state.editingId = next.id;
    state.selected = next.id;
    persist();
    target.setCustomValidity("");
    if (G.columns[ui.gridTab][col].key === "connection") {
      const phase = document.querySelector(
        `[data-grid-row="${row}"][data-grid-col="3"]`,
      );
      if (phase) phase.value = next.phaseSet;
    }
    refreshGrid();
  } catch (error) {
    target.setCustomValidity(error.message);
    toast(error.message);
  }
}

export function gridBulk() {
  const selected = state.circuits.filter((c) => ui.gridSelection.has(c.id));
  if (!selected.length)
    return toast("Selecione os circuitos que receberão as condições.");
  const keys = [
    "installation",
    "cableForm",
    "wall",
    "metal",
    "insulation",
    "temperature",
    "groupCount",
    "groupLayout",
    "maxDrop",
  ];
  const labels = {
    installation: "Instalação e método",
    cableForm: "Construção do cabo",
    wall: "Parede",
    metal: "Metal",
    insulation: "Isolação",
    temperature: "Temperatura",
    groupCount: "Quantidade agrupada",
    groupLayout: "Disposição do agrupamento",
    maxDrop: "Limite de queda",
  };
  modal(
    "Aplicar condições aos selecionados",
    `<p>Origem: <strong>${esc(state.draft.description || "Circuito atual")}</strong>. Destino: ${selected.length} circuito(s). Marque apenas os campos que deseja substituir.</p>${keys
      .map(
        (key) =>
          `<label class="radio-row"><input type="checkbox" data-bulk-key="${key}">${labels[key]}: ${esc(
            G.options(
              Object.values(G.columns)
                .flat()
                .find((c) => c.key === key) || {},
            ).find(([v]) => v === state.draft[key])?.[1] ||
              state.draft[key] ||
              "Pendente",
          )}</label>`,
      )
      .join("")}`,
    '<button class="btn secondary" data-close>Cancelar</button><button class="btn primary" data-grid-action="applyBulk">Aplicar campos marcados</button>',
  );
}

export async function gridClick(d) {
  if (d.gridTab) {
    ui.gridTab = d.gridTab;
    await requestRender();
    return;
  }
  if (d.gridOpen !== undefined) selectGridRow(+d.gridOpen);
  if (d.gridDetail !== undefined) {
    ui.gridDetails = +d.gridDetail;
    persist();
    await requestRender();
    document
      .querySelector(".grid-detail")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (d.diagnostic !== undefined) {
    const entry = calc(state.draft).diagnostics?.[+d.diagnostic];
    if (!entry) return;
    state.page = "wizard";
    if (state.mode === "technical") ui.gridDetails = entry.step;
    else state.step = entry.step;
    await requestRender();
    const selector =
      entry.scope === "load"
        ? `[data-load="${entry.field}"][data-index="${entry.index}"]`
        : `[data-field="${entry.field}"]`;
    const input = document.querySelector(selector);
    input?.closest("details")?.setAttribute("open", "");
    input?.focus();
    return;
  }
  switch (d.gridAction) {
    case "add":
      if (state.circuits.length >= 300)
        return toast("Limite de 300 circuitos.");
      syncTechnical();
      state.draft = M.newCircuit();
      state.editingId = state.draft.id;
      state.circuits.push(structuredClone(state.draft));
      persist();
      await requestRender();
      document
        .querySelector(
          `[data-grid-row="${state.circuits.length - 1}"][data-grid-col="1"]`,
        )
        ?.focus();
      break;
    case "duplicate": {
      const selected = state.circuits.filter((c) => ui.gridSelection.has(c.id));
      if (!selected.length)
        return toast("Selecione os circuitos para duplicar.");
      if (state.circuits.length + selected.length > 300)
        return toast("A duplicação ultrapassa 300 circuitos.");
      selected.forEach((c) => {
        const copy = structuredClone(c);
        copy.id = M.id();
        copy.number = "";
        copy.description = (copy.description + " — cópia").slice(0, 70);
        state.circuits.push(copy);
      });
      persist();
      requestRender();
      break;
    }
    case "bulk":
      gridBulk();
      break;
    case "applyBulk": {
      const keys = [
        ...document.querySelectorAll("[data-bulk-key]:checked"),
      ].map((el) => el.dataset.bulkKey);
      if (!keys.length) return toast("Marque ao menos um campo.");
      const source = structuredClone(state.draft);
      for (const c of state.circuits.filter((c) =>
        ui.gridSelection.has(c.id),
      )) {
        keys.forEach((key) => (c[key] = source[key]));
        if (keys.includes("installation")) {
          c.methodOverride = source.methodOverride;
          c.unknownInstallation = source.unknownInstallation;
        }
      }
      state.draft = structuredClone(
        state.circuits.find((c) => c.id === state.editingId) || state.draft,
      );
      persist();
      closeModal();
      requestRender();
      break;
    }
  }
}
