import { $, esc, state } from "../core/state.js";

export function helpButton(key, label = "Saiba mais") {
  return `<button type="button" class="help-btn" data-help="${esc(key)}" aria-label="${esc(label)}">?</button>`;
}

export function field(label, key, options = {}) {
  const value = options.value !== undefined ? options.value : state.draft[key],
    scope = options.scope || "field",
    index = options.index;
  const inputId = `${scope}-${index === undefined ? "" : index + "-"}${key}${options.suffix || ""}`;
  const attrs = `id="${inputId}" data-${scope}="${key}" ${index !== undefined ? `data-index="${index}"` : ""}`;
  let input = options.options
    ? `<select ${attrs}>${options.options.some(([v]) => String(v) === String(value)) ? "" : '<option value="" selected>Selecione · pendente</option>'}${options.options.map(([v, t]) => `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`
    : `<input ${attrs} type="${options.text ? "text" : "number"}" value="${esc(value)}" ${options.text ? 'maxlength="100"' : 'step="any"'} ${options.min !== undefined ? `min="${options.min}"` : ""} ${options.max !== undefined ? `max="${options.max}"` : ""}>`;
  return `<div class="field ${options.className || ""}"><div class="field-caption"><label for="${inputId}">${label}</label>${options.help ? helpButton(options.help, `Ajuda: ${label}`) : ""}</div>${input}${options.hint ? `<span class="hint">${options.hint}</span>` : ""}</div>`;
}

export function notice(text, kind = "") {
  return `<div class="notice ${kind}">${text}</div>`;
}

export function stat(title, value) {
  return `<div class="stat"><small>${title}</small><strong>${value}</strong></div>`;
}

export function check(title, value, ok) {
  return `<div class="check-row"><span>${title}</span><strong class="${ok === true ? "text-ok" : ok === false ? "text-bad" : "text-pending"}">${esc(value || "")} ${ok === true ? "· Atende neste critério" : ok === false ? "· Não atende" : "· Pendente"}</strong></div>`;
}
