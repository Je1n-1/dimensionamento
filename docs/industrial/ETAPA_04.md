# Etapa 4 — Potências e correntes nominais

**Conclusão: 25/10/2026.** Etapa 4 concluída no escopo do roteiro original. Etapa 5 não iniciada; aguarda autorização expressa.

Árvore utilizada: `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`. Implementação Python com interface industrial existente. Motor de cálculo, dados e interface residenciais preservados.

## Funcionalidades entregues

1. Serviço Python independente da interface para conversões W, kW, VA, kVA, cv e hp. Bases elétrica ativa absorvida, aparente e mecânica de saída são explícitas. Dados desconhecidos não recebem valor 1.
2. Fórmulas FN/FF e trifásicas equilibradas, com tensão apropriada à ligação. Potência mecânica requer rendimento e fator de potência para estimar corrente. Catálogo e fórmula podem aparecer em paralelo, com fontes distintas.
3. Seleção automática placa → catálogo → fórmula ou escolha explícita da fonte. Fonte explícita incompleta não é substituída silenciosamente. Catálogo manual exige identificação e referência; a tabela fornecida exige seleção explícita e combinação existente.
4. Transcrição das 35 linhas da fotografia WEG W21, 60 Hz, IP55; 220/380/440 V; 2/4/6/8 polos. Sem anotações manuscritas, aproximações ou preenchimento de células ausentes. Origem, edição, página, versão do registro e hash preservados.
5. Separação de corrente nominal, calculada, selecionada, limite inferior da corrente de projeto de motor, partida informada e corrente medida. Partida e medida não substituem nominal/projeto.
6. Ib mínimo para circuito terminal exclusivo de um motor, somente no escopo confirmado de 6.5.1.1/6.5.1.3.1. In de placa/catálogo e condições efetivas são necessárias. Se houver intenção de explorar FS > 1 declarado pelo fabricante, Ib mínimo = In × FS; caso contrário, In. Sem redução arbitrária.
7. Resultados em Consumidores e cargas, expansíveis, com grandezas, origem, fórmulas e motivos das pendências. Botão **Calcular potências e correntes**. Nenhuma nova seção lateral.
8. Potências do registro consideram quantidade uma vez; correntes são por equipamento. Soma de potência ativa de usos finais conhecidos identifica cobertura parcial. Total com painéis, transformadores, acionamentos ou cargas não classificadas aguarda topologia para evitar dupla contagem.
9. Contrato v4, migração aditiva de v2/v3, persistência dos resultados e rejeição de revisões/versões incompatíveis. Alterar entradas invalida cálculos. Alterar condições nominais no formulário limpa a confirmação correspondente.
10. Aviso útil de servidor offline, sem apagar dados existentes ou confirmar gravação que falhou.

## Exemplo verificado

Dados temporários de teste: W21, 20 cv, 380 V, 4 polos, 60 Hz, FP 0,85, rendimento 0,90, um motor, circuito exclusivo S1/gaiola confirmado e utilização declarada de FS 1,15.

| Grandeza | Resultado | Origem |
|---|---:|---|
| Potência mecânica | 14.709,975 W | Conversão de 20 cv |
| Potência ativa elétrica | 16.344,4167 W | Potência mecânica / rendimento |
| Corrente estimada | 29,2150 A | Potência elétrica / (√3 × 380 × 0,85) |
| Corrente nominal selecionada | 30,4 A | Linha 20 cv, 380 V, 4 polos da tabela |
| Ib mínimo | 34,96 A | 30,4 × 1,15, nas condições declaradas |

A coluna kW do impresso identifica essa linha como 15 kW. Essa equivalência de catálogo foi preservada como chave da tabela, sem confundi-la com a conversão exata de 20 cv para watts. A tabela e a fórmula podem dar valores diferentes por terem origens e parâmetros distintos. Nenhum cabo ou disjuntor foi dimensionado neste exemplo.

## Arquivos novos

- `data/industrial/contracts.v4.json` e `data/industrial/catalogs/weg-w21-fockink-2006.v1.json`.
- `voltcalc/industrial/power.py`, `catalogs.py`, `current_rules.py` e `currents.py`.
- `frontend/industrial/js/core/currents.js`, `frontend/industrial/js/currents-controller.js` e `currents-view.js`.
- `tests/industrial/test_currents.py` e `tests/industrial/currents.test.mjs`.
- `docs/industrial/fontes/fockink-weg-w21-p47.jpg`, `fontes/README.md`, este relatório e evidências `evidencias/etapa04_*.png`.

## Arquivos modificados

- `voltcalc/industrial/contracts.py`: contrato ativo v4; nome do argumento da fábrica separado do campo de projeto `name`.
- `voltcalc/industrial/__init__.py`: descrição do módulo.
- `voltcalc/web/api.py`: rota industrial independente, com importação sob demanda.
- `voltcalc/web/assets.py`: publicação explícita dos módulos e contrato v4, preservando versões anteriores.
- `frontend/industrial/js/app.js`: contrato/migrações, controlador de correntes, etapa e filtros de resultados.
- `frontend/industrial/js/core/migrations.js`: migração v2/v3 para v4 validada na origem.
- `frontend/industrial/js/core/services.js`: adaptador HTTP, versão de regra por domínio e erros de transporte.
- `frontend/industrial/js/core/state.js`: aceitação restrita a correntes rastreáveis e invalidação por versão/domínio/revisão.
- `frontend/industrial/js/consumers-controller.js`: booleanos desconhecidos e limpeza da confirmação nominal.
- `frontend/industrial/js/consumers-view.js`: entradas/fontes, ação de cálculo e resultados.
- `frontend/industrial/js/pages.js`: descrição da cobertura parcial em Configurações.
- `frontend/industrial/css/industrial.css`: cartões de resultados responsivos.
- `tests/industrial/test_structure.py` e `contract_cases.json`: contrato ativo e próxima versão incompatível.
- `tests/industrial/consumers.test.mjs`: expectativas de textos atualizadas; verificações anteriores mantidas.
- `docs/industrial/DECISOES_ARQUITETURAIS.md`: DA-21 a DA-25.
- `docs/industrial/PENDENCIAS.md`: IND-04/05 e acompanhamento dos limites.

