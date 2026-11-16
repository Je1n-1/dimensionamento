import { calc } from "../core/api.js";
import { CONNECTIONS, LABELS, esc, fmt, state, ui } from "../core/state.js";
import { check, helpButton, notice, stat } from "./components.js";

export function traceView(r) {
  if (!r.segments.length)
    return notice(
      "Os trechos e quedas serão exibidos quando houver dados e seção preliminar disponíveis.",
    );
  return /* HTML */ `<details class="details" open>
    <summary>
      Queda de tensão por trecho e por equipamento ${helpButton("distance")}
    </summary>
    <p class="hint">
      ${r.routeMode === "linear"
        ? "Percurso compartilhado em sequência."
        : "Ramais independentes partindo do quadro."}
      Valores para ${fmt((r.chosen || r.cableCandidate)?.section)} mm². Tensão
      de referência: ${fmt(r.voltage)} V.
    </p>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Trecho</th>
            <th>Extensão</th>
            <th>Corrente</th>
            <th>Queda no trecho</th>
            <th>Acumulada no caminho</th>
          </tr>
        </thead>
        <tbody>
          ${r.segments
            .map(
              (s) =>
                /* HTML */ `<tr>
                  <td>${fmt(s.start)} → ${fmt(s.end)} m</td>
                  <td>${fmt(s.length)} m</td>
                  <td>${fmt(s.current)} A</td>
                  <td>${fmt(s.dv)} V</td>
                  <td>${fmt(s.accumulated)} V</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="table-wrap endpoint-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>Grupo</th>
            <th>Posição desde o quadro</th>
            <th>Queda estimada</th>
          </tr>
        </thead>
        <tbody>
          ${r.endpoints
            .map(
              (e) =>
                /* HTML */ `<tr>
                  <td>${esc(e.description)}</td>
                  <td>${fmt(e.distance)} m</td>
                  <td>${fmt(e.dvPct)}%</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="hint">
      Queda anterior ao quadro, harmônicas e desequilíbrio não estão incluídos.
    </p>
  </details>`;
}

export function correctionCard(kind, r, compact = false) {
  const info = r.corrections?.[kind];
  if (!info) return "";
  return /* HTML */ `<div
    class="factor-card ${info.factor == null ? "factor-missing" : ""}"
  >
    <div>
      <span
        >${kind === "temperature"
          ? "Temperatura · FCT"
          : "Agrupamento · FCA"}</span
      ><strong
        >${info.factor == null ? "Não disponível" : fmt(info.factor)}</strong
      >
    </div>
    <p>
      ${esc(
        compact && kind === "grouping" && info.factor == null
          ? "Fator indisponível para a condição cadastrada. O bloqueio acima explica o motivo e como revisar."
          : info.message,
      )}
    </p>
    ${info.reference ? /* HTML */ `<small>${esc(info.reference)}</small>` : ""}
  </div>`;
}

export function selectionReadiness(r, compact = false) {
  if (r.pending) return "";
  const blockers = r.selectionBlockers || [],
    checks = (r.diagnostics || []).filter((d) => !d.blocksSelection);
  if (compact && blockers.length)
    return /* HTML */ `<div class="preflight-note">
      <strong
        >${blockers.length}
        ${blockers.length === 1 ? "bloqueio impede" : "bloqueios impedem"}
        concluir a seleção</strong
      >
      <p>
        Você pode continuar o cadastro, mas o cabo e o disjuntor automático
        dependem destes pontos:
      </p>
      <div class="grid-tabs">
        ${[...new Set(blockers.map((d) => d.step))]
          .map(
            (step) =>
              /* HTML */ `<button
                class="btn secondary small"
                data-review-step="${step}"
              >
                Revisar ${LABELS[step - 1].toLowerCase()} →
              </button>`,
          )
          .join("")}
      </div>
    </div>`;
  const list = (entries) =>
    /* HTML */ `<ul class="resolution-list">
      ${entries
        .map(
          (d) =>
            /* HTML */ `<li>
              <p>${esc(d.message)}</p>
              <button
                class="btn secondary small"
                data-diagnostic="${r.diagnostics.findIndex(
                  (x) =>
                    x.field === d.field &&
                    x.scope === d.scope &&
                    x.index === d.index &&
                    x.message === d.message,
                )}"
              >
                Revisar ${LABELS[d.step - 1].toLowerCase()} →
              </button>
            </li>`,
        )
        .join("")}
    </ul>`;
  return `${
    blockers.length
      ? /* HTML */ `<section
          class="resolution-box"
          aria-label="O que impede o dimensionamento"
        >
          <span class="eyebrow"
            >${blockers.length}
            ${blockers.length === 1
              ? "bloqueio identificado"
              : "bloqueios identificados"}</span
          >
          <h3>
            ${r.ib != null
              ? "A corrente foi calculada. Falta concluir a seleção do cabo e do disjuntor."
              : "Precisamos conferir os dados da carga."}
          </h3>
          ${list(blockers)}
          <p class="hint">
            Sem uma seção definida, a queda final também não pode ser
            apresentada. Revise os dados conforme a instalação real; limitações
            de tabela são limitações do programa.
          </p>
        </section>`
      : /* HTML */ `<div class="notice readiness-ok">
          Dados suficientes para a seleção preliminar de cabo e disjuntor. As
          verificações complementares continuam separadas abaixo.
        </div>`
  }${
    checks.length
      ? /* HTML */ `<details class="details additional-checks">
          <summary>
            ${checks.length}
            ${checks.length === 1
              ? "verificação complementar · não impede"
              : "verificações complementares · não impedem"}
            a seleção nominal
          </summary>
          ${list(checks)}
        </details>`
      : ""
  }`;
}

