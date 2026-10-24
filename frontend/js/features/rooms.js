import { M, esc, fmt, state, ui, requestRender } from "../core/state.js";
import { persist } from "../core/storage.js";
import { toast } from "../core/dom.js";
import { field, notice } from "../views/components.js";

const TYPES = [
  ["living", "Sala"],
  ["bedroom", "Dormitório"],
  ["kitchen", "Cozinha / copa"],
  ["laundry", "Área de serviço / lavanderia"],
  ["bathroom", "Banheiro"],
  ["balcony", "Varanda"],
  ["other", "Outro cômodo residencial"],
];
export function defaultRoom(name) {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const type = /cozinha|copa/.test(n)
    ? "kitchen"
    : /lavanderia|servico/.test(n)
      ? "laundry"
      : /banheiro|lavabo/.test(n)
        ? "bathroom"
        : /quarto|dormitorio/.test(n)
          ? "bedroom"
          : /sala/.test(n)
            ? "living"
            : /varanda/.test(n)
              ? "balcony"
              : "other";
  return {
    name,
    type,
    area: "",
    perimeter: "",
    sockets: "",
    lights: "",
    distance: "",
    powerFactor: "1",
    connection: "fn",
  };
}
export function roomRows() {
  return state.context.rooms.map(
    (name) =>
      state.context.roomSpecs?.find((r) => r.name === name) ||
      defaultRoom(name),
  );
}
const selectedKinds = () => ui.roomKinds || { sockets: true, lighting: true };
const previewKey = () =>
  JSON.stringify([state.context.propertyType, roomRows(), selectedKinds()]);
export function clearRoomPreview() {
  ui.roomPreview = null;
  ui.roomError = "";
}
const cell = (r, i, key, label, options = {}) =>
  field(label, key, {
    scope: "room-spec",
    index: i,
    value: r[key],
    ...options,
  });
