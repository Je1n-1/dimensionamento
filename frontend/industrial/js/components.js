export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  edit: '<path d="m14 5 5 5M3 21l5-1L21 7l-5-5L3 15z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  folder: '<path d="M3 7V5h6l2 3h10v12H3zM3 11h18"/>',
  home: '<path d="m2 10 10-8 10 8M5 8v13h5v-7h4v7h5V8"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8z"/>',
  cable: '<path d="M3 8V4h18v16H3v-4m0-4h6l3-4 3 8 3-4h3"/>',
  infrastructure: '<path d="M4 4v17m16-17v17M4 6h16M4 12h16M4 18h16M8 6v12m8-12v12"/>',
  voltage: '<path d="M8 3h8m-6 0-5 18m9-18 5 18M3 21h18M7 15h10M9 9h6"/>',
  chart: '<path d="M3 3v18h19M7 17v-6h3v6m4 0V5h3v12m4 0v-9"/>',
  report: '<path d="M5 2h10l5 5v15H5zM14 2v6h6M8 12h9M8 16h9"/>',
  settings: '<path d="m9 3 1-2h4l1 2 3 2h3l2 4-2 2v3l2 2-2 4h-3l-3 2h-6l-3-2H3l-2-4 2-2v-3L1 9l2-4h3z"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z"/><path d="M12 7v6m0 3v1"/>',
  save: '<path d="M3 3h15l3 3v15H3zM7 3v6h9V3M7 21v-8h10v8"/>',
  export: '<path d="M5 8v13h15V8M12 16V2m-4 4 4-4 4 4"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  list: '<path d="M8 5h13M8 12h13M8 19h13M3 5h1m-1 7h1m-1 7h1"/>',
  motor: '<rect x="6" y="6" width="13" height="13" rx="2"/><path d="M3 9h3m-3 6h3m16-6h3m-3 6h3M9 3h7M9 10h7m-7 4h7M7 22v-3m10 3v-3"/>',
  nodes: '<rect x="9" y="2" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-5h14v5"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
  menu: '<path d="M3 5h18M3 12h18M3 19h18"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export function icon(name, className = '') {
  return `<svg class="icon ${escapeHTML(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}
export function badge(label = 'Não implementado', tone = 'neutral') {
  return `<span class="badge ${escapeHTML(tone)}">${escapeHTML(label)}</span>`;
}
export function action(label, symbol, { stage, primary = false, href, action: name } = {}) {
  const cls = `button${primary ? ' primary' : ''}`;
  if (href) return `<a class="${cls}" href="${escapeHTML(href)}">${icon(symbol)}${escapeHTML(label)}</a>`;
  return `<button class="${cls}" type="button" ${stage ? `disabled title="Disponível na Etapa ${stage}"` : `data-action="${escapeHTML(name)}"`}>${icon(symbol)}${escapeHTML(label)}</button>`;
}
export function metric(label, symbol, note, tone = 'blue', value = '—') {
  return `<article class="metric"><span class="icon-tile ${tone}">${icon(symbol)}</span><div><span class="metric-label">${escapeHTML(label)}</span><strong class="metric-value" ${value === '—' ? 'aria-label="Não disponível"' : ''}>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></div></article>`;
}
export function field(label, { type = 'text', placeholder = '', options, disabled = false, id, error = '' } = {}) {
  const attrs = `id="${escapeHTML(id)}" ${disabled ? 'disabled' : ''} ${error ? `aria-invalid="true" aria-describedby="${escapeHTML(id)}-error"` : ''}`;
  return `<label class="field" for="${escapeHTML(id)}"><span>${escapeHTML(label)}</span>${options
    ? `<select ${attrs}>${options.map(option => `<option>${escapeHTML(option)}</option>`).join('')}</select>`
    : `<input ${attrs} type="${escapeHTML(type)}" placeholder="${escapeHTML(placeholder)}">`}${error ? `<small id="${escapeHTML(id)}-error" class="error">${escapeHTML(error)}</small>` : ''}</label>`;
}
export function panel(title, symbol, content, actions = '', className = '') {
  return `<section class="panel ${escapeHTML(className)}"><div class="panel-header"><h2>${icon(symbol)}${escapeHTML(title)}</h2>${actions}</div>${content}</section>`;
}
export function emptyState(title, description, symbol = 'folder', extra = '') {
  return `<div class="empty-state"><span class="empty-icon">${icon(symbol)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p>${extra}</div>`;
}
export function table(columns, label, description) {
  return `<div class="table-scroll" role="region" aria-label="${escapeHTML(label)}" tabindex="0"><table><caption class="sr-only">${escapeHTML(label)}</caption><thead><tr>${columns.map(c => `<th scope="col">${escapeHTML(c)}</th>`).join('')}</tr></thead><tbody><tr><td colspan="${columns.length}" class="empty-cell">${icon('list')}<strong>Nenhum dado disponível</strong><span>${escapeHTML(description)}</span></td></tr></tbody></table></div>`;
}
export function notice(title, description, tone = 'blue') {
  return `<div class="notice ${escapeHTML(tone)}">${icon('info')}<div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(description)}</p></div></div>`;
}