export function corrections(r) {
  return /* HTML */ `<div class="explain">
    <strong>Capacidade tabelada necessária do cabo</strong> ${helpButton(
      "capacity",
    )}
    <p>
      Este valor se refere ao cabo, não à corrente nominal do disjuntor. A
      corrente da carga
      ${r.ib == null
        ? "ainda depende dos dados dos equipamentos"
        : `é ${fmt(r.ib)} A`}.
    </p>
    <div class="factor-grid">
      ${correctionCard("temperature", r)}${correctionCard("grouping", r, true)}
    </div>
    ${r.requiredAmpacity != null
      ? /* HTML */ `<div class="equation">
            ${fmt(r.ib)} A ÷ (${fmt(r.fct)} × ${fmt(r.fca)}) =
            <b>${fmt(r.requiredAmpacity)} A</b>
          </div>
          <p>
            Essa é a capacidade que procuramos na tabela antes das
            correções.${r.chosen
              ? ` Para o cabo de ${fmt(r.chosen.section)} mm²: ${fmt(r.chosen.itab)} A × ${fmt(r.fct)} × ${fmt(r.fca)} = <b>${fmt(r.chosen.iz)} A</b> de capacidade corrigida.`
              : ""}
          </p>`
      : /* HTML */ `<p class="factor-dependency">
          ${r.ib == null
            ? "Precisamos da corrente da carga"
            : r.fct == null && r.fca == null
              ? "Precisamos dos fatores de temperatura e de agrupamento"
              : r.fct == null
                ? "Falta o fator de temperatura"
                : "Falta o fator de agrupamento"}
          para obter a capacidade tabelada necessária. O motivo está indicado
          acima.
        </p>`}<small
      >Os fatores corrigem a capacidade do cabo; não aumentam a corrente
      consumida pela carga.</small
    >
  </div>`;
}

export function resultView() {
  const r = calc(state.draft),
    b = r.chosen,
    p = r.protection;
  if (r.pending)
    return notice(
      ui.serviceError || "Calculando no servidor Python…",
      ui.serviceError ? "bad" : "",
    );
  if (!b)
    return /* HTML */ `<div class="stats-row result-stats">
        ${stat(
          "Corrente da carga · Ib",
          r.ib != null ? fmt(r.ib) + " A" : "Confira os dados da carga",
        )}${stat(
          "Potência ativa dos grupos",
          r.loadResults?.length === state.draft.loads.length
            ? fmt(r.totals.p) + " W"
            : "Cadastro incompleto",
        )}${p.nominal != null
          ? stat(
              "Disjuntor informado · ainda não aprovado",
              fmt(p.nominal) + " A",
            )
          : ""}
      </div>
      ${selectionReadiness(r)}${corrections(r)}${r.cableCandidate
        ? notice(
            "Existe uma seção candidata para corrente e queda, mas a coordenação com a proteção ainda não foi atendida.",
            "warn",
          )
        : ""}<button class="btn secondary" data-action="saveDraft">
        Salvar rascunho para continuar depois
      </button>`;
  return `${selectionReadiness(r)}${r.issues.map((text) => notice(esc(text), "bad")).join("")}<div class="stats-row result-stats">${stat("Corrente da carga · Ib", fmt(r.ib) + " A")}${stat("Capacidade tabelada necessária do cabo", fmt(r.requiredAmpacity) + " A")}${stat("Seção preliminar", b ? fmt(b.section) + " mm²" : "Pendente")}</div><div class="overview-grid"><div class="key-metric"><small>${state.draft.breakerMode === "verify" ? "Disjuntor informado" : "Disjuntor nominal sugerido"}</small><strong>${fmt(p.nominal)} A</strong></div><div class="key-metric"><small>Maior queda estimada</small><strong>${b ? fmt(b.dvPct) + "%" : "Pendente"}</strong></div></div>${p.failed ? notice("Há uma incompatibilidade na proteção informada. Consulte as verificações abaixo.", "bad") : ""}${corrections(r)}<h3 class="small-heading result-heading">O que determinou a seção?</h3><div class="criteria-grid">${Object.entries(
    {
      minimum: "Seção mínima do modelo",
      ampacity: "Capacidade de corrente",
      voltageDrop: "Queda de tensão",
      protection: "Coordenação com o disjuntor",
    },
  )
    .map(
      ([key, label]) =>
        /* HTML */ `<div>
          <span>${label}</span><strong>${fmt(r.criteria[key])} mm²</strong>
        </div>`,
    )
    .join(
      "",
    )}</div><p class="hint">${b ? "Critério(s) determinante(s): " + esc(r.determining.join("; ")) + "." : "Não foi possível combinar todos os critérios. Corrija os erros ou consulte as pendências."}</p><div class="checks">${check("Corrente da carga ≤ nominal do disjuntor", `${fmt(r.ib)} A ≤ ${fmt(p.nominal)} A`, p.loadOk)}${check("Nominal do disjuntor ≤ capacidade corrigida", `${fmt(p.nominal)} A ≤ ${fmt((b || r.cableCandidate)?.iz)} A`, p.cableOk)}${check("Atuação convencional I₂ ≤ 1,45 × Iz", "Hipótese I₂/In: " + fmt(state.draft.i2Factor), p.conventionalOk)}${check(`Ik ≤ ${esc(state.draft.breakingCapacityType)}`, "Comparação isolada em kA", p.shortOk)}${check("Curva real, partida, curto térmico e seletividade", "", null)}</div>${traceView(r)}<details class="details"><summary>Hipóteses, referências e verificações pendentes</summary>${r.notices.map((text) => notice(esc(text), "warn")).join("")}<p class="hint">Base histórica NBR 5410:1997. Método ${esc(r.method || "pendente")}, tabela ${r.table}, fatores de temperatura e agrupamento. Neutro, PE, DR/DPS e seccionamento não são dimensionados.</p></details><div class="result-alert">Resultado preliminar. As verificações parciais não representam aprovação do projeto.</div><button class="btn primary" data-action="saveCircuit">${state.editingId ? "Atualizar circuito" : "Salvar circuito no projeto"}</button>`;
}

