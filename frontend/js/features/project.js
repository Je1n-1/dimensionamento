import {
  roomPlannerView,
  roomPlannerClick,
  roomPlannerInput,
  clearRoomPreview,
} from "./rooms.js";
import { coverageView } from "../views/coverage.js";
import { calc, prepare } from "../core/api.js";
import {
  M,
  esc,
  fmt,
  state,
  ui,
  requestRender,
  syncTechnical,
} from "../core/state.js";
import { persist } from "../core/storage.js";
import { toast } from "../core/dom.js";
import { field, notice } from "../views/components.js";
import { supplyView } from "../views/forms.js";
import {
  icon,
  equipmentIcon,
  roomIcon,
  metric,
  cardTitle,
} from "../views/visuals.js";

export const EQUIPMENT = [
  ["lighting", "Iluminação", "☼"],
  ["sockets", "Tomadas de uso geral", "♧"],
  ["shower", "Chuveiro", "♨"],
  ["ac", "Ar-condicionado", "❄"],
  ["microwave", "Micro-ondas", "▣"],
  ["washer", "Máquina de lavar", "◉"],
  ["motor", "Motor elétrico", "⚙"],
  ["transformer", "Transformador", "⌁"],
  ["other", "Outro equipamento / TUE", "+"],
];
const ROOMS = [
  "Sala",
  "Cozinha",
  "Quarto",
  "Banheiro",
  "Área de serviço",
  "Escritório",
  "Garagem",
  "Área externa",
];
export const proposalKey = () =>
  JSON.stringify([
    state.context,
    state.supply,
    state.circuits,
    state.reactance,
  ]);
export function invalidateProposal() {
  ui.proposal = null;
  ui.proposalError = "";
}
const contextField = (label, key, options = {}) =>
  field(label, key, {
    scope: "context",
    value: state.context[key],
    ...options,
  });
const input = (item, key, label, options = {}) =>
  field(label, key, {
    scope: "inventory",
    index: state.context.equipment.indexOf(item),
    value: item[key],
    ...options,
  });
const connections = () => [
  ["fn", "Fase + neutro"],
  ...(state.supply.phases !== "mono" ? [["ff", "Fase + fase"]] : []),
  ...(state.supply.phases === "tri" ? [["tri", "Trifásico equilibrado"]] : []),
];

