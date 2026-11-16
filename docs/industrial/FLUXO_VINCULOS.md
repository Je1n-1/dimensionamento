# Consumidor → circuito → quadro → trechos

Entrega de 07/11/2026. Acompanhamento IND-63, sem alterar o roteiro 0–11 ou os motores elétricos.

## Mudanças entregues

- A tabela de consumidores apresenta método/temperatura/comprimento dos trechos e material/isolação dos condutores vinculados, identificando a origem dos dados. Não soma comprimentos de ramais diferentes como se fossem a distância de uma carga.
- Campos de planejamento ausentes deixam de aparecer como exigência de repetição quando a carga já tem circuito. Dados efetivamente ausentes na estrutura recebem diagnóstico próprio. Quadros não são cobrados como se fossem equipamentos consumidores comuns.
- **Ver vínculos e próximos passos** mostra circuitos, quadros e trechos reais, aponta referências incompletas e divergência de quadro, e oferece edição direta do circuito, trecho, condições térmicas e condições do cabo.
- Planejamento fica em uma seção recolhível no cadastro de cargas já vinculadas. Sua edição não sobrescreve silenciosamente a estrutura usada no cálculo.
- O filtro por trecho também localiza vínculos efetivos. O indicador conta cargas com circuito, em vez de apenas referências textuais de planejamento.
- Preparar circuito a partir de uma carga pré-seleciona essa carga e seu quadro declarado. A preparação em lote oferece seleção das cargas sem origem ou do quadro escolhido, mantendo confirmação explícita de percursos independentes e validação transacional no Python.
- Dimensionamento diferencia **seção sugerida** e **seção adotada de fase**, além de disponibilizar os mesmos atalhos contextuais.

## Preservação e limites

`core/workflow.js` é uma leitura dos vínculos declarados, não um validador elétrico. Sua apresentação nunca substitui análise de topologia, capacidade, queda ou proteção. Nenhum circuito é criado por um nome de trecho, nenhum comprimento é inferido e nenhum dado salvo é alterado pela leitura. Confirmações térmicas permanecem explícitas.

Alterações em circuitos, trechos e condições usam os controladores e transações existentes, com revisão e invalidação. Modelos/backup v9 mantidos. Não houve refatoração residencial ou migração de projetos. O projeto didático foi adicionado explicitamente a pedido do usuário; o projeto anterior na origem principal foi preservado.

## Arquivos

Novos: `frontend/industrial/js/core/workflow.js`, `frontend/industrial/js/workflow-view.js`, `tests/industrial/workflow-links.test.mjs`, gerador/JSON em `examples/industrial/`, `tests/industrial/test_example_15kw.py` e esta documentação.

Modificados: `core/consumers.js`, `consumers-view.js`, `conductors-view.js`, `topology-view.js`, `topology-controller.js` e lista pública industrial em `voltcalc/web/assets.py`. As alterações de PDF já existentes foram preservadas e documentadas separadamente em RELATORIO_RESUMIDO.md.

## Validação

229 testes Python e 19 suítes JavaScript aprovados no conjunto deste trabalho. Os testes novos verificam dados completos na estrutura com planejamento vazio, identificação de faltas reais, divergência de quadro, filtro por vínculo, seleção da carga, escape de texto e ausência de mutações. O exemplo testa 15.000 W exatos, 5.000 W por fase, seis circuitos e resultados parciais honestos.

No navegador: importação em cópia isolada de QA, cálculo das seis cargas, abertura do trecho correto pelo atalho e confirmação das informações; depois importação autorizada na origem principal. Em 07/11, recuperação do exemplo salvo confirmada, preservando o projeto anterior. Logs locais: `tmp/workflow-python-tests.log` e `tmp/workflow-js-tests.json`.

Consulte [exemplo didático](EXEMPLO_15000W.md) e [continuidade de proteção](PROTECAO_PLANEJAMENTO.md).
