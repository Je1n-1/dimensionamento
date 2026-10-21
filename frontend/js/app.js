import { calc, prepare, prepareBoard } from "./core/api.js";
import { closeModal, toast } from "./core/dom.js";
import {
  $,
  CONNECTIONS,
  G,
  M,
  esc,
  fmt,
  resultKey,
  state,
  syncTechnical,
  ui,
  viewKey,
} from "./core/state.js";
import { load, persist } from "./core/storage.js";
import {
  changeCircuit,
  editCircuit,
  goStep,
  saveCircuit,
} from "./features/circuits.js";
import { settings, showHelp } from "./features/dialogs.js";
import {
  applyCsv,
  csvDialog,
  exportJson,
  importJson,
  previewCsv,
  restorePrevious,
} from "./features/files.js";
import {
  enterTechnical,
  gridClick,
  gridInput,
  refreshGrid,
  selectGridRow,
  technicalView,
} from "./features/grid.js";
import { report } from "./features/report.js";
import { notice, stat } from "./views/components.js";
import { paintDiagnostics } from "./views/diagnostics.js";
import { routePreview } from "./views/forms.js";
import {
  loadsView,
  overviewView,
  referenceView,
  wizardView,
} from "./views/pages.js";
import {
  correctionCard,
  resultView,
  selectionReadiness,
  summaryView,
  traceView,
} from "./views/results.js";

let renderVersion = 0,
  summaryVersion = 0;

export function paintLive() {
  paintDiagnostics();
  const live = calc(state.draft);
  document
    .querySelectorAll("[data-live-temperature]")
    .forEach((el) => (el.innerHTML = correctionCard("temperature", live)));
  document
    .querySelectorAll("[data-live-group-explanation]")
    .forEach(
      (el) =>
        (el.innerHTML = live.corrections
          ? `<div class="${live.fca == null ? "notice warn" : "explain"}">${esc(live.corrections.grouping.message)}</div>`
          : ""),
    );
  document
    .querySelectorAll("[data-live-route]")
    .forEach((el) => (el.innerHTML = routePreview()));
  document
    .querySelectorAll("[data-live-readiness]")
    .forEach((el) => (el.innerHTML = selectionReadiness(live, true)));
  const raw = calc(state.draft),
    r = {
      ...raw,
      totals:
        raw.loadResults?.length === state.draft.loads.length ? raw.totals : {},
    };
  document
    .querySelectorAll("[data-live-subtotals]")
    .forEach(
      (el) =>
        (el.innerHTML = (r.loadResults || [])
          .map(
            (l) =>
              `<div class="summary-item"><span>Grupo ${l.index + 1} · ${esc(l.description)}</span><strong>${fmt(l.p)} W · ${fmt(l.s)} VA</strong></div>`,
          )
          .join("")),
    );
  $("summaryPanel").innerHTML = summaryView();
  document
    .querySelectorAll("[data-live-totals]")
    .forEach(
      (el) =>
        (el.innerHTML =
          stat("Equipamentos", fmt(r.totals.quantity, 0)) +
          stat("Potência ativa", fmt(r.totals.p) + " W") +
          stat("Corrente calculada", fmt(r.ib) + " A")),
    );
  document
    .querySelectorAll("[data-live-voltage]")
    .forEach((el) => (el.textContent = fmt(r.voltage) + " V"));
  document
    .querySelectorAll("[data-live-loaded]")
    .forEach((el) => (el.textContent = fmt(r.loaded, 0) + " condutores"));
  document
    .querySelectorAll("[data-live-group]")
    .forEach(
      (el) =>
        (el.textContent =
          r.fca == null ? "Não disponível para esta condição" : fmt(r.fca)),
    );
  document
    .querySelectorAll("[data-live-link]")
    .forEach(
      (el) =>
        (el.textContent = `Este circuito: ${CONNECTIONS.find((x) => x[0] === state.draft.connection)?.[1] || "ligação a confirmar"}, ${fmt(r.voltage)} V; ${fmt(r.loaded, 0)} condutores carregados. ${r.phase === "tri" ? "A corrente exibida é por fase." : "A alimentação geral pode ter mais fases que este circuito utiliza."}`),
    );
  const status = $("connectionStatus");
  status.hidden = !ui.serviceError;
  status.innerHTML = ui.serviceError
    ? `${esc(ui.serviceError)} <button class="btn small" data-action="retry">Tentar novamente</button>`
    : "";
  document
    .querySelectorAll("[data-live-errors]")
    .forEach(
      (el) =>
        (el.innerHTML = r.issues
          .map((text) => notice(esc(text), "bad"))
          .join("")),
    );
}

