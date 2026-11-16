import { $, esc } from "./state.js";

let toastTimer,
  modalFocus = null;

let tableResizeObserver;

export function refreshTableOverflow() {
  tableResizeObserver?.disconnect();
  const entries = [];
  document.querySelectorAll("#mainPanel .board-table").forEach((table) => {
    const scroller = table.closest(".table-wrap");
    if (!scroller) return;
    const frame = document.createElement("div");
    frame.className = "table-overflow-frame";
    scroller.before(frame);
    frame.append(scroller);
    const update = () => {
      frame.dataset.moreRight =
        scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 1;
    };
    scroller.addEventListener("scroll", update, { passive: true });
    entries.push({ scroller, table, update });
    update();
  });
  tableResizeObserver = new ResizeObserver(() => {
    entries.forEach(({ update }) => update());
  });
  entries.forEach(({ scroller, table }) => {
    tableResizeObserver.observe(scroller);
    tableResizeObserver.observe(table);
  });
}

export function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4500);
}

export function modal(
  title,
  body,
  buttons = '<button class="btn secondary" data-close>Fechar</button>',
) {
  modalFocus = document.activeElement;
  $("modalRoot").innerHTML =
    `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${body}<div class="modal-foot">${buttons}</div></div>`;
  $("modalRoot").hidden = false;
  $("modalRoot").querySelector("input,button,select,a")?.focus();
}

export function closeModal() {
  $("modalRoot").hidden = true;
  $("modalRoot").innerHTML = "";
  modalFocus?.focus();
}
