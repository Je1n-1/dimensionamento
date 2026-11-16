# Etapa 8 — Análise de queda de tensão

Entrega em 28/10/2026. Árvore ativa: `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`.

Implementada a análise por consumidor e percurso elétrico completo, com alimentadores entre quadros, contribuição dos segmentos e verificação separada dos limites total e terminal. O roteiro original das Etapas 0 a 11 permanece inalterado. Etapa 9 não iniciada.

## Funcionalidades

- Página Queda de tensão conectada aos consumidores, circuitos, formações e caminhos reais da Etapa 5.
- Tabela com carga, origem/percurso, distância completa, Ib terminal, seção final adotada, tensão, queda equivalente em volts, percentual, limite total e situação.
- Seleção da carga abre memória dos segmentos: circuito, comprimento físico, corrente, seção, R/X, queda local, percentuais e barras de contribuição. Se houver várias seções/correntes, a tabela principal identifica os valores terminais e a memória mostra todos os trechos.
- Origem normativa declarada e confirmada pelo usuário. A cadeia de alimentadores é percorrida até essa origem; alimentador ausente não é substituído por queda zero.
- Condições elétricas por circuito. Uma carga única pode fornecer tensão, frequência e FP por herança. Grupos/alimentadores exigem estudo equivalente e Ib referenciada no dimensionamento.
- Resistência AC e reatância por formação, em Ω/km por condutor, com temperatura adotada e referência de catálogo/estudo. Não há valores elétricos demonstrativos preenchidos automaticamente.
- Reconferência de R/X exigida quando mudam construção, seção, método, arranjo, frequência ou condições térmicas. Mudança apenas no comprimento recalcula a queda sem invalidar a referência de impedância.
- Entradas persistidas com revisão otimista. Análises detalhadas são transitórias e exigem recálculo ao reabrir ou alterar o projeto. Respostas obsoletas são recusadas.
- Estados Não calculado, Pendente, Limite excedido e Queda dentro dos limites. Nenhum deles declara conformidade global. Partida de motores continua explicitamente não calculada.

## Critérios e fontes

Base industrial isolada: `nbr5410-2004-voltage-1`. Não utiliza tabelas ou regras residenciais de 1997.

Fonte normativa fornecida pelo usuário: `C:\Users\jeanm\Downloads\NBR-5410.pdf`, seção 6.2.7, páginas impressas 115–116 (físicas 123–124). SHA-256: `b3dc538362dae43a5e07f9a6c6a341db7cf90ada2d072c4e39c04b3ee43495e3`. Texto conferido e página de limites inspecionada visualmente.

- 6.2.7.1: 7% a partir de transformador próprio MT/BT; 7% a partir do secundário da concessionária quando o ponto de entrega estiver nesse local; 5% nos demais casos a partir da entrega em baixa tensão; 7% a partir de geração própria.
- 6.2.7.2: circuito terminal limitado separadamente a 4%.
- 6.2.7.4: corrente de projeto. A corrente de cada circuito é aplicada integralmente aos segmentos do seu caminho; não há redução automática por derivação ou demanda presumida.
- Limite adicional de projeto é opcional, referenciado e cumulativo aos critérios normativos; não pode relaxá-los.
- A suplementação opcional para linhas principais acima de 100 m não é aplicada. Mantêm-se os limites base.

Modelo longitudinal aproximado em regime permanente: `ΔU = k × Ib × (R cosφ + X senφ) × L`, com L em km, k=2 para FN/FF e k=√3 para trifásico equilibrado. Fonte primária das fórmulas: [Schneider Electric — Electrical Installation Guide](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions). Os valores ilustrativos de R, X, FP ou partida dessa publicação não são importados para o sistema.

Em transição trifásica equilibrada com neutro para fase-neutro na mesma rede, as parcelas são normalizadas em percentuais; o total em volts é referido à tensão da carga. As tensões nominais 380/220 admitem arredondamento nominal; transformações intermediárias e transições incompatíveis são bloqueadas.

## Arquivos da entrega

Novos:

- `data/industrial/contracts.v8.json`: política de origem, condições elétricas e impedâncias referenciadas.
- `voltcalc/industrial/voltage_rules.py`: fórmulas, limites versionados e compatibilidade de ligações.
- `voltcalc/industrial/voltage.py`: percurso completo, validações, memória e operação transacional.
- `frontend/industrial/js/voltage-controller.js`, `voltage-view.js`: serviço de interface, formulários e análise contextual.
- `tests/industrial/test_voltage.py`, `voltage.test.mjs`: regressões do cálculo e integração.
- Este relatório e duas evidências em `docs/industrial/evidencias/etapa08_*.jpg`.

