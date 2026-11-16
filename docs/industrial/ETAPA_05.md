# Etapa 5 — Estrutura lógica de painéis, trechos e ramais

Data: 26/10/2026. Árvore utilizada: `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`.

## Resultado

Implementado o cadastro lógico de quadros, pontos, trechos principais, ramais, circuitos, formações de cabos e infraestrutura declarada. A edição está em **Consumidores e cargas → Caminhos e circuitos**, sem nova aba lateral e sem mapa completo. O roteiro original de 0 a 11 foi mantido.

O serviço Python identifica os caminhos físicos até cada consumidor/quadro, os circuitos compartilhando cada trecho e as quantidades/funções declaradas dos cabos e condutores. Circuitos deixam de participar da contagem após sua derivação quando seus percursos terminam naquele ponto. Nenhum número de demonstração é inserido nos projetos do usuário.

## Funcionalidades

- Quadros independentes e pontos de origem externa, quadro, consumidor ou derivação/passagem. Geração explícita dos pontos faltantes das cargas e quadros já cadastrados.
- Trechos com origem, destino, comprimento físico, tipo principal/ramal, método, ambiente, temperatura, disposição e condições do solo.
- Assistente de caminho com distâncias físicas ou acumuladas desde a origem escolhida. Exemplo testado: 28/35/51 m → trechos de 28/7/16 m.
- Circuitos com origem, consumidores/quadros atendidos e seleção dos trechos que efetivamente percorrem.
- Formações unipolares, multipolares ou de condutores isolados, quantidades em paralelo e funções L1/L2/L3/N/PE/PEN explícitas. Percurso completo do circuito ou subconjunto selecionado.
- Cadastro do tipo de infraestrutura por trecho, mantendo a ocupação não calculada.
- Diagnósticos de origem/destino ausente, circuito desconectado, trecho excedente, destino não alcançado, caminho ambíguo, ciclo, alimentação duplicada, vínculo repetido, formação incompleta e divergência com quadro planejado.
- Exclusão bloqueada para itens vinculados. Quadros pertencentes a consumidores painel são mantidos sob edição no cadastro de consumidores. Exclusão de formação remove apenas seus condutores próprios quando não há vínculos externos.
- Migração aditiva para o contrato v5, persistência com controle de revisão, invalidação de resultados ao alterar a estrutura e análise transitória por revisão.

## Arquivos da etapa

Novos:

- `data/industrial/contracts.v5.json`
- `voltcalc/industrial/topology.py`
- `frontend/industrial/js/core/topology.js`
- `frontend/industrial/js/topology-controller.js`
- `frontend/industrial/js/topology-view.js`
- `tests/industrial/test_topology.py`
- `tests/industrial/topology.test.mjs`
- Este relatório e as três evidências em `docs/industrial/evidencias/etapa05_*.png`.

Modificados para integrar a etapa:

- `voltcalc/industrial/contracts.py`: contrato ativo v5.
- `voltcalc/web/api.py`: rota industrial de topologia, sem alteração dos cálculos residenciais.
- `voltcalc/web/assets.py`: publicação explícita do contrato e módulos novos.
- `frontend/industrial/js/core/migrations.js`: preenchimento aditivo recursivo dos novos campos.
- `frontend/industrial/js/core/services.js`: versão independente do domínio de topologia.
- `frontend/industrial/js/app.js`: contrato v5, controlador contextual e identificação da etapa.
- `frontend/industrial/js/pages.js`: subseção de caminhos dentro de Consumidores e cargas.
- `frontend/industrial/css/industrial.css`: formulários, tabelas e controles responsivos da estrutura.
- `tests/industrial/contract_cases.json`, `test_structure.py`, `currents.test.mjs`: versão ativa e regressão da compatibilidade.
- `docs/industrial/DECISOES_ARQUITETURAIS.md`: DA-26 a DA-29.
- `docs/industrial/PENDENCIAS.md`: IND-06/07, acompanhamento de IND-28 e IND-30 a IND-33.

