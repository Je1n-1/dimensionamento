# VoltCalc Industrial — acompanhamento de pendências

Atualização: 24/10/2026, Etapa 1. Fontes: [auditoria SENAI](../analysis/REVISAO_SENAI.md), [Etapa 0](ETAPA_00.md) e roteiro original do usuário.

Este registro não autoriza alterações imediatas, não reorganiza as Etapas 0 a 11 e não significa que funcionalidades futuras foram implementadas. Prioridades representam risco e dependência; a execução permanece condicionada à autorização da etapa correspondente. Os achados residenciais permanecem sem correção nesta entrega.

## Industrial — funcionalidades previstas e ressalvas técnicas

| ID | Prioridade | Problema ou necessidade | Etapa original prevista | Situação / critério de fechamento |
|---|---|---|---|---|
| IND-01 | Alta | Ausência de persistência industrial | 2 | Interface abstrata pronta; escolher tecnologia, implementar gravação real, falhas, conflitos e recuperação |
| IND-02 | Alta | Múltiplos projetos, duplicação e exclusão | 2 | UI vazia; testar isolamento, criar/salvar/fechar/reabrir e confirmação antes de excluir |
| IND-03 | Alta | Cadastro industrial e completude dos dados | 3 | Modelos e validação estrutural prontos; formulário, edição, filtros e validação contextual pendentes |
| IND-04 | Alta | Potência mecânica/elétrica/aparente e corrente dos motores | 4 | Campos distintos preparados; conversão e prioridade placa/catálogo/fórmula ainda ausentes |
| IND-05 | Alta | Catálogo WEG/fabricante não identificado | 4 | Fonte rastreável depende do documento/catalogação real; não preencher com dados das imagens |
| IND-06 | Alta | Topologia e trechos compartilhados | 5 | Contratos de nós/trechos definidos; editor compacto, conexões, validação do grafo e cabos por trecho pendentes |
| IND-07 | Alta | Confusão entre distância acumulada e comprimento físico | 3 e 5 | Campos separados; explicar no cadastro e validar os percursos físicos ao implementar topologia |
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
