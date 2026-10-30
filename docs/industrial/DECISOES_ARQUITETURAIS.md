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


## DA-13 — adaptador de persistência escolhido na Etapa 2

**Decidido e implementado na Etapa 2.** Foi mantida a tecnologia já identificada na aplicação: armazenamento local do navegador. A implementação concreta `LocalProjectRepository` utiliza exclusivamente a chave `voltcalc_industrial_projects_v1`, sem ler ou modificar as chaves residenciais. Não foi criado banco SQL ou arquivo de projetos no servidor.

O envelope contém formato/versão, projetos completos e seleção atual. Cada gravação troca um único valor localStorage; Web Locks (`voltcalc-industrial-projects-v1`) serializa as mutações entre abas cooperantes. A revisão esperada é conferida dentro desse bloqueio, depois de reler o catálogo. A confirmação de sucesso exige `setItem` concluído e conferência da leitura.

Sem Web Locks, as mutações são recusadas com mensagem explícita; não existe fallback concorrente inseguro. Erros de leitura, quota, gravação não confirmada, versão desconhecida e corrupção são distintos. Catálogo inválido não é convertido silenciosamente em catálogo vazio. A interface mantém a edição aberta se a gravação falhar.

A separação por namespace e IDs é lógica, não autenticação multiusuário. Os dados permanecem no perfil/origem do navegador; o servidor Python continua servindo a interface e contratos. Exportação/importação, recuperação avançada e relatórios continuam na Etapa 10. O limite defensivo inicial do catálogo é 500 projetos, sujeito à quota do navegador; não representa capacidade de desempenho já homologada.

## DA-14 — revisão de entradas versus revisão de gravação

**Decidido e implementado na Etapa 2.** O contrato ativo passou para `contracts.v2.json`/`schemaVersion: 2`, acrescentando `storageRevision`, `workflowStatus` e `currentStage`. O arquivo v1 permanece como registro da estrutura anterior. Como a Etapa 1 não implementava armazenamento industrial, não há migração silenciosa de projetos persistidos v1. Dados de formato desconhecido são preservados e recusados, não normalizados com perda de campos.

`revision` continua representando a revisão das entradas elétricas; `storageRevision` incrementa a cada gravação e protege contra conflitos. Alterar nome, descrição ou status administrativo não invalida resultados elétricos. A futura edição de cargas/condições continuará usando a invalidação do store. `getCurrentId`/`setCurrentId` completam a porta abstrata para restaurar a seleção após reabrir o site.

Abrir e fechar apenas alteram a seleção atual, sem mudar a data de edição do projeto. `createdAt` permanece na edição, `updatedAt` registra salvamentos. Outras abas atualizam o catálogo sem tomar o lugar do projeto aberto localmente. Um formulário aberto mantém seu rascunho e sua revisão original, de modo que conflitos não sobrescrevam o trabalho recente.

## DA-15 — duplicação, exclusão e situação do projeto

**Implementado na Etapa 2.** A duplicação cria novos IDs para o projeto e suas entidades, remapeia referências e preserva textos de origem/catálogo. Não há objetos compartilhados entre original e cópia. Resultados da cópia são invalidados; a cópia começa “Em edição”.

A exclusão exige modal com nome do projeto, cancelamento inicial e revisão esperada. Exclusão ou edição ocorrida em outra aba impede confirmação sobre revisão antiga. A remoção do projeto aberto limpa somente sua seleção, sem afetar os demais.

Os status disponíveis são “Em edição”, “Ativo” e “Arquivado”: organização do trabalho, sem declaração normativa. A etapa atual inicia em 2; navegar em uma página futura não conclui essa etapa. Contadores de consumidores, painéis e trechos vêm do conteúdo armazenado; potência e resultados elétricos continuam não calculados até as etapas previstas.

## DA-16 — limites desta entrega

**Aplicado na Etapa 2.** Importar projeto permanece desabilitado para a Etapa 10; não foi convertido em requisito de antecipação a partir do botão da imagem. Cargas, cálculos e topologia não receberam formulários ou algoritmos. Os testes de recuperação de objetos completos utilizam dados controlados em suíte de teste; a interface não recebe dados demonstrativos automáticos.

