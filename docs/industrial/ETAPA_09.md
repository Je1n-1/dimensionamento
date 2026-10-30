# Etapa 9 — Visão geral e topologia completa

Data: 29/10/2026. Árvore ativa: `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`.

## Entrega

A página Visão geral reúne a topologia cadastrada e os resultados dos serviços existentes. O roteiro original das Etapas 0 a 11 foi preservado. Esta entrega não inicia a Etapa 10, não implementa proteção elétrica e não altera regras ou cálculos residenciais.

- Mapa SVG interativo com quadros, origens, consumidores, motores, derivações, ramais e trechos compartilhados. Nomes, conexões e comprimentos vêm do projeto, sem dados demonstrativos embutidos.
- Seleção por mouse e teclado, zoom, enquadramento, deslocamento por arraste/setas, organização automática inicial e movimento individual de pontos. Posição também pode ser editada por formulário acessível.
- Edição de origem, destino, comprimento físico e observações do trecho. Ciclos e operações inválidas são recusados sem salvar parcialmente. Circuitos não são transferidos automaticamente quando uma conexão muda.
- Coordenadas gráficas persistidas em `Node.position`, separadas dos metros em `Segment.length`. Mover o desenho preserva revisão e resultados elétricos. Alterar o percurso físico incrementa a revisão e invalida resultados/confirmacões conforme o serviço de topologia existente.
- Painel contextual com cargas atendidas, dados do ponto, corrente por equipamento, condutores, ocupação, parcela local de queda e pendências.
- Tabela completa: identificador, origem/destino, cargas a jusante, comprimento, contagem de cabos/condutores, método, construção/seções adotadas, infraestrutura/dimensões úteis, agrupamento/ocupação, temperatura, queda local por circuito, observações e situação.
- Cartões de cargas, potência ativa convertida, trechos, maior ocupação calculada, maior queda de percurso completo e pendências. Potências desconhecidas permanecem desconhecidas; uma soma parcial é identificada. Consumidores do tipo painel não duplicam a soma das cargas.
- Consolidação dos serviços de correntes, topologia, condutores, infraestrutura e queda na mesma revisão. Falhas de um domínio são mostradas explicitamente. Trechos relacionados a critérios reprovados pedem revisão; nenhum estado declara conformidade integral.
- Salvamento com controle otimista de revisão e validação de respostas. Migração aditiva v2–v8 para v9, sem gravação automática de projetos antigos.

## Arquivos desta entrega

Novos:

- `data/industrial/contracts.v9.json`: posição gráfica, observações do trecho e contrato da visão geral.
- `voltcalc/industrial/overview.py`: consolidação e operações de edição, sem novo motor elétrico.
- `frontend/industrial/js/core/overview.js`: contrato de serviço, posições, limites do desenho e propriedades consolidadas dos trechos.
- `frontend/industrial/js/overview-controller.js`, `overview-view.js`: mapa, formulários, seleção e interação.
- `tests/industrial/test_overview.py`, `overview.test.mjs`: regressões e integração Python/JS.
- Este relatório e `docs/industrial/evidencias/etapa09_*.jpg`.

Modificados:

- `voltcalc/industrial/contracts.py`, `voltcalc/web/api.py`, `voltcalc/web/assets.py`: contrato v9, endpoint POST `/api/industrial/overview` e arquivos públicos explícitos.
- `frontend/industrial/js/core/services.js`, `core/migrations.js`: domínio overview e migração aditiva.
- `frontend/industrial/js/app.js`, `pages.js`, `css/industrial.css`: integração, substituição do placeholder da Visão geral e apresentação responsiva.
- Testes ativos de contrato, estrutura, correntes, condutores, infraestrutura, queda, topologia, fluxo e lote de motores: contrato v9. A expectativa antiga de mapa placeholder foi substituída pelo estado real de projeto fechado.
- `docs/industrial/DECISOES_ARQUITETURAIS.md`, `PENDENCIAS.md`: decisões DA-39/40 e acompanhamento IND-53 a IND-55.

Alterações preexistentes das etapas anteriores foram preservadas. Não houve limpeza de registros do usuário, refatoração abrangente ou alteração das regras normativas existentes.

## Validação

