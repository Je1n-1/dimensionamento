import { closeModal, modal, toast } from "../core/dom.js";
import {
  $,
  M,
  PREVIOUS,
  STORAGE,
  esc,
  fmt,
  requestRender,
  state,
  ui,
  syncTechnical,
} from "../core/state.js";
import { persist } from "../core/storage.js";
import { notice } from "../views/components.js";

export function csvDialog() {
  ui.csvPreview = null;
  modal(
    "Importar quadro de cargas CSV",
    `<p>Use um CSV separado por ponto e vírgula, com as colunas do exemplo. A linha TOTAL deve informar a rede trifásica 127/220 ou 220/380 V.</p><label for="csvFile">Selecionar arquivo CSV</label><input id="csvFile" type="file" accept=".csv,text/csv"><p class="hint">W e VA serão preservados e usados para obter o FP. Distâncias e condições de instalação ficarão pendentes. Arquivos Excel .xlsx ainda não são importados diretamente.</p>`,
  );
}

export async function previewCsv(file = null) {
  try {
    if (file && file.size > 2e6) throw Error("Limite de 2 MB.");
    let response;
    if (file) {
      const bytes = await file.arrayBuffer();
      let text = new TextDecoder("utf-8").decode(bytes);
      if (text.includes("\uFFFD"))
        text = new TextDecoder("windows-1252").decode(bytes);
      response = await fetch("/api/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: file.name }),
        signal: AbortSignal.timeout(15000),
      });
    } else
      response = await fetch("/api/example", {
        signal: AbortSignal.timeout(15000),
      });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Arquivo recusado.");
    ui.csvPreview = M.readProject(data.project, true);
    modal(
      "Prévia do quadro importado",
      `<p><strong>${ui.csvPreview.circuits.length} circuitos · rede ${esc(ui.csvPreview.supply.network)} V · ${fmt(data.panel.p)} W</strong></p><p>${data.panel.phases.map((p) => `Fase ${p.label}: ${fmt(p.current)} A`).join(" · ")}</p><ul>${ui.csvPreview.circuits.map((c) => `<li>${esc(c.number)} · ${esc(c.description)}</li>`).join("")}</ul>${data.warnings.map((w) => notice(esc(w), "warn")).join("")}<p>As correntes serão recalculadas. Os disjuntores são valores informados, e o dimensionamento ficará pendente até você preencher os dados ausentes.</p><p>Ao abrir, o projeto atual será guardado neste navegador para restauração. Exporte um backup JSON se quiser manter uma cópia permanente.</p>`,
      `<button class="btn secondary" data-close>Cancelar</button><button class="btn primary" data-action="applyCsv">Abrir como novo projeto</button>`,
    );
  } catch (error) {
    ui.csvPreview = null;
    toast("Importação recusada: " + error.message);
  }
}

export function applyCsv() {
  if (!ui.csvPreview) return;
  try {
    localStorage.setItem(PREVIOUS, JSON.stringify(M.projectData(state)));
    localStorage.setItem(STORAGE, JSON.stringify(M.projectData(ui.csvPreview)));
  } catch {
    toast(
      "Não foi possível preservar o projeto anterior. Exporte um backup e libere espaço no navegador.",
    );
    return;
  }
  Object.assign(state, ui.csvPreview);
  ui.csvPreview = null;
  ui.boardCache = null;
  closeModal();
  state.page = "loads";
  requestRender();
  toast("Quadro importado. Complete os dados pendentes em Editar.");
}

export function restorePrevious() {
  try {
    const raw = localStorage.getItem(PREVIOUS);
    if (!raw) return;
    const restored = M.readProject(JSON.parse(raw), true);
    const current = JSON.stringify(M.projectData(state));
    localStorage.setItem(STORAGE, JSON.stringify(M.projectData(restored)));
    localStorage.setItem(PREVIOUS, current);
    Object.assign(state, restored);
    ui.boardCache = null;
    state.page = "loads";
    requestRender();
    toast(
      "Projeto anterior restaurado. O outro quadro permanece disponível para restauração.",
    );
  } catch (error) {
    toast("Não foi possível restaurar: " + error.message);
  }
}

export function exportJson() {
  syncTechnical();
  const raw = JSON.stringify(M.projectData(state), null, 2),
    href = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = href;
  a.download =
    "VoltCalc_" +
    state.projectName.replace(/[^a-z0-9_-]/gi, "_").slice(0, 45) +
    ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  toast("Backup exportado.");
}

export async function importJson(file) {
  if (!file) return;
  try {
    if (file.size > 4e6) throw Error("Limite de 4 MB.");
    const data = M.readProject(JSON.parse(await file.text()), true);
    if (
      !confirm(
        `Importar o projeto com ${data.circuits.length} circuitos e substituir o atual?`,
      )
    )
      return;
    Object.assign(state, data);
    persist();
    closeModal();
    state.page = "loads";
    requestRender();
    toast("Projeto importado.");
  } catch (error) {
    toast("Importação recusada: " + error.message);
  }
}