Os demais arquivos já alterados no diretório de trabalho pertencem às etapas anteriores e não foram revertidos nem incluídos como mudanças desta etapa.

## Validação

- Regressão Python completa: **125 testes aprovados**, incluindo 20 novos testes de topologia.
- **10 suítes JavaScript aprovadas**: grid, model, report, rooms, ux, industrial/structure, repository, consumers, currents e topology.
- Testes reais na fronteira Python/JavaScript, API HTTP, migração v2/v3/v4, persistência, conflito de revisão, duplicação com remapeamento de vínculos e isolamento da chave residencial.
- Cenário de três circuitos: 3/2/1 circuitos presentes, 12/8/4 cabos unipolares para formações L1/L2/L3/PE, percursos de 28/35/51 m. A quantidade de equipamentos não multiplica cabos automaticamente.
- Variações multipolares, condutores isolados, formações em paralelo, mudança de formação ao longo do percurso, ramal independente, comprimentos ausentes e distância acumulada inválida.
- Recusa atômica de ciclos, alimentação duplicada, vínculo repetido e exclusões indevidas. Alteração de estrutura invalida grandezas anteriores e conserva a rastreabilidade.
- Navegador: cadastro de dois quadros, criação de pontos, caminho acumulado, circuito alimentador, formação de quatro unipolares, condições do trecho e infraestrutura; persistência após recarga; bloqueio de ciclo com mensagem no formulário.
- Responsividade em 1280 × 900 e 390 × 844. Na tela pequena, largura do documento 375 px para viewport de 390 px; tabelas têm rolagem local. Texto dos seletores corrigido e reinspecionado.
- Conferência SHA-256: **105 arquivos protegidos do residencial e suporte permaneceram inalterados** em relação à linha de base da etapa.

Comandos de regressão: `python -m unittest discover -s tests -q` e execução com Node de cada arquivo `tests/**/*.test.mjs` / `tests/*.test.cjs`. Log Python em `tmp/industrial-stage5-python-tests.log`.

## Evidências

- [Cadastro de caminhos no desktop](evidencias/etapa05_caminhos_desktop.png)
- [Trechos, quantidades e circuito](evidencias/etapa05_trechos_desktop.png)
- [Formulário de formação no celular](evidencias/etapa05_formulario_mobile.png)

As capturas utilizam projeto temporário identificado como QA, criado na origem de testes da porta 8001. Não são resultados de uma instalação real.

O projeto temporário foi removido ao finalizar os testes, e o servidor de QA foi encerrado. O servidor principal foi iniciado com o código atualizado em `http://127.0.0.1:8000/industrial/` e sua abertura foi verificada no navegador. Nenhum projeto de teste foi gravado nessa origem principal.

## Limites e pendências

Estrutura válida significa apenas que as verificações lógicas implementadas passaram. Não existe indicador Conforme nesta entrega. Métodos e condições ambientais são declarados pelo usuário; nenhum método é inferido a partir da infraestrutura. A versão `industrial-topology-1` não é uma versão normativa.

Sem dimensionamento de condutores, cálculo de corrente de alimentadores, proteção, fatores térmicos, ocupação, queda de tensão, mapa final ou exportação. Distâncias legadas e planejamento textual não são convertidos em uma rede automaticamente. Múltiplas alimentações e redes cíclicas são recusadas. A contagem física não aprova PE/PEN, paralelismo ou condutores carregados.

Os dados permanecem locais ao navegador e à origem. Usar outra porta não transfere os projetos. O repositório da Etapa 2 e os serviços de correntes da Etapa 4 foram preservados. Ressalvas SENAI/residenciais continuam como acompanhamento, sem alterações no motor residencial.

**Etapa 5 concluída. Etapa 6 não iniciada; aguarda confirmação expressa.**