A Etapa 2 termina com seu relatório e nova parada para autorização expressa da Etapa 3. As decisões DA-01 a DA-12 registram o estado histórico da Etapa 1; DA-13 a DA-16 documentam a evolução autorizada.


## DA-17 — cadastro industrial e contrato v3

**Implementado na Etapa 3, concluída em 25/10/2026.** O contrato ativo é `contracts.v3.json`. Foram acrescentados ao consumidor material/tipo de cabo, isolação e descrição de outra isolação, além de uma identificação textual do trecho planejado. Motor possui corrente de catálogo independente da corrente de placa. Os contratos v1 e v2 permanecem preservados.

A atualização v2 → v3 é aditiva e validada contra o contrato v2 original antes de completar novos campos com vazio/null. Mantém IDs, revisões, datas e entradas anteriores. Ler o catálogo não grava a migração: a gravação ocorre na próxima transação bem-sucedida do repositório, mantendo o envelope atômico da Etapa 2. Erros de leitura, versão ou quota não substituem dados por defaults. Abas com código antigo devem ser recarregadas para usar a versão atual; o validador antigo recusa o formato novo, evitando sobrescrita silenciosa.

## DA-18 — consumidor, especializações e vínculos

**Implementado na Etapa 3.** Cada registro pertence ao projeto aberto. Tipo e tag são obrigatórios; tags são únicas no projeto sem distinção de caixa. Dados desconhecidos podem ficar vazios e aparecem como pendências de preenchimento. A tabela informa quais campos faltam; cadastro preenchido não significa cálculo nem conformidade.

Motor mantém sua especialização vinculada ao consumidor. Um consumidor painel cria/atualiza a entidade Panel correspondente, disponível como origem de outras cargas. Cada painel tem quantidade 1 para conservar identidade inequívoca. Quantidades maiores são aceitas para grupos de equipamentos com características iguais. Mudar o tipo remove a especialização anterior, com aviso no formulário; vínculos externos impedem exclusão ou conversão que os deixaria inválidos. Não existe exclusão em cascata de circuitos/trechos. O cadastro também impede autorreferência/ciclo na origem de painéis; isso não implementa o serviço de topologia da Etapa 5.

As alterações usam uma cópia validada do projeto e a revisão capturada ao abrir o formulário. A revisão elétrica aumenta, resultados são invalidados e o repositório confirma a gravação antes de publicar o novo estado. Uma falha ou conflito mantém o formulário e os valores digitados. Ao excluir um item, resultados destinados ao item removido são descartados, e os demais são invalidados.

## DA-19 — entradas elétricas e limites do cadastro

**Implementado na Etapa 3.** Potência é por equipamento; unidades W/kW, VA/kVA e cv/hp são registradas com base elétrica ativa, aparente ou mecânica compatível. Não há conversão, soma de unidades distintas nem cálculo de corrente nesta etapa. Fator de potência e rendimento usam fração de 0 a 1, indicada no campo. Placa e catálogo permanecem entradas separadas; catálogo exige fabricante e referência informados, sem integrar ou validar catálogo externo. A seleção da fonte pertence à Etapa 4.

Ligação e fases são explícitas e verificadas quanto à consistência do cadastro. Três fases sem neutro permitem L1 + L2 + L3 + PE. PE é uma escolha visível, e nenhuma ligação infere TT/TN/IT. Cadastrar alumínio ou um método não significa aprovação normativa de seu uso. O método de instalação é informado textualmente; sua classificação/aplicabilidade será validada na etapa de condutores.

Distância exige indicação de base quando preenchida: acumulada desde o quadro ou comprimento físico de um segmento. Uma tag planejada não cria um trecho; vínculo a trecho existente só usa entidades já presentes. Não há soma de comprimentos, criação de grafo ou dimensionamento automático. Essas atividades permanecem na Etapa 5 e posteriores.

## DA-20 — apresentação e parada da Etapa 3

**Implementado na Etapa 3.** A página utiliza a largura principal completa, sem Assistente técnico lateral. Filtros de tipo, ambiente, trecho e busca atuam sobre os registros do projeto. Campos adicionais de motor são apresentados somente para motor; painel recebe orientação própria e as demais cargas usam os campos comuns. A edição ocorre em modal responsivo com validação contextual. Os dados continuam no adaptador local escolhido na Etapa 2, sem novo banco ou dependência.

