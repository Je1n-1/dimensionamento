import { ROUTES, resolveRoute } from './core/routes.js';
import { createStore } from './core/state.js';
import { icon, action, escapeHTML as esc } from './components.js';
import { pageView } from './pages.js';
import { LocalProjectRepository } from './core/local-repository.js';
import { createProjectController } from './projects-controller.js';

const root = document.getElementById('industrial-root');
async function boot() {
  const response = await fetch('/industrial/contracts.v2.json');
  if (!response.ok) throw new Error('Não foi possível carregar os contratos industriais.');
  const contract = await response.json();
  if (contract.format !== 'voltcalc-industrial-contract' || contract.version !== 2) throw new Error('Versão de contrato incompatível.');
  const store = createStore(contract);
  const repository = new LocalProjectRepository(contract, { storage: window.localStorage, locks: navigator.locks });
  let projects;
  root.innerHTML = `
    <aside class="sidebar" id="industrial-sidebar" aria-label="Módulo industrial">
      <a class="brand" href="#/projetos"><img src="/images/favicon.svg" alt="" width="38" height="48"><span><strong>VoltCalc</strong><span>Industrial</span></span></a>
      <nav aria-label="Etapas industriais">${ROUTES.filter(r => !r.auxiliary).map(navItem).join('')}</nav>
      <nav class="aux-nav" aria-label="Funções auxiliares">${ROUTES.filter(r => r.auxiliary).map(navItem).join('')}</nav>
      <div class="sidebar-footer"><a class="norm-card" href="#/configuracoes"><small>Referência prevista</small><strong>NBR 5410:2004</strong><span>Regras não implementadas</span></a>
      <p>VoltCalc Industrial<br><span>Gerenciamento de projetos · Etapa 2</span></p><a class="residential-link" href="/">${icon('home')} Abrir residencial ${icon('arrow')}</a></div>
    </aside>
    <div class="app-content"><header class="topbar">
      <button type="button" class="icon-button menu-toggle" data-action="menu" aria-label="Abrir navegação" aria-expanded="false" aria-controls="industrial-sidebar">${icon('menu')}</button>
      <div class="project-identity"><span>Projeto:</span><strong id="project-name">${esc(store.snapshot()?.name || 'Nenhum projeto selecionado')}</strong></div>
      <a href="#/configuracoes" class="norm-chip">${icon('shield')}<span>Referência prevista<strong>NBR 5410:2004</strong></span></a>
      <div class="top-actions">${action('Salvar projeto', 'save', { action: 'save-project', primary: true })}${action('Exportar PDF', 'export', { stage: 10 })}<button type="button" class="icon-button" data-action="help" aria-label="Sobre esta etapa">${icon('info')}</button></div>
    </header><main id="main" tabindex="-1"></main><footer class="page-footer"><span>VoltCalc Industrial · Etapa 2</span><span>Projetos salvos neste navegador · Cálculos não implementados</span></footer></div>
    <dialog id="help-dialog" aria-labelledby="help-title"><form method="dialog"><button class="icon-button dialog-close" aria-label="Fechar">${icon('close')}</button><span class="page-icon">${icon('info')}</span><h2 id="help-title">Estrutura do VoltCalc Industrial</h2>
      <p>Na página Projetos, crie, salve, abra, edite e organize seus estudos. Os dados ficam neste navegador e endereço. Os controles futuros permanecem desabilitados.</p>
      <ul><li>Etapa 2 disponível: gerenciamento e persistência dos projetos.</li><li>Etapas 3 a 5: consumidores, grandezas e topologia.</li><li>Etapas 6 a 8: condutores, infraestrutura e queda.</li><li>Etapas 9 a 11: visão geral, relatórios e validação final.</li></ul>
      <p>Nenhum valor ilustrativo é utilizado como cálculo. O sistema residencial continua separado.</p><button class="button primary">Entendi</button></form></dialog>`;
  function navItem(route) {
    return `<a class="nav-item" href="#/${route.id}" data-route="${route.id}">${icon(route.icon)}<span><strong>${esc(route.title)}</strong><small>${esc(route.subtitle)}</small></span></a>`;
  }
  function render(focus = false, { filterOnly = false } = {}) {
    const focused = document.activeElement;
    const focusId = focused?.id;
    const selection = focused?.tagName === 'INPUT' ? [focused.selectionStart, focused.selectionEnd] : null;
    const contentHadFocus = root.querySelector('#main').contains(focused);
    const route = resolveRoute(location.hash);
    root.querySelector('#project-name').textContent = store.snapshot()?.name || 'Nenhum projeto selecionado';
    root.querySelector('[data-action="save-project"]').disabled = !store.snapshot() || Boolean(projects?.view.unavailable);
    if (filterOnly && route.id === 'projetos' && root.querySelector('#project-results')) {
      // Keep live filter controls mounted: typing must not recreate the focused input.
      const template = document.createElement('template');
      template.innerHTML = pageView(route, contract, projects.view);
      for (const id of ['project-summary', 'project-results']) root.querySelector(`#${id}`).replaceWith(template.content.querySelector(`#${id}`));
      return;
    }
    if (location.hash !== `#/${route.id}`) history.replaceState(null, '', `#/${route.id}`);
    document.title = `VoltCalc Industrial · ${route.title}`;
    root.querySelectorAll('[data-route]').forEach(item => {
      if (item.dataset.route === route.id) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    root.querySelector('#main').innerHTML = pageView(route, contract, projects?.view);
    root.classList.remove('nav-open');
    root.querySelector('[data-action="menu"]').setAttribute('aria-expanded', 'false');
    if (focus) {
      window.scrollTo(0, 0);
      root.querySelector('#page-title').focus({ preventScroll: true });
    } else if (focusId && document.getElementById(focusId) !== focused) {
      const replacement = document.getElementById(focusId);
      replacement?.focus({ preventScroll: true });
      if (selection && replacement?.tagName === 'INPUT') replacement.setSelectionRange(...selection);
    } else if (contentHadFocus && !root.querySelector('dialog[open]')) {
      root.querySelector('#page-title').focus({ preventScroll: true });
    }
  }
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    root.querySelector('#main').focus();
  });
  window.addEventListener('hashchange', () => render(true));
  root.addEventListener('click', event => {
    const control = event.target.closest('[data-action]');
    if (control?.dataset.action === 'help') root.querySelector('#help-dialog').showModal();
    if (control?.dataset.action === 'menu') {
      const open = root.classList.toggle('nav-open');
      control.setAttribute('aria-expanded', String(open));
    }
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && root.classList.contains('nav-open')) {
      root.classList.remove('nav-open');
      const toggle = root.querySelector('[data-action="menu"]');
      toggle.setAttribute('aria-expanded', 'false'); toggle.focus();
    }
  });
  projects = createProjectController({ root, repository, contract, store, render });
  await projects.refresh({ restore: true });
}
boot().catch(error => {
  root.innerHTML = `<main class="startup"><h1>VoltCalc Industrial indisponível</h1><p>${esc(error.message)}</p><p>Inicie ou reinicie o servidor com <code>python server.py</code> e acesse <a href="http://127.0.0.1:8000/industrial/">o módulo industrial</a>.</p><button class="button primary" id="retry">Tentar novamente</button><a href="/">Abrir residencial</a></main>`;
  document.getElementById('retry').addEventListener('click', () => location.reload());
});
