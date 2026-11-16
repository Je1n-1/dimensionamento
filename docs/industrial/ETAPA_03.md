# Etapa 3 — Consumidores e cargas

**Conclusão: 25/10/2026.** Implementada exclusivamente a Etapa 3 do roteiro original. A Etapa 4 não foi iniciada.

Árvore ativa: `C:/Users/jeanm/OneDrive/Desktop/dimensionamento`.
Aplicação: http://127.0.0.1:8000/industrial/

## Entrega funcional

A página Consumidores e cargas utiliza a área principal completa, com tabela de cadastro, indicadores, filtros e ações, sem Assistente técnico lateral. É necessário criar ou abrir um projeto antes de cadastrar os itens. O salvamento do consumidor confirma a persistência no projeto atual, sem exigir outro clique em Salvar projeto.

Tipos disponíveis: motor, painel/quadro, transformador, inversor/acionamento, iluminação, aquecimento e outra carga. O formulário apresenta dados adicionais de motor apenas quando esse tipo é escolhido; painéis têm orientação e identificação próprias como origem de cargas.

| Grupo | Campos e comportamento |
| --- | --- |
| Identificação | Tipo, tag única no projeto, descrição, quantidade e observações |
| Potência | Valor por equipamento, W/kW/VA/kVA/cv/hp e base ativa elétrica/aparente/mecânica |
| Alimentação | Tensão, frequência, ligação, fases e presença explícita de PE |
| Parâmetros | Fator de potência e rendimento em fração de 0 a 1 |
| Cabo e instalação | Método informado, cobre/alumínio, condutores isolados/unipolar/multipolar/outro, PVC/XLPE/EPR/outra isolação descrita |
| Localização | Ambiente/setor, temperatura, distância e identificação de sua base |
| Origem | Painel de origem, tag de trecho planejado e vínculo a trecho existente quando disponível |
| Motor | Polos, fator de serviço, correntes de placa e de catálogo separadas, fabricante, modelo, edição e referência |

A quantidade representa equipamentos com as mesmas características. Cargas com valores diferentes devem ter registros distintos. Cada painel tem quantidade 1 para manter identidade própria. A potência por equipamento não é multiplicada/somada como resultado elétrico nesta etapa.

Há criação, leitura, edição e exclusão confirmada. Filtros de tipo, ambiente e trecho podem ser combinados com busca por tag, descrição, observações e ambiente. A pesquisa mantém o foco durante a digitação. A tabela distingue registros de quantidade de equipamentos.

## Validação e integridade

- Tipo e tag são obrigatórios; tags repetidas no mesmo projeto, inclusive com diferenças de caixa, são recusadas.
- Quantidade deve ser inteira positiva. Números não finitos, negativos em campos positivos e valores fora dos limites do contrato são recusados.
- Unidade e base de potência precisam ser compatíveis quando informadas; potência preenchida exige unidade/base.
- Ligação e conjunto de fases precisam corresponder. Um motor pode ser cadastrado com L1 + L2 + L3 + PE, sem neutro. Nenhum tipo de carga infere TT ou outro esquema de aterramento.
- Distância preenchida exige escolher entre acumulada desde o quadro e comprimento físico de um segmento. O significado aparece no formulário e na tabela.
- Corrente de catálogo exige fabricante e referência; os valores são entradas do usuário, sem validar um catálogo externo ou escolher a fonte de cálculo.
- Painéis cadastrados tornam-se opções de origem. Autorreferência e ciclo na cadeia de origem são recusados.
- Exclusão ou mudança de tipo não deixa vínculos externos pendurados: consumidores, circuitos ou nós referenciando o item impedem a operação. Não há remoção automática em cascata.
- Uma alteração incrementa a revisão elétrica e invalida resultados anteriores. Resultados destinados a um item excluído são removidos.
- Gravação usa a revisão capturada ao abrir o formulário. Conflito entre abas ou falha de persistência mantém a edição e mostra o motivo; não publica um rascunho como salvo.

Campos ainda desconhecidos podem permanecer vazios. A tabela apresenta Dados pendentes e uma lista expansível dos campos ausentes. Cadastrado significa preenchimento básico, acompanhado de Não calculado; não declara completude para todas as verificações futuras nem conformidade normativa.

## Preservação de projetos e arquitetura

O contrato ativo passou para `contracts.v3.json`. Os contratos v1 e v2 foram mantidos. A migração v2 → v3 valida o projeto antigo e acrescenta somente os campos novos, conservando IDs, datas, revisões e entradas existentes. Ler não grava: a atualização persistida acontece em uma transação bem-sucedida do repositório. Falhas e formatos desconhecidos preservam o conteúdo original. Abas abertas com código anterior devem ser recarregadas após a atualização.

O adaptador local e o namespace industrial da Etapa 2 foram mantidos. Não houve criação de banco SQL, sincronização externa, dependência de execução ou endpoint de cálculo. O servidor permanece Python. Dados industriais continuam vinculados ao navegador e à origem; não são misturados com o residencial.

As regras 2004 seguem isoladas e não implementadas. Nenhuma tabela de 1997 foi reutilizada para declarar atendimento industrial. As portas de condutores e proteção permanecem separadas. Decisões detalhadas em [DECISOES_ARQUITETURAIS.md](DECISOES_ARQUITETURAIS.md), DA-17 a DA-20.

## Arquivos criados