Importação de planilha não foi antecipada a partir do botão ilustrativo: permanece indisponível, acompanhando importação/exportação da Etapa 10. Potências agregadas e correntes calculadas permanecem na Etapa 4. O roteiro de 0 a 11 não foi reorganizado. Ao concluir a Etapa 3, aguardar confirmação expressa para a Etapa 4.


## DA-21 — serviço de potências e correntes (Etapa 4)

O serviço industrial é implementado em Python, sem dependência de DOM, HTTP ou persistência. `power.py` converte unidades e bases; `catalogs.py` consulta uma referência específica; `current_rules.py` concentra o critério limitado de motor de 2004; `currents.py` coordena resultados e rastreabilidade. A rota `/api/industrial/currents` é apenas um adaptador e importa o serviço sob demanda. O motor residencial não é chamado nem alterado. As portas de condutores e proteção continuam separadas e não implementadas.

W/kW indicam potência ativa elétrica ou mecânica conforme a base declarada. VA/kVA indicam aparente; cv e hp indicam potência mecânica e são diferentes. A conversão usa 1 cv = 735,49875 W e 1 hp mecânico = 745,6998715822702 W. Potência elétrica a partir da mecânica requer rendimento; aparente a partir da elétrica requer fator de potência. Dados ausentes não recebem valor 1. Corrente trifásica pela fórmula exige confirmação de equilíbrio e tensão entre fases. FN/FF usam a tensão efetivamente aplicada à carga, sem fator √3.

A preferência automática é placa → catálogo selecionado/manual → fórmula. Uma fonte explicitamente escolhida e incompleta não é substituída silenciosamente. Corrente calculada pode ser mostrada em paralelo para comparação. In de placa/catálogo, estimativa por fórmula, mínimo de projeto, partida e medida são grandezas distintas. A fórmula não certifica a corrente de placa do equipamento.

## DA-22 — referência WEG fornecida pelo usuário

A fotografia recebida em 25/10/2026 foi preservada em `fontes/fockink-weg-w21-p47.jpg`, com SHA-256 no JSON. Trata-se de reprodução Fockink MA-ENG-AE-0003, Seção II, Rev.05 de 19/04/2021, p.47/111, que declara como fonte WEG W21 IP55, setembro de 2006. Não foi apresentada como catálogo atual nem como publicação original WEG autenticada.

Foram transcritas 35 linhas e 12 colunas de corrente (220/380/440 V × 2/4/6/8 polos). Traços são `null`. As equivalências cv/kW impressas permanecem como chaves próprias; não são substituídas por conversões exatas. Consulta por cv/kW ou W equivalentes à coluna kW, sem aproximação, interpolação, extrapolação ou conversão silenciosa de hp em cv. Anotações à caneta não entram nos valores. A seleção explícita dessa referência declara que o equipamento corresponde à linha W21 trifásica, 60 Hz, IP55.

## DA-23 — limite inferior de Ib e cobertura normativa parcial

O critério implementado está isolado e versionado como `nbr5410-2004-motors-6.5.1.3.1-v1`, com aplicação limitada pelas condições de 6.5.1.1 e 6.5.1.3.1, conferidas no PDF 2004 corrigido em 2008 fornecido pelo usuário. O usuário confirma circuito terminal exclusivo de um motor de indução de gaiola, regime S1, aplicação industrial normal, fora das exclusões da seção. A potência mecânica deve ser conhecida e não exceder 150 kW; quantidade deve ser 1.

Ib mínimo usa In nas condições efetivas. Quando a operação pretende explorar FS > 1 declarado pelo fabricante, usa In × FS; caso contrário, In. FS desconhecido ou inadequado não gera redução arbitrária. In deve vir de placa/catálogo, com tensão, frequência, ligação e confirmação das condições de maior potência/velocidade utilizadas. Alterações desses dados no formulário limpam a confirmação para nova conferência. Estimativa por fórmula continua disponível, mas não recebe o mesmo caráter de In certificado para esse limite normativo.

Isso é cálculo de um limite inferior, não aprovação de condutor ou proteção. O registro geral de regras/tabelas continua não implementado; a capacidade de correntes e sua versão parcial são identificadas separadamente. Os critérios globais continuam pendentes. Não há indicador Conforme na entrega.

## DA-24 — contrato v4, resultados e isolamento