export async function refreshSummary() {
  paintLive();
  const version = ++summaryVersion,
    key = resultKey(state.draft);
  await prepare([state.draft]);
  if (version === summaryVersion && key === resultKey(state.draft)) {
    paintLive();
    if (state.page === "protection" || state.page === "voltage") {
      const area = $("dependentResult");
      if (area)
        area.innerHTML =
          state.page === "voltage"
            ? traceView(calc(state.draft))
            : resultView();
    }
  }
}

export async function render() {
  const version = ++renderVersion,
    snapshot = viewKey();
  await prepare(
    state.page === "loads" || state.mode === "technical"
      ? [state.draft, ...state.circuits]
      : [state.draft],
  );
  if (state.page === "loads") await prepareBoard();
  if (version !== renderVersion || snapshot !== viewKey()) return;
  document
    .querySelector(".page-layout")
    .classList.toggle(
      "board-layout",
      state.page === "loads" || state.mode === "technical",
    );
  $("summaryPanel").hidden =
    state.page === "loads" || state.mode === "technical";
  document.querySelector(".mode-toggle").hidden = state.page === "loads";
  $("projectName").value = state.projectName;
  $("guidedMode").classList.toggle("active", state.mode === "guided");
  $("technicalMode").classList.toggle("active", state.mode === "technical");
  $("guidedMode").setAttribute("aria-pressed", state.mode === "guided");
  $("technicalMode").setAttribute("aria-pressed", state.mode === "technical");
  $("pageTitle").textContent =
    state.page === "loads"
      ? "Quadro de cargas"
      : state.page === "wizard"
        ? "Dimensionamento de circuitos"
        : "Análise do circuito";
  $("pageSubtitle").textContent =
    "Cadastre as cargas, entenda os critérios e confira cada resultado.";
  document
    .querySelectorAll("[data-page]")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.page === state.page),
    );
  $("mainPanel").innerHTML =
    state.page === "wizard"
      ? state.mode === "guided"
        ? wizardView()
        : technicalView()
      : state.page === "loads"
        ? loadsView()
        : state.page === "reference"
          ? referenceView()
          : overviewView();
  if (
    state.page === "wizard" &&
    state.mode === "technical" &&
    ui.gridDetails !== 6
  )
    $("mainPanel").insertAdjacentHTML(
      "beforeend",
      '<div data-diagnostics aria-live="polite"></div>',
    );
  paintLive();
}

