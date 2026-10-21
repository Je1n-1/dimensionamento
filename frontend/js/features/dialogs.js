import { modal } from "../core/dom.js";
import { $, HELP, esc, state } from "../core/state.js";
import { field } from "../views/components.js";

export function showHelp(key) {
  const help = HELP[key] || HELP.result;
  modal(
    help.title,
    help.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("") +
      (help.source
        ? `<p><a href="${esc(help.source)}" target="_blank" rel="noopener noreferrer">Consultar fundamento técnico</a></p>`
        : ""),
  );
}

export function settings() {
  modal(
    "Configurações e backups",
    `<p>Projetos ficam neste navegador. O backup inclui equipamentos, distâncias, alimentação, rascunho e configurações de cálculo.</p><div class="field"><label for="reactanceInput">Reatância estimada (Ω/km)</label><input id="reactanceInput" type="number" min="0" max="2" step=".01" value="${esc(state.reactance)}"></div><p class="hint">Estimativa comum a todos os trechos. Dados de fabricantes ainda não foram integrados.</p><div class="field-row"><button class="btn secondary" data-action="export">Exportar backup JSON</button><button class="btn secondary" data-action="import">Importar backup JSON</button><input id="importFile" type="file" accept=".json,application/json" hidden></div>`,
    `<button class="btn secondary" data-close>Cancelar</button><button class="btn primary" data-action="saveSettings">Salvar configurações</button>`,
  );
}
