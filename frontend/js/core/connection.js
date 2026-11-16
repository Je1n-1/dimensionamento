import { $, esc, ui, requestRender } from "./state.js";

let checking = false;
export function paintConnectionStatus() {
  const el = $("connectionStatus");
  el.hidden = !ui.serverOffline && !ui.serviceError;
  if (el.hidden) {
    el.replaceChildren();
    return;
  }
  const port =
    location.port && location.port !== "8000" ? ` --port ${location.port}` : "";
  el.innerHTML = /* HTML */ `<strong
      >${ui.serverOffline
        ? "Servidor Python desconectado"
        : "Não foi possível atualizar os cálculos"}</strong
    >
    <p>
      ${esc(
        ui.serviceError ||
          "A página continua aberta, mas novos cálculos dependem do servidor.",
      )}
    </p>
    <p>
      Na pasta do VoltCalc, execute <code>python server.py${port}</code> ou abra
      <strong>Iniciar_VoltCalc.bat</strong>. Mantenha a janela do servidor
      aberta.
    </p>
    <button class="btn secondary small" data-action="retry">
      Tentar novamente
    </button>`;
}
export async function checkConnection() {
  if (checking) return false;
  checking = true;
  const wasOffline = ui.serverOffline;
  try {
    const response = await fetch("/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw Error("Offline");
    ui.serverOffline = false;
    if (wasOffline) {
      ui.serviceError = "";
      requestRender();
    }
    return true;
  } catch {
    ui.serverOffline = true;
    return false;
  } finally {
    checking = false;
    paintConnectionStatus();
  }
}
export function monitorConnection() {
  checkConnection();
  setInterval(() => {
    if (!document.hidden) checkConnection();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkConnection();
  });
  window.addEventListener("online", checkConnection);
  window.addEventListener("offline", checkConnection);
}
