import {
  CONNECTIONS,
  INSTALLATIONS,
  LABELS,
  TYPES,
  esc,
  fmt,
  state,
} from "../core/state.js";
import { field, helpButton, notice } from "./components.js";

export function intro(step) {
  const titles = [
    "",
    "Qual circuito você vai dimensionar?",
    "Quais equipamentos serão alimentados?",
    "Como os cabos serão instalados?",
    "Quantos circuitos compartilham o percurso?",
    "Quais são as condições do circuito?",
    "Entenda o dimensionamento",
  ];
  return `<span class="eyebrow">Passo ${step} de 6</span><h2>${titles[step]} ${helpButton(["", "circuit", "power", "installation", "groupCount", "distance", "result"][step])}</h2>`;
}

export function stepper() {
  return `<ol class="stepper">${LABELS.map((text, i) => `<li class="${state.step === i + 1 ? "current" : state.step > i + 1 ? "done" : ""}"><button data-step="${i + 1}" aria-current="${state.step === i + 1 ? "step" : "false"}" aria-label="Etapa ${i + 1}: ${text}"><span class="step-dot">${i + 1}</span><span class="step-name">${text}</span></button></li>`).join("")}</ol>`;
}

export function circuitView() {
  return `<p class="step-description">Escolha o uso principal. Na próxima etapa, adicione equipamentos com potências e posições diferentes.</p><div class="choice-grid">${TYPES.map(([key, name, desc, icon]) => `<button data-choose="type" data-value="${key}" class="choice-btn ${state.draft.type === key ? "selected" : ""}" aria-pressed="${state.draft.type === key}"><span class="choice-icon">${icon}</span><strong>${name}</strong><small>${desc}</small></button>`).join("")}</div><div class="fieldset">${field("Identificação do circuito", "number", { text: true, hint: "Opcional. Ex.: 1, C1, IL-01." })}${field("Nome do circuito", "description", { text: true, hint: "Ex.: Iluminação térreo, tomadas da cozinha, motor da bomba." })}</div>`;
}

export function supplyView() {
  const s = state.supply;
  return `<details class="details supply-details" open><summary>Alimentação da instalação ${helpButton("supply")}</summary><p class="hint">Dados do projeto inteiro. Uma casa trifásica pode ter circuitos fase–neutro e fase–fase.</p><div class="input-grid two">${field(
    "Fases disponíveis na instalação",
    "phases",
    {
      scope: "supply",
      value: s.phases,
      options: [
        ["mono", "Monofásica · fase R (A) + neutro"],
        ["bi", "Bifásica · fases R e S (A e B) + neutro"],
        ["tri", "Trifásica · fases R, S e T (A, B e C) + neutro"],
      ],
    },
  )}${field("Tensões da rede · fase–neutro / fase–fase", "network", {
    scope: "supply",
    value: s.network,
    options: [
      ["127/220", "127 / 220 V"],
      ["220/380", "220 / 380 V"],
      ["custom", "Informar outra rede"],
    ],
  })}${s.network === "custom" ? field("Tensão fase–neutro (V)", "phaseVoltage", { scope: "supply", value: s.phaseVoltage, min: 1 }) + field("Tensão fase–fase (V)", "lineVoltage", { scope: "supply", value: s.lineVoltage, min: 1 }) : ""}</div></details>`;
}

export function connectionView() {
  const c = state.draft,
    opts =
      c.connection === "legacy"
        ? [
            ["legacy", "Monofásico importado · confirmar ligação"],
            ...CONNECTIONS,
          ]
        : CONNECTIONS;
  const phases =
    c.connection === "tri"
      ? [["ABC", "R + S + T (A + B + C)"]]
      : c.connection === "ff"
        ? [
            ["AB", "R + S (A + B)"],
            ["BC", "S + T (B + C)"],
            ["CA", "T + R (C + A)"],
          ]
        : [
            ["A", "R (A) + neutro"],
            ["B", "S (B) + neutro"],
            ["C", "T (C) + neutro"],
          ];
  return `<div class="fieldset"><div class="field-title">Ligação deste circuito ${helpButton("connection")}</div><div class="input-grid two">${field("Ligação do circuito", "connection", { options: opts, help: "connection" })}${field("Fases utilizadas", "phaseSet", { options: phases })}${field(
    "Tensão do circuito",
    "voltageMode",
    {
      options: [
        ["auto", "Usar a tensão da rede"],
        ["manual", "Informar tensão manualmente"],
      ],
      help: "supply",
    },
  )}${c.voltageMode === "manual" || c.connection === "legacy" ? field("Tensão aplicada à carga (V)", "voltage", { min: 1, help: "connection" }) : '<div class="field"><label>Tensão calculada pela ligação</label><output class="input-like" data-live-voltage>—</output></div>'}</div><div data-live-link class="explain"></div>${c.connection === "tri" ? notice("Cada grupo abaixo deve representar a potência total equilibrada nas três fases. Lâmpadas ligadas a uma fase e neutro devem ser cadastradas em um circuito fase–neutro.", "warn") : ""}</div>`;
}