## Validação automatizada

- `python -m unittest discover -s tests -q`: **105 testes aprovados** — 80 residenciais, 7 industriais anteriores e 18 novos de potência/corrente/HTTP.
- **9 suítes JavaScript aprovadas**: grid, model, report, rooms, ux, industrial/structure, industrial/repository, industrial/consumers e industrial/currents.
- Casos novos: unidades/bases incompatíveis, cv versus hp, rendimento/FP ausentes, FN/FF/3F, desequilíbrio, prioridade de fontes, combinação ausente na tabela, 50 Hz, células vazias, FS e intenção de uso, escopo desconhecido, quantidade, limite de 150 kW, overflow/NaN/booleanos, revisão/versão, API 400, integração real Python → contrato JS, persistência, quota, conflito de revisão, migração v2/v3, invalidação e HTML escapado.
- Comparação SHA-256: **105 arquivos protegidos sem alteração**. Integrações autorizadas `voltcalc/web/api.py` e `assets.py`, módulo industrial e temporários são excluídos da linha de base. Motor e testes residenciais preservados.
- Registros: `tmp/industrial-stage4-python-tests.log`, `tmp/industrial-stage4-regression.json` e `tmp/industrial_stage4_baseline.json`.

## Conferência no navegador

Origem isolada de QA: `http://127.0.0.1:8001`. Nenhum projeto de teste foi criado na origem principal 8000.

- Consultar a tabela e conferir 30,4 A, fórmula 29,215 A e Ib mínimo 34,96 A; partida 180 A e medida 12 A independentes.
- Recarregar e recuperar resultados persistidos.
- Alterar quantidade para 2: invalidar resultados, recalcular potências e manter Ib de grupo pendente.
- Informar 50 Hz: consulta WEG recusada, sem substituir a fonte selecionada pela fórmula.
- Alterar frequência no formulário: confirmação nominal limpa; reconfirmar após conferir dados.
- Incluir 15 luminárias de 100 VA em FN/220 V sem FP: corrente por equipamento disponível; potência ativa pendente, sem assumir FP = 1.
- Filtrar a lista: cartões acompanham os filtros sem interromper digitação.
- Desligar servidor de QA e tentar calcular: aviso para iniciar `python server.py`, sem remover resultados salvos. Reiniciar e continuar.
- Desktop de 1280 px e celular de 390 px: página sem transbordamento horizontal (conteúdo 1265/375 px). Formulário mobile com 341 px úteis e de conteúdo. Tabela mantém rolagem local.
- Projeto temporário removido; catálogo de QA vazio confirmado após recarregar. Viewport restaurado. Servidor principal iniciado e módulo aberto em `http://127.0.0.1:8000/industrial/`.

Uma falha de vinculação de `fetch` ao navegador foi detectada na conferência de UI e corrigida, com teste de regressão. Os valores das evidências são de teste e foram removidos ao final:

- [Resultados no desktop](evidencias/etapa04_correntes_desktop.png)
- [Resultados no celular](evidencias/etapa04_correntes_mobile.png)
- [Formulário no celular](evidencias/etapa04_formulario_mobile.png)

## Fontes e limites

- [Fotografia preservada](fontes/fockink-weg-w21-p47.jpg): Fockink MA-ENG-AE-0003, Seção II, Rev.05 — 19/04/2021, p.47/111. Fonte declarada: WEG W21 IP55, setembro de 2006. Não equivale a integração atual com fabricantes.
- PDF local `C:/Users/jeanm/Downloads/NBR-5410.pdf`: ABNT NBR 5410:2004, corrigida de 17/03/2008, páginas impressas 154–155 (físicas 162–163), escopo e critério de motor.
- [Guia de especificação WEG, seção 1.2.6, página 11](https://static.weg.net/medias/downloadcenter/h32/hc5/WEG-motores-eletricos-guia-de-especificacao-50032749-brochure-portuguese-web.pdf): relação entre potência mecânica, rendimento, fator de potência e corrente.
- [NIST SP 811, edição 2008, Apêndice B](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication811e2008.pdf): conversão de horsepower mecânico e métrico. Usam-se as definições para evitar arredondamento intermediário.

Corrente calculada não comprova adequação de condutores, proteção, partida, curto-circuito, coordenação, queda, aterramento ou infraestrutura. Motor sem In de placa/catálogo recebe estimativa pela fórmula, mas o limite normativo de Ib permanece pendente. Múltiplos motores e cargas trifásicas desequilibradas não recebem resultados fora do modelo implementado. Painéis e acionamentos requerem topologia para consolidar a instalação.

Nenhum status Conforme foi acrescentado. Nenhuma ressalva SENAI/residencial fora do escopo foi corrigida. Etapas 0 a 11 permanecem na sequência original.

**Próxima ação depende de confirmação expressa: Etapa 5 — Estrutura lógica de painéis, trechos e ramais.**