export function summaryView() {
  const c = state.draft,
    raw = calc(c),
    r = {
      ...raw,
      totals: raw.loadResults?.length === c.loads.length ? raw.totals : {},
    },
    b = r.chosen;
  const show =
    state.step === 6 || state.mode === "technical" || state.page !== "wizard";
  return /* HTML */ `<section class="panel preview-top">
      <h2 class="summary-title">Resumo do circuito</h2>
      ${[
        ["Circuito", c.description || "Sem nome"],
        [
          "Grupos / equipamentos",
          `${c.loads.length} / ${fmt(r.totals.quantity, 0)}`,
        ],
        ["Potência ativa", fmt(r.totals.p) + " W"],
        ["Potência aparente", fmt(r.totals.s) + " VA"],
        [
          "Ligação",
          CONNECTIONS.find((x) => x[0] === c.connection)?.[1] || "A confirmar",
        ],
        ["Tensão", fmt(r.voltage) + " V"],
        ["Corrente da carga", fmt(r.ib) + " A"],
      ]
        .map(
          ([label, value]) =>
            /* HTML */ `<div class="summary-item">
              <span>${label}</span><strong>${esc(value)}</strong>
            </div>`,
        )
        .join("")}
    </section>
    <section class="panel preview-result">
      <h2 class="summary-title">
        Resultado preliminar ${helpButton("result")}
      </h2>
      ${show && !b && !r.pending
        ? /* HTML */ `<p>
            ${(r.selectionBlockers || []).length} bloqueio(s) impedem a seleção.
            Os motivos e os botões para revisão aparecem no resultado.
          </p>`
        : show
          ? `${r.protection.failed ? notice("Proteção informada incompatível.", "bad") : ""}<div class="result-mini"><div><span>Cabo preliminar</span><strong>${b ? fmt(b.section) + " mm²" : "Pendente"}</strong></div></div><div class="result-mini"><div><span>${c.breakerMode === "verify" ? "Disjuntor informado" : "Disjuntor sugerido"}</span><strong>${fmt(r.protection.nominal)} A</strong></div></div><div class="result-mini"><div><span>Maior queda estimada</span><strong>${b ? fmt(b.dvPct) + "%" : "Pendente"}</strong></div></div>`
          : "<p>O resultado será explicado na última etapa. A corrente já acompanha as alterações das cargas.</p>"}
      <p class="result-note">
        ${r.pending
          ? "Aguardando cálculo…"
          : "Pré-dimensionamento parcial; consulte as condições e pendências."}
      </p>
    </section>`;
}

export function gridResult(c) {
  const r = calc(c),
    pending = (r.diagnostics || []).filter((d) => d.field !== "shortIk");
  return /* HTML */ `<strong>${fmt(r.ib)} A · ${fmt(r.voltage)} V</strong
    ><small
      >${r.chosen
        ? "Cabo " +
          fmt(r.chosen.section) +
          " mm² · disj. " +
          fmt(r.protection.nominal) +
          " A"
        : "Seleção pendente"}</small
    ><small
      >${r.pending
        ? "Calculando…"
        : pending.length
          ? pending.length + " pendência(s)"
          : r.shortOk === null
            ? "Interrupção pendente"
            : "Verificações parciais"}</small
    >`;
}