- **205 testes Python aprovados**, incluindo regressão residencial, isolamento de coordenadas, recálculo de distância, invalidação, rejeição atômica de ciclos/valores inválidos, consolidação parcial e HTTP.
- **16 suítes JavaScript aprovadas**: integração Python/JS, respostas obsoletas/malformadas, serviço indisponível, layout com 150 pontos, ciclos/desconexões, alimentadores sem contagem duplicada, migração v2–v8, persistência/reabertura, duplicação/remapeamento de IDs, conflito de revisão, escape e formulários.
- Verificação no navegador, pela interface, no projeto sintético `QA Etapa 6 — condutores`, origem isolada `127.0.0.1:8001`: seleção no mapa/tabela, posição 400/150 salva e reaberta, zoom, enquadramento, arraste de quadro/fundo, deslocamento por teclado, reorganização e edição física.
- Conexão do trecho com o próprio ponto de origem recusada com mensagem de ciclo. Comprimento de 25 para 50 m persistiu ao reabrir e alterou a queda de 2 V / 0,909% para 4 V / 1,818%. Movimento gráfico manteve a revisão elétrica e a queda. Ao final, o comprimento foi restaurado para 25 m; confirmações elétricas invalidadas não foram artificialmente restabelecidas.
- Corrigido durante a inspeção visual o tamanho de ícones SVG internos, que prejudicava a seleção. Dimensões explícitas e área de interação verificadas novamente.
- Tela 390 × 844: largura útil e documento com 375 px, sem transbordamento horizontal global. Formulário editável com controles visíveis. Composição em duas colunas verificada em 1680 × 1050. Override de viewport removido ao concluir. Nenhum erro JavaScript observado na verificação final.
- **105 arquivos protegidos do residencial e suporte inalterados**, comparados por SHA-256 com a linha de base da Etapa 6. `git diff --check` sem erros de whitespace.

Comandos: `$env:PYTHONIOENCODING='utf-8'; python -X utf8 -m unittest discover -s tests -q`; Node em `tests/**/*.test.mjs` e `tests/*.test.cjs`. A primeira execução Python encontrou apenas um problema de codificação da saída do subprocesso no Windows; repetida com UTF-8 herdado, passou sem alterar o código residencial. Logs em `tmp/industrial-stage9-python-tests.log` e `tmp/industrial-stage9-js-tests.json`.

Evidências: [Visão geral desktop](evidencias/etapa09_visao_geral_desktop.jpg) e [formulário móvel](evidencias/etapa09_formulario_mobile.jpg). Os valores exibidos são exclusivamente do cenário de QA.

Servidor principal iniciado em `http://127.0.0.1:8000/industrial/`: residencial, página industrial e contrato v9 responderam HTTP 200; endpoint da visão geral retornou os três consumidores da fixture com status parcial. Requisições de cálculo não persistem projetos no servidor. Aba de QA e servidor isolado da porta 8001 encerrados ao concluir.

## Limitações e acompanhamento

- O mapa é esquemático, sem escala física, planta arquitetônica, roteamento CAD ou prevenção automática de cruzamentos. Posições manuais permitem reorganizar a apresentação. Zoom/deslocamento são estados temporários; posições dos pontos são persistidas.
- Cargas a jusante seguem vínculos explícitos de circuitos/alimentadores. Conexões incompletas permanecem pendentes; nenhuma alimentação é inferida de nomes.
- A contagem resumida de pendências soma itens por serviço, problemas de topologia e falhas de domínio; um mesmo circuito pode ter mais de uma pendência. A lista detalhada também contém limites de cobertura e, portanto, não representa a mesma contagem.
- O consolidado usa somente o escopo já implementado nas Etapas 4–8. Partida, proteção, coordenação, harmônicas e demais condições não cobertas continuam não verificadas. O status geral permanece **Verificação parcial**.
- Análises detalhadas são transitórias: ao reabrir, usar **Atualizar análises**. Entradas, posições, distâncias e observações permanecem salvas no repositório local existente. Consolidação de recuperação/exportação e relatórios continua na Etapa 10.
- Nenhum dado da origem do usuário na porta 8000 foi alterado. A autorização anterior para exclusão de testes manuais foi cancelada e permanece cancelada.

**Etapa 9 concluída no escopo documentado. Etapa 10 não iniciada.**