export function clickHandler(ev) {
  const btn = ev.target.closest("button");
  if (!btn) return;
  const d = btn.dataset;
  if (
    d.gridTab ||
    d.gridAction ||
    d.gridDetail !== undefined ||
    d.gridOpen !== undefined ||
    d.diagnostic !== undefined
  ) {
    gridClick(d);
    return;
  }
  if (d.reviewStep) {
    state.page = "wizard";
    if (state.mode === "technical") ui.gridDetails = +d.reviewStep;
    else state.step = +d.reviewStep;
    render();
    return;
  }
  if (d.help) {
    ev.preventDefault();
    showHelp(d.help);
    return;
  }
  if (d.close !== undefined) {
    closeModal();
    return;
  }
  if (d.step) {
    goStep(+d.step);
    return;
  }
  if (d.choose) {
    changeCircuit(d.choose, d.value);
    render();
    return;
  }
  if (d.page) {
    state.page = d.page;
    render();
    return;
  }
  if (d.table) {
    ui.tableShown = d.table;
    state.page = "reference";
    render();
    return;
  }
  if (d.edit) {
    editCircuit(d.edit);
    return;
  }
  if (d.duplicate) {
    if (state.circuits.length >= 300) return toast("Limite atingido.");
    const c = M.cleanCircuit(state.circuits.find((c) => c.id === d.duplicate));
    c.id = M.id();
    c.number = "";
    c.description = (c.description + " — cópia").slice(0, 70);
    state.circuits.push(c);
    persist();
    render();
    return;
  }
  if (d.delete) {
    const c = state.circuits.find((c) => c.id === d.delete);
    if (c && confirm(`Excluir "${c.description}"?`)) {
      state.circuits = state.circuits.filter((x) => x.id !== c.id);
      if (state.editingId === c.id) {
        state.editingId = null;
        state.draft = M.newCircuit();
      }
      persist();
      render();
    }
    return;
  }
  if (d.removeLoad !== undefined) {
    state.draft.loads.splice(+d.removeLoad, 1);
    persist();
    render();
    return;
  }
  const action = d.action || btn.id;
  switch (action) {
    case "csvDialog":
      csvDialog();
      break;
    case "example":
      previewCsv();
      break;
    case "applyCsv":
      applyCsv();
      break;
    case "restorePrevious":
      restorePrevious();
      break;
    case "next":
      goStep(Math.min(6, state.step + 1));
      break;
    case "back":
      goStep(Math.max(1, state.step - 1));
      break;
    case "guidedMode":
      syncTechnical();
      state.mode = "guided";
      state.page = "wizard";
      render();
      break;
    case "technicalMode":
      enterTechnical();
      break;
    case "addLoad":
      if (state.draft.loads.length >= 100)
        return toast("Limite de 100 grupos por circuito.");
      state.draft.loads.push(M.newLoad());
      persist();
      render();
      break;
    case "new":
      if (state.mode === "technical") {
        state.page = "wizard";
        gridClick({ gridAction: "add" });
        break;
      }
      state.draft = M.newCircuit();
      state.editingId = null;
      state.step = 1;
      state.page = "wizard";
      persist();
      render();
      break;
    case "saveDraft":
      if (persist())
        toast(
          "Rascunho salvo neste navegador, incluindo os dados ainda pendentes.",
        );
      break;
    case "saveCircuit":
      saveCircuit();
      break;
    case "seeResult":
      state.mode = "guided";
      state.page = "wizard";
      state.step = 6;
      render();
      break;
    case "saveBtn":
      state.projectName = $("projectName").value || "Meu projeto";
      if (persist()) toast("Projeto salvo neste navegador.");
      break;
    case "settingsBtn":
    case "sidebarSettings":
      settings();
      break;
    case "printBtn":
    case "sidebarReport":
      report();
      break;
    case "export":
      exportJson();
      break;
    case "import":
      $("importFile").click();
      break;
    case "saveSettings": {
      const value = $("reactanceInput").value;
      if (value === "" || !Number.isFinite(+value) || +value < 0 || +value > 2)
        return toast("Informe reatância entre 0 e 2 Ω/km.");
      state.reactance = +value;
      persist();
      closeModal();
      render();
      break;
    }
    case "retry":
      render();
      break;
  }
}