Modificados:

- `voltcalc/industrial/contracts.py`, `voltcalc/web/api.py`, `voltcalc/web/assets.py`: contrato ativo v8, rota POST `/api/industrial/voltage` e assets explícitos.
- `frontend/industrial/js/core/services.js`, `core/migrations.js`: serviço independente e migração aditiva v2–v7 para v8.
- `frontend/industrial/js/app.js`, `pages.js`, `css/industrial.css`: integração, disponibilidade e apresentação responsiva.
- Testes ativos de estrutura, contrato, correntes, condutores, infraestrutura, topologia, fluxo e lote de motores: referência ao contrato v8; testes históricos preservados.
- `docs/industrial/DECISOES_ARQUITETURAIS.md`, `PENDENCIAS.md`: decisões DA-37/38 e acompanhamento IND-48 a IND-52.

Mudanças preexistentes das Etapas 6/7 e revisões de cadastro foram preservadas. Não foram feitas refatorações residenciais.

## Validação

- **192 testes Python aprovados**, incluindo regressão residencial, fórmulas FN/FF/trifásicas, percursos 28/35/51 m, alimentadores, transição fase-neutro, limites independentes, dados ausentes, restrições do modelo, invalidação de impedância, atomicidade e HTTP.
- **15 suítes JavaScript aprovadas**: integração Python/JS, migração v2–v7 sem mutação, persistência, duplicação com remapeamento da origem, conflito de revisão, resposta obsoleta, indisponibilidade do servidor, escape de HTML e leitura dos formulários.
- Navegador via CUA, em projeto sintético já existente de QA na porta 8001, separado da origem 8000: origem/condições/RX, salvamento, seção adotada, recarga, cálculo de 2 V / 0,909%, alteração para 20 V / 9,091%, aviso de limite excedido, X ausente como pendência e recuperação do valor.
- Nenhum erro JavaScript observado. Tela móvel 390 × 844: largura útil 375 px sem transbordamento global; diálogo com 350 px de conteúdo e rolagem vertical, sem transbordamento horizontal. Override de viewport removido ao terminar.
- **105 arquivos protegidos do residencial e suporte inalterados**, por comparação SHA-256 com a linha de base da Etapa 6. `git diff --check` sem erros.

Comandos: `python -m unittest discover -s tests -q`; Node para `tests/**/*.test.mjs` e `tests/*.test.cjs`. Logs em `tmp/industrial-stage8-python-tests.log`, `tmp/industrial-stage8-js-tests.json` e `tmp/industrial-stage8-voltage-tests.log`. Testes HTTP não persistem dados no navegador nem no servidor.

Evidências: [análise no desktop](evidencias/etapa08_queda_desktop.jpg) e [formulário móvel](evidencias/etapa08_formulario_mobile.jpg). Os números nessas imagens são exclusivamente do projeto sintético de teste.

Servidor principal disponível em `http://127.0.0.1:8000/industrial/`. Página e contrato v8 responderam HTTP 200; a API retornou os três percursos da fixture. Servidor de QA da porta 8001 e abas de teste encerrados ao concluir.

## Limitações e pendências

- Regime permanente senoidal, cargas resistivas/indutivas e trifásico equilibrado. Harmônicas, desequilíbrio, FFN, paralelismo, PEN, retorno com características distintas, transformação intermediária, acionamentos e modelos de carga especiais não implementados.
- R/X são declarados pelo usuário para a construção e condições efetivas. Não há catálogo automático, autenticação de fontes, cálculo eletromagnético nem conversão de resistência entre temperaturas.
- Temperatura adotada de R é entrada conferida contra ambiente e limite de serviço da isolação; não é temperatura real estimada pelo sistema.
- Partida, atuação/coordenação das proteções e conformidade integral permanecem não verificadas. A análise de queda não seleciona disjuntor nem altera seções automaticamente.
- Nenhum alimentador ou demanda é inferido de nomes de quadros. Grupos/alimentadores precisam de Ib referenciada. Cargas distribuídas usam a corrente integral do circuito; a redução a jusante não é calculada automaticamente.
- Memória consolidada e exportações continuam na Etapa 10; revisão geral de cobertura permanece na 11. Ampliações de modelo exigem escopo próprio, sem reordenar o roteiro.
- A exclusão de dados manuais foi cancelada pelo usuário. Nenhum registro do usuário foi apagado. Somente o projeto identificado como QA na origem 8001 recebeu entradas sintéticas de teste.

**Etapa 8 concluída no escopo parcial documentado. Etapa 9 não iniciada.**
