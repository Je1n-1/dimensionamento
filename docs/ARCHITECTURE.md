# Organização do VoltCalc

## Pastas

```text
dimensionamento/
├── server.py                 # comando de inicialização compatível
├── engine.py                 # API pública de cálculo compatível
├── Iniciar_VoltCalc.bat       # atalho Windows
├── voltcalc/                 # aplicação Python
│   ├── calculations/         # grandezas, percursos, fatores, seleção e validação
│   ├── importers/            # importação de quadros CSV
│   ├── web/                  # HTTP, rotas da API e arquivos públicos
│   └── paths.py              # caminhos absolutos a partir do projeto
├── frontend/
│   ├── index.html
│   ├── css/                  # estilos
│   ├── images/               # imagens da interface
│   └── js/
│       ├── app.js            # inicialização, eventos e atualização da página
│       ├── core/             # estado, API, armazenamento e elementos comuns
│       ├── views/            # formulários, resultados, páginas e diagnósticos
│       └── features/         # circuitos, grade, arquivos, diálogos e relatório
├── data/                     # tabelas históricas do motor
├── examples/                 # quadros de cargas de exemplo
├── tests/                    # testes Python e JavaScript
├── scripts/                  # ferramentas de desenvolvimento/auditoria
├── docs/
│   ├── analysis/             # análise e evidências da versão original
│   └── screenshots/          # registros visuais
└── archive/                  # versões anteriores preservadas, fora do site ativo
```

## Onde alterar cada função

| Responsabilidade | Arquivo principal | Funções |
|---|---|---|
| Corrente, potência e trechos | `voltcalc/calculations/circuits.py` | `profile`, `voltage_trace` |
| Correções térmicas | `voltcalc/calculations/corrections.py` | `temperature_correction`, `grouping_correction` |
| Seleção de cabo e disjuntor | `voltcalc/calculations/sizing.py` | `calculate`, `method_of` |
| Pendências e campos relacionados | `voltcalc/calculations/validation.py` | `diagnostics` |
| Quadro de cargas por fase | `voltcalc/calculations/panel.py` | `build_panel` |
| Leitura do CSV | `voltcalc/importers/csv_import.py` | `import_csv` |
| Requisições HTTP | `voltcalc/web/server.py` | `Handler`, `main` |
| Contratos da API | `voltcalc/web/api.py` | `get_payload`, `post_payload` |
| Arquivos públicos e URLs antigas | `voltcalc/web/assets.py` | `ASSETS`, `ALIASES` |
| Estado do projeto | `frontend/js/core/state.js` | `state`, `ui`, `syncTechnical` |
| Cache e chamadas ao Python | `frontend/js/core/api.js` | `prepare`, `calc`, `prepareBoard` |
| Persistência local | `frontend/js/core/storage.js` | `load`, `persist` |
| Formulários e etapas | `frontend/js/views/forms.js` | `equipmentView`, `groupingView`, `conditionsView` |
| Resultados e explicações | `frontend/js/views/results.js` | `resultView`, `selectionReadiness`, `corrections` |
| Edição de circuitos | `frontend/js/features/circuits.js` | `saveCircuit`, `editCircuit`, `goStep` |
| Grade técnica e ações em lote | `frontend/js/features/grid.js` | `technicalView`, `gridInput`, `gridClick` |
| Regras de colagem | `frontend/js/technical.js` | `VoltGrid.set`, `VoltGrid.paste` |
| Importação/exportação no navegador | `frontend/js/features/files.js` | `previewCsv`, `applyCsv`, `exportJson`, `importJson` |
| Memorial | `frontend/js/features/report.js` | `report` |

`model.js` mantém os dados e a migração de backups; `help.js` contém as explicações; `illustrations.js` desenha as instalações; `board.js` apresenta o quadro de cargas. Esses arquivos continuam carregados antes do módulo principal para preservar suas interfaces existentes.

## Fluxo da aplicação

1. `server.py` chama o servidor do pacote `voltcalc.web`.
2. O servidor entrega somente os arquivos presentes na lista pública de `assets.py`.
3. `index.html` carrega os dados auxiliares e o módulo `js/app.js`.
4. A interface mantém o projeto em `core/state.js`; `core/api.js` solicita os cálculos ao Python.
5. As funções de `views/` apresentam a resposta e as de `features/` tratam as ações. O callback `requestRender` solicita atualização ao controlador sem importar o módulo de inicialização.
6. `core/storage.js` mantém as mesmas chaves de armazenamento e o formato de backup v3. Não há migração dos projetos por causa da reorganização.

## Executar e verificar

```powershell
python server.py --open
# Alternativa equivalente:
python -m voltcalc --open

python -m unittest discover -s tests -v
node tests/model.test.cjs
node tests/grid.test.cjs
```

Não há etapa de build nem dependências Python externas. `frontend/package.json` apenas identifica o código JavaScript como módulos ES; não instala pacotes. O site continua na mesma origem `http://127.0.0.1:8000/`, preservando o armazenamento do navegador. A versão de referência dos cálculos continua sendo a base histórica existente.

Os diretórios `archive/`, `docs/`, `tests/` e o código Python não são expostos pelo servidor. `scripts/audit_original.cjs` audita a versão arquivada e grava suas evidências em `docs/analysis/evidencias.json`; não testa o motor atual.