function contextView() {
  const supply = state.supply;
  return /* HTML */ `<section class="panel design-card context-card">
    ${cardTitle(
      1,
      "Informações do projeto",
      "Defina os dados básicos da sua instalação.",
    )}
    <div class="input-grid two">
      <div class="full-field">
        ${field("Nome do projeto / casa", "name", {
          scope: "project",
          value: state.projectName,
          text: true,
        })}
      </div>
      ${contextField("Tipo de edificação", "propertyType", {
        options: [
          ["house", "Residência unifamiliar"],
          ["apartment", "Apartamento"],
          ["commercial", "Comercial"],
          ["other", "Outro"],
        ],
      })}${field("Alimentação da concessionária", "phases", {
        scope: "supply",
        value: supply.phases,
        options: [
          ["mono", "Monofásico (F + N)"],
          ["bi", "Bifásico (2F + N)"],
          ["tri", "Trifásico (3F + N)"],
        ],
      })}${field("Tensão da rede · FN / FF", "network", {
        scope: "supply",
        value: supply.network,
        options: [
          ["127/220", "127 / 220 V"],
          ["220/380", "220 / 380 V"],
          ["custom", "Outra rede"],
        ],
      })}
      <div class="field">
        <label>Fases disponíveis</label>
        <div class="readonly-field">
          ${{
            mono: "Fase A (R) + neutro",
            bi: "Fases A e B (R/S) + neutro",
            tri: "Fases A, B e C (R/S/T) + neutro",
          }[supply.phases]}
        </div>
      </div>
      ${supply.network === "custom"
        ? field("Tensão fase–neutro (V)", "phaseVoltage", {
            scope: "supply",
            value: supply.phaseVoltage,
            min: 1,
          }) +
          field("Tensão fase–fase (V)", "lineVoltage", {
            scope: "supply",
            value: supply.lineVoltage,
            min: 1,
          })
        : ""}
    </div>
  </section>`;
}
function equipmentCatalog(compact = true) {
  return /* HTML */ `<div class="equipment-catalog">
    ${EQUIPMENT.filter(
      ([kind]) =>
        kind !== "other" &&
        (compact || !["sockets", "lighting"].includes(kind)),
    )
      .map(([kind, name]) => {
        const selected = state.context.equipment.some((e) => e.kind === kind);
        return /* HTML */ `<button
          class="equipment-choice ${selected ? "selected" : ""}"
          data-pick-equipment="${kind}"
          aria-pressed="${selected}"
        >
          ${icon(equipmentIcon(kind))}<span
            ><strong>${name}</strong
            ><small
              >${selected
                ? "Selecionado · editar dados"
                : "Selecionar equipamento"}</small
            ></span
          ><i class="selection-mark">${selected ? icon("check") : ""}</i>
        </button>`;
      })
      .join("")}
  </div>`;
}
function roomCards() {
  const ctx = state.context,
    rooms = [...new Set([...ROOMS, "Sala de jantar", "Varanda", ...ctx.rooms])];
  return /* HTML */ `<h3>Ambientes da residência</h3>
    <p class="muted">Marque os ambientes que fazem parte do projeto.</p>
    <div class="room-options">
      ${rooms
        .map(
          (room) =>
            /* HTML */ `<label
              class="room-choice ${ctx.rooms.includes(room) ? "selected" : ""}"
              ><input
                type="checkbox"
                data-room="${esc(room)}"
                ${ctx.rooms.includes(room) ? "checked" : ""}
              />${icon(roomIcon(room))}<strong>${esc(room)}</strong></label
            >`,
        )
        .join("")}
    </div>
    <div class="inline-add">
      <input
        id="customRoom"
        maxlength="60"
        aria-label="Nome do novo ambiente"
        placeholder="Adicionar ambiente personalizado"
      /><button class="btn secondary small" data-project-action="room">
        ${icon("plus")} Adicionar
      </button>
    </div>`;
}
function equipmentView(compact = false) {
  return /* HTML */ `<section class="panel design-card environments-card">
    ${cardTitle(
      2,
      compact ? "Ambientes e cargas" : "O que existe na sua casa?",
      compact
        ? "Selecione os ambientes e os principais equipamentos."
        : "Selecione os ambientes e consumidores. Depois, detalhe quantidades e potências.",
    )}
    ${compact
      ? /* HTML */ `<div class="catalog-tabs">
          <button class="active" data-project-step="2">
            ${icon("home")} Ambientes da residência</button
          ><button data-project-step="3">
            ${icon("plug")} Detalhar equipamentos
          </button>
        </div>`
      : roomPlannerView() + `<details class="details"><summary>Selecionar cômodos comuns por cartões</summary>${roomCards()}</details>`}${compact
      ? ""
      : "<h3>Equipamentos específicos e outros grupos</h3>"}${equipmentCatalog(
      compact,
    )}<button class="add-equipment-btn" data-add-equipment="other">
      ${icon("plus")} Adicionar outro equipamento</button
    >${compact
      ? /* HTML */ `<button class="text-link" data-project-step="2">
          Selecionar ambientes e organizar as cargas →
        </button>`
      : ""}
  </section>`;
}
function inventoryView() {
  const ctx = state.context;
  return /* HTML */ `<section class="panel design-card">
    ${cardTitle(
      3,
      "Detalhar equipamentos",
      "Informe as grandezas reais de cada grupo de consumidores.",
    )}<button class="btn secondary" data-project-step="2">
      Tomadas e iluminação por cômodo
    </button>
    <p class="hint">
      Informe a potência de entrada e sua unidade. Para potências ou distâncias
      diferentes, adicione outro grupo.
    </p>
    ${ctx.equipment.length
      ? /* HTML */ `<div
          class="inventory ${state.mode === "technical"
            ? "inventory-technical"
            : ""}"
        >
          ${ctx.equipment
            .map(
              (item, i) =>
                /* HTML */ `<section class="inventory-item">
                  <div class="card-title">
                    <h3>
                      ${icon(equipmentIcon(item.kind))} ${i + 1}.
                      ${esc(item.name)}
                    </h3>
                    <div>
                      <button
                        class="btn ghost small"
                        data-add-equipment="${esc(item.kind)}"
                      >
                        + Outro grupo</button
                      ><button
                        class="btn ghost small"
                        data-remove-equipment="${i}"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  <div class="inventory-fields">
                    ${input(item, "name", "Identificação", {
                      text: true,
                    })}${input(item, "room", "Ambiente", {
                      options: [
                        ["", "Sem ambiente"],
                        ...ctx.rooms.map((r) => [r, r]),
                      ],
                    })}${input(item, "quantity", "Quantidade", {
                      min: 1,
                      max: 1000,
                    })}${input(item, "unit", "Unidade", {
                      value: item.unit || "W",
                      options: [
                        ["W", "W"],
                        ["VA", "VA"],
                      ],
                    })}${input(item, "powerBasis", "Potência informada", {
                      value: item.powerBasis || "unit",
                      options: [
                        ["unit", "Por equipamento / ponto"],
                        ["total", "Total do grupo"],
                      ],
                    })}${input(
                      item,
                      "power",
                      item.powerBasis === "total"
                        ? "Potência total do grupo"
                        : "Potência unitária",
                      {
                        min: 0.01,
                      },
                    )}${input(item, "powerFactor", "Fator de potência", {
                      min: 0.01,
                      max: 1,
                    })}${input(item, "connection", "Ligação", {
                      options: connections(),
                    })}${input(item, "distance", "Distância de ida (m)", {
                      min: 0,
                    })}
                  </div>
                </section>`,
            )
            .join("")}
        </div>`
      : notice("Selecione os consumidores na etapa Ambientes.")}
    <p class="hint">
      As distâncias partem do quadro. Grupos de iluminação/tomadas são tratados
      na mesma posição; os percursos distribuídos são ajustados no circuito. O
      inventário não sobrescreve circuitos já adicionados.
    </p>
    <button class="btn secondary" data-add-equipment="sockets">
      + Grupo de tomadas manual</button
    ><button class="btn secondary" data-add-equipment="lighting">
      + Grupo de iluminação manual
    </button>
    <button class="btn secondary" data-project-step="2">
      ${icon("plus")} Selecionar consumidores
    </button>
  </section>`;
}
function assumptionsView() {
  return /* HTML */ `<div class="proposal-assumptions">
    <p>
      Condições iniciais: cobre, PVC 70 °C, condutores isolados em eletroduto
      embutido em alvenaria (B1), queda limitada a 4%. Curva C, hipótese I₂/In =
      1,45. Confirme essas condições em cada circuito.
    </p>
    <div class="input-grid two">
      ${field("Temperatura do local (°C)", "temperature", {
        scope: "assumption",
        value: state.context.conditions.temperature,
        min: 10,
        max: 80,
      })}${field("Circuitos no mesmo feixe", "groupCount", {
        scope: "assumption",
        value: state.context.conditions.groupCount,
        min: 1,
        max: 20,
      })}
    </div>
    <p class="hint">
      O agrupamento depende do percurso físico, não da quantidade de circuitos
      da casa.
    </p>
  </div>`;
}
function proposalView() {
  const proposal = ui.proposal;
  return /* HTML */ `<section class="panel design-card proposal-card">
    ${cardTitle(
      3,
      "Sugestões do sistema",
      "Gere uma proposta a partir das cargas informadas. Você pode aceitar, editar ou gerar novamente.",
    )}
    <div class="proposal-heading">
      ${icon("report")}
      <div>
        <strong>Proposta inicial de circuitos</strong>
        <p>
          As sugestões são preliminares. Revise as condições reais da
          instalação.
        </p>
      </div>
      <button class="btn secondary small" data-project-step="3">
        ${icon("edit")} Editar cargas
      </button>
    </div>
    <div id="proposalArea">
      ${proposal
        ? `${proposal.warnings.map((x) => notice(esc(x), "warn")).join("")}<div class="table-wrap proposal-table"><table class="data-table"><thead><tr><th>Incluir</th><th>Circuito</th><th>Potência</th><th>Corrente</th><th>Disjuntor</th><th>Fase</th></tr></thead><tbody>${proposal.circuits
            .map(
              (c, i) =>
                /* HTML */ `<tr>
                  <td>
                    <input
                      type="checkbox"
                      data-proposal-include="${i}"
                      aria-label="Incluir circuito ${i + 1}"
                      ${proposal.included.has(c.id) ? "checked" : ""}
                    />
                  </td>
                  <td>
                    <input
                      data-proposal-name="${i}"
                      value="${esc(c.description)}"
                      maxlength="70"
                      aria-label="Nome do circuito proposto ${i + 1}"
                    />
                  </td>
                  <td>${fmt(calc(c).totals.p)} W</td>
                  <td>${fmt(calc(c).ib)} A</td>
                  <td>${fmt(calc(c).protection?.nominal)} A</td>
                  <td>
                    <select
                      data-proposal-phase="${i}"
                      aria-label="Fases do circuito proposto ${i + 1}"
                    >
                      ${phaseOptions(c)
                        .map(
                          (p) =>
                            /* HTML */ `<option
                              ${p === c.phaseSet ? "selected" : ""}
                            >
                              ${p}
                            </option>`,
                        )
                        .join("")}
                    </select>
                  </td>
                </tr>`,
            )
            .join("")}</tbody></table></div>`
        : /* HTML */ `<div class="proposal-empty">
            ${icon("board")}<strong>Sua proposta aparecerá aqui</strong>
            <p>
              Selecione os consumidores e informe quantidade, potência, ligação
              e distância.
            </p>
            <button class="btn secondary small" data-project-step="3">
              Preencher equipamentos →
            </button>
          </div>`}
    </div>
    <div class="design-callout blue">
      ${icon("chart")}
      <div>
        <strong>Distribuição de fases</strong>
        <p>
          Uma instalação trifásica pode alimentar circuitos fase–neutro e
          fase–fase.
        </p>
        <label class="inline-check"
          ><input
            type="checkbox"
            data-context="distribute"
            ${state.context.distribute ? "checked" : ""}
          />Sugerir distribuição inicial entre fases</label
        >
      </div>
    </div>
    <details class="details proposal-settings">
      <summary>Condições usadas na sugestão</summary>
      ${assumptionsView()}
    </details>
    <div class="design-callout blue">
      ${icon("book")}
      <div>
        <strong>Referências e verificações</strong>
        <p>
          Base histórica NBR 5410:1997. Curto-circuito, DR/DPS, neutro e PE
          exigem verificações complementares.
        </p>
      </div>
    </div>
    ${ui.proposalError ? notice(esc(ui.proposalError), "bad") : ""}
    <div class="card-footer">
      ${proposal
        ? /* HTML */ `<button
              class="btn secondary small"
              data-project-action="generate"
            >
              Gerar novamente</button
            ><button class="btn primary" data-project-action="apply">
              ${icon("check")} Adicionar selecionados
            </button>`
        : /* HTML */ `<button
            class="btn primary"
            data-project-action="generate"
            ${ui.proposalBusy ? "disabled" : ""}
          >
            ${icon("plus")}
            ${ui.proposalBusy ? "Gerando…" : "Gerar proposta inicial"}
            ${icon("arrow")}
          </button>`}
    </div>
  </section>`;
}
function inventoryPower() {
  const items = state.context.equipment;
  return items.length &&
    items.every(
      (e) =>
        Number.isFinite(+e.power) &&
        +e.power > 0 &&
        Number.isInteger(+e.quantity) &&
        +e.quantity > 0,
    )
    ? items.reduce(
        (p, e) =>
          p +
          +e.power *
            (e.powerBasis === "total" ? 1 : +e.quantity) *
            (e.unit === "VA" ? +e.powerFactor : 1),
        0,
      )
    : null;
}
function projectMetrics() {
  const p = inventoryPower();
  return /* HTML */ `<div class="metric-grid">
    ${metric(
      "Potência cadastrada",
      p == null ? "A informar" : fmt(p) + " W",
      "Soma dos consumidores informados",
      "bolt",
    )}${metric(
      "Circuitos no projeto",
      state.circuits.length,
      "Circuitos já adicionados",
      "layers",
      "purple",
    )}${metric(
      "Maior corrente de fase",
      fmt(ui.boardCache?.maxCurrent) + " A",
      "Considerando os circuitos salvos",
      "chart",
      "green",
    )}${metric(
      "Ambientes cadastrados",
      state.context.rooms.length,
      "Cômodos da instalação",
      "home",
      "purple",
    )}
  </div>`;
}
export function choicesSummary() {
  const ctx = state.context,
    p = inventoryPower(),
    count = ctx.equipment.every(
      (e) => Number.isInteger(+e.quantity) && +e.quantity > 0,
    )
      ? ctx.equipment.reduce((s, e) => s + +e.quantity, 0)
      : null;
  return /* HTML */ `<section class="panel design-card choices-summary">
    <h2>${icon("board")} Resumo das escolhas</h2>
    <div class="choice-summary-row">
      <span class="metric-icon purple">${icon("home")}</span>
      <div>
        <strong>Ambientes selecionados <b>${ctx.rooms.length}</b></strong>
        <p>
          ${esc(
            ctx.rooms.join(", ") || "Selecione os ambientes da instalação.",
          )}
        </p>
      </div>
    </div>
    <div class="choice-summary-row">
      <span class="metric-icon blue">${icon("plug")}</span>
      <div>
        <strong>Consumidores / equipamentos <b>${fmt(count, 0)}</b></strong>
        <p>
          ${esc(
            ctx.equipment.map((e) => e.name).join(", ") ||
              "Adicione os equipamentos do projeto.",
          )}
        </p>
      </div>
    </div>
    <div class="choice-summary-row">
      <span class="metric-icon amber">${icon("bolt")}</span>
      <div>
        <span>Potência total cadastrada</span
        ><strong class="summary-power"
          >${p == null ? "A informar" : fmt(p / 1000) + " kW"}</strong
        >
      </div>
    </div>
    <div class="design-callout blue">
      ${icon("layers")}
      <div>
        <strong>Sugestão automática de circuitos</strong>
        <p>
          Após informar as grandezas, gere uma proposta editável de divisão das
          cargas.
        </p>
        <div class="summary-tiles">
          <div>
            <strong>${ui.proposal?.circuits.length ?? "—"} circuitos</strong
            ><small>Na prévia da proposta</small>
          </div>
          <div>
            <strong
              >${{ mono: 1, bi: 2, tri: 3 }[state.supply.phases]} fases</strong
            ><small>Na alimentação</small>
          </div>
        </div>
      </div>
    </div>
    <div class="design-callout amber">
      ${icon("light")}
      <div>
        <strong>Você controla o projeto</strong>
        <p>
          A proposta é opcional. Revise os dados antes de adicionar os
          circuitos.
        </p>
      </div>
    </div>
    <div class="design-callout blue">
      ${icon("book")}
      <div>
        <strong>Critérios e pendências explícitos</strong>
        <p>
          Uma sugestão não é aprovação integral. Cada resultado informa o que
          foi verificado.
        </p>
      </div>
    </div>
    <div class="card-footer">
      <button
        class="btn secondary"
        data-project-step="${Math.max(1, ui.projectStep - 1)}"
      >
        ← Voltar</button
      >${ui.projectStep < 6
        ? /* HTML */ `<button
            class="btn primary"
            data-project-step="${ui.projectStep + 1}"
          >
            Continuar ${icon("arrow")}
          </button>`
        : /* HTML */ `<button class="btn primary" data-page="loads">
            Ver circuitos ${icon("arrow")}
          </button>`}
    </div>
  </section>`;
}
function projectStepper() {
  const steps = [
    ["Projeto", "Dados básicos"],
    ["Ambientes", "O que existe na casa"],
    ["Equipamentos", "Detalhar cargas"],
    ["Alimentação", "Fases e condições"],
    ["Sugestões", "Ver circuitos"],
    ["Revisão", "Confirmar e adicionar"],
  ];
  return /* HTML */ `<nav class="project-steps" aria-label="Etapas do projeto">
    ${steps
      .map(
        ([name, sub], i) =>
          /* HTML */ `<button
            class="${ui.projectStep === i + 1
              ? "active"
              : ui.projectStep > i + 1
                ? "done"
                : ""}"
            data-project-step="${i + 1}"
            aria-current="${ui.projectStep === i + 1 ? "step" : "false"}"
          >
            <span>${ui.projectStep > i + 1 ? icon("check") : i + 1}</span>
            <div><strong>${name}</strong><small>${sub}</small></div>
          </button>`,
      )
      .join("")}
  </nav>`;
}
export function projectView() {
  if (state.mode === "technical")
    return /* HTML */ `<div data-project-metrics>${projectMetrics()}</div>
      <section class="panel design-card">
        ${roomPlannerView()}<details class="details"><summary>Selecionar cômodos comuns por cartões</summary>${roomCards()}</details>
      </section>
      <div class="project-composition">
        <div>
          ${contextView()}${equipmentView(
            true,
          )}${inventoryView()}${coverageView()}
        </div>
        <div>${proposalView()}</div>
      </div>`;
  if (ui.projectStep === 1)
    return /* HTML */ `<div data-project-metrics>${projectMetrics()}</div>
      <div class="project-composition">
        <div>${contextView()}${equipmentView(true)}</div>
        <div>${proposalView()}</div>
      </div>
      ${coverageView()}${projectStepper()}`;
  const content = {
    2: () => equipmentView(),
    3: inventoryView,
    4: () =>
      /* HTML */ `<section class="panel design-card">
        ${cardTitle(
          4,
          "Alimentação e condições",
          "Confira a rede e as hipóteses usadas na proposta.",
        )}${supplyView()}${assumptionsView()}
      </section>`,
    5: proposalView,
    6: proposalView,
  }[ui.projectStep]();
  if (ui.projectStep === 2)
    return `${projectStepper()}${content}${coverageView()}<div class="card-footer"><button class="btn secondary" data-project-step="1">← Projeto</button><button class="btn primary" data-project-step="3">Detalhar equipamentos →</button></div>`;
  return `${projectStepper()}<div class="assistant-composition"><div>${content}</div><aside id="choicesSummary">${choicesSummary()}</aside></div>`;
}

