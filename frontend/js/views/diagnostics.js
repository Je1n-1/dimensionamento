import { calc } from "../core/api.js";
import { G, LABELS, esc, state, ui } from "../core/state.js";
import { gridResult } from "./results.js";

export function paintDiagnostics() {
  const r = calc(state.draft),
    diagnostics = r.diagnostics || [];
  document.querySelectorAll(".field-diagnostic").forEach((el) => el.remove());
  document
    .querySelectorAll('[aria-invalid="true"]')
    .forEach((el) => el.removeAttribute("aria-invalid"));
  for (const el of document.querySelectorAll("[data-field],[data-load]")) {
    const scope = el.dataset.load ? "load" : "field",
      key = el.dataset.load || el.dataset.field;
    const entries = diagnostics.filter(
      (d) =>
        !(d.blocksSelection && !d.blocking) &&
        d.scope === scope &&
        (d.field === key || (key === "voltageMode" && d.field === "voltage")) &&
        (scope !== "load" || d.index === +el.dataset.index),
    );
    if (entries.length) {
      el.setAttribute("aria-invalid", "true");
      const msg = document.createElement("small");
      msg.className = "field-diagnostic";
      msg.id = el.id + "-diagnostic";
      msg.textContent = [...new Set(entries.map((d) => d.message))].join(" ");
      el.setAttribute("aria-describedby", msg.id);
      el.after(msg);
    } else if (el.getAttribute("aria-describedby")?.endsWith("-diagnostic"))
      el.removeAttribute("aria-describedby");
  }
  document
    .querySelectorAll("[data-diagnostics]")
    .forEach(
      (el) =>
        (el.innerHTML = diagnostics.length
          ? `<details class="details" ${diagnostics.some((d) => d.blocksSelection) ? "open" : ""}><summary>${diagnostics.length} pendência(s) ou verificações · ${state.draft.description ? esc(state.draft.description) : "circuito atual"}</summary><ul class="diagnostic-list">${diagnostics.map((d, i) => `<li><button data-diagnostic="${i}">${LABELS[d.step - 1]} — ${esc(d.message)}</button></li>`).join("")}</ul></details>`
          : ""),
    );
  if (state.mode !== "technical") return;
  state.circuits.forEach((c, i) => {
    const result = calc(c),
      el = document.querySelector(`[data-grid-result="${i}"]`);
    if (el) el.innerHTML = gridResult(c);
    G.columns[ui.gridTab].forEach((column, j) => {
      const cell = document.querySelector(
          `[data-grid-row="${i}"][data-grid-col="${j}"]`,
        ),
        msg = document.querySelector(`[data-grid-error="${i}-${j}"]`);
      if (!cell || !msg) return;
      if (cell !== document.activeElement)
        cell.value = (column.load ? c.loads[0] : c)?.[column.key] ?? "";
      cell
        .closest("tr")
        .classList.toggle("grid-active", state.editingId === c.id);
      const entries = (result.diagnostics || []).filter(
        (d) =>
          d.field === column.key &&
          d.scope === (column.load ? "load" : "field") &&
          (!column.load || d.index === 0),
      );
      msg.textContent = entries.length ? "Confira o campo" : "";
      cell.title = entries.map((d) => d.message).join(" ");
      if (entries.length) cell.setAttribute("aria-invalid", "true");
    });
  });
}