Contrato v4 acrescenta equilíbrio declarado, preferência de fonte, identificação da tabela, confirmações de condições/escopo/uso de FS e rastreabilidade textual/fonte por resultado. Contratos v1/v2/v3 permanecem disponíveis e inalterados. Migração v2/v3 → v4 é aditiva, valida o contrato de origem e conserva entradas, IDs, datas e revisões. Confirmações novas começam desconhecidas, nunca aprovadas automaticamente. Ler não grava a migração; gravação posterior usa as mesmas transações e proteção contra conflito/quota.

Cada requisição/resposta tem projeto, revisão elétrica, domínio, versão do motor e versão da regra de correntes. Resultados só entram no estado após validação de todos os consumidores, fonte/rastreabilidade e confirmação da gravação. Respostas antigas, alvos estranhos, resultados parciais de lote ou veredictos de outros domínios são recusados. Alterar entradas invalida valores anteriores; duplicação também invalida. O repositório continua local ao navegador/origem, sem novo banco.

## DA-25 — quantidades, somas e apresentação

Potências do registro incluem a quantidade uma única vez. Correntes são por equipamento: não se cria implicitamente um circuito compartilhado nem se somam correntes de fases diferentes. A soma de potência ativa das cargas é exibida apenas para registros de usos finais conhecidos (motor, iluminação, aquecimento), com contagem de registros convertidos e aviso de soma parcial. Se houver painel, transformador, acionamento ou outro tipo, o total da instalação aguarda topologia para evitar dupla contagem. Potências individuais continuam disponíveis.

Resultados ficam em Consumidores e cargas, com detalhes expansíveis, fórmulas, fonte e motivo de cada pendência. A navegação original do roteiro industrial não foi reorganizada. Nenhuma funcionalidade de Etapa 5 ou posterior foi implementada. Ao concluir a Etapa 4, aguardar autorização expressa para a Etapa 5.

## DA-26 — rede física e circuitos declarados (Etapa 5)

O serviço Python `topology.py` representa pontos e trechos dirigidos sem ciclos. Um circuito declara origem, destinos e os segmentos de seu percurso. Circuitos distintos podem compartilhar os mesmos trechos. Cada destino precisa ter um caminho único no conjunto de trechos selecionados; trechos desconectados, ciclos, múltiplas alimentações e caminhos ambíguos recebem diagnósticos. Não há enumeração recursiva de todos os caminhos: ordenação topológica e contagem limitada identificam ambiguidades.

`Circuit.segmentIds` é a associação canônica. `Segment.circuitIds` é uma lista derivada, sincronizada ao salvar a estrutura. `Circuit.originNodeId` identifica origem externa ou ponto de quadro; `originPanelId` é sincronizado quando a origem é um quadro. `destinationPanelIds` permite alimentadores. O quadro principal pode ser uma origem declarada sem inventar a rede a montante. Um ponto de consumidor é a localização física de sua derivação; passagem de outros circuitos por esse ponto não significa alimentação elétrica através do equipamento.

Quadros independentes são cadastrados na estrutura. Quadros que pertencem a consumidores painel continuam sendo editados/excluídos no cadastro de consumidores, preservando o vínculo existente. A ação explícita Criar pontos das cargas e quadros gera somente pontos ausentes, sem duplicar os existentes nem inferir circuitos. Dados anteriores de distância/tag de trecho e quadro planejado são preservados; divergências de quadro são apontadas, não corrigidas silenciosamente.

## DA-27 — distâncias e formações físicas

Todo `Segment.length` é comprimento físico em metros. No assistente de caminho, o usuário escolhe comprimentos sucessivos ou distâncias acumuladas desde a origem selecionada. Acumuladas 28/35/51 m resultam em 28/7/16 m. Valores decrescentes, não finitos e negativos são recusados; zero explícito é permitido pelo contrato. A distância antiga de um consumidor não é convertida automaticamente porque a base física precisa ser declarada.

`Cable` representa uma formação repetível, vinculada a um circuito. Os registros `Conductor` representam funções L1/L2/L3/N/PE/PEN dentro dessa formação; `quantity` repete a formação em paralelo. Em unipolares, quantidade física de cabos = funções × quantidade; em multipolares = quantidade; condutores isolados são contados separadamente. As contagens de funções incluem todos os condutores declarados, sem assumir quais são carregados. Quantidade de equipamentos não multiplica silenciosamente os cabos. É possível seguir todo o circuito ou selecionar parte de seus trechos, permitindo formações diferentes após derivações.