export function equipmentView() {
  const c = state.draft;
  return `${c.source ? notice("CSV: esta linha representa a carga agregada do circuito. Quantidade 1 significa um total importado, não um equipamento físico. Substitua por grupos reais e informe as distâncias para calcular a queda.", "warn") : ""}<div class="card-title equipment-title"><div><h3>Equipamentos do circuito ${helpButton("circuit")}</h3><p>Todos os grupos abaixo pertencem a este único circuito e à mesma proteção. Separe os equipamentos por potência ou posição; isso não cria circuitos adicionais.</p></div><button type="button" class="btn secondary small" data-action="addLoad">+ Adicionar grupo</button></div><div class="equipment-list">${c.loads
    .map((load, i) => {
      const f = (label, key, opts = {}) =>
        field(label, key, {
          ...opts,
          scope: "load",
          index: i,
          value: load[key],
        });
      return `<fieldset class="equipment-card"><legend>Grupo de equipamentos ${i + 1}</legend><div class="equipment-actions"><button class="btn ghost small" data-remove-load="${i}" ${c.loads.length === 1 ? "disabled" : ""} aria-label="Remover grupo ${i + 1}">Remover</button></div><div class="equipment-fields">${f("Descrição", "description", { text: true, className: "wide" })}${f("Quantidade", "quantity", { min: 1 })}${f("Potência por unidade", "power", { min: 0.001, help: "power" })}${f("Unidade", "unit", { options: ["W", "kW", "VA", "kVA", "CV", "HP"].map((v) => [v, v]) })}${f("Fator de potência", "powerFactor", { min: 0.01, max: 1, help: "powerFactor" })}${["CV", "HP"].includes(load.unit) ? f("Rendimento η", "efficiency", { min: 0.01, max: 1, help: "efficiency" }) : ""}${f("Distância de ida desde o quadro (m)", "distance", { min: 0, help: "distance", className: "wide", hint: "Todos os equipamentos desta linha estão na mesma posição. Escolha o percurso logo abaixo dos grupos." })}</div></fieldset>`;
    })
    .join(
      "",
    )}</div><div data-live-subtotals></div><div data-live-totals class="stats-row live-totals"></div>${notice("O FP inicial 1 é uma hipótese: confirme os dados do equipamento ou driver. Todas as cargas cadastradas são consideradas ligadas simultaneamente.")}`;
}

export function methodOf(c) {
  if (c.unknownInstallation) return null;
  if (c.methodOverride) return c.methodOverride;
  if (c.installation === "embedded" && c.wall === "thermal")
    return c.cableForm === "single" ? "A1" : "A2";
  if (["embedded", "conduit"].includes(c.installation))
    return c.cableForm === "single" ? "B1" : "B2";
  return { surface: "C", buried: "D" }[c.installation] || null;
}

