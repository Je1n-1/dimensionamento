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


## Fluxo Projeto → Circuitos → Relatório

- A lateral tem somente as três seções. `state.page` mantém `wizard`, `loads` e outras chaves internas para preservar o editor; todas pertencem visualmente a Circuitos.
- O toggle de modos mantém a seção atual. Projeto tem etapas no guiado e formulário direto no técnico; Circuitos oferece quadro/editor guiado ou grade; Relatório oferece cartões ou tabela consolidada.
- `frontend/js/features/project.js`: inventário, ambientes, prévia e aplicação explícita da proposta. A prévia é invalidada quando o contexto muda e nunca substitui circuitos existentes.
- `voltcalc/calculations/planning.py`: `propose_circuits`, exposta por `POST /api/propose`. A divisão é uma heurística editável: um circuito por grupo de iluminação/tomadas, um por consumidor dedicado. Usa `build_panel` para alocação incremental de fases; não dimensiona entrada/alimentador, demanda, DR ou PE.
- A proposta usa hipóteses visíveis de instalação B1/Cu/PVC e temperaturas/agrupamento informados. Os valores de cabos/disjuntores da prévia vêm da mesma API Python do editor. Não há valores elétricos fictícios na interface.
- `planningOrigin` identifica o consumidor/unidade já aplicado e evita repetir a mesma proposta. O inventário é uma entrada para novos circuitos; editar o inventário não sobrescreve circuitos salvos.
- `context` é persistido e exportado no backup v3, com migração vazia para projetos antigos. Dados antigos, rascunhos e informações do CSV continuam preservados.
- `frontend/js/views/report.js`: consolidação, critérios triestados (atendido/não atendido/pendente) e CSV de resultados; células textuais com prefixos de fórmula são escapadas. O CSV de resultados não é o formato de importação de cargas: use JSON para restaurar o projeto completo.
- `frontend/css/project.css`: shell e componentes do novo fluxo, sem reescrever os estilos internos do editor.

Validação adicional: `python -m unittest discover -s tests`, `node tests/model.test.cjs`, `node tests/grid.test.cjs`, `node tests/report.test.mjs`.

## Composição visual das referências (22/10/2026)

- `frontend/css/project.css`: cabeçalho compacto, três seções laterais, cartões, assistente, tabelas com painel lateral e resultados; adaptações para telas estreitas.
- `frontend/js/views/visuals.js`: ícones SVG, indicadores e resumo de fases compartilhados.
- `frontend/js/views/dashboard.js`: quadro de cargas, filtros, detalhes do circuito e resultado com abas contextuais.
- `frontend/js/features/grid.js`: visão consolidada no modo técnico e acesso à edição de células existente por **Editar em planilha**.
- `frontend/js/features/project.js`: contexto e proposta em duas colunas; seleção de ambientes/equipamentos e resumo lateral no assistente.
- `frontend/images/project-reference.png`: referência fornecida pelo usuário, exibida como fundo com recorte por CSS da área da casa.

A navegação principal permanece **Projeto / Circuitos / Relatório**. Valores dos modelos visuais não são usados como resultados. Indicadores gerais distinguem **Pré-dimensionado**, **Revisar**, **Dados pendentes** e **Cálculo indisponível**; aprovação aparece somente nos critérios calculados.

Validação: 72 testes Python; testes JavaScript de modelo, grade e relatório; navegação, geração e aplicação de proposta, alteração de potência com recálculo, filtro de circuitos, acesso à proteção pelo resultado, abas de queda e proteção; inspeção visual em 1672×941 e 390×844. Dados de teste isolados na porta 8001. Capturas em `docs/screenshots/*_referencia_desktop.png`.


## Revisão de usabilidade e manutenção (22/10/2026)

- A referência normativa não apresenta mais seta de expansão sem ação. O favicon SVG usa o raio amarelo da marca.
- A exclusão usa o modal da aplicação, com nome escapado, foco inicial em Cancelar e confirmação vinculada ao circuito solicitado. Escape cancela; Tab permanece no modal.
- `core/keyboard.js` concentra o único listener de teclado do documento: o modal tem prioridade sobre a navegação da grade.
- `views/status.js` centraliza os estados da tabela e do resultado. Pré-dimensionado significa seleção calculada no modelo, sem declarar conformidade integral.
- `core/connection.js` verifica a disponibilidade do servidor e mostra instruções de inicialização e opção de tentar novamente. A recuperação mantém os circuitos cadastrados.
- Abrir `frontend/index.html` via arquivo mostra instruções estáticas e um link explícito para localhost, sem redirecionar. Se a navegação HTTP começar com o servidor já parado, a mensagem de conexão pertence ao navegador e não pode ser substituída pelo site.
- `/tables.js` continua sendo um recurso gerado pelo servidor Python; agora o caminho é absoluto como os demais recursos. Não há migração do motor de cálculos para JavaScript.
- Os templates das telas principais foram indentados e marcados como HTML para facilitar manutenção, sem introduzir dependência de build.

Verificação: 72 testes Python; suítes JavaScript de modelo, grade, relatório e `node tests/ux.test.mjs`. No navegador: modal, cancelamento por Escape, preservação do circuito, status explicativo, desconexão e recuperação do servidor isolado na porta 8001. Captura: `docs/screenshots/ux_confirmacao_exclusao.png`.

## Cadastro residencial por cômodo (24/10/2026)

`features/rooms.js` oferece cadastro em lote, prévia e aplicação explícita. `calculations/residential.py` calcula a previsão residencial de 2004/2008 separadamente das tabelas de dimensionamento ainda históricas (1997). `views/coverage.js` apresenta cobertura e lacunas no projeto, relatório e impressão. `context.roomSpecs` guarda geometria e escolhas; o inventário aceita `unit`, `powerBasis` e `residentialSource`. Backups antigos continuam aceitos.

Detalhes, referências, limites e validação em `docs/REVISAO_COMODOS_NBR5410.md`. Teste adicional de interface lógica: `node tests/rooms.test.mjs`.