Se faltarem percurso, formação ou funções, a contagem correspondente fica pendente. Erros estruturais impedem apresentar contagens como verificadas. Os números descrevem entradas físicas; não representam capacidade de condução, fator de agrupamento ou aprovação do uso de PEN, PE, paralelismo ou material. Método, temperatura, disposição, ambiente e condições de solo são entradas por trecho. Tipo de infraestrutura é cadastrado sem calcular ocupação.

## DA-28 — contrato v5 e transações

O contrato v5 acrescenta origem externa, tipo/ambiente do trecho, origem/destinos do circuito, formações e o vínculo dos condutores. Migração v2/v3/v4 é aditiva e recursiva, valida o contrato de origem e conserva IDs, entradas e revisões. Não cria topologia nem confirma referências por inferência. Contratos anteriores permanecem disponíveis. A versão do motor de correntes não mudou: abrir um projeto antigo não invalida correntes válidas apenas pela adição do novo esquema.

A porta `/api/industrial/topology` usa projeto, revisão, domínio e versões na requisição. Operações atuam em cópia e validam contrato e estrutura antes de retornar. Novos erros estruturais são recusados; rascunhos incompletos podem ser salvos com pendências, e dados antigos com problemas podem ser reparados progressivamente. Exclusões respeitam referências; excluir uma formação remove apenas seus condutores próprios sem vínculos externos. Toda alteração incrementa a revisão elétrica e invalida resultados anteriores, preservando a rastreabilidade textual.

O navegador confirma a persistência com revisão otimista antes de publicar o estado. Falhas e conflitos conservam o formulário. A análise estrutural é transitória e depende da revisão atual; não é armazenada como resultado normativo. O repositório e sua chave industrial permanecem os mesmos da Etapa 2.

## DA-29 — interface, versões e limite da etapa

Cadastro compacto em uma subseção contextual Caminhos e circuitos de Consumidores e cargas, sem nova entrada lateral nem mapa completo. Formulários e tabelas usam os componentes e o visual industrial existentes. O resultado é Estrutura válida ou Pendências, jamais Conforme. A versão `industrial-topology-1` identifica lógica de rede, não uma edição normativa. As regras 2004 continuam isoladas da base residencial.

Etapa 5 não calcula seção, proteção, ocupação, queda, corrente de alimentadores ou balanço de fases. Não antecipa o mapa da Etapa 9 nem os relatórios/exportações da 10. A Etapa 6 depende de autorização posterior.

## DA-30 — regras de condutores 2004 independentes (Etapa 6)

`conductor_rules.py` e `conductors-2004.v1.json` compõem a versão parcial `nbr5410-2004-conductors-1`. Não importam tabelas residenciais. A fonte fornecida, páginas, hash, ordem de colunas e exclusões ficam identificadas. Três células suspeitas de alumínio 630 mm² na tabela 38 não são utilizadas nem corrigidas silenciosamente. O registro geral de conformidade continua sem cobertura integral.

O serviço aplica somente condições implementadas: capacidades A1–G, correções térmicas e de agrupamento, carregamento do neutro, mínimos de seção e PE simplificado. Confirmações não são inferidas de nomes de infraestrutura. Situações sem modelo ficam pendentes. Temperatura da isolação é limite de serviço, nunca temperatura operacional estimada.

## DA-31 — dimensionamento por formação e trecho

`Cable` é a unidade da seleção de seção; `Circuit` fornece a carga e `Segment` fornece as condições térmicas. A contagem de agrupamento deriva dos circuitos/formações presentes no trecho. O menor Iz corrigido ao longo da formação governa a comparação com Ib. A seção sugerida não altera os condutores adotados.

Ib automático reutiliza o serviço isolado de correntes apenas para carga terminal compatível ou motor único com condições nominais válidas. Grupos/alimentadores recebem Ib externo com origem e confirmação explícitas, sem declaração de que o estudo de cargas foi verificado. Não há demanda arbitrária, soma cega de quadros ou divisão automática entre paralelos. A corrente integral do circuito é usada em todos os trechos da formação.

