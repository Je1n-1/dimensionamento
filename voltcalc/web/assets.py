"""Explicit public assets: application source, backups and archives stay private."""
from voltcalc.paths import FRONTEND, ROOT

PUBLIC_FILES = (
    'js/features/rooms.js', 'js/views/coverage.js',
    'images/favicon.svg', 'js/views/status.js', 'js/core/keyboard.js', 'js/core/connection.js',
    'index.html', 'css/styles.css', 'css/updates.css', 'images/preview.png',
    'js/app.js', 'js/model.js', 'js/help.js', 'js/illustrations.js', 'js/board.js', 'js/technical.js',
    'js/core/state.js', 'js/core/dom.js', 'js/core/api.js', 'js/core/storage.js',
    'js/views/components.js', 'js/views/forms.js', 'js/views/results.js',
    'js/views/pages.js', 'js/views/diagnostics.js',
    'js/features/circuits.js', 'js/features/files.js', 'js/features/dialogs.js',
    'js/features/report.js', 'js/features/grid.js',
    'js/features/project.js', 'js/views/report.js', 'css/project.css',
    'js/views/visuals.js', 'js/views/dashboard.js', 'images/project-reference.png',
)
ASSETS = {'/' + name: FRONTEND / name for name in PUBLIC_FILES}
ASSETS['/'] = ASSETS['/index.html']
ASSETS['/VoltCalc_Guiado_Abrir.html'] = ASSETS['/index.html']

# Industrial: isolated shell, project repository and shared contracts; no calculation API.
INDUSTRIAL_FILES = (
    'index.html', 'css/industrial.css', 'js/app.js', 'js/components.js', 'js/pages.js',
    'js/core/routes.js', 'js/core/model.js', 'js/core/repository.js',
    'js/core/services.js', 'js/core/state.js',
    'js/core/local-repository.js', 'js/projects-view.js', 'js/projects-controller.js',
)
ASSETS.update({'/industrial/' + name: FRONTEND / 'industrial' / name for name in INDUSTRIAL_FILES})
ASSETS['/industrial/'] = FRONTEND / 'industrial/index.html'
ASSETS['/industrial/contracts.v1.json'] = ROOT / 'data/industrial/contracts.v1.json'
ASSETS['/industrial/contracts.v2.json'] = ROOT / 'data/industrial/contracts.v2.json'

# Old URLs redirect to their canonical locations so module-relative imports work.
ALIASES = {'/ui.js': '/js/app.js', '/preview.png': '/images/preview.png'}
ALIASES['/industrial'] = '/industrial/'
ALIASES.update({'/' + name: '/js/' + name for name in
                ('model.js', 'help.js', 'illustrations.js', 'board.js', 'technical.js')})
ALIASES.update({'/' + name: '/css/' + name for name in ('styles.css', 'updates.css')})