export function updateInput(ev) {
  const target = ev.target,
    d = target.dataset,
    value = target.type === "checkbox" ? target.checked : target.value;
  if (d.gridRow !== undefined) {
    gridInput(target);
    return;
  }
  if (d.gridSelect !== undefined) {
    if (target.checked) ui.gridSelection.add(d.gridSelect);
    else ui.gridSelection.delete(d.gridSelect);
    return;
  }
  if (d.gridAll !== undefined) {
    ui.gridSelection = target.checked
      ? new Set(state.circuits.map((c) => c.id))
      : new Set();
    render();
    return;
  }
  if (d.bulkKey !== undefined) return;
  if (target.id === "projectName") {
    state.projectName = value.slice(0, 60);
    persist();
    return;
  }
  if (d.field) changeCircuit(d.field, value);
  else if (d.supply) {
    state.supply[d.supply] = value;
    persist();
  } else if (d.load) {
    const load = state.draft.loads[+d.index];
    if (load && Object.hasOwn(load, d.load)) {
      load[d.load] = value;
      document.querySelectorAll("[data-load]").forEach((el) => {
        if (
          el !== target &&
          el.dataset.load === d.load &&
          el.dataset.index === d.index
        )
          el.value = value;
      });
      if (d.load === "description") {
        const label = document.querySelector(
          'label[for="load-' + d.index + '-distance-route"]',
        );
        if (label)
          label.textContent = +d.index + 1 + ". " + value + " · distância (m)";
      }
      persist();
    }
  } else return;
  if (target.tagName === "SELECT" || target.type === "checkbox") render();
  else {
    refreshSummary();
    if (state.mode === "technical") refreshGrid();
  }
}

document.addEventListener("click", clickHandler);
document.addEventListener("input", (ev) => {
  if (ev.target.tagName !== "SELECT" && ev.target.type !== "checkbox")
    updateInput(ev);
});
document.addEventListener("change", (ev) => {
  if (ev.target.id === "csvFile") previewCsv(ev.target.files[0]);
  else if (ev.target.id === "importFile") importJson(ev.target.files[0]);
  else if (ev.target.tagName === "SELECT" || ev.target.type === "checkbox")
    updateInput(ev);
});
document.addEventListener("keydown", (ev) => {
  if ($("modalRoot").hidden) return;
  if (ev.key === "Escape") closeModal();
  if (ev.key === "Tab") {
    const nodes = [
      ...$("modalRoot").querySelectorAll("button,input:not([hidden]),select,a"),
    ].filter((el) => !el.disabled);
    if (ev.shiftKey && document.activeElement === nodes[0]) {
      ev.preventDefault();
      nodes.at(-1)?.focus();
    } else if (!ev.shiftKey && document.activeElement === nodes.at(-1)) {
      ev.preventDefault();
      nodes[0]?.focus();
    }
  }
});
$("modalRoot").addEventListener("click", (ev) => {
  if (ev.target === $("modalRoot")) closeModal();
});
document.addEventListener("paste", async (ev) => {
  const target = ev.target;
  if (target.dataset.gridRow === undefined) return;
  ev.preventDefault();
  try {
    syncTechnical();
    const next = G.paste(
      state.circuits,
      ui.gridTab,
      +target.dataset.gridRow,
      +target.dataset.gridCol,
      ev.clipboardData.getData("text/plain"),
    );
    state.circuits = next;
    state.draft = structuredClone(next[+target.dataset.gridRow]);
    state.editingId = state.draft.id;
    persist();
    await render();
    toast("Células coladas. Confira as pendências e os resultados.");
  } catch (error) {
    toast("Colagem não aplicada: " + error.message);
  }
});
document.addEventListener("keydown", async (ev) => {
  if (ev.key !== "Enter" || ev.target.dataset.gridRow === undefined) return;
  ev.preventDefault();
  const row = +ev.target.dataset.gridRow,
    col = ev.target.dataset.gridCol;
  const next = [...document.querySelectorAll(`[data-grid-col="${col}"]`)].find(
    (el) => +el.dataset.gridRow > row,
  );
  next?.focus();
});
document.addEventListener("focusin", (ev) => {
  const row = ev.target.dataset.gridRow;
  if (row === undefined || state.circuits[+row]?.id === state.editingId) return;
  selectGridRow(+row);
  if (ui.gridDetails) {
    ui.gridDetails = 0;
    document.querySelector(".grid-detail")?.remove();
  }
  persist();
  paintDiagnostics();
});
ui.render = render;
load();
render();