Agrupamento das tabelas 42–45 exige a mesma temperatura máxima de serviço, carregamento semelhante declarado e faixa de três seções sucessivas conferida contra as seções adotadas dos outros circuitos. A opção conservadora F=1/√n é explícita, limitada às disposições implementadas ao ar. Não se misturam tabelas 42 e 43 nem se extrapolam condições enterradas. Temperatura intermediária usa classe superior e fica registrada na memória.

## DA-32 — contrato v6 e persistência das condições

Contrato v6 adiciona `Cable.design` e `Segment.thermal`, com confirmações inicialmente desconhecidas. Migração v2–v5 conserva IDs, valores e revisões, sem gravação automática. Material, isolação e seção continuam nos registros `Conductor`; o formulário aplica explicitamente material/isolação à formação e seção adotada somente às fases/neutro.

`/api/industrial/conductors` recebe identidade, revisão e versões, opera sobre cópia e valida o contrato. Alterações de condições incrementam a revisão e invalidam grandezas anteriores. O navegador grava com revisão otimista antes de publicar o projeto. Respostas de outro projeto/revisão ou com formações incompatíveis são recusadas.

A memória detalhada é análise transitória vinculada à revisão; não é inserida como resultado de conformidade no repositório. Condições são persistidas e o usuário recalcula ao reabrir. Um futuro relatório deve recalcular ou validar explicitamente a versão e revisão antes de consolidar resultados. Essa decisão não antecipa a Etapa 10.

Alterações de estrutura limpam confirmações de método, agrupamento, escopo e Ib externo; alterações de cargas limpam confirmação de escopo e Ib externo. Valores permanecem preservados. Edição de condições pelo formulário da Etapa 6 reúne as confirmações necessárias na própria operação.

## DA-33 — apresentação e fronteira de proteção

O resultado é Pré-dimensionado ou Pendente, com cada critério calculado identificado. Neutro permanece sem redução; PE pela tabela 58 não significa verificação da função de proteção. Proteção, curto-circuito, partida, coordenação, seccionamento, ocupação e queda são pendências explícitas. `ProtectionService` continua separado e não implementado. Não há Conforme global, mesmo quando capacidade e seção mínima atendem.

Os detalhes e candidatos ficam em painel contextual da página Dimensionamento, seguindo a estrutura visual industrial existente. O roteiro 0–11 permanece inalterado; Etapa 7 depende de confirmação posterior.

## DA-34 — preparação explícita de circuitos e cadastro contextual (27/10/2026)

A revisão de usabilidade das etapas existentes conecta o cadastro ao dimensionamento sem mudar o contrato v6 nem o motor elétrico. A operação `prepare` do serviço de topologia cria, em uma única transação validada, pontos, circuitos terminais, trechos independentes, formações e funções dos condutores para as cargas selecionadas. Exige quadro existente, distância completa declarada, ligação/fases compatíveis, tipo de cabo e confirmação de percursos independentes. Não transforma uma referência de trecho em agrupamento físico presumido.

Material, isolação, temperatura e método são copiados apenas quando declarados. Seções e confirmações normativas não são preenchidas automaticamente. Cargas com circuitos, percursos ou vínculos conflitantes são recusadas sem gravação parcial. Circuitos compartilhados continuam no editor de caminhos da Etapa 5. O número de equipamentos de um registro representa cargas no mesmo ponto, não posições distribuídas.

Duplicar consumidor cria novos IDs, conserva características editáveis, desvincula o segmento físico e não copia circuitos ou resultados. A confirmação nominal do motor deve ser refeita. Unidade sugere a base da potência somente após mudança explícita no formulário; W/kW continuam editáveis como potência elétrica ou mecânica. Ligação nunca é inferida apenas pela tensão.

Novo projeto é salvo e selecionado antes de navegar para Consumidores. Quadros estruturais podem ser criados diretamente sem preencher dados de uma carga. Cargas sem circuito e circuitos sem formação aparecem como pendências no dimensionamento. Nenhuma dessas mudanças inicia a Etapa 7 ou amplia a cobertura normativa.

## DA-35 — quantidade de motores como cadastro individual em lote (27/10/2026)

