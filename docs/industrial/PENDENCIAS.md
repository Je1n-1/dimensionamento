# VoltCalc Industrial — acompanhamento de pendências

Atualização: 24/10/2026, Etapa 2. As evidências da Etapa 1 foram preservadas. Fontes: [auditoria SENAI](../analysis/REVISAO_SENAI.md), [Etapa 0](ETAPA_00.md) e roteiro original do usuário.

Este registro não autoriza alterações imediatas, não reorganiza as Etapas 0 a 11 e não significa que funcionalidades futuras foram implementadas. Prioridades representam risco e dependência; a execução permanece condicionada à autorização da etapa correspondente. Os achados residenciais permanecem sem correção nesta entrega.

## Industrial — funcionalidades previstas e ressalvas técnicas

| ID | Prioridade | Problema ou necessidade | Etapa original prevista | Situação / critério de fechamento |
|---|---|---|---|---|
| IND-01 | Alta | Persistência industrial | 2 | Resolvido na Etapa 2: adaptador localStorage isolado, Web Locks, revisões, gravação confirmada e tratamento de falhas; limitações documentadas em ETAPA_02.md |
| IND-02 | Alta | Múltiplos projetos, duplicação e exclusão | 2 | Resolvido na Etapa 2: CRUD, pesquisa, filtro, ordenação, cópia independente e exclusão confirmada; ciclo completo testado |
| IND-03 | Alta | Cadastro industrial e completude dos dados | 3 | Resolvido na Etapa 3: cadastro dos sete tipos, edição/exclusão, filtros, persistência e validação contextual; dados ausentes explicitados |
| IND-04 | Alta | Potência mecânica/elétrica/aparente e corrente dos motores | 4 | Atendido na Etapa 4: conversões, bases e fontes separadas; Ib mínimo limitado ao escopo explicitamente confirmado. Casos fora dele permanecem pendentes |
| IND-05 | Alta | Catálogo WEG/fabricante | 4 | Atendido para a fotografia Fockink/WEG W21 recebida em 25/10/2026; origem/edição, limites e SHA-256 registrados. Não é catálogo atual de qualquer motor |
| IND-06 | Alta | Topologia e trechos compartilhados | 5 | Atendido no escopo radial dirigido: editor, vínculos, percursos únicos, contagens e validação. Limites em DA-26 a DA-29 |
| IND-07 | Alta | Confusão entre distância acumulada e comprimento físico | 3 e 5 | Atendido: base explícita no assistente, conversão em comprimentos físicos e extensão por destino; distâncias legadas preservadas sem inferência |
| IND-08 | Alta | Classificação de força e seção mínima — achado SENAI | 6 | Campo de finalidade previsto; regras e casos de motor/chuveiro/transformador deverão ser verificados |
| IND-09 | Alta | Base industrial da edição 2004 não implementada | 6 | Registro isolado e sem tabelas; validar fontes, notas, abrangência e versões antes de calcular |
| IND-10 | Alta | Métodos E/F/G e disposições não cobertas pelo motor antigo | 6 | Não converter bandejas/leitos automaticamente em B1; implementar somente referências validadas |
| IND-11 | Alta | Aplicabilidade de agrupamento heterogêneo | 5 e 6 | Considerar circuitos efetivamente presentes, arranjos, seções e isolações; não contar grupos de equipamentos como circuitos |
| IND-12 | Alta | Solo, enterramento e agrupamento subterrâneo/espaçado | 6 | Dados de solo previstos; fatores e condições de aplicação dependem de referências específicas |
| IND-13 | Alta | Neutro, PE, harmônicas e condições de redução | 6; conferir cobertura na 11 | Funções de condutor previstas; dimensionamento e limites ainda pendentes. O que não for calculado deve continuar explícito |
| IND-14 | Alta | Restrições de uso do alumínio | 6 | Material cadastrado não equivale a uso permitido; verificar aplicabilidade |
| IND-15 | Alta | Separação entre seção do cabo e proteção | 6; rastreabilidade na 10 e 11 | Portas distintas prontas; não aprovar proteção por existência de cabo dimensionado |
| IND-16 | Alta | Ocupação real e diâmetros externos | 7 | Campos de infraestrutura/diâmetro preparados; serviço ausente. Não usar seção metálica como área externa |
| IND-17 | Alta | Limites genéricos de 70%/75% para bandeja/leito nas imagens | 7 | Não implantados; exigir referência, disposição e condições aplicáveis |
| IND-18 | Alta | Limite terminal versus limite total e queda a montante — SENAI | 8 | Finalidade/limite/fonte previstos; cálculo acumulado e validação normativa ainda ausentes |
| IND-19 | Alta | Queda R/X aproximada versus tabela real de fabricante — SENAI | 8 | Preservar caso de fronteira 3,8431% versus 4,0518% como referência de teste; validar dados do cabo e hipóteses |
| IND-20 | Alta | Temperatura real do condutor não calculada | 6; apresentação na 9 e 10 | Nenhuma temperatura demonstrativa apresentada; somente implementar/exibir estimativa com modelo identificado |
| IND-21 | Alta | Corrente de partida, curto-circuito, energia passante, seletividade e coordenação | Acompanhar 4/6/8/10/11 conforme roteiro; implementação completa depende de autorização futura específica | Permanecer “Não verificado” quando não calculado. Não transformar a validação final da Etapa 11 em implementação não prevista |
| IND-22 | Média | Mapa completo e edição visual | 9 | Somente área vazia em Visão geral; coordenadas visuais não podem redefinir comprimentos elétricos |
| IND-23 | Alta | Exportação, recuperação e validade de resultados persistidos | 10; fundamentos de gravação na 2 | Sem exportação industrial nesta entrega; incluir revisões, versões, fontes e pendências |
| IND-24 | Média | Importação industrial diferente do CSV residencial | 3 e 10, conforme formato previsto | Definir e validar contratos de entrada próprios; não anunciar suporte XLSX não implementado |
| IND-25 | Alta | Desempenho e cenário de 30+ consumidores/múltiplos painéis | 11 | Estrutura sem dados demonstrativos; testar cenário real somente com funcionalidades implementadas |
| IND-26 | Média | Validação estrutural não é validação elétrica | 3 a 8 nas etapas correspondentes | Tipos, IDs e referências testados; completude, conflitos elétricos, ciclos, combinações e critérios serão acrescentados no serviço pertinente |

