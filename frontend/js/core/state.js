/** Shared project state and UI configuration; no electrical calculations. */
export const M = window.VoltModel,
  DB = window.NBR1997,
  HELP = window.VoltHelp;
export const $ = (id) => document.getElementById(id);
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const fmt = (v, d = 2) =>
  v !== null && v !== undefined && v !== "" && Number.isFinite(+v)
    ? (+v).toLocaleString("pt-BR", { maximumFractionDigits: d })
    : "—";
export const STORAGE = "voltcalc_guiado_v3",
  OLD_STORAGE = "voltcalc_guiado_v2";
export const LABELS = [
  "Circuito",
  "Grandezas",
  "Instalação",
  "Agrupamento",
  "Condições",
  "Resultado",
];
export const TYPES = [
  ["lighting", "Iluminação", "Lâmpadas e luminárias", "☼"],
  ["sockets", "Tomadas", "Equipamentos conectados", "♧"],
  ["motor", "Motor elétrico", "Bombas e máquinas", "⚙"],
  ["shower", "Chuveiro", "Aquecimento elétrico", "♨"],
  ["transformer", "Transformador", "Alimentação de cargas", "▣"],
  ["other", "Outros", "Outros equipamentos", "⌁"],
];
export const INSTALLATIONS = [
  ["embedded", "Eletroduto embutido", "Tubulação dentro da parede"],
  ["conduit", "Eletroduto aparente", "Tubulação sobre a parede"],
  ["surface", "Sobre a parede", "Cabo fixado diretamente"],
  [
    "buried",
    "Cabos enterrados no solo",
    "Instalação subterrânea · não é aterramento",
  ],
  ["tray", "Bandeja ou leito", "Suporte aberto · cálculo pendente"],
  ["overhead", "Ao ar livre", "Requer enquadramento · cálculo pendente"],
];
export const CONNECTIONS = [
  ["fn", "Fase + neutro"],
  ["ff", "Fase + fase (duas fases)"],
  ["tri", "Trifásico equilibrado"],
];
export const state = {
  projectName: "Meu projeto",
  circuits: [],
  draft: M.newCircuit(),
  editingId: null,
  selected: null,
  supply: M.supplyDefaults(),
  reactance: 0.08,
  importInfo: null,
  page: "wizard",
  mode: "guided",
  step: 1,
};
export const PREVIOUS = "voltcalc_before_csv_v3";
export const resultKey = (c) =>
  JSON.stringify([c, state.reactance, state.supply]);
export const viewKey = () =>
  JSON.stringify([
    state.draft,
    state.circuits,
    state.supply,
    state.reactance,
    state.page,
    state.mode,
    state.step,
  ]);
export const G = window.VoltGrid;
export const ui = {
  tableShown: "31",
  serviceError: "",
  boardCache: null,
  boardKey: "",
  csvPreview: null,
  gridTab: "loads",
  gridDetails: 0,
  gridSelection: new Set(),
  render: null,
};
export function syncTechnical() {
  if (state.mode !== "technical" || !state.editingId) return;
  const i = state.circuits.findIndex((c) => c.id === state.editingId);
  if (i >= 0) state.circuits[i] = structuredClone(state.draft);
}
export function requestRender() {
  return ui.render();
}