export function installationView() {
  const c = state.draft;
  return `<p class="step-description">O caminho do cabo e os materiais ao redor determinam como o calor se dissipa.</p><div class="picture-grid">${INSTALLATIONS.map(([key, name, desc]) => `<button class="picture-card ${c.installation === key ? "selected" : ""}" data-choose="installation" data-value="${key}" aria-pressed="${c.installation === key}">${window.VoltArt(key)}<strong>${name}</strong><small>${desc}</small></button>`).join("")}</div><div class="fieldset"><div class="input-grid two">${field(
    "Construção do cabo",
    "cableForm",
    {
      options: [
        ["single", "Condutores isolados / cabos unipolares"],
        ["multi", "Cabo multipolar (inclui bipolar)"],
      ],
      help: "cableForm",
    },
  )}${
    c.installation === "embedded"
      ? field("Material da parede", "wall", {
          options: [
            ["masonry", "Alvenaria convencional"],
            ["thermal", "Parede termicamente isolante"],
          ],
          help: "wall",
        })
      : ""
  }${field("Material do condutor", "metal", {
    options: [
      ["Cu", "Cobre"],
      ["Al", "Alumínio"],
    ],
    help: "metal",
  })}${field("Isolação do cabo", "insulation", {
    options: [
      ["PVC", "PVC · 70 °C"],
      ["EPR", "EPR · 90 °C"],
      ["XLPE", "XLPE · 90 °C"],
    ],
    help: "insulation",
  })}${
    ["embedded", "conduit", "buried"].includes(c.installation)
      ? field("Material do eletroduto · registro", "conduitType", {
          options: [
            ["PVC", "PVC"],
            ["metal", "Metálico"],
            ["other", "Outro / confirmar"],
          ],
          help: "conduitType",
        })
      : ""
  }</div></div><label class="radio-row"><input type="checkbox" data-field="unknownInstallation" ${c.unknownInstallation ? "checked" : ""}>Não sei identificar a instalação — manter seleção pendente</label><details class="details"><summary>Ver fundamento técnico e método de referência</summary><div class="explain">Método estimado: <strong>${esc(methodOf(c) || "Pendente")}</strong>. Base histórica: tabela 28, NBR 5410:1997. Material do eletroduto é documental, sem fator adicional automático. ${state.mode === "technical" ? field("Sobrescrever método", "methodOverride", { options: [["", "Automático"], ...["A1", "A2", "B1", "B2", "C", "D"].map((x) => [x, x])], help: "installation" }) : ""}</div></details>${["tray", "overhead"].includes(c.installation) ? notice("Esta disposição ainda não possui todas as tabelas necessárias no motor. A seção ficará pendente.", "warn") : ""}`;
}

export function groupingView() {
  const c = state.draft;
  return `<div class="concept-note"><strong>${c.loads.length} grupo(s) de equipamentos neste cadastro = 1 circuito.</strong><p>Conte os circuitos que compartilham a instalação, incluindo este. Exemplo: iluminação do jardim e tomadas no mesmo eletroduto são 2 circuitos. Dois grupos de lâmpadas sob a mesma proteção continuam sendo 1 circuito.</p></div><p class="step-description">Circuitos próximos aquecem uns aos outros. O agrupamento pode reduzir a capacidade de condução dos cabos.</p><div class="choice-grid">${[
    [
      "bundle",
      "No mesmo eletroduto ou em feixe",
      "Cabos próximos, sem espaçamento relevante.",
    ],
    [
      "spaced",
      "Separados / espaçados",
      "A disposição e o afastamento precisam ser considerados.",
    ],
    [
      "unknown",
      "Não sei informar",
      "O fator ficará pendente quando houver vários circuitos.",
    ],
  ]
    .map(
      ([key, title, desc]) =>
        `<button data-choose="groupLayout" data-value="${key}" class="choice-btn ${c.groupLayout === key ? "selected" : ""}"><strong>${title}</strong><small>${desc}</small></button>`,
    )
    .join(
      "",
    )}</div><div class="fieldset"><div class="input-grid two">${field("Quantos circuitos estão agrupados?", "groupCount", { min: 1, max: 20, help: "groupCount", hint: "Inclua este circuito. Não conte grupos de lâmpadas nem fios. Informe 1 quando não houver outro circuito junto." })}<div class="field"><label>Fator de agrupamento (FCA)</label><output data-live-group class="input-like">—</output></div></div><div data-live-group-explanation></div></div><details class="details"><summary>Ver fundamento técnico</summary><p class="hint">Fatores da tabela 37, item 1, da base histórica, somente para as disposições implementadas. Agrupamento subterrâneo e espaçamentos especiais exigem outros fatores.</p></details>`;
}

