# Etapa 6 — Dimensionamento de condutores

Data: 26/10/2026. Árvore utilizada: `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`.

## Entrega

A página Dimensionamento agora calcula uma seção preliminar por formação de cabos, vinculada ao circuito e aos seus trechos. Exibe corrente de projeto, material/isolação, métodos, fatores, seções candidatas, memória por trecho, seção mínima, neutro e PE. A situação é **Pré-dimensionado** ou **Pendente**, sem declaração de conformidade global.

Esta entrega executa somente a Etapa 6 do roteiro original. Proteção, infraestrutura/ocupação, queda de tensão, mapa final e exportações não foram antecipados. As ressalvas SENAI e residenciais continuam acompanhadas, sem alteração do motor residencial.

## Funcionalidades implementadas

- Condições elétricas por formação: ligação, taxa de terceira harmônica e múltiplos, material, isolação, disposição F/G, localização do PE e confirmação do escopo de aplicação.
- Condições térmicas por trecho: método de referência, temperatura, agrupamento, camadas, espaçamento e características do solo. Nenhum B1 é inferido de eletrocalha ou leito.
- Ib automático para carga terminal compatível, com quantidade aplicada uma vez, ou motor único com fonte nominal e condições válidas da Etapa 4. Para grupos, alimentadores e demais casos, Ib pode ser informado com memória e confirmação explícitas. Esse estudo informado não é verificado automaticamente.
- Tabelas 36–39 independentes da base residencial: cobre/alumínio, PVC/EPR/XLPE, métodos A1 a G e disposições aplicáveis. Condições incompatíveis bloqueiam a seleção.
- Fatores das tabelas 40–45, sujeitos às suas notas e limites. Circuitos agrupados são identificados pela topologia, não pela quantidade de equipamentos. Grupos homogêneos exigem seções conhecidas dos outros circuitos, comparação da faixa de três seções sucessivas e declaração de carregamento semelhante. F = 1/√n está disponível como escolha explícita conservadora nas disposições ao ar implementadas.
- Temperatura intermediária usa a próxima classe superior da tabela, com indicação do valor informado e adotado. Não há extrapolação. A capacidade precisa atender ao trecho de menor Iz corrigida.
- Conferência de fases/neutro, condutores carregados e correção 0,86 para três fases com neutro e harmônicas acima de 15% até 33%. Neutro nunca é reduzido automaticamente.
- Seção mínima de instalação fixa conforme finalidade. Alumínio exige confirmação das condições industriais; comando/sinalização em alumínio não recebe mínimo inventado.
- PE simplificado pela tabela 58, mesmo metal das fases e mínimos conforme localização/proteção mecânica. Isso não verifica a função de proteção ou a suportabilidade ao curto-circuito.
- Comparação de seções adotadas, sem sobrescrevê-las com a sugestão. Escolhas insuficientes aparecem nas pendências.
- Alterações estruturais limpam confirmações dependentes. Mudanças de cargas invalidam a confirmação de Ib informado e do escopo. Resultados são vinculados ao projeto, à revisão e à versão da regra.
- Condições persistidas no repositório industrial existente. A análise detalhada permanece transitória e deve ser recalculada ao reabrir a aplicação; a tela informa essa condição.

## Fonte e rastreabilidade

Fonte documental fornecida pelo usuário: `C:\Users\jeanm\Downloads\NBR-5410.pdf`, ABNT NBR 5410:2004. SHA-256: `b3dc538362dae43a5e07f9a6c6a341db7cf90ada2d072c4e39c04b3ee43495e3`.

Tabelas de capacidade: páginas físicas 109–113 (impressas 101–105). Foram extraídas 160 linhas, com 1.520 células de capacidade, e conferidas as páginas renderizadas e suas notas. Métodos, correções, condutores carregados, mínimos e PE foram consultados nas seções 6.2.5, 6.2.6 e 6.4.3 e respectivas tabelas. O serviço de correntes mantém a regra de motores de 6.5.1.3.1 e a proveniência da Etapa 4.

Versão independente: `nbr5410-2004-conductors-1`, cobertura **parcial**. O registro geral de normas não foi promovido para cobertura integral.

A tabela 38 da fonte contém valores repetidos da linha de 500 mm² nas células de alumínio 630 mm², F plano e G horizontal/vertical. Essas três células foram mantidas na transcrição, mas **excluídas do cálculo** até esclarecimento documental. Não houve correção numérica silenciosa nem substituição por tabela de 1997.

## Arquivos

Novos:

- `data/industrial/contracts.v6.json`: modelos aditivos de condições e versão do serviço.
- `data/industrial/conductors-2004.v1.json`: capacidades, colunas, fonte e células excluídas.
- `voltcalc/industrial/conductor_rules.py`: regras e fatores versionados.
- `voltcalc/industrial/conductors.py`: análise por formação, validação de condições e porta HTTP.
- `frontend/industrial/js/conductors-controller.js`: edição, cálculo, revisão e gravação segura.
- `frontend/industrial/js/conductors-view.js`: tabela, formulários e memória detalhada.
- `tests/industrial/test_conductors.py`, `tests/industrial/conductors.test.mjs`: regressões da etapa.
- Este relatório e evidências de interface.

Modificados:

