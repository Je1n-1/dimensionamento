import { CurrentService, serviceRequest } from './core/services.js';
import { applyCurrentResponse } from './core/currents.js';

export function createCurrentController({root, contract, store, repository, projects, service = new CurrentService()}) {
  let busy = false;
  const status = document.createElement('div');
  status.className = 'project-feedback'; status.setAttribute('role','status'); status.hidden = true; root.append(status);
  let timer;
  function notify(message) { clearTimeout(timer); status.textContent = message; status.hidden = false; timer = setTimeout(() => {status.hidden = true;}, 10000); }
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-calculate-currents]');
    if (!button || busy) return;
    const captured = store.snapshot();
    if (!captured?.consumers.length || projects.view.unavailable) return notify('Abra um projeto e cadastre consumidores antes de calcular.');
    busy = true; button.disabled = true; button.setAttribute('aria-busy','true');
    notify('Calculando potências e correntes…');
    try {
      const response = await service.calculate(serviceRequest(contract,captured,'currents'), captured);
      const next = applyCurrentResponse(contract,captured,response);
      const current = store.snapshot();
      if (current?.id !== captured.id || current.revision !== captured.revision || current.storageRevision !== captured.storageRevision) throw new Error('O projeto mudou durante o cálculo. Calcule novamente com as entradas atuais.');
      const saved = await repository.save(next,captured.storageRevision);
      // A project switch during asynchronous storage must not reopen the old one.
      const visible = store.snapshot();
      if (visible?.id === captured.id && visible.revision === captured.revision && visible.storageRevision === captured.storageRevision) store.setDraft(saved);
      await projects.refresh();
      if (store.snapshot()?.id === captured.id) { const section = root.querySelector('#current-results'); section?.focus(); section?.scrollIntoView({behavior:'smooth',block:'start'}); }
      notify('Potências e correntes salvas. Consulte a fonte e as pendências de cada item; cabo e proteção ainda não foram verificados.');
    } catch (error) { notify(error.message); }
    finally { busy = false; button.disabled = false; button.removeAttribute('aria-busy'); }
  });
}