Por solicitação do usuário, o formulário singular permanece para quantidade 1. Quantidade maior abre cartões com valores individuais e herança explícita dos dados comuns. O lote é validado em rascunho e persistido uma única vez, com revisão única, IDs próprios e quantidade 1 por consumidor. Não altera contrato, cálculos ou armazenamento. Divisão de registro vinculado à topologia é bloqueada; resultados e confirmações nominais não são replicados como válidos. Detalhes e testes: [CADASTRO_MULTIPLOS_MOTORES.md](CADASTRO_MULTIPLOS_MOTORES.md).

## DA-36 — envoltórias físicas e referências independentes (28/10/2026)

A Etapa 7 usa contrato v7 aditivo e serviço Python independente `infrastructure`. A envoltória do multipolar pertence a Cable; o diâmetro de cada unipolar/condutor isolado pertence a Conductor. Os diâmetros são vinculados por assinatura à construção (funções, seções, material, isolação e formação), sem IDs, para conservar validade numa duplicação fiel e pedir reconfirmação quando a construção mudar. Fontes de fabricante são declaradas pelo usuário, não autenticadas automaticamente. Nenhum diâmetro é inferido da área metálica.

Uma infraestrutura abrange todos os elementos físicos do trecho. Múltiplos condutos/repartição parcial ficam pendentes até existir um modelo de alocação específico. Eletrodutos usam os limites de 6.2.11.1.6-a; percurso contínuo é entrada separada e confirmada, sem inferência a partir do total de cabos. Calhas e leitos usam arranjo em camada única e referência explícita de projeto/fabricante, sem percentuais normativos universais.

Resultados geométricos têm versão `nbr5410-2004-infrastructure-1`, projeto e revisão. Entradas persistem pelo repositório existente; análises são transitórias. Edição física invalida resultados e confirmações térmicas do projeto de forma conservadora. Proteção continua em serviço separado. Etapas 8–11 permanecem na ordem original e não foram implementadas nesta entrega.
## DA-37 — queda por percurso completo, regras isoladas (28/10/2026)

A Etapa 8 introduz contrato v8 aditivo e serviço `voltage`, sem alterar o motor residencial nem implementar proteção. A origem normativa confirmada pertence ao projeto; a cadeia de circuitos atravessa alimentadores entre quadros até a carga. Origem desconectada, alimentação ambígua ou percurso inválido geram pendência, nunca queda a montante igual a zero presumida.

Condições elétricas pertencem ao circuito e R/X à formação. Uma carga única pode fornecer tensão, frequência, FP e equilíbrio por herança; grupos/alimentadores usam parâmetros equivalentes e Ib referenciada. A assinatura da impedância abrange construção, frequência, método, arranjo e condições térmicas. IDs e comprimentos são excluídos para permitir duplicação fiel e recálculo geométrico. Não há catálogo, estimativa de temperatura ou correção automática da resistência.

Limites de 6.2.7.1 são selecionados pela origem declarada, com 6.2.7.2 verificado separadamente no terminal. Limites adicionais não relaxam a norma. Somente regime permanente senoidal no escopo descrito em ETAPA_08 é calculado; partida e modelos especiais ficam pendentes. O estado positivo é restrito à queda e não implica Conforme global.

## DA-38 — migração e resultados de queda (28/10/2026)

Migração v2–v7 para v8 preserva entradas/IDs/revisões e adiciona campos desconhecidos, sem gravar automaticamente nem inventar impedâncias. `VoltageService` verifica identidade, revisão, versão, conjunto de consumidores e grandezas retornadas. Edições operam sobre cópia, salvam com controle otimista e invalidam resultados anteriores. A memória detalhada é transitória; consolidação continua na Etapa 10. Dados manuais do usuário permanecem preservados após cancelamento explícito da limpeza. O roteiro 0–11 não foi reorganizado; Etapa 9 aguarda continuidade autorizada.


## DA-39 — topologia gráfica independente do percurso (29/10/2026)

A Etapa 9 usa contrato v9 aditivo: `Node.position` é opcional, com coordenadas finitas; `Segment.notes` registra observações. Sem posição manual, o mapa organiza nós por profundidade do grafo. Coordenadas, zoom e deslocamento nunca determinam metros. Uma edição de posição preserva a revisão elétrica e usa a revisão de armazenamento para detectar conflitos. Edição de conexão/comprimento usa o serviço transacional de topologia, incrementa revisão e invalida confirmações/resultados. Vínculos de circuitos permanecem explícitos, sem remapeamento elétrico silencioso.

