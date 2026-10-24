# VoltCalc Industrial — decisões arquiteturais

Registro iniciado em 24/10/2026, durante a Etapa 1. Este documento acompanha o roteiro original das Etapas 0 a 11; não altera sua ordem, não substitui entregas e não autoriza antecipações.

## DA-01 — árvore ativa e isolamento do residencial

**Decidido na Etapa 1.** Trabalhar exclusivamente em `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`. Manter `/`, os contratos HTTP residenciais, arquivos da interface, regras, tabelas e chaves de armazenamento existentes. A integração nesta etapa altera apenas a lista de recursos públicos em `voltcalc/web/assets.py`.

O módulo industrial possui HTML, CSS, JavaScript e pacote Python próprios. Não importa `window.VoltModel`, estado residencial, `calculations.sizing` ou `nbr1997.json`. O favicon existente é reutilizado como recurso visual. Não é criada uma cópia do motor residencial com rótulo normativo diferente.

## DA-02 — entrada e navegação

**Decidido e implementado na Etapa 1.** Entrada `/industrial/`, com redirecionamento de `/industrial`. Rotas internas por fragmento (`#/projetos`, etc.) evitam dependência de framework e permitem recarregar uma página interna sem criar rotas de negócio prematuras.

Ordem principal: Projetos, Consumidores e cargas, Dimensionamento, Infraestrutura, Queda de tensão, Visão geral. Relatórios e Configurações são auxiliares. O mapa completo terá lugar exclusivamente em Visão geral na Etapa 9; nesta etapa existe apenas sua área vazia identificada. O residencial mantém suas três seções.

A página de consumidores ocupa a área principal completa, sem assistente lateral. O shell usa a composição das imagens fornecidas: lateral escura, seleção azul, cabeçalho compacto, indicadores e tabelas claras. A ausência de projetos é representada por estados vazios, não por projetos ou resultados demonstrativos.

## DA-03 — contrato compartilhado e versionado

**Decidido e implementado na Etapa 1.** `data/industrial/contracts.v1.json` é o contrato declarativo compartilhado por Python e JavaScript. É um formato interno identificado por `format` e `version`, não uma implementação de JSON Schema.

Modelos principais: Project, Consumer, Motor, Panel, Circuit, Segment, Conductor, Infrastructure e CalculationResult. Objetos de apoio: Supply, Source, Node, Criterion e Measurement. IDs identificam entidades; referências explícitas conectam as coleções. Consumidor, circuito, trecho físico e painel permanecem conceitos separados.

As fábricas retornam objetos independentes. A validação inicial rejeita campos desconhecidos, tipos incorretos, valores não finitos, limites estruturais, versões incompatíveis, IDs repetidos e referências inexistentes. Campos elétricos desconhecidos usam `null`; não recebem defaults elétricos fictícios. Um rascunho estruturalmente válido **não está necessariamente pronto para calcular**. Validações de completude, consistência elétrica, grafos e regras aplicáveis serão acrescentadas nas etapas previstas.

Limites numéricos do contrato são limites de entrada, não critérios normativos. O limite defensivo de 1.000 itens por coleção tampouco declara capacidade operacional testada; desempenho e capacidade serão verificados na Etapa 11. Nenhum limite ilustrativo de 150 consumidores das imagens foi adotado como regra de produto.

## DA-04 — persistência por interface abstrata

**Interface decidida na Etapa 1; tecnologia reservada à Etapa 2.** `ProjectRepository` define métodos assíncronos `list(query)`, `load(id)`, `save(project, expectedRevision)`, `duplicate(id, expectedRevision)` e `delete(id, expectedRevision)`.

Não há adaptador em memória simulando salvamento, acesso a localStorage, banco SQL, gravação em arquivo ou CRUD nesta etapa. Todos os métodos rejeitam explicitamente com `REPOSITORY_NOT_IMPLEMENTED`. A indicação de sucesso futuro deve depender de confirmação de gravação, incluindo quota, falha de I/O e conflitos.

A sugestão de armazenamento feita na Etapa 0 não foi transformada em implementação. A tecnologia será definida na Etapa 2, de acordo com a orientação posterior do usuário. A interface não deve depender dessa escolha. Quaisquer migrações industriais terão versão própria; não se alteram as chaves residenciais.

## DA-05 — estado temporário, revisões e invalidação

**Decidido e preparado na Etapa 1.** O store industrial inicia sem projeto selecionado. Fábricas e métodos de estado são contratos testáveis; não constituem um cadastro de projetos disponível na UI.

