"""Explicit public assets: application source, backups and archives stay private."""
from voltcalc.paths import FRONTEND

PUBLIC_FILES = (
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

# Old URLs redirect to their canonical locations so module-relative imports work.
ALIASES = {'/ui.js': '/js/app.js', '/preview.png': '/images/preview.png'}
ALIASES.update({'/' + name: '/js/' + name for name in
                ('model.js', 'help.js', 'illustrations.js', 'board.js', 'technical.js')})
ALIASES.update({'/' + name: '/css/' + name for name in ('styles.css', 'updates.css')})