## Residencial e assuntos fora da autorização atual

| ID | Prioridade | Achado | Etapa prevista / autorização | Situação |
|---|---|---|---|---|
| RES-01 | Alta | Seção mínima de força simplificada — SENAI | Fora da implementação industrial; correção residencial exige autorização específica | Não alterado |
| RES-02 | Alta | Limite terminal livre até 20% e ausência de queda a montante — SENAI | Fora da autorização atual | Não alterado |
| RES-03 | Alta | Diferença de queda pelo modelo genérico versus catálogo — SENAI | Fora da autorização atual | Não alterado; não tratado como validação de fabricante |
| RES-04 | Alta | Agrupamento, neutro/PE, solo, harmônicas e alumínio incompletos — SENAI | Fora da autorização atual | Não alterado; requisitos industriais correspondentes registrados acima |
| RES-05 | Alta | Nem todos os chamadores observam falha de persistência — Etapa 0 | Correção residencial exige autorização; prevenir no industrial na Etapa 2 | Não alterado |
| RES-06 | Média | Importação JSON usa confirmação nativa | Fora da autorização atual | Não alterado |
| RES-07 | Média | Cache residencial não inclui versão de regras/motor | Fora da autorização atual; contrato industrial já inclui versões | Não alterado no residencial |
| RES-08 | Baixa | README desatualizado sobre distribuição automática de fases | Fora da autorização atual | Não alterado |
| EXT-01 | Média | Luminotécnica completa (lux, fluxo, Fu/Fm, UGR) — SENAI | Fora do roteiro industrial 0–11; requer novo escopo explícito | Não implementado, sem etapa nova criada |

