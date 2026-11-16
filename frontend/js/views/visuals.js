import { esc, fmt, state, ui } from "../core/state.js";
import { calc } from "../core/api.js";

const paths = {
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
  bolt: '<path d="m13 2-8 12h6l-1 8 9-13h-7z"/>',
  report: '<path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6"/>',
  board: '<path d="M5 6H3v15h18V6h-2M9 3h6v13H9zM6 9v8M18 9v8"/>',
  plug: '<path d="M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0zm6 10v4"/>',
  light: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0l-1 3H9z"/>',
  shower:
    '<path d="M5 21V8a5 5 0 0 1 10 0M11 11h8l-2-3h-4zM12 15v1m5-1v1m-3 3v1m5-1v1m-8-1v1"/>',
  air: '<rect x="3" y="4" width="18" height="10" rx="2"/><path d="M6 10h12M7 17v3m5-3v5m5-5v3"/>',
  washer:
    '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 7h14M8 4h1m3 0h1"/><circle cx="12" cy="14" r="4"/>',
  kitchen:
    '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M5 8h14M8 5h1m3 0h1m3 0h1M8 11h8v7H8z"/>',
  sofa: '<path d="M5 10V6h14v4M3 10h4v5h10v-5h4v9H3zm2 9v3m14-3v3"/>',
  bed: '<path d="M3 20V7m18 13V7M3 16h18M3 11h18v5M6 7h5v4H6zm7 0h5v4h-5z"/>',
  monitor:
    '<rect x="3" y="3" width="18" height="13" rx="1"/><path d="M12 16v5m-5 0h10"/>',
  tree: '<path d="M12 17v5M8 17a5 5 0 0 1-2-9 6 6 0 0 1 12 0 5 5 0 0 1-2 9z"/>',
  car: '<path d="m4 10 2-6h12l2 6M3 10h18v9H3zm3 4h2m8 0h2M5 19v3m14-3v3"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM9 12l2 2 4-5"/>',
  chart: '<path d="M3 3v18h18M6 15l5-5 4 3 6-8m-5 0h5v5"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  scale: '<path d="M12 3v18m-6 0h12M4 7h16M5 7l-4 8h8zm14 0-4 8h8z"/>',
  settings:
    '<path d="m9 3 1-2h4l1 2 3 2h3l2 4-2 2v3l2 2-2 4h-3l-3 2h-6l-3-2H3l-2-4 2-2v-3L1 9l2-4h3z"/><circle cx="12" cy="12" r="3"/>',
  save: '<path d="M4 3h14l3 3v15H3V3zm3 0v6h9V3M7 21v-8h10v8"/>',
  export: '<path d="M7 4H4v17h16V4h-3M12 16V2m-4 4 4-4 4 4"/>',
  edit: '<path d="m14 5 5 5M3 21l5-1L21 7l-5-5L3 15z"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="m12 3 10 18H2zm0 5v6m0 3v1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  book: '<path d="M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2z"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  cable: '<path d="m4 19 8-8m-5 6 3 3M9 9l7-7 6 6-7 7zm3-3 6 6"/>',
};
export function icon(name, cls = "") {
  return `<svg class="vc-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.plug}</svg>`;
}
export const equipmentIcon = (kind) =>
  ({
    lighting: "light",
    sockets: "plug",
    shower: "shower",
    ac: "air",
    microwave: "kitchen",
    washer: "washer",
    motor: "settings",
    transformer: "layers",
    other: "plug",
  })[kind] || "plug";
export const roomIcon = (room) =>
  /quarto/i.test(room)
    ? "bed"
    : /banheiro/i.test(room)
      ? "shower"
      : /cozinha|jantar/i.test(room)
        ? "kitchen"
        : /serviço/i.test(room)
          ? "washer"
          : /escritório/i.test(room)
            ? "monitor"
            : /garagem/i.test(room)
              ? "car"
              : /externa|varanda/i.test(room)
                ? "tree"
                : "sofa";
export function metric(
  label,
  value,
  description,
  name = "bolt",
  color = "blue",
) {
  return `<article class="metric-card"><span class="metric-icon ${color}">${icon(name)}</span><div><span>${label}</span><strong>${value}</strong><small>${description}</small></div></article>`;
}
export function cardTitle(number, title, subtitle = "") {
  return `<div class="design-card-title"><span class="number-badge">${number}</span><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div></div>`;
}
export function phaseBadge(phases) {
  return `<span class="phase-label">${[...String(phases || "")].map((p) => `<i class="phase-dot phase-${esc(p)}">${esc({ A: "R", B: "S", C: "T" }[p] || p)}</i>`).join("")}</span>`;
}
export function phaseSummary() {
  const p = ui.boardCache;
  if (!p?.complete)
    return '<p class="empty-state">Distribuição disponível após conferir as grandezas e fases dos circuitos.</p>';
  return `<div class="phase-summary">${p.phases.map((ph) => `<article>${phaseBadge(ph.phase)}<b>Fase ${ph.label}</b><strong>${fmt(ph.current)} A</strong><small>${ph.count} circuitos · ${fmt(ph.p)} W</small><div class="phase-track"><span class="phase-fill phase-${ph.phase}" style="width:${p.maxCurrent ? Math.max(2, (ph.current / p.maxCurrent) * 100) : 0}%"></span></div></article>`).join("")}</div>`;
}
export function circuitMetrics() {
  const p = ui.boardCache;
  const pending = state.circuits.filter(
    (c) => !calc(c).chosen || calc(c).protection.failed,
  ).length;
  return `<div class="metric-grid">${metric("Potência instalada (total)", fmt(p?.p) + " W", `em ${state.circuits.length} circuitos`, "bolt")}${metric("Maior corrente por fase", fmt(p?.maxCurrent) + " A", p?.complete ? "Fase " + p.maxPhases.join(" / ") : "Confira as grandezas", "chart", "green")}${metric("Circuitos a revisar", pending, "Com seleção pendente ou incompatível", "warning", "amber")}${metric("Diferença entre fases", fmt(p?.spread) + " A", "Indicador informativo, sem aprovação normativa", "scale", "purple")}</div>`;
}
export function hydrateShell() {
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
