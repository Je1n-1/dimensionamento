/* Apresentação do quadro. Grandezas e totais são fornecidos pelo Python. */
window.VoltBoard = (() => {
  "use strict";
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmt = (v) =>
    v !== null && v !== undefined && v !== "" && Number.isFinite(+v)
      ? (+v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
      : "—";
  const phase = (s) =>
    String(s || "")
      .replace(/A/g, "R")
      .replace(/B/g, "S")
      .replace(/C/g, "T")
      .split("")
      .join("/");
  const help = (key) =>
    `<button class="help-btn" data-help="${key}" aria-label="Ajuda do quadro de cargas">?</button>`;
  const stat = (label, value) =>
    `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`;
  function render(panel, circuits, results, info, interactive = true) {
    if (!panel)
      return '<div class="notice warn">Não foi possível atualizar o quadro. Tente novamente com o servidor Python aberto.</div>';
    if (!circuits.length)
      return '<p class="empty-board">Nenhum circuito salvo. Cadastre um circuito, importe seu CSV ou abra o exemplo de residência.</p>';
    const lookup = new Map(results.map((r) => [r.c.id, r]));
    const tableRows = panel.rows
      .map((row, index) => {
        const c = circuits[index],
          r = lookup.get(c.id),
          prot = r?.protection,
          source = c.source;
        const nominal =
          c.breakerMode === "verify" ? c.breakerCurrent : prot?.nominal;
        const state = prot?.failed
          ? "Incompatível"
          : !row.valid
            ? "Revisar grandezas"
            : r?.chosen
              ? "Verificações parciais"
              : "Dimensionamento pendente";
        return `<tr><td><strong>${esc(row.number)} · ${esc(row.description)}</strong></td><td>${esc({ fn: "F + N", ff: "F + F", tri: "3F", legacy: "Confirmar" }[row.connection] || "Confirmar")}</td><td>${fmt(row.voltage)}</td><td>${fmt(row.s)}</td><td>${fmt(row.p)}</td><td>${fmt(row.powerFactor)}</td><td>${esc(phase(row.phaseSet))}</td><td>${fmt(row.ib)}</td><td>${fmt(nominal)}<small class="cell-note">${c.breakerMode === "verify" ? "Informado" : "Sugerido"}</small></td><td><span class="tag ${prot?.failed ? "bad" : "pending"}">${state}</span>${r?.chosen ? `<small class="cell-note">Cabo: ${fmt(r.chosen.section)} mm²</small>` : ""}</td>${interactive ? `<td><div class="table-actions"><button data-edit="${esc(c.id)}">Editar</button><button data-duplicate="${esc(c.id)}">Duplicar</button><button data-delete="${esc(c.id)}">Excluir</button></div></td>` : ""}</tr>`;
      })
      .join("");
    const sourceRows = circuits
      .filter((c) => c.source)
      .map(
        (c) =>
          `<tr><td>${esc(c.number)} · ${esc(c.description)}</td><td>${esc(c.source.filename)}</td><td>${esc(c.source.scheme)}</td><td>${fmt(c.source.p)}</td><td>${fmt(c.source.s)}</td><td>${fmt(c.source.current)}</td><td>${fmt(c.source.breaker)}</td></tr>`,
      )
      .join("");
    return `<div class="stats-row board-totals">${stat("Potência ativa instalada", fmt(panel.p) + " W")}${stat("Soma dos VA dos circuitos", fmt(panel.sumVA) + " VA")}${stat("Maior corrente de fase", fmt(panel.maxCurrent) + " A")}${stat("Diferença entre maior e menor fase", fmt(panel.spread) + " A")}</div>
 <div class="phase-cards">${panel.phases.map((p) => `<div class="phase-card"><span>Fase ${p.label} <small>(${p.phase})</small></span><strong>${fmt(p.current)} <small>A</small></strong><p>${fmt(p.p)} W atribuídos · ${p.count} circuito(s)</p></div>`).join("")}</div>
 ${panel.complete ? `<p class="board-explanation">Maior corrente: <strong>${fmt(panel.maxCurrent)} A, fase(s) ${panel.maxPhases.join("/")}</strong>. Esse valor representa a fase mais carregada; não é a soma das correntes R, S e T. ${help("panelTotals")}</p>` : '<div class="notice warn">Totais indisponíveis: revise as ligações, fases e grandezas pendentes. Circuitos incompletos não são tratados como carga zero.</div>'}
 ${panel.issues.map((issue) => `<div class="notice warn">${esc(issue)}</div>`).join("")}
 <h3>Circuitos e proteção ${help("panelProtection")}</h3><p class="hint">Valores calculados com todas as cargas ligadas. F + N indica os condutores ativos; o PE deve ser previsto e verificado separadamente.</p>
 <div class="table-wrap" tabindex="0" role="region" aria-label="Circuitos do quadro, role para ver todas as colunas"><table class="data-table board-table"><thead><tr><th>Circuito</th><th>Ligação</th><th>V</th><th>VA</th><th>W</th><th>FP</th><th>Fases</th><th>I (A)</th><th>Disjuntor (A)</th><th>Verificação</th>${interactive ? "<th>Ações</th>" : ""}</tr></thead><tbody>${tableRows}</tbody><tfoot><tr><th colspan="3">Total do projeto</th><td>${fmt(panel.sumVA)}</td><td>${fmt(panel.p)}</td><td colspan="${interactive ? "6" : "5"}">Maior corrente de fase: ${fmt(panel.maxCurrent)} A</td></tr></tfoot></table></div>
 <details class="details phase-detail"><summary>Distribuição de cada circuito entre as fases ${help("panelPhases")}</summary><p class="hint">Em fase–fase, a potência é rateada igualmente entre as duas fases para organização do quadro. A corrente inteira percorre ambas. Os totais de corrente consideram os ângulos das cargas.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Circuito</th><th>R (W)</th><th>S (W)</th><th>T (W)</th><th>R (A)</th><th>S (A)</th><th>T (A)</th></tr></thead><tbody>${panel.rows
   .map(
     (r) =>
       `<tr><td>${esc(r.number)} · ${esc(r.description)}</td>${[
         "phasePower",
         "phaseCurrent",
       ]
         .map((k) =>
           "ABC"
             .split("")
             .map((p) => `<td>${fmt(r[k][p])}</td>`)
             .join(""),
         )
         .join("")}</tr>`,
   )
   .join("")}</tbody><tfoot><tr><th>Total por fase</th>${["p", "current"]
   .map((k) =>
     "ABC"
       .split("")
       .map(
         (p) => `<td>${fmt(panel.phases.find((x) => x.phase === p)?.[k])}</td>`,
       )
       .join(""),
   )
   .join("")}</tr></tfoot></table></div></details>
 <details class="details"><summary>Como interpretar os totais ${help("panelTotals")}</summary><p>As potências ativas (W) são somadas. “Soma dos VA” soma os valores dos circuitos, sem representar necessariamente a potência aparente resultante da instalação. As correntes de cada fase são somadas como fasores, com FP indutivo e sequência R/S/T.</p><p>Esta análise mostra distribuição de cargas na tensão nominal. Não aplica fator de demanda, não dimensiona o alimentador ou o neutro e não calcula harmônicas ou desequilíbrio de tensão. A diferença entre fases é informativa, sem limite normativo presumido.</p></details>
 ${sourceRows ? `<details class="details"><summary>Valores originais do CSV e dados pendentes</summary><p>Estes são registros do arquivo original e não acompanham alterações no editor. Cada linha importada é uma carga agregada: a quantidade real de equipamentos e suas distâncias não foram fornecidas. Preencha instalação, condutores, agrupamento, temperatura, percurso, limite de queda e características da proteção antes de dimensionar.</p>${info ? `<p>Disjuntor da linha TOTAL original: <strong>${fmt(info.generalBreaker)} A</strong>, somente registro. Não foi dimensionado nem verificado como proteção geral.</p>` : ""}<div class="table-wrap"><table class="data-table"><thead><tr><th>Circuito</th><th>Arquivo</th><th>Esquema original</th><th>W</th><th>VA</th><th>I (A)</th><th>Disjuntor (A)</th></tr></thead><tbody>${sourceRows}</tbody></table></div>${(info?.warnings || []).map((w) => `<p class="notice warn">${esc(w)}</p>`).join("")}</details>` : ""}`;
  }
  return { render };
})();
