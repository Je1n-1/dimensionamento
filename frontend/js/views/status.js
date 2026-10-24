import { esc } from "../core/state.js";
import { criterionChecks } from "./report.js";

export function calculationState(c, r) {
  if (r.pending)
    return {
      label: "Cálculo indisponível",
      tone: "pending",
      detail: "Restabeleça a conexão com o servidor para calcular.",
    };
  if (
    r.issues?.length ||
    r.protection?.failed ||
    criterionChecks(c, r).some(([, ok]) => ok === false)
  )
    return {
      label: "Revisar",
      tone: "pending",
      detail:
        "Há dados inválidos ou critérios não atendidos. Abra as verificações.",
    };
  if (!r.chosen)
    return {
      label: "Dados pendentes",
      tone: "pending",
      detail:
        "Complete os dados indicados no resultado para selecionar cabo e disjuntor.",
    };
  return {
    label: "Pré-dimensionado",
    tone: "partial",
    detail:
      "Cabo e disjuntor calculados no modelo. As verificações complementares permanecem pendentes.",
  };
}

export function statusBadge(c, r) {
  const status = calculationState(c, r);
  return /* HTML */ `<span
    class="status-pill ${status.tone}"
    title="${esc(status.detail)}"
    >${status.label}</span
  >`;
}