## Itens estruturais encerrados na Etapa 1

| Item | Evidência |
|---|---|
| Entrada industrial separada e navegação na ordem correta | `/industrial/` e testes de rotas |
| Contrato único e versionado de modelos | JSON compartilhado, validadores Python/JS e casos comuns de teste |
| Interface abstrata de armazenamento | `ProjectRepository`, sem adaptador nem gravação |
| Separação de condutores e proteção | Portas independentes no JS e Python |
| Ausência de falsa conformidade | Regras vazias, controles futuros desabilitados, testes de recusa de resultados indevidos |
| Invalidação e rejeição de resposta antiga | Store com revisão e versões, testes de alteração/atomicidade |
| Regressão e verificação visual inicial | Resultados em [ETAPA_01.md](ETAPA_01.md) |

Nenhuma pendência de etapa posterior foi encerrada apenas por existir um campo, contrato ou placeholder.


## Atualização da Etapa 2

- Persistência e gerenciamento de projetos foram implementados; não houve autorização nem implementação da Etapa 3.
- Contrato v2 acrescenta revisão de gravação, status organizacional e etapa atual. O contrato v1 da estrutura permanece preservado; não existia adaptador de persistência industrial na Etapa 1.
- Formatos desconhecidos ou catálogo inválido bloqueiam a gravação sem apagar o conteúdo original. Recuperação automática de catálogo corrompido e exportação/importação de backup não foram antecipadas; acompanham IND-23/Etapa 10.
- O catálogo pertence ao navegador e à origem utilizada. Mudança de porta/perfil não transfere os dados. Sincronização e banco multiusuário não fazem parte da Etapa 2.
- Status “Em edição”, “Ativo” e “Arquivado” são administrativos. Não há status de conformidade ou conclusão normativa.
- O comportamento de busca durante digitação e o excesso de largura das ações da tabela em mobile foram corrigidos dentro desta etapa e retestados.
- Todas as ressalvas SENAI e residenciais acima permanecem abertas; nenhum motor residencial foi modificado.
- Regressão final e evidências: [ETAPA_02.md](ETAPA_02.md).


## Atualização da Etapa 3 — 25/10/2026

- IND-03 encerrado no escopo de cadastro; IND-07 atendido quanto à distinção/explicação das distâncias, sem antecipar topologia.
- Contrato v3 e migração aditiva do catálogo v2 implementados e testados. Formatos incompatíveis e falhas de gravação preservam o conteúdo original.
- CRUD e filtros não substituem verificação normativa. As pendências SENAI, regras 2004, correntes, condutores, proteção e infraestrutura permanecem nas etapas originais.
- Correntes de placa e catálogo podem ser registradas separadamente. Seleção da fonte, conversões, corrente de projeto e catálogo WEG permanecem em IND-04/IND-05, Etapa 4.
- A tag de trecho é planejamento textual; não cria nós ou segmentos. Exclusão/conversão de itens referenciados é recusada até remoção explícita dos vínculos.
- Persistência continua local ao navegador/origem. Backup/importação/exportação e recuperação avançada permanecem na Etapa 10.
- Relatório, testes e evidências: [ETAPA_03.md](ETAPA_03.md). A Etapa 4 não foi iniciada.

## Atualização da Etapa 4 — 25/10/2026

