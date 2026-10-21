import { toast } from "./dom.js";
import { M, OLD_STORAGE, STORAGE, state, syncTechnical } from "./state.js";

export function persist() {
  syncTechnical();
  try {
    localStorage.setItem(STORAGE, JSON.stringify(M.projectData(state)));
    return true;
  } catch {
    toast("Não foi possível gravar no navegador. Exporte um backup JSON.");
    return false;
  }
}

export function load() {
  try {
    const raw =
      localStorage.getItem(STORAGE) || localStorage.getItem(OLD_STORAGE);
    if (raw) Object.assign(state, M.readProject(JSON.parse(raw)));
  } catch (error) {
    toast(
      "Falha ao restaurar: " +
        error.message +
        ". O armazenamento anterior foi preservado.",
    );
  }
}