Atualizações trabalham sobre cópias, validam antes de aceitar e incrementam a revisão. Enquanto a malha de dependências não estiver implementada, toda alteração invalida conservadoramente todos os resultados do projeto, esvaziando medições e critérios anteriores. Dados inválidos não substituem o estado válido anterior.

Cada solicitação futura terá token com projeto, revisão, domínio, versão do serviço e versão das regras. Respostas antigas ou incompatíveis são recusadas. Resultados restaurados sem validade para as versões/revisões atuais tornam-se invalidados. A invalidação seletiva poderá ser implementada quando os serviços/topologia correspondentes existirem, preservando esse contrato.

## DA-06 — condutores e proteção são serviços distintos

**Contratos decididos na Etapa 1; cálculos não implementados.** Há portas separadas `ConductorService.calculate(request, project)` e `ProtectionService.verify(request, project)` em JavaScript e Protocols equivalentes em Python. Não há chamada automática da seleção residencial de cabo/disjuntor.

A futura seção do condutor não será interpretada como proteção aprovada. Domínios de resultado previstos: grandezas, topologia, condutores, proteção, infraestrutura e queda. A Etapa 6 implementará seu escopo de condutores; proteção e partida permanecerão explicitamente pendentes conforme o roteiro enquanto não houver implementação autorizada.

## DA-07 — registro normativo sem regras inventadas

**Decidido e implementado na Etapa 1.** O registro industrial contém:

- identificação: `nbr-5410-2004`;
- versão do registro: `2004-unimplemented-v1`;
- estado: `not_implemented`;
- tabelas: lista vazia.

Isso identifica o escopo previsto, não afirma vigência atual, implantação da edição ou atendimento normativo. A versão inicial do contrato/serviço é `industrial-contracts-1`. Ao implementar regras, suas fontes, notas, abrangência e versões deverão ser registradas e testadas nas etapas correspondentes.

Enquanto as regras estiverem não implementadas, o store recusa resultados calculados, critérios aprovados/reprovados/não aplicáveis e medições numéricas apresentados como resultados. Dados ilustrativos de imagens não constituem fonte técnica. A base residencial de 1997 não é importada pelo módulo industrial.

## DA-08 — resultado e fonte são dados explícitos

**Modelo preparado na Etapa 1.** CalculationResult guarda domínio, alvo, revisão de entrada, versões, estado, medições, critérios e motivo. Source guarda tipo de origem, fabricante, modelo, edição e referência. Campos de motor separam corrente de placa, medida e partida; não há prioridade de seleção ou fórmula implementada antes da Etapa 4.

Distâncias física e acumulada são conceitos distintos no contrato. O grafo usa nós e trechos, mas não há editor ou algoritmo de topologia antes da Etapa 5. A conexão 3F não escolhe automaticamente esquema de aterramento.

## DA-09 — componentes e acessibilidade

**Implementado na Etapa 1.** Componentes de ícone, cartão, painel, tabela, campo, ação, aviso, estado vazio e badge ficam em `frontend/industrial/js/components.js`. Textos variáveis são escapados. As tabelas têm cabeçalhos/caption e rolagem local, com foco visível. O menu indica página atual, oferece versão móvel e fecha ao navegar. A ajuda usa dialog nativo estilizado, com Escape e retorno de foco. O atalho para conteúdo não modifica a rota.

Controles de etapas futuras permanecem desabilitados com indicação da etapa correspondente. “Referência prevista” leva à explicação em Configurações, sem dropdown decorativo. Não há indicador “Conforme”.

## DA-10 — servidor e acesso

**Implementado na Etapa 1.** O servidor Python existente serve apenas os novos arquivos explicitamente permitidos e o contrato compartilhado. Não foram criados endpoints industriais de cálculo ou persistência. Documentos e código Python continuam privados ao servidor estático. Não houve nova dependência de execução ou etapa de build.

## DA-11 — acompanhamento das ressalvas

**Decidido na Etapa 1.** As auditorias SENAI e Etapa 0 alimentam `PENDENCIAS.md`. Correções residenciais exigem autorização específica. Os itens que cabem no industrial ficam vinculados à etapa original pertinente; assuntos fora do roteiro não são transformados em novas etapas nem incorporados à Etapa 11 como autorização de implementação.

## DA-12 — validação e parada

**Aplicado na Etapa 1.** Regressão residencial permanece obrigatória, acompanhada de testes industriais de contrato, rotas, isolamento, estados e invalidação. Evidências visuais são guardadas com o relatório da etapa. Ao entregar a Etapa 1, interromper e aguardar confirmação expressa para a Etapa 2.
