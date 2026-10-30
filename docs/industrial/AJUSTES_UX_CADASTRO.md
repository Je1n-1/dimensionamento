# Revisão do cadastro e passagem ao dimensionamento

Concluída em 27/10/2026. Árvore utilizada: `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`.

## Problema e comportamento entregue

O cadastro de cargas e a estrutura física estavam separados sem uma passagem clara entre eles. Uma carga salva podia não aparecer na tela de dimensionamento porque ainda não havia circuito nem formação de cabos. A tela agora apresenta essas cargas, explica o vínculo que falta e oferece preparação em lote.

- Criar ou abrir projeto leva a Consumidores e cargas, com o projeto salvo e selecionado.
- Adicionar quadro abre um cadastro curto, sem exigir dados elétricos de consumidor.
- Duplicar equipamento abre uma cópia editável com nova tag e distância preservada para revisão. Cancelar não grava. Circuitos, resultados e vínculos de segmento não são copiados.
- Unidade de potência sugere a base correspondente; W/kW permitem revisão elétrica/mecânica. Não houve mudança nas fórmulas.
- Rendimento aparece para potência mecânica; equilíbrio trifásico aparece para ligação trifásica. Fases incompatíveis ficam indisponíveis. Tensão não determina a ligação.
- Dados de catálogo, condições de motor e partida/medição são agrupados em detalhes expansíveis. A corrente de placa e a escolha de fonte continuam acessíveis.
- Métodos A1–G têm descrições resumidas. Isolações indicam temperatura máxima de serviço. Distâncias têm exemplo físico/acumulado; fator de serviço tem explicação.
- Corrente identifica a tag do equipamento. Motivos de pendência ficam visíveis sem abrir a memória de cálculo.
- Preparar circuitos cria, após confirmação, um circuito terminal e percurso independente para cada registro selecionado, usando os dados declarados. A operação é atômica e recusa duplicações ou conflitos com estruturas existentes.
- Dimensionamento inclui cargas sem circuito e circuitos sem formação na contagem de pendências. Sem formações, o botão de cálculo fica desabilitado. Após calcular, o primeiro bloqueio aparece na própria linha.

## Arquivos desta revisão

| Arquivo | Alteração |
|---|---|
| `frontend/industrial/js/projects-controller.js` | Seleção persistida e navegação após criar/abrir |
| `frontend/industrial/js/core/consumers.js` | Cópia independente, sugestões de potência e lista de métodos |
| `frontend/industrial/js/consumers-controller.js` | Duplicação, campos contextuais e abertura de detalhes em erros |
| `frontend/industrial/js/consumers-view.js` | Entrada por quadro, orientação de fluxo e formulário simplificado |
| `frontend/industrial/js/currents-view.js` | Identificação da corrente e motivos visíveis |
| `frontend/industrial/js/topology-view.js` | Formulário de preparação em lote |
| `frontend/industrial/js/topology-controller.js` | Operação atômica e navegação para dimensionamento |
| `frontend/industrial/js/conductors-view.js` | Cargas sem estrutura, contagem e motivos de pendência |
| `frontend/industrial/css/industrial.css` | Layout do fluxo, detalhes expansíveis e formulário em tela pequena |
| `voltcalc/industrial/preparation.py` | Preparação estrutural, sem decisões de dimensionamento |
| `voltcalc/industrial/topology.py` | Integração da preparação com validação, revisão e invalidação existentes |
| `tests/industrial/test_preparation.py` | Validação do lote, atomicidade, fases, conflitos e ausência de inferências |
| `tests/industrial/workflow.test.mjs` | Duplicação, bases de potência, campos e apresentação das pendências |
| `docs/industrial/DECISOES_ARQUITETURAIS.md` | DA-34 |
| `docs/industrial/PENDENCIAS.md` | IND-39 a IND-42 |

Os arquivos previamente alterados na Etapa 6 foram preservados. Esta revisão não representa uma nova etapa do roteiro.

## Verificação

- Regressão completa Python: **158 testes aprovados**, incluindo os novos casos de preparação.
- JavaScript: **12 suítes aprovadas**, incluindo as regressões residenciais e a nova suíte de fluxo.
- `git diff --check`: sem erros de whitespace; apenas avisos de normalização LF/CRLF.
- 105 arquivos protegidos do residencial, documentação de auditoria e distribuição anterior: hashes preservados em comparação com a referência da Etapa 6.
- Navegador: novo projeto → quadro Q1 → luminária L1 (100 W, 220 V FN, 10 m) → duplicação L2 (25 m) → preparação em lote → dimensionamento. L1 com condições declaradas apresentou 0,455 A e 1,5 mm²; L2 permaneceu pendente sem confirmações. Dados de teste, não instalação real.
- Persistência após recarregar: dois consumidores, quadro e circuitos mantidos; memória de dimensionamento recalculada conforme o comportamento existente.
- Tela pequena: formulário de duplicação verificado em viewport 390 × 844; sem transbordamento horizontal da página. Cancelamento preservou os dois registros originais. Console sem erros durante a verificação final.
- Evidências: [dimensionamento](evidencias/ux_fluxo_dimensionamento.png) e [cadastro em tela pequena](evidencias/ux_cadastro_mobile.png).

## Limites

A preparação rápida não define circuitos compartilhados, iluminação distribuída ao longo de um mesmo circuito ou alimentadores de quadros. Esses casos continuam no editor de Caminhos e circuitos. Cada registro com quantidade maior que 1 representa equipamentos no mesmo destino.

Métodos e condições copiados ainda exigem confirmação física. Cadastro completo não significa cálculo concluído. Motor sem dados nominais verificados pode ter corrente estimada, mas permanecer sem Ib normativo. Proteção, curto-circuito, queda, ocupação, topologia visual e exportações permanecem nas etapas originais. Não há declaração de conformidade global nem novos catálogos/leitor de PDF.