export function protectionView() {
  const c = state.draft;
  return `<div class="fieldset"><div class="field-title">Proteção elétrica ${helpButton("breakerMode")}</div><div class="input-grid two">${field(
    "Como selecionar o disjuntor?",
    "breakerMode",
    {
      options: [
        ["auto", "Sugerir disjuntor"],
        ["verify", "Verificar disjuntor informado"],
      ],
      help: "breakerMode",
    },
  )}${c.breakerMode === "verify" ? field("Corrente nominal informada (A)", "breakerCurrent", { min: 1, help: "breakerMode", hint: "A seção será procurada considerando este disjuntor." }) : '<p class="hint">O motor procura uma corrente nominal na lista disponível e uma seção compatível com os critérios implementados.</p>'}</div><details class="details" ${state.mode === "technical" ? "open" : ""}><summary>Características do dispositivo e curto-circuito</summary><div class="input-grid two advanced-fields">${field("Curva de atuação · registro", "breakerCurve", { options: ["B", "C", "D"].map((x) => [x, x]), help: "breakerCurve" })}${field("Relação I₂/In adotada", "i2Factor", { min: 1, max: 3, help: "i2Factor" })}${field("Corrente de curto-circuito Ik (kA)", "shortIk", { min: 0, help: "shortIk", hint: "Deixe vazio se não houver estudo." })}${field(
    "Designação da capacidade",
    "breakingCapacityType",
    {
      options: [
        ["Icn", "Icn"],
        ["Icu", "Icu"],
      ],
      help: "breakerIcu",
    },
  )}${field(`Capacidade de interrupção ${esc(c.breakingCapacityType)} (kA)`, "breakerIcu", { min: 0, help: "breakerIcu", hint: "Valor do dispositivo na tensão aplicável." })}</div></details></div>`;
}

export function conditionsView() {
  const c = state.draft;
  return `<div class="input-grid two">${field("Temperatura no local dos cabos (°C)", "temperature", { min: 10, max: 80, help: "temperature", hint: methodOf(c) === "D" ? "Temperatura do solo." : "Temperatura do ambiente ao redor dos cabos." })}${field("Limite de queda do circuito (%)", "maxDrop", { min: 0.1, max: 20, help: "maxDrop", hint: "4% é o valor inicial configurável; confirme o critério do projeto." })}<div class="field"><div class="field-caption"><label>Condutores carregados</label>${helpButton("loaded")}</div><output data-live-loaded class="input-like">—</output><span class="hint">Definidos pela ligação do circuito.</span></div></div><div data-live-temperature></div><div class="route-recap"><strong>Distâncias e percurso já cadastrados em Grandezas</strong><div data-live-route>${routePreview()}</div><button class="btn secondary small" data-review-step="2">Editar equipamentos e distâncias →</button></div>${methodOf(c) === "D" ? `<details class="details"><summary>Solo · dados documentais ${helpButton("soilResistance")}</summary><div class="input-grid two">${field("Resistividade térmica (K·m/W)", "soilResistance", { min: 0, help: "soilResistance" })}${field("Profundidade (m)", "soilDepth", { min: 0, help: "soilResistance" })}</div></details>` : ""}${protectionView()}`;
}

export function routePreview() {
  const c = state.draft,
    loads = [...c.loads].sort(
      (a, b) => Number(a.distance) - Number(b.distance),
    );
  return `<div class="route-preview"><strong>Quadro · proteção deste circuito</strong><div class="route-path ${c.routeMode === "independent" ? "route-branches" : ""}">${loads.map((l) => `<span>→ ${esc(l.description || "Equipamento")} <b>${fmt(l.distance)} m</b> desde o quadro</span>`).join("")}</div><p>${c.routeMode === "linear" ? "Um caminho compartilhado: a corrente diminui após as derivações para as cargas." : "Um caminho de cabos separado por grupo, partindo da mesma proteção. Se houver um tronco comum antes da separação, este modelo não representa o percurso."}</p></div>`;
}

export function routeView() {
  return `<div class="fieldset"><div class="field-title">Percurso dentro deste circuito ${helpButton("distance")}</div>${field(
    "Como os grupos de equipamentos são atendidos?",
    "routeMode",
    {
      options: [
        ["linear", "Caminho compartilhado, com cargas ao longo dele"],
        ["independent", "Caminhos separados desde a proteção no quadro"],
      ],
      help: "distance",
    },
  )}<div data-live-route>${routePreview()}</div><p class="hint">Percurso descreve por onde a corrente chega às cargas. Agrupamento descreve o aquecimento entre circuitos próximos: cabos de caminhos diferentes podem estar no mesmo eletroduto. O modelo usa uma seção e as mesmas condições térmicas em todos os caminhos.</p></div>`;
}