- IND-04 e IND-05 atendidos no escopo descrito em DA-21 a DA-25 e [ETAPA_04.md](ETAPA_04.md). A fonte da tabela passou a ser a fotografia documental enviada pelo usuário, não os valores demonstrativos dos mockups.
- Corrente de partida e medida são entradas separadas; partida, queda transitória, proteção e coordenação não são verificadas (IND-21 permanece aberto).
- A base 2004 de condutores e as demais verificações de IND-08 a IND-20 continuam nas etapas originais. Não houve uso da base residencial 1997 nem declaração de conformidade geral.
- Migração v4 preserva dados antigos e deixa novas confirmações desconhecidas. Resultados persistidos dependem de revisão e versões válidas.
- Um erro de vinculação de `fetch` ao navegador foi identificado no teste de UI e corrigido. O aviso offline foi verificado desligando o servidor de QA e preservando os dados salvos.
- Confirmação de condições nominais é limpa ao editar entradas elétricas ou fonte no formulário; deve ser refeita após a alteração.

| ID | Prioridade | Limitação / acompanhamento | Etapa prevista | Situação |
|---|---|---|---|---|
| IND-27 | Alta | Fonte WEG histórica reproduzida por terceiro; dados de equipamento real precisam ser conferidos | Revisão de fontes na 11; integração de novos fabricantes somente com autorização específica | Fotografia/edição rastreadas. Não afirmar atualidade ou equivalência a motores de outras linhas |
| IND-28 | Alta | Corrente de grupos/alimentadores e dupla contagem de painel/acionamento | 5 (relações) e 6 (dimensionamento), conforme roteiro | Correntes por equipamento apenas; soma de instalação bloqueada quando a topologia é necessária |
| IND-29 | Média | Desequilíbrio trifásico e motores fora de 6.5.1.1 | Acompanhar 6/11; ampliações não previstas dependem de autorização | Não calculados pelo modelo equilibrado; não declarar limite de Ib normativo fora do escopo |

Etapa 5 não iniciada. Ressalvas residenciais/SENAI fora do escopo permanecem inalteradas.

## Atualização da Etapa 5 — 26/10/2026

- IND-06/IND-07 atendidos no escopo do roteiro. Modelo lógico, edição compacta, trechos compartilhados, derivações, formações e validações implementados. Relatório: [ETAPA_05.md](ETAPA_05.md).
- IND-28 atendido quanto às relações quadro/circuito/carga e aos percursos físicos. Correntes de grupos e alimentadores e somas elétricas dependentes dessas relações continuam pendentes para a etapa correspondente.
- O método de instalação e as condições por trecho são entradas declaradas. Nenhum B1 é inferido para eletrocalha/leito. Dimensionamento, fatores normativos, proteção, ocupação e queda não foram antecipados.
- Contrato v5 migra projetos anteriores sem gerar pontos/circuitos automaticamente nem alterar suas entradas. O residencial e suas ressalvas de auditoria permanecem intactos.
- O teste de interface identificou corte do texto dos seletores no modal em tela pequena; a altura dos controles da nova estrutura foi corrigida e verificada novamente.

| ID | Prioridade | Limitação / acompanhamento | Etapa prevista | Situação |
|---|---|---|---|---|
| IND-30 | Alta | Redes em anel, dupla alimentação e vários circuitos de funções diferentes para o mesmo consumidor | Avaliação na 11; expansão depende de autorização | Modelo atual exige percurso único por destino e recusa ciclos/múltiplas alimentações, sem simular manobras |
| IND-31 | Alta | Contagem declarada não verifica funções carregadas, paralelismo, PE/PEN, seção, material ou isolação | 6; proteção em serviço separado conforme roteiro | Funções e quantidades físicas disponíveis; verificação normativa pendente |
| IND-32 | Média | Distância e trecho planejado do cadastro antigo podem divergir da rede física | 5 (entrada explícita), acompanhar 11 | Não inferir conexões. O usuário declara origem e base de distância; analisar inconsistências de planejamento sem apagar entradas |
| IND-33 | Média | Ocupação por trecho, diâmetros externos e dimensões de infraestrutura | 7 | Tipo de infraestrutura cadastrado; ocupação Não calculada |

Etapa 5 concluída no escopo documentado. Etapa 6 não iniciada.