| Arquivo | Responsabilidade |
| --- | --- |
| `data/industrial/contracts.v3.json` | Novos campos de consumidor e corrente de catálogo |
| `frontend/industrial/js/core/migrations.js` | Migração aditiva validada de projetos v2 |
| `frontend/industrial/js/core/consumers.js` | CRUD puro, consistência de entradas, filtros, vínculos e pendências |
| `frontend/industrial/js/consumers-view.js` | Tabela, indicadores, filtros e formulário |
| `frontend/industrial/js/consumers-controller.js` | Eventos, edição, confirmação, persistência e erros |
| `tests/industrial/consumers.test.mjs` | Casos de cadastro, validação, persistência e migração |
| `docs/industrial/ETAPA_03.md` | Relatório desta entrega |
| `docs/industrial/evidencias/etapa03_*.png` | Evidências de QA descritas abaixo |

## Arquivos modificados

- `frontend/industrial/js/app.js`: integração do cadastro, contrato v3 e indicação da etapa disponível.
- `frontend/industrial/js/pages.js`: página real de consumidores e remoção do placeholder substituído.
- `frontend/industrial/js/projects-view.js`: orientação para acessar o cadastro já disponível.
- `frontend/industrial/js/core/local-repository.js`: atualização validada dos projetos v2 durante leitura/transação.
- `frontend/industrial/css/industrial.css`: tabela, filtros, pendências expansíveis e formulário responsivo.
- `voltcalc/industrial/contracts.py`: carregamento do contrato v3.
- `voltcalc/web/assets.py`: recursos públicos industriais novos e rota do contrato v3.
- `tests/industrial/test_structure.py`: contrato público atualizado.
- `tests/industrial/contract_cases.json`: versão futura incompatível atualizada para 4.
- `docs/industrial/DECISOES_ARQUITETURAIS.md` e `PENDENCIAS.md`: decisões e acompanhamento da etapa.

## Testes executados

### Regressão automatizada final

- `python -m unittest discover -s tests -q`: **87 testes aprovados** (80 residenciais e 7 industriais).
- **8 suítes JavaScript aprovadas**: `tests/grid.test.cjs`, `tests/model.test.cjs`, `tests/report.test.mjs`, `tests/rooms.test.mjs`, `tests/ux.test.mjs`, `tests/industrial/structure.test.mjs`, `tests/industrial/repository.test.mjs` e `tests/industrial/consumers.test.mjs`.
- A nova suíte verifica os sete tipos, unidades/bases, ligações, distâncias, validações negativas, imutabilidade em erro, atualização/exclusão, especializações, referências, invalidação, persistência, isolamento de outro projeto, conflito de revisão, migração v2 e falha de gravação durante a migração.
- Comparação SHA-256 da linha de base protegida: **106 arquivos sem alteração**. A lista exclui o módulo industrial, temporários e o arquivo de integração autorizado `voltcalc/web/assets.py`. Registro: `tmp/industrial_stage3_baseline.json`.
- Log da execução Python: `tmp/industrial-stage3-python-tests.log`.

### Verificação de interface

Executada na origem isolada `http://127.0.0.1:8001`, com projeto de QA criado pelo teste:

1. Criar painel, motor completo e iluminação; conferir valores na tabela, incluindo placa e catálogo independentes, fases/PE, quantidade e base da distância.
2. Recarregar e reabrir edição, confirmando a persistência dos campos. Os três registros também foram recuperados após interrupção e reinício do navegador/servidor.
3. Combinar filtros de tipo, ambiente e trecho; buscar com digitação contínua.
4. Recusar potência em VA com base mecânica; corrigir e salvar edição de quantidade/distância.
5. Recusar exclusão do painel usado como origem do motor.
6. Editar o motor em duas abas: preservar a gravação da segunda e recusar a revisão antiga, mantendo o texto do rascunho da primeira.
7. Cancelar exclusão por Escape, depois confirmar a exclusão de iluminação e recarregar; painel e motor permaneceram.
8. Revisar a página e o formulário em viewport real de 390 px: página com largura de conteúdo de 375 px e formulário com conteúdo de 342 px, sem transbordamento horizontal. A tabela tem rolagem horizontal local para suas colunas.
9. Conferir ausência de avisos/erros no console observado; remover o projeto temporário, recarregar e confirmar catálogo de QA vazio.
10. Reabrir a aplicação principal na porta 8000, sem dados demonstrativos e sem alterar o catálogo principal nos testes.

### Evidências visuais

Os registros nas imagens abaixo são dados temporários de teste, não resultados de dimensionamento. Eles foram removidos da origem de QA ao concluir.

- [Tabela de consumidores — desktop](evidencias/etapa03_consumidores_desktop.png)
- [Tabela de consumidores — mobile](evidencias/etapa03_consumidores_mobile.png)
- [Formulário — mobile](evidencias/etapa03_formulario_mobile.png)
- [Conflito entre abas](evidencias/etapa03_conflito.png)

## Limitações e próximas etapas

- Conversões, potência instalada agregada, seleção da corrente de placa/catálogo/fórmula e correntes calculadas: Etapa 4.
- Topologia, criação de segmentos físicos e validação dos percursos: Etapa 5. A tag planejada não cria segmento.
- Aplicabilidade normativa de método/material/isolação, fatores, condutores e demais verificações: etapas originais correspondentes, sem declaração de Conforme nesta entrega.
- Importação/exportação e recuperação avançada: Etapa 10. O botão ilustrativo de importação não antecipou uma implementação fora do cadastro solicitado.
- Não há integração automática com fabricantes, proteção/partida de motores nem banco compartilhado. O armazenamento local mantém as limitações registradas na Etapa 2.
- Ressalvas SENAI e do residencial permanecem acompanhadas em [PENDENCIAS.md](PENDENCIAS.md); não houve correção fora do escopo.

**Encerramento:** Etapa 3 concluída. A Etapa 4 aguarda confirmação expressa do usuário.