export function roomPlannerView() {
  const rows = roomRows(),
    preview = ui.roomPreview?.key === previewKey() ? ui.roomPreview : null;
  return /* HTML */ `<div class="room-planner">
    <div class="room-planner-heading">
      <div>
        <h3>Tomadas e iluminação por cômodo</h3>
        <p>
          Preencha todos os ambientes aqui. Deixe as quantidades em branco para
          usar os mínimos sugeridos.
        </p>
      </div>
    </div>
    <div class="bulk-room-add">
      <label for="bulkRooms">Adicionar vários cômodos</label
      ><textarea
        id="bulkRooms"
        rows="2"
        placeholder="Sala, Cozinha, Quarto 1, Quarto 2, Banheiro"
        maxlength="6000"
      ></textarea
      ><button class="btn secondary" data-room-action="add">
        Adicionar cômodos de uma vez
      </button>
    </div>
    ${!["house", "apartment"].includes(state.context.propertyType)
      ? notice(
          "A sugestão residencial está disponível para casas e apartamentos. Para este tipo de imóvel, informe as cargas de projeto no inventário.",
          "warn",
        )
      : ""}
    <div class="room-kind-options">
      <label
        ><input
          type="checkbox"
          data-room-kind="sockets"
          ${selectedKinds().sockets ? "checked" : ""}
        />
        Incluir tomadas de uso geral</label
      ><label
        ><input
          type="checkbox"
          data-room-kind="lighting"
          ${selectedKinds().lighting ? "checked" : ""}
        />
        Incluir iluminação</label
      >
    </div>
    ${rows.length
      ? /* HTML */ `<div class="table-wrap">
          <table class="data-table room-planner-table">
            <caption>
              Previsão residencial · NBR 5410:2004, corrigida 2008 · 9.5.2
            </caption>
            <thead>
              <tr>
                <th>Cômodo e uso</th>
                <th>Dimensões</th>
                <th>Pontos previstos</th>
                <th>Alimentação e percurso</th>
                <th>Prévia</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((r, i) => {
                  const p = preview?.rooms[i];
                  return /* HTML */ `<tr>
                    <td>
                      <strong>${esc(r.name)}</strong>${cell(
                        r,
                        i,
                        "type",
                        `Uso · ${esc(r.name)}`,
                        { options: TYPES },
                      )}
                    </td>
                    <td>
                      ${cell(r, i, "area", `Área (m²) · ${esc(r.name)}`, {
                        min: 0.01,
                      })}${cell(
                        r,
                        i,
                        "perimeter",
                        `Perímetro (m) · ${esc(r.name)}`,
                        { min: 0.01 },
                      )}
                    </td>
                    <td>
                      ${cell(r, i, "sockets", `Tomadas · ${esc(r.name)}`, {
                        min: 0,
                        max: 1000,
                        hint: "Em branco: mínimo sugerido",
                      })}${cell(
                        r,
                        i,
                        "lights",
                        `Pontos de luz · ${esc(r.name)}`,
                        { min: 0, max: 1000, hint: "Em branco: 1 ponto" },
                      )}
                    </td>
                    <td>
                      ${cell(
                        r,
                        i,
                        "distance",
                        `Distância do quadro (m) · ${esc(r.name)}`,
                        { min: 0 },
                      )}
                      <details>
                        <summary>Ligação e fator de potência</summary>
                        ${cell(r, i, "connection", `Ligação · ${esc(r.name)}`, {
                          options: [
                            ["fn", "Fase + neutro"],
                            ...(state.supply.phases !== "mono"
                              ? [["ff", "Fase + fase"]]
                              : []),
                          ],
                        })}${cell(r, i, "powerFactor", `FP · ${esc(r.name)}`, {
                          min: 0.01,
                          max: 1,
                          hint: "Hipótese inicial 1; ajuste conforme as cargas.",
                        })}
                      </details>
                    </td>
                    <td>
                      ${p
                        ? /* HTML */ `<strong
                              >${p.ready
                                ? "Prévia calculada"
                                : "Revisar dados"}</strong
                            >${selectedKinds().sockets && p.minSockets != null
                              ? /* HTML */ `<p>
                                    Mínimo: ${p.minSockets} pontos de tomada
                                  </p>
                                  <p>
                                    ${p.sockets} ponto(s) · ${fmt(p.socketsVA)}
                                    VA
                                  </p>`
                              : ""}${selectedKinds().lighting &&
                            p.lightingVA != null
                              ? /* HTML */ `<p>
                                  ${p.lights} ponto(s) de luz ·
                                  ${fmt(p.lightingVA)} VA
                                </p>`
                              : ""}${p.issues
                              .map((x) => `<p class="text-bad">${esc(x)}</p>`)
                              .join("")}
                            <details>
                              <summary>Critérios e observações</summary>
                              ${p.notes.map((x) => `<p>${esc(x)}</p>`).join("")}
                            </details>`
                        : "Informe as dimensões e calcule a prévia."}
                    </td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>`
      : notice(
          "Cole os nomes ou use os cartões de cômodos comuns abaixo para montar a grade.",
        )}
    <p class="hint">
      Ponto de tomada não é quantidade de aparelhos nem de módulos da placa. As
      potências sugeridas são em VA; iluminação representa a previsão do
      ambiente, não watts por lâmpada. A distância é de ida: revise depois os
      percursos distribuídos no circuito.
    </p>
    ${ui.roomError ? notice(esc(ui.roomError), "bad") : ""}
    <div class="room-planner-actions">
      <button
        class="btn secondary"
        data-room-action="preview"
        ${ui.roomBusy ? "disabled" : ""}
      >
        ${ui.roomBusy ? "Calculando…" : "Calcular prévia dos cômodos"}</button
      ><button
        class="btn primary"
        data-room-action="apply"
        ${preview?.complete ? "" : "disabled"}
      >
        Aplicar grupos selecionados ao inventário
      </button>
    </div>
    <p class="hint">
      Aplicação em lote e editável. Itens manuais e circuitos já salvos são
      preservados. Não aplica a redução opcional de 600 VA de três para dois
      pontos; usa a atribuição geral mais conservadora. O dimensionamento de
      cabos ainda utiliza a base histórica de 1997.
    </p>
  </div>`;
}
async function previewRooms() {
  if (ui.roomBusy) return;
  const key = previewKey();
  ui.roomBusy = true;
  clearRoomPreview();
  requestRender();
  try {
    const response = await fetch("/api/residential", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyType: state.context.propertyType,
        rooms: roomRows(),
        include: selectedKinds(),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || "Falha na previsão residencial.");
    if (key !== previewKey())
      throw Error("Os cômodos mudaram. Calcule a prévia novamente.");
    ui.roomPreview = { ...data, key };
  } catch (e) {
    ui.roomError = e.message;
  } finally {
    ui.roomBusy = false;
    requestRender();
  }
}
export function applyRoomPreview() {
  const preview = ui.roomPreview;
  if (!preview?.complete || preview.key !== previewKey()) {
    toast("Calcule uma prévia válida antes de aplicar.");
    return false;
  }
  const specs = roomRows(),
    equipment = structuredClone(state.context.equipment);
  let changed = 0,
    skipped = 0;
  for (const row of preview.rooms) {
    const spec = specs.find((r) => r.name === row.name);
    for (const [kind, name, quantity, power] of [
      ["sockets", "Tomadas de uso geral", row.sockets, row.socketsVA],
      ["lighting", "Iluminação", row.lights, row.lightingVA],
    ]) {
      if (!selectedKinds()[kind]) continue;
      const same = equipment.filter(
        (e) => e.kind === kind && e.room === row.name,
      );
      const managed = same.find((e) => e.residentialSource === "2004-room");
      if (
        same.some((e) => e !== managed) ||
        (managed &&
          state.circuits.some(
            (c) =>
              c.planningOrigin === managed.id ||
              c.planningOrigin?.startsWith(managed.id + ":"),
          ))
      ) {
        skipped++;
        continue;
      }
      const item = {
        id: managed?.id || M.id(),
        kind,
        name,
        room: row.name,
        quantity: String(quantity),
        power: String(power),
        unit: "VA",
        powerBasis: "total",
        residentialSource: "2004-room",
        powerFactor: spec.powerFactor,
        connection: spec.connection,
        distance: spec.distance,
      };
      if (managed) Object.assign(managed, item);
      else equipment.push(item);
      changed++;
    }
  }
  if (equipment.length > 100) {
    toast(
      "O lote excede 100 grupos. Reduza os ambientes ou os grupos existentes.",
    );
    return false;
  }
  state.context.equipment = equipment;
  ui.proposal = null;
  ui.proposalError = "";
  persist();
  requestRender();
  toast(
    `${changed} grupo(s) aplicado(s). ${skipped ? `${skipped} grupo(s) preservado(s): já cadastrados manualmente ou aplicados a circuitos. ` : ""}Revise em Detalhar equipamentos.`,
  );
  return true;
}
export function roomPlannerClick(d) {
  if (!d.roomAction) return false;
  if (d.roomAction === "preview") previewRooms();
  if (d.roomAction === "apply") applyRoomPreview();
  if (d.roomAction === "add") {
    const names = document
      .getElementById("bulkRooms")
      .value.split(/[,;\n]+/)
      .map((n) => n.trim().slice(0, 60))
      .filter(Boolean);
    const rooms = [...new Set([...state.context.rooms, ...names])];
    if (rooms.length > 100) {
      toast("Limite de 100 cômodos.");
      return true;
    }
    state.context.rooms = rooms;
    clearRoomPreview();
    ui.proposal = null;
    persist();
    requestRender();
  }
  return true;
}
export function roomPlannerInput(target) {
  if (target.dataset.roomKind) {
    ui.roomKinds = {
      ...selectedKinds(),
      [target.dataset.roomKind]: target.checked,
    };
    clearRoomPreview();
    requestRender();
    return true;
  }
  const key = target.dataset.roomSpec;
  if (!key) return false;
  const rows = roomRows(),
    row = rows[+target.dataset.index];
  if (
    !row ||
    ![
      "type",
      "area",
      "perimeter",
      "sockets",
      "lights",
      "distance",
      "powerFactor",
      "connection",
    ].includes(key)
  )
    return false;
  row[key] = target.value;
  state.context.roomSpecs = rows;
  clearRoomPreview();
  ui.proposal = null;
  persist();
  // Input changes invalidate the displayed preview without replacing the focused input.
  document
    .querySelector('[data-room-action="apply"]')
    ?.setAttribute("disabled", "");
  document
    .querySelectorAll(".room-planner-table tbody tr td:last-child")
    .forEach(
      (el) => (el.textContent = "Dados alterados. Calcule a prévia novamente."),
    );
  return true;
}
