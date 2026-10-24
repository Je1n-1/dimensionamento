import { $ } from "./state.js";
import { closeModal } from "./dom.js";

// A modal owns keyboard navigation while open; grid shortcuts never run behind it.
export function handleKeydown(ev) {
  const root = $("modalRoot");
  if (!root.hidden) {
    if (ev.key === "Escape") {
      ev.preventDefault();
      closeModal();
      return;
    }
    if (ev.key === "Tab") {
      const nodes = [
        ...root.querySelectorAll(
          "button,input,select,textarea,a[href],[tabindex]",
        ),
      ].filter(
        (el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length,
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (
        !nodes.includes(document.activeElement) ||
        (!ev.shiftKey && document.activeElement === last)
      ) {
        ev.preventDefault();
        first?.focus();
      } else if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last?.focus();
      }
    }
    return;
  }
  if (ev.key !== "Enter" || ev.target.dataset.gridRow === undefined) return;
  ev.preventDefault();
  const row = +ev.target.dataset.gridRow,
    col = ev.target.dataset.gridCol;
  const next = [...document.querySelectorAll(`[data-grid-col="${col}"]`)].find(
    (el) => +el.dataset.gridRow > row && !el.closest("[hidden]"),
  );
  next?.focus();
}