function phaseOptions(c) {
  if (c.connection === "tri") return ["ABC"];
  if (c.connection === "ff")
    return state.supply.phases === "tri" ? ["AB", "BC", "CA"] : ["AB"];
  return { mono: ["A"], bi: ["A", "B"], tri: ["A", "B", "C"] }[
    state.supply.phases
  ];
}
function proposalResult(c) {
  const r = calc(c);
  return r.chosen
    ? `${fmt(r.chosen.section)} mm² · ${fmt(r.protection.nominal)} A<br><small>Verificações parciais</small>`
    : /* HTML */ `<span class="text-pending">Seleção pendente</span
        ><small
          >${esc(
            r.selectionBlockers?.[0]?.message ||
              r.issues?.[0] ||
              "Confira os dados em Circuitos.",
          )}</small
        >`;
}
export async function generateProposal() {
  if (ui.proposalBusy) return;
  syncTechnical();
  const key = proposalKey();
  ui.proposalBusy = true;
  ui.proposalError = "";
  ui.proposal = null;
  requestRender();
  try {
    const response = await fetch("/api/propose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: state.context,
        supply: state.supply,
        circuits: state.circuits,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || "Não foi possível gerar a proposta.");
    const circuits = data.circuits.map(M.cleanCircuit);
    if (!(await prepare(circuits))) throw Error(ui.serviceError);
    if (key !== proposalKey())
      throw Error("Os dados mudaram durante o cálculo. Gere novamente.");
    ui.proposal = {
      ...data,
      circuits,
      key,
      included: new Set(circuits.map((c) => c.id)),
    };
  } catch (error) {
    ui.proposalError = error.message;
  } finally {
    ui.proposalBusy = false;
    requestRender();
  }
}
export function applyProposal() {
  const p = ui.proposal;
  if (!p || p.key !== proposalKey()) {
    invalidateProposal();
    toast("Os dados mudaram. Gere uma nova proposta.");
    requestRender();
    return;
  }
  const selected = p.circuits.filter((c) => p.included.has(c.id));
  if (!selected.length)
    return toast("Selecione ao menos um circuito na prévia.");
  if (selected.some((c) => !c.description.trim()))
    return toast("Informe o nome dos circuitos selecionados.");
  if (state.circuits.length + selected.length > 300)
    return toast("Limite de 300 circuitos.");
  const offset = state.circuits.length;
  state.circuits.push(
    ...selected.map((c, i) =>
      M.cleanCircuit({ ...c, number: String(offset + i + 1) }),
    ),
  );
  state.editingId = selected[0].id;
  state.draft = M.cleanCircuit(
    state.circuits.find((c) => c.id === state.editingId),
  );
  invalidateProposal();
  state.page = "loads";
  persist();
  requestRender();
  toast(
    `${selected.length} circuito(s) adicionado(s). Revise as hipóteses e os resultados.`,
  );
}
export function projectClick(d) {
  if (roomPlannerClick(d)) return true;
  if (d.pickEquipment) {
    if (
      ["sockets", "lighting"].includes(d.pickEquipment) &&
      ["house", "apartment"].includes(state.context.propertyType)
    ) {
      ui.roomKinds = {
        sockets: d.pickEquipment === "sockets",
        lighting: d.pickEquipment === "lighting",
      };
      clearRoomPreview();
      ui.projectStep = 2;
      requestRender();
      return true;
    }
    if (state.context.equipment.some((e) => e.kind === d.pickEquipment)) {
      ui.projectStep = 3;
      requestRender();
      return true;
    }
    return projectClick({ addEquipment: d.pickEquipment });
  }
  if (d.projectStep) {
    ui.projectStep = Math.max(1, Math.min(6, +d.projectStep));
    requestRender();
    return true;
  }
  if (d.addEquipment) {
    if (state.context.equipment.length >= 100)
      return (toast("Limite de 100 grupos."), true);
    const entry = EQUIPMENT.find((x) => x[0] === d.addEquipment);
    state.context.equipment.push({
      id: M.id(),
      kind: entry[0],
      name: entry[1],
      unit: "W",
      powerBasis: "unit",
      room: state.context.rooms[0] || "",
      quantity: "1",
      power: "",
      powerFactor: "1",
      connection: "fn",
      distance: "",
    });
  } else if (d.removeEquipment !== undefined)
    state.context.equipment.splice(+d.removeEquipment, 1);
  else if (d.projectAction === "room") {
    const room = document.getElementById("customRoom").value.trim();
    if (!room || state.context.rooms.includes(room)) return true;
    if (state.context.rooms.length >= 100)
      return (toast("Limite de 100 ambientes."), true);
    state.context.rooms.push(room);
  } else if (d.projectAction === "generate") {
    generateProposal();
    return true;
  } else if (d.projectAction === "apply") {
    applyProposal();
    return true;
  } else return false;
  invalidateProposal();
  persist();
  requestRender();
  return true;
}
export function projectInput(target) {
  if (roomPlannerInput(target)) return true;
  const d = target.dataset,
    value = target.type === "checkbox" ? target.checked : target.value;
  if (d.proposalInclude !== undefined) {
    const id = ui.proposal?.circuits[+d.proposalInclude]?.id;
    if (id)
      value ? ui.proposal.included.add(id) : ui.proposal.included.delete(id);
    return true;
  }
  if (d.proposalName !== undefined || d.proposalPhase !== undefined) {
    const c = ui.proposal?.circuits[+(d.proposalName ?? d.proposalPhase)];
    if (c) c[d.proposalName !== undefined ? "description" : "phaseSet"] = value;
    return true;
  }
  if (d.project === "name") {
    state.projectName = value.slice(0, 60);
    document.getElementById("projectName").value = state.projectName;
  } else if (d.context) {
    state.context[d.context] = value;
    clearRoomPreview();
  } else if (d.assumption) state.context.conditions[d.assumption] = value;
  else if (d.room) {
    clearRoomPreview();
    if (value) {
      if (!state.context.rooms.includes(d.room))
        state.context.rooms.push(d.room);
    } else {
      state.context.rooms = state.context.rooms.filter((r) => r !== d.room);
      state.context.equipment.forEach((e) => {
        if (e.room === d.room) e.room = "";
      });
    }
  } else if (d.inventory)
    state.context.equipment[+d.index][d.inventory] = value;
  else return false;
  invalidateProposal();
  persist();
  document.getElementById("proposalArea")?.replaceChildren();
  const summary = document.getElementById("choicesSummary");
  if (summary) summary.innerHTML = choicesSummary();
  document
    .querySelectorAll("[data-project-metrics]")
    .forEach((el) => (el.innerHTML = projectMetrics()));
  if (d.project === "name")
    document.getElementById("pageTitle").textContent =
      "Projeto: " + state.projectName;
  if (target.type === "checkbox" || target.tagName === "SELECT")
    requestRender();
  return true;
}
