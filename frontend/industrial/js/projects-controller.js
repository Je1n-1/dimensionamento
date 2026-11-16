import { createEntity } from './core/model.js';
import { INDUSTRIAL_STORAGE, STATUS_LABELS } from './core/local-repository.js';
import { escapeHTML as esc } from './components.js';

/** Orchestrates project lifecycle only. Consumers and calculations remain untouched. */
export function createProjectController({ root, repository, contract, store, render }) {
  const view = { all: [], rows: [], current: null, query: { search: '', status: 'all', sort: 'updated' }, error: '', unavailable: false };
  let ticket = 0, busy = false, editing = null;
  const dialog = document.createElement('dialog');
  dialog.id = 'project-dialog'; dialog.setAttribute('aria-labelledby', 'project-dialog-title');
  root.append(dialog);
  const feedback = document.createElement('div');
  feedback.className = 'project-feedback'; feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); feedback.hidden = true;
  root.append(feedback);
  let feedbackTimer;
  function notify(message, error = false) {
    clearTimeout(feedbackTimer); feedback.textContent = message; feedback.classList.toggle('is-error', error); feedback.hidden = false;
    feedbackTimer = setTimeout(() => { feedback.hidden = true; }, error ? 15000 : 6000);
  }
  function publish(filterOnly = false) { view.current = store.snapshot(); render(false, { filterOnly }); }
  async function refresh({ restore = false, reconcile = false, filterOnly = false } = {}) {
    const version = ++ticket;
    try {
      const all = await repository.list();
      const rows = await repository.list(view.query);
      let restored;
      if (restore) { const id = await repository.getCurrentId(); restored = id ? await repository.load(id) : null; }
      if (reconcile) {
        const id = store.snapshot()?.id;
        restored = id && all.some(p => p.id === id) ? await repository.load(id) : null;
      }
      if (version !== ticket) return;
      view.all = all; view.rows = rows; view.error = ''; view.unavailable = false;
      if (restore || reconcile) { if (restored) store.setDraft(restored); else store.clear(); }
    } catch (error) {
      if (version !== ticket) return;
      view.error = error.message; view.unavailable = true; view.all = []; view.rows = [];
    }
    publish(filterOnly);
  }
  function modal(content) {
    dialog.innerHTML = content;
    dialog.showModal();
  }
  function editForm(project = null) {
    editing = project ? structuredClone(project) : createEntity(contract, 'Project');
    modal(`<form id="project-form"><h2 id="project-dialog-title">${project ? 'Editar projeto' : 'Novo projeto industrial'}</h2>
      <label class="field" for="project-title">Nome do projeto<input id="project-title" name="name" required maxlength="120" value="${esc(editing.name)}" placeholder="Ex.: Linha de bombeamento" autofocus></label>
      <label class="field" for="project-description">Descrição<textarea id="project-description" name="description" maxlength="2000" rows="4" placeholder="Objetivo e localização do projeto">${esc(editing.description)}</textarea></label>
      <label class="field" for="project-workflow">Status do trabalho<select id="project-workflow" name="workflowStatus">${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${editing.workflowStatus === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <p class="dialog-note">Este status é organizacional. Os cálculos e verificações elétricas permanecem pendentes.</p>
      <p class="form-error" role="alert" id="project-form-error"></p>
      <div class="dialog-actions"><button type="button" class="button" data-dialog-cancel>Cancelar</button><button type="submit" class="button primary">Salvar projeto</button></div></form>`);
  }
  function confirmDelete(project) {
    editing = structuredClone(project);
    modal(`<form id="delete-project-form"><h2 id="project-dialog-title">Excluir projeto?</h2><p>Excluir <strong>${esc(project.name)}</strong> e todos os seus dados industriais?</p><p>Essa ação não pode ser desfeita. Outros projetos e o residencial serão preservados.</p><p id="project-form-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" data-dialog-cancel autofocus>Cancelar</button><button type="submit" class="button danger">Excluir projeto</button></div></form>`);
  }
  async function operation(work) {
    if (busy) return;
    busy = true; root.classList.add('project-busy');
    try { await work(); } catch (error) { notify(error.message, true); }
    finally { busy = false; root.classList.remove('project-busy'); }
  }
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('click', event => { if (event.target.closest('[data-dialog-cancel]') && !busy) dialog.close(); });
  dialog.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const isDelete = event.target.id === 'delete-project-form';
    if (!isDelete) {
      const nameInput = dialog.querySelector('[name="name"]');
      if (!nameInput.value.trim()) { nameInput.setCustomValidity('Informe o nome do projeto.'); nameInput.reportValidity(); return; }
    }
    await operation(async () => {
      const errorNode = dialog.querySelector('#project-form-error');
      errorNode.textContent = '';
      try {
        if (isDelete) {
          await repository.delete(editing.id, editing.storageRevision);
          if (store.snapshot()?.id === editing.id) store.clear();
          dialog.close(); await refresh(); notify('Projeto excluído.');
        } else {
          const data = new FormData(event.target);
          const next = structuredClone(editing);
          next.name = data.get('name').trim(); next.description = data.get('description').trim(); next.workflowStatus = data.get('workflowStatus');
          // Metadata edits do not change electrical inputs or calculation revisions.
          const saved = await repository.save(next, editing.storageRevision);
          await repository.setCurrentId(saved.id);
          store.setDraft(saved); dialog.close(); await refresh(); notify(`Projeto ${saved.name} salvo. Cadastre o quadro e suas cargas.`);
          if (editing.storageRevision === 0) location.hash = '#/consumidores';
        }
      } catch (error) { errorNode.textContent = error.message; }
    });
  });
  dialog.addEventListener('input', event => { if (event.target.name === 'name') event.target.setCustomValidity(''); });
  root.addEventListener('click', event => {
    const control = event.target.closest('[data-project-action], [data-action]');
    if (!control) return;
    const name = control.dataset.projectAction || control.dataset.action;
    if (!['new-project', 'refresh-projects', 'save-project', 'open', 'edit', 'duplicate', 'delete', 'close'].includes(name)) return;
    operation(async () => {
      if (name === 'refresh-projects') return refresh({ restore: true });
      if (view.unavailable) throw new Error(view.error);
      if (name === 'new-project') return editForm();
      const current = store.snapshot(), id = control.dataset.projectId || current?.id;
      if (name === 'save-project') {
        if (!current) throw new Error('Crie ou abra um projeto antes de salvar.');
        const saved = await repository.save(current, current.storageRevision);
        store.setDraft(saved); await refresh(); notify('Projeto salvo neste navegador.'); return;
      }
      if (name === 'close') { await repository.setCurrentId(null); store.clear(); await refresh(); notify('Projeto fechado. Os dados salvos continuam na lista.'); return; }
      const project = await repository.load(id);
      if (name === 'open') {
        await repository.setCurrentId(id); store.setDraft(project); await refresh(); notify(`Projeto aberto: ${project.name}`);
        location.hash = '#/consumidores';
      } else if (name === 'edit') editForm(project);
      else if (name === 'delete') confirmDelete(project);
      else if (name === 'duplicate') { await repository.duplicate(id, project.storageRevision); await refresh(); notify('Cópia independente criada.'); }
    });
  });
  root.addEventListener('input', event => {
    if (event.target.id === 'project-search') { view.query.search = event.target.value; refresh({ filterOnly: true }); }
  });
  root.addEventListener('change', event => {
    if (event.target.id === 'project-status') { view.query.status = event.target.value; refresh({ filterOnly: true }); }
    if (event.target.id === 'project-order') { view.query.sort = event.target.value; refresh({ filterOnly: true }); }
  });
  window.addEventListener('storage', event => {
    if (event.key === INDUSTRIAL_STORAGE || event.key === null) {
      // Keep an open edit form untouched; its captured revision detects conflicts.
      refresh({ reconcile: !dialog.open });
      notify('O catálogo mudou em outra aba. A lista foi atualizada.');
    }
  });
  return { view, refresh };
}