## DA-40 — visão geral como orquestração, não motor normativo (29/10/2026)

O domínio `overview`, versão `industrial-overview-1`, reúne os serviços existentes para a mesma revisão. Não muda fórmulas nem regras. Cada falha de serviço mantém resultado indisponível com motivo; potência parcial e resultados ausentes não viram zero. Cargas a jusante são deduplicadas por identidade; a parcela local de queda em alimentadores comuns é deduplicada por circuito/segmento. O status geral permanece parcial e critérios reprovados exigem revisão. `OverviewService` valida envelope, versões, identidades, conjuntos e resumo; o controlador descarta respostas obsoletas e grava via repositório existente. Análises são transitórias; posições e entradas persistem. A consolidação de recuperação e relatórios continua reservada à Etapa 10.

## DA-41 — recuperação por entradas e intercâmbio versionado (29/10/2026)

A Etapa 10 mantém o contrato de projeto v9 e o repositório local existente. O backup recebe envelope próprio `voltcalc-industrial-project`, versão 1, com versão do contrato e data de exportação. Inclui todas as entradas, configurações, revisões, fontes, relações e posições. Resultados numéricos transitórios são descartados: ao abrir Relatórios, os serviços atuais recalculam as entradas. Sem servidor disponível, as entradas continuam preservadas e a análise fica indisponível com motivo. Não se apresenta um resultado antigo como atual.

Importação é uma operação explícita de criação de cópia: valida integralmente o arquivo, suporta migrações industriais v2–v8 para v9, remapeia IDs e vínculos e reinicia as revisões da nova cópia. Não sobrescreve o projeto de origem nem outros registros. O arquivo original conserva sua revisão para rastreabilidade. Limite de intercâmbio: 4 MB. JSON residencial, PDF e CSV não são formatos de importação industrial. Conflitos, quota e corrupção conservam o comportamento transacional já existente, sem limpeza silenciosa. Não há sincronização entre navegadores ou banco de dados no servidor.

## DA-42 — relatório separado dos motores de cálculo (29/10/2026)

O serviço `industrial-report-1` orquestra a visão geral e apresenta os resultados sem alterar regras normativas. Identifica projeto, revisão elétrica, versões dos serviços, data UTC e SHA-256 das entradas (incluindo metadados/posições; excluindo resultados). O frontend descarta respostas que não correspondem ao projeto/entradas atuais e rejeita versões incompatíveis. A identidade criptográfica é rastreabilidade, não assinatura ou certificação.

Tela, CSV e PDF compartilham seções normalizadas com entradas, fontes, critérios, memória e limites. CSV usa UTF-8 com BOM, ponto e vírgula e neutralização de fórmulas em células textuais. PDF usa ReportLab como dependência opcional e fonte incorporada; a falta da dependência gera mensagem acionável, sem impedir o residencial. A geração retorna bytes em base64 pela API existente, sem armazenamento de relatórios no servidor. O status geral é sempre verificação parcial; critérios individuais preservam seus resultados reais. A Etapa 11 permanece separada e não foi iniciada nesta entrega.

## DA-43 — fechamento da auditoria sem ampliação normativa (30/10/2026)

A Etapa 11 testa e documenta o escopo existente. Resultado de regressão positivo não promove estados parciais a Conforme nem implementa proteção ou aterramento implicitamente. O cenário de 30 consumidores usa dados sintéticos isolados; exclusão automatizada ocorre somente em memória. Roteiro 0–11 mantido e encerrado com ressalvas. Pendências posteriores precisam de autorização própria.

A potência da visão geral é soma de registros convertidos, sem balanço de energia em cadeias de transformação/acionamento nem demanda. Essa semântica fica explícita na apresentação. Nenhuma fórmula elétrica é alterada pela auditoria.

PDF incorpora Noto Sans Regular para os quatro símbolos gregos ausentes na Vera, com licença OFL, origem e hashes em `voltcalc/industrial/fonts/`. A fonte é local e não depende da máquina do leitor; o restante da tipografia é preservado. O teste confere texto extraído e fonte incorporada, complementado por inspeção visual. A extensão excessiva do relatório permanece uma pendência editorial, sem omissão da memória técnica para encurtá-lo artificialmente.
