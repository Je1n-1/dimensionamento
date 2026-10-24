import { calc, prepare } from "../core/api.js";
import { toast, modal, closeModal } from "../core/dom.js";
import { esc, M, requestRender, resultKey, state, ui } from "../core/state.js";
import { persist } from "../core/storage.js";

export function stepError(step) {
  const c = state.draft;
  const valid = (v) => v !== "" && v !== null && Number.isFinite(+v);
  if (step === 1 && !c.description.trim()) return "Dê um nome ao circuito.";
  if (step === 2) {
    if (
      !c.loads.every(
        (l) =>
          l.description.trim() &&
          valid(l.quantity) &&
          +l.quantity >= 1 &&
          Number.isInteger(+l.quantity) &&
          valid(l.power) &&
          +l.power > 0 &&
          valid(l.powerFactor) &&
          +l.powerFactor > 0 &&
          +l.powerFactor <= 1 &&
          (!["CV", "HP"].includes(l.unit) ||
            (valid(l.efficiency) && +l.efficiency > 0 && +l.efficiency <= 1)),
      )
    )
      return "Confira quantidade, potência, fator de potência e rendimento dos grupos.";
  }
  if (
    step === 4 &&
    (!valid(c.groupCount) ||
      !Number.isInteger(+c.groupCount) ||
      +c.groupCount < 1 ||
      +c.groupCount > 20)
  )
    return "Informe de 1 a 20 circuitos agrupados.";
  if (
    step === 5 &&
    (!c.loads.every((l) => valid(l.distance) && +l.distance >= 0) ||
      !valid(c.maxDrop) ||
      +c.maxDrop <= 0)
  )
    return "Confira as distâncias e o limite de queda.";
  return "";
}

export async function goStep(next) {
  await prepare([state.draft]);
  if (next > state.step) {
    for (let s = state.step; s < next; s++) {
      const entry = (calc(state.draft).diagnostics || []).find(
        (d) => d.step === s && d.blocking,
      );
      const error = entry?.message || stepError(s);
      if (error) {
        state.step = s;
        await requestRender();
        toast(error);
        return;
      }
    }
  }
  state.step = next;
  persist();
  requestRender();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function changeCircuit(key, value) {
  const c = state.draft;
  if (!Object.hasOwn(c, key)) return;
  c[key] = value;
  if (key === "connection") {
    c.legacyLoaded = null;
    c.phaseSet = value === "tri" ? "ABC" : value === "ff" ? "AB" : "A";
    if (value === "legacy") c.voltageMode = "manual";
  }
  if (key === "installation") {
    c.methodOverride = "";
    c.unknownInstallation = false;
  }
  if (key === "methodOverride" && value) c.unknownInstallation = false;
  persist();
}

export async function saveCircuit() {
  if (!state.draft.description.trim()) return toast("Dê um nome ao circuito.");
  for (let s = 1; s <= 5 && !state.draft.source; s++) {
    const error = stepError(s);
    if (error) {
      state.mode = "guided";
      state.page = "wizard";
      state.step = s;
      requestRender();
      toast(error);
      return;
    }
  }
  const key = resultKey(state.draft);
  if (!(await prepare([state.draft]))) {
    toast(ui.serviceError);
    return;
  }
  if (key !== resultKey(state.draft)) {
    toast("Os dados mudaram. Salve novamente.");
    return;
  }
  if (calc(state.draft).issues.length && !state.draft.source) {
    state.page = "wizard";
    state.mode = "guided";
    state.step = 6;
    requestRender();
    toast("Corrija os campos inválidos apresentados no resultado.");
    return;
  }
  const c = M.cleanCircuit(state.draft);
  if (state.editingId) {
    const index = state.circuits.findIndex((x) => x.id === state.editingId);
    if (index < 0) {
      toast("Circuito original não encontrado.");
      return;
    }
    c.id = state.editingId;
    state.circuits[index] = c;
  } else {
    if (state.circuits.length >= 300) {
      toast("Limite de 300 circuitos.");
      return;
    }
    c.id = M.id();
    state.circuits.push(c);
  }
  state.editingId = c.id;
  state.selected = c.id;
  state.draft = M.cleanCircuit(c);
  if (persist()) toast("Circuito salvo no projeto.");
  state.page = "loads";
  requestRender();
}

export function editCircuit(id) {
  const c = state.circuits.find((c) => c.id === id);
  if (!c) return;
  state.draft = M.cleanCircuit(c);
  state.editingId = id;
  state.selected = id;
  state.page = "wizard";
  state.step = 1;
  persist();
  requestRender();
}

let pendingDeletion = null;
export function requestDeleteCircuit(id) {
  const c = state.circuits.find((c) => c.id === id);
  if (!c) return;
  pendingDeletion = id;
  modal(
    "Excluir circuito?",
    /* HTML */ `<p>
        Excluir <strong>${esc(c.description || "Circuito sem nome")}</strong> do
        projeto?
      </p>
      <p>
        Os demais circuitos serão mantidos. Esta ação remove o circuito do
        projeto salvo neste navegador.
      </p>`,
    /* HTML */ `<button class="btn secondary" data-close>Cancelar</button
      ><button class="btn danger" data-confirm-delete="${esc(id)}">
        Excluir circuito
      </button>`,
  );
}
export function confirmDeleteCircuit(id) {
  if (id !== pendingDeletion || document.getElementById("modalRoot").hidden)
    return;
  const c = state.circuits.find((c) => c.id === id);
  if (!c) return;
  pendingDeletion = null;
  state.circuits = state.circuits.filter((c) => c.id !== id);
  ui.gridSelection.delete(id);
  if (state.selected === id) state.selected = null;
  if (state.editingId === id) {
    state.editingId = null;
    state.draft = M.newCircuit();
  }
  closeModal();
  persist();
  requestRender();
  toast("Circuito excluído do projeto.");
}