- `voltcalc/industrial/contracts.py`: contrato ativo v6.
- `voltcalc/industrial/topology.py`: invalidação das confirmações dependentes da estrutura.
- `voltcalc/web/api.py`, `voltcalc/web/assets.py`: rota industrial e publicação explícita dos novos arquivos.
- `frontend/industrial/js/core/migrations.js`: migração aditiva de v2–v5.
- `frontend/industrial/js/core/services.js`: cliente do serviço e validação de respostas/revisões.
- `frontend/industrial/js/core/state.js`: invalidação das confirmações após editar entradas.
- `frontend/industrial/js/core/topology.js`, `frontend/industrial/js/topology-view.js`: campo opcional de condutores carregados, conferido pelo cálculo.
- `frontend/industrial/js/app.js`, `frontend/industrial/js/pages.js`: integração e identificação da etapa.
- `frontend/industrial/css/industrial.css`: tabela, memória e formulário responsivos.
- `tests/industrial/contract_cases.json`, `test_structure.py`, `currents.test.mjs`, `topology.test.mjs`: versão ativa e compatibilidade.
- `docs/industrial/DECISOES_ARQUITETURAIS.md`, `docs/industrial/PENDENCIAS.md`: decisões e acompanhamento.

## Testes e evidências

- **153 testes Python aprovados**, com regressão residencial e industrial, serviço real e API HTTP.
- **11 suítes JavaScript aprovadas**, incluindo integração com Python, migração, persistência, conflito, falha de servidor, resposta desatualizada e apresentação sem conformidade inventada.
- Cenário de três circuitos com trecho compartilhado: contagens 3/2/1, fatores conservadores por trecho e seleção pelo mais desfavorável.
- Limites das tabelas, temperaturas intermediárias, ausência de fator, células excluídas, materiais, métodos, funções, harmônicas, PE, paralelismo recusado, agrupamento homogêneo/heterogêneo/enterrado e ausência de seção suficiente.
- Motor de 20 cv, catálogo histórico WEG fornecido, 380 V, 4 polos, In 30,4 A e FS 1,15: Ib 34,96 A, integrado ao serviço de condutores sem multiplicador arbitrário.
- Pela interface: projeto temporário, carga de 4.400 W a 220 V, caminho de 25 m, circuito terminal, formação L1/N/PE, cobre/PVC, método B1 e ambiente de 34 °C. Resultado: Ib 20 A, classe térmica adotada 35 °C, Ft 0,94, Fg 1, seção 2,5 mm² e Iz corrigida 22,56 A. O comprimento permanece cadastrado; não foi usado para fingir verificação de queda.
- Reabertura preservou as condições e pediu recálculo. Pendência de dados faltantes foi exibida antes de preencher as condições.
- Desktop de 1440 × 900: documento de 1425 px sem transbordamento horizontal global. Celular de 390 × 844: documento de 375 px; tabelas têm rolagem local e formulário cabe na tela.
- **105 arquivos protegidos do residencial e suporte permaneceram idênticos**, conferidos por SHA-256 contra a linha de base da etapa.
- `git diff --check` sem erros de espaço em branco.

Comandos: `python -m unittest discover -s tests -q`; Node para cada `tests/**/*.test.mjs` e `tests/*.test.cjs`. Logs: `tmp/industrial-stage6-python-tests.log` e `tmp/industrial-stage6-js-tests.log`.

Evidências:

- [Dimensionamento no desktop](evidencias/etapa06_condutores_desktop.png)
- [Condições no celular](evidencias/etapa06_formulario_mobile.png)

As capturas são do projeto **QA Etapa 6 — condutores**, sem instalação real, criado pela interface na porta 8001. Ele foi arquivado e fechado após a verificação, preservando os dados de teste. Nenhum projeto de teste foi gravado na origem principal da porta 8000.

O servidor de QA foi encerrado. A versão entregue foi iniciada em `http://127.0.0.1:8000/industrial/` e verificada no navegador, sem erros de console na abertura. A aba principal ficou na lista de projetos.

## Limitações e pendências

O cálculo não cobre todas as situações da norma. Exigem estudo específico: cabos armados, outras tensões/frequências/regimes fora do escopo confirmado, radiação solar/infravermelha, paralelismo, PEN, neutro com harmônicas acima de 33%, grupo com temperaturas máximas de serviço diferentes e hipóteses de instalação não implementadas. F/G aceitam aqui unipolares; os casos especiais de condutores isolados ao ar ou enterrados não são inferidos.

Enterramento: profundidade implementada de 0,7 m; agrupamentos de até seis circuitos nas tabelas 44/45, com resistividade de 2,5 K·m/W e espaçamentos tabelados. Tabela 41 aplica-se ao caso implementado de um circuito em conduto enterrado, com classe superior conservadora para resistividade intermediária. Outras combinações ficam pendentes. As aproximações de até ±10% das tabelas 44/45 são indicadas.

O modelo de várias camadas exige contagem compatível com camadas × circuitos por camada. Não deduz agrupamento de uma planta, não dispensa confirmação de condições reais e não substitui um estudo térmico específico. A temperatura mostrada é apenas a máxima de serviço da isolação; não há temperatura operacional estimada.

Correntes de grupos/alimentadores não são somadas automaticamente: usa-se Ib informado, identificado como estudo externo, até implementação autorizada de um modelo correspondente. Uma formação utiliza a corrente do circuito em todos os seus trechos; não há redução automática por derivação de cargas dentro do mesmo circuito.

Proteção, curto-circuito, seccionamento, coordenação, partida, queda e ocupação continuam identificados separadamente como não verificados/não calculados. A seleção apresentada não é seção final de projeto nem aprovação global.

**Etapa 6 concluída com a cobertura e as limitações documentadas. Etapa 7 não iniciada; aguarda confirmação expressa.**
