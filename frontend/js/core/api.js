import { resultKey, state, ui } from "./state.js";

const cache = new Map(),
  pending = new Map();

export async function prepareBoard() {
  const key = JSON.stringify([state.circuits, state.supply]);
  if (key === ui.boardKey && ui.boardCache) return true;
  try {
    const response = await fetch("/api/panel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circuits: state.circuits, supply: state.supply }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    if (key !== JSON.stringify([state.circuits, state.supply])) return false;
    ui.boardCache = data;
    ui.boardKey = key;
    return true;
  } catch {
    ui.boardCache = null;
    ui.boardKey = "";
    ui.serviceError =
      "Não foi possível atualizar o quadro de cargas. Mantenha o servidor Python aberto e tente novamente.";
    return false;
  }
}

export function calc(c) {
  return (
    cache.get(resultKey(c)) || {
      c,
      ib: null,
      voltage: null,
      loaded: null,
      totals: {},
      fct: null,
      fca: null,
      combinedFactor: null,
      requiredAmpacity: null,
      chosen: null,
      cableCandidate: null,
      issues: [],
      notices: [],
      criteria: {},
      determining: [],
      protection: {},
      segments: [],
      endpoints: [],
      pending: true,
    }
  );
}

export async function prepare(circuits) {
  const unique = [...new Map(circuits.map((c) => [resultKey(c), c])).values()];
  const missing = unique.filter(
    (c) => !cache.has(resultKey(c)) && !pending.has(resultKey(c)),
  );
  if (missing.length) {
    const snapshots = JSON.parse(JSON.stringify(missing)),
      reactance = state.reactance,
      supply = structuredClone(state.supply),
      keys = snapshots.map((c) => JSON.stringify([c, reactance, supply]));
    const task = (async () => {
      try {
        const response = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ circuits: snapshots, reactance, supply }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (
          !response.ok ||
          !Array.isArray(data.results) ||
          data.results.length !== keys.length
        )
          throw Error(data.error || "Resposta inválida.");
        data.results.forEach((r, i) => cache.set(keys[i], r));
        ui.serviceError = "";
        while (cache.size > 1000) cache.delete(cache.keys().next().value);
      } catch (error) {
        ui.serviceError =
          "Servidor indisponível ou dados recusados. Mantenha o Python aberto e tente novamente.";
      } finally {
        keys.forEach((k) => pending.delete(k));
      }
    })();
    keys.forEach((k) => pending.set(k, task));
  }
  await Promise.all(
    unique.map((c) => pending.get(resultKey(c))).filter(Boolean),
  );
  return unique.every((c) => cache.has(resultKey(c)));
}
