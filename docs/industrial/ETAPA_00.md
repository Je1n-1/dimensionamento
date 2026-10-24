# VoltCalc Industrial — Etapa 0: auditoria do projeto existente

Data: 24/10/2026. Situação: auditoria concluída; implementação industrial ainda não iniciada.

## 1. Escopo, fontes e preservação

Esta entrega atende à Etapa 0 do roteiro fornecido pelo usuário. Os cinco arquivos de texto anexados são idênticos; foram tratados como um único roteiro. As seis imagens de 24/10/2026 são referências de apresentação e interação. Seus números elétricos, temperaturas, fatores, limites de ocupação e indicadores de conformidade não são dados de cálculo validados.

O roteiro determina: **“FAZER 1 ETAPA POR VEZ E AGUARDAR MINHA CONFIRMAÇÃO ANTES DE INICIAR A PRÓXIMA.”** Por isso, esta entrega cria somente este documento, sem implementar a Etapa 1 ou modificar o funcionamento do residencial.

Código ativo localizado em `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`. O diretório informado no contexto, `C:\Users\jeanm\OneDrive\Documents\ChatGPT\dimensionamento`, contém `.git` e `analise_voltcalc`, não a mesma árvore da aplicação ativa. O relatório e a futura integração devem usar explicitamente a árvore ativa para evitar editar outra cópia.

Foram inventariados os arquivos ativos e examinados o servidor, contratos HTTP, modelo de dados, persistência, motor de cálculo, importação, fluxos de interface, documentação e testes. As versões em `archive/` foram identificadas como históricas, fora do servidor ativo. Esta auditoria de software não certifica a correção integral das tabelas normativas nem substitui a validação técnica prevista nas etapas posteriores.

O repositório já apresentava alterações locais e arquivos não rastreados, incluindo o cadastro por cômodo, ajustes de UX e seus testes. Eles foram preservados. Não foram excluídos arquivos, limpos dados do navegador ou criados bancos de dados. Não foi feita migração de projetos reais do usuário.

## 2. Arquitetura identificada

```text
dimensionamento/
├── server.py / Iniciar_VoltCalc.bat  Inicialização compatível
├── engine.py                       Fachada pública do motor existente
├── voltcalc/
│   ├── calculations/               Cálculos, propostas e validação
│   ├── importers/                  Importação do quadro CSV
│   ├── web/                        HTTP, API e lista de arquivos públicos
│   └── paths.py                    Caminhos relativos à raiz do projeto
├── frontend/
│   ├── index.html
│   ├── css/                        styles.css, updates.css, project.css
│   ├── images/                     Referências visuais e favicon
│   └── js/
│       ├── core/                   Estado, armazenamento, API e conexão
│       ├── features/               Ações de edição, projetos e arquivos
│       ├── views/                  Formulários, tabelas e resultados
│       └── model.js, technical.js, board.js, help.js, illustrations.js
├── data/nbr1997.json                Base histórica de dimensionamento
├── examples/residencia.csv          Exemplo do importador atual
├── tests/                          Testes Python e JavaScript
├── scripts/                        Ferramentas de auditoria
├── docs/                           Documentação e evidências
└── archive/                        Distribuições anteriores, não servidas
```

### Tecnologias e dependências

| Camada | Implementação atual | Implicação |
|---|---|---|
| Servidor | Python, `ThreadingHTTPServer`, biblioteca padrão | Não exige framework ou instalação de pacotes para executar |
| Cálculo | Funções Python em `voltcalc/calculations/` | Regras testáveis sem navegador |
| Interface | HTML, CSS e JavaScript nativo | Sem etapa de build |
| Módulos JS | ES modules e alguns objetos globais legados | A nova interface precisa isolar estado e inicialização |
| Dependências JS | `frontend/package.json` contém apenas `private` e `type: module` | Não existe framework de UI ou gerenciador de estado externo |
| Persistência | `localStorage` e backup JSON | Dados pertencem à origem e ao perfil do navegador |
| PDF | Relatório HTML e impressão do navegador | Não há gerador de PDF no servidor |
| Testes | `unittest` e scripts Node com asserções | Reaproveitáveis como regressão residencial |

O README indica Python 3.10 ou superior. A execução de auditoria usou Python 3.13.15 e Node v24.22.1. Node é usado para testes, não para servir a aplicação.

### Execução

Na pasta ativa:

```powershell
Set-Location 'C:\Users\jeanm\OneDrive\Desktop\dimensionamento'
python server.py --open
```

Alternativas: `python -m voltcalc --open`, `Iniciar_VoltCalc.bat` ou `python server.py --port 8001` para uma instância de teste isolada. A aplicação padrão fica em `http://127.0.0.1:8000/`.

O servidor escuta apenas no endereço local. Mudar de `127.0.0.1` para `localhost`, trocar a porta ou usar outro perfil de navegador muda o armazenamento acessível pela interface. Isso pode parecer perda de projetos, embora os dados permaneçam na origem anterior.

### Rotas reais

| Método e rota | Responsabilidade |
|---|---|
| `GET /` e `/index.html` | Interface residencial |
| `GET /api/health` | Disponibilidade do serviço e identificação da base histórica |
| `GET /api/example` | Importação do exemplo residencial |
| `GET /tables.js` | JavaScript gerado a partir de `nbr1997.json` |
| `POST /api/calculate` | Cálculo de circuitos |
| `POST /api/panel` | Consolidação de cargas e correntes por fase |
| `POST /api/import-csv` | Leitura do formato CSV reconhecido |
| `POST /api/propose` | Proposta opcional de divisão de circuitos |
| `POST /api/residential` | Prévia de iluminação e tomadas por cômodo |

Os demais arquivos públicos são listados explicitamente em `voltcalc/web/assets.py`. URLs antigas possuem redirecionamentos de compatibilidade. Não existem rotas industriais ou CRUD de projetos no servidor.

O servidor valida o objeto JSON, tamanho do corpo, tipo de conteúdo, números não finitos e origem quando o cabeçalho está presente. Há limite de 4 MB por requisição e limites próprios de quantidade de circuitos. Arquivos Python, testes, documentos e arquivos históricos não são expostos pela lista pública. Trata-se de uma aplicação local, sem autenticação ou infraestrutura de publicação multiusuário.

## 3. Persistência e modelo de dados

### O que existe

`frontend/js/core/storage.js` grava o projeto atual no navegador. As chaves identificadas em `core/state.js` são:

- `voltcalc_guiado_v3`: projeto residencial atual;
- `voltcalc_guiado_v2`: formato antigo aceito na restauração;
- `voltcalc_before_csv_v3`: cópia anterior à aplicação de uma importação CSV.

O formato de backup é `VoltCalcGuiado-v3`, com esquema versão 3 e leitura compatível com v2. O estado inclui nome, contexto, alimentação, circuitos, rascunho, edição atual, reatância e informações de importação. O contexto guarda ambientes, geometria de cômodos, equipamentos e condições da proposta.

O modelo limita o projeto a 300 circuitos, 100 grupos de cargas por circuito e até 100 entradas nas listas de ambientes/equipamentos. Esses limites não devem ser confundidos com o número ilustrativo de 150 consumidores das imagens industriais.

O código não contém integração com banco SQL. A busca no repositório não localizou arquivos `.db`, `.sqlite`, `.sqlite3` ou `.sql`. A pasta `data/` contém a base normativa histórica, não projetos salvos. **Nenhum banco esperado foi substituído ou criado nesta etapa.** O conteúdo real do armazenamento do navegador do usuário não foi exportado nem alterado pela auditoria.

### Limitações relevantes

1. Há um projeto ativo por chave, sem catálogo de múltiplos projetos, histórico de revisões ou controle de conflitos entre abas.
2. `persist()` informa falha e retorna `false`, mas nem todos os chamadores condicionam o sucesso da ação a esse retorno. A importação JSON pode anunciar a importação mesmo se a persistência falhar.
3. O modelo residencial normaliza uma lista conhecida de campos. Acrescentar dados industriais ao objeto antigo sem um esquema próprio pode descartá-los ao salvar/importar.
4. O backup CSV de resultados não é um backup completo restaurável. O próprio importador aceita outro contrato de CSV; JSON é o caminho atual para restauração integral.
5. Não há transação abrangendo várias chaves, recuperação por revisão ou resolução de edição concorrente.

### Proposta de armazenamento industrial

Para manter a tecnologia existente, a proposta inicial é um repositório industrial versionado sobre `localStorage`, com namespace exclusivo, catálogo de projetos e identidade própria para cada projeto. A implementação deve ocorrer na Etapa 2, não nesta auditoria.

O contrato do repositório deve oferecer listar, carregar, salvar, duplicar e excluir, sem expor detalhes de armazenamento às telas. Deve validar a versão, detectar edição sobre revisão desatualizada, tratar falta de espaço e permitir backup JSON. A estratégia de gravação e recuperação precisa ser testada antes de afirmar que o projeto foi salvo. Cálculos persistidos só serão válidos para a mesma revisão de entradas, motor e tabelas.

Não reutilizar ou apagar as chaves residenciais. Não migrar automaticamente os projetos residenciais para o esquema industrial. Se futuramente for necessário banco central, sincronização entre computadores ou usuários, será necessária uma decisão explícita de armazenamento no servidor; SQLite é uma possibilidade compatível com Python, mas **não foi escolhido nem criado nesta etapa**.

## 4. Funcionalidades residenciais existentes

| Área | Situação observada | Arquivos principais |
|---|---|---|
| Navegação | Projeto, Circuitos e Relatório; modos guiado/técnico no contexto | `frontend/index.html`, `js/app.js`, `features/project.js` |
| Cadastro por cômodo | Geometria e escolhas em lote, prévia e aplicação explícita | `features/rooms.js`, `calculations/residential.py` |
| Inventário | Equipamentos, quantidades, potência e ambientes | `model.js`, `features/project.js` |
| Proposta | Divisão editável e distribuição incremental opcional de fases | `calculations/planning.py` |
| Editor de circuitos | Grupos de cargas diferentes, ligação, fases e condições | `views/forms.js`, `features/circuits.js` |
| Grade técnica | Edição e colagem em lote com validação | `technical.js`, `features/grid.js` |
| Grandezas | Potências ativa/aparente/reativa e correntes | `calculations/circuits.py` |
| Dimensionamento | Correções, candidatos de seção e proteção preliminar | `corrections.py`, `sizing.py` |
| Quadro de cargas | Consolidação por fase e indicadores de distribuição | `panel.py`, `board.js`, `views/dashboard.js` |
| Resultados | Critérios calculados, pendências e causas de bloqueio | `views/results.js`, `views/report.js`, `validation.py` |
| Arquivos | Importação CSV específica, backup JSON, exportação CSV e impressão | `features/files.js`, `features/report.js` |
| UX | Modal de exclusão, teclado centralizado, conexão e favicon | `features/circuits.js`, `core/keyboard.js`, `core/connection.js` |

O cadastro residencial por cômodo calcula uma previsão vinculada às referências de 2004/2008, separada do motor de ampacidade histórico de 1997. Isso **não significa que todas as tabelas ou verificações da aplicação tenham sido migradas para 2004**. `views/coverage.js` registra essa distinção e as lacunas.

Os problemas anteriores do botão decorativo da norma, exclusão de circuito com `confirm()`, ausência de favicon e duplicidade do listener global de teclado já têm tratamento no código atual. A importação JSON ainda utiliza confirmação nativa; é um fluxo distinto da exclusão de circuito. Abrir `frontend/index.html` por arquivo exibe instruções, e a aplicação carregada monitora desconexão. Quando o servidor já está parado antes da primeira requisição HTTP, a tela de erro pertence ao navegador.

O estado geral atual é deliberadamente **Pré-dimensionado**, **Revisar**, **Dados pendentes** ou **Cálculo indisponível**. Os critérios individuais têm estados atendido, não atendido e pendente. Esse comportamento deve permanecer no residencial.

## 5. Motor atual: aproveitamento e limites

### Grandezas, motores e fases

`circuits.py` aceita W, kW, VA, kVA, CV e HP nos grupos de carga. CV/HP são convertidos em potência mecânica e usam rendimento; a potência aparente usa fator de potência. São tratadas ligações fase-neutro, fase-fase e trifásica equilibrada. O quadro consolida correntes por fasores sob as hipóteses do modelo.

Isso não constitui um cadastro industrial de motores: faltam polos, frequência, regime, fator de serviço, corrente de placa, catálogo com procedência, corrente de partida e prioridade explícita entre fontes. Também falta distinguir potência mecânica de elétrica quando ambas forem informadas em W/kW. A proposta de inventário aceita apenas W/VA, embora o editor de cargas tenha mais unidades.

Não foi localizado catálogo WEG nos anexos desta solicitação, no repositório ou na busca por nomes de arquivos relacionados a WEG/catálogo/motor em Downloads. A futura integração de catálogo depende de uma fonte identificada por fabricante, edição, tensão e configuração. Nenhuma corrente da imagem deve preencher essa lacuna.

O modelo atual não calcula harmônicos, corrente de neutro industrial ou demanda de alimentadores. A distribuição de fases é uma heurística incremental, não uma otimização global nem dimensionamento de entrada.

### Percursos e queda de tensão

Existem dois modelos dentro de um circuito: cargas ao longo de um percurso com posições acumuladas e ramais independentes a partir da origem. No percurso linear, a distância física de cada segmento é obtida pela diferença entre posições e a carga a jusante diminui após cada derivação.

Não há grafo do projeto que reúna painéis, trechos compartilhados por diferentes circuitos e a passagem de cada cabo. O mesmo circuito utiliza condições e seção comuns no cálculo atual. Não se deve transformar diretamente os grupos de cargas em nós de um grafo industrial sem definir essas relações.

A queda usa uma aproximação com resistência/reatância e tensão nominal. Não inclui automaticamente alimentadores a montante, partida de motores, desequilíbrio completo ou solução iterativa da rede. O cálculo da resistência usa hipóteses de temperatura do material; **não estima a temperatura real de operação do cabo**.

### Cabos, correções e proteção

O motor utiliza `data/nbr1997.json`. Há seleção de métodos A1/A2/B1/B2/C/D, correções de temperatura e agrupamento, candidatos de seção, queda e proteção preliminar. Métodos e condições fora da cobertura geram pendências. Bandeja/leito/ar livre não devem ser forçados para B1 apenas para produzir resultado.

O agrupamento depende de quantidade/arranjo informados, não da topologia real dos trechos. Alguns casos enterrados, espaçamento não definido e condições fora das tabelas não têm seleção automática. A política térmica usa o próximo valor tabelado mais conservador quando aplicável, sem inventar interpolação.

A escolha final residencial combina cabo e disjuntor. Isso exige separação de responsabilidades para o industrial: a Etapa 6 deve poder produzir a seleção do condutor sem fingir que proteção, curto-circuito, coordenação e partida já foram verificados.

Há comparação entre capacidade de interrupção informada e corrente de curto informada, mas não cálculo completo da corrente de curto, seletividade, curvas, energia passante ou coordenação de partida. Seções mínimas são simplificadas por tipo de circuito. PE, neutro, DR/DPS e seccionamento não possuem toda a verificação exigida pelo novo escopo.

### Infraestrutura

Não existe serviço de ocupação de eletrodutos, eletrocalhas e leitos por diâmetro externo real dos cabos. Seção de cobre em mm² não equivale à área externa ocupada pelo cabo isolado. Fatores de agrupamento térmico e taxa geométrica de ocupação precisam permanecer como verificações distintas.

Os limites ilustrativos de 70%/75% das imagens não podem se tornar regras universais para calha/leito. A futura implementação precisa registrar tipo, disposição, dimensões e referência aplicável, além de vincular os cabos efetivamente presentes em cada trecho.

## 6. Problemas e riscos priorizados

| Prioridade | Constatação | Tratamento recomendado |
|---|---|---|
| Alta | Base de ampacidade histórica de 1997 e previsão residencial de 2004 convivem | Bases e versões explícitas por cálculo; validar a base industrial sem alterar silenciosamente a residencial |
| Alta | Não há topologia de trechos compartilhados nem inventário de cabos por trecho | Modelo próprio na Etapa 1 e cálculo topológico na Etapa 5 |
| Alta | Não há dados de placa/catálogo nem análise de partida | Fontes rastreáveis; campos ausentes produzem pendências, nunca números demonstrativos |
| Alta | Persistência atual comporta um projeto ativo e pode falhar por quota | Repositório industrial isolado e testes de falha/recuperação na Etapa 2 |
| Alta | Esquema residencial descarta propriedades desconhecidas | Não persistir objetos industriais pelo normalizador residencial |
| Alta | Seleção de cabo atual está acoplada à proteção preliminar | Serviços independentes com critérios e resultados próprios |
| Alta | Falta de verificações pode ser escondida por um indicador geral verde | Estado geral calculado pela cobertura de critérios exigidos, não pela existência de uma seção sugerida |
| Média | Estado global, IDs e classes genéricas no frontend | Entrada, estado, DOM e CSS industriais separados |
| Média | Cache usa entradas, mas não versão das tabelas/motor | Chave com revisão e versões; rejeitar respostas assíncronas desatualizadas |
| Média | Diagnósticos dependem parcialmente de texto de erro e regex | Novos códigos estáveis de validação, com campo e causa estruturados |
| Média | `window.print()` depende do navegador e do CSS de impressão | Tratar como exportação existente; testar relatório industrial completo na Etapa 10 |
| Média | Importação CSV é específica, não importação industrial genérica | Contrato industrial e prévia de validação próprios; não anunciar suporte XLSX inexistente |
| Baixa | README ainda menciona ausência de balanceamento automático | Atualizar documentação quando autorizado; já há alocação heurística opcional em `planning.py` |

As alterações locais anteriores aumentam o risco de misturar escopos em uma revisão. Cada etapa industrial deverá registrar precisamente seus arquivos, sem reverter trabalho residencial existente. As correções de código acima não foram executadas nesta auditoria.

## 7. Proposta arquitetural para as próximas etapas

### Isolamento e organização

Preservar `/` e os contratos `/api/*` residenciais. Propor uma entrada `/industrial/`, com recursos explícitos na lista pública e futura API `/api/industrial/*`. Nenhuma dessas rotas foi criada nesta entrega.

```text
frontend/industrial/                 # proposta, ainda não criada
  index.html
  css/industrial.css
  js/app.js
  js/core/                          # modelo, estado, validação, revisão e API
  js/repositories/                  # armazenamento independente das telas
  js/components/                    # tabela, cartões, modal e estados
  js/pages/                         # seis páginas do roteiro
voltcalc/industrial/                # proposta, ainda não criada
  models.py
  validation.py
  services/                         # grandezas, topologia, cabos, ocupação, queda
  api.py
tests/industrial/                   # testes próprios, além da regressão existente
docs/industrial/                    # relatórios por etapa
```

Manter Python como fonte dos cálculos. Reaproveitar utilitários puros por contrato explícito e com testes, sem fazer as telas industriais dependerem de `window.VoltModel`, do estado residencial ou de seletores genéricos. Inicialmente, um namespace visual industrial evita uma refatoração transversal arriscada dos três arquivos CSS existentes.

Reaproveitamento recomendado: mecanismos do servidor, validação de números, conversões revisadas, conceitos do cálculo por segmentos, formatação/escape, ícones SVG, estrutura de tabelas, modais acessíveis e padrões de teste. Reaproveitamento condicionado: seleção de cabos, critérios normativos, armazenamento, importadores e consolidação elétrica — todos exigem adaptação de contrato e cobertura.

### Entidades propostas

| Entidade | Responsabilidade mínima |
|---|---|
| Projeto | Identidade, descrição, revisões, alimentação, referências e etapa atual |
| Consumidor | Tipo, tag, quantidade, potência/unidade/base, ligação, ambiente e origem |
| Motor | Dados específicos e fontes de corrente, rendimento, fator de potência e partida |
| Painel | Nó elétrico, alimentação e consumidores/circuitos atendidos |
| Circuito | Ligação elétrica entre origem e consumidores; condutores e critérios próprios |
| Trecho | Ligação física entre nós, comprimento real e condições locais |
| Condutor | Material, seção, isolação, função, formação e dados externos de catálogo |
| Infraestrutura | Tipo, geometria, arranjo e cabos presentes no trecho |
| Resultado de cálculo | Entradas, versões, critérios, fontes, valores e pendências |

Consumidor, circuito e trecho não são sinônimos. Um circuito pode atravessar vários trechos; um trecho pode carregar vários circuitos. Potência de um painel deve evitar dupla contagem das cargas a jusante. Posição acumulada de consumidor e comprimento físico do trecho precisam de campos e validações distintos.

O cadastro deve distinguir fases, neutro e PE. Uma ligação 3F + PE não implica neutro e não define, por si só, o esquema de aterramento da instalação.

### Atualização e rastreabilidade

Toda edição relevante incrementa a revisão do projeto e invalida os resultados afetados. Dependências previstas: consumidores/alimentação → correntes → cabos por trecho → ocupação e queda → consolidação. Mudanças de topologia, norma, catálogo e condições de instalação também invalidam resultados dependentes. O dimensionamento que considere queda deve resolver essa dependência dentro do serviço, com entradas/versionamento explícitos.

Resultados precisam carregar revisão das entradas, versão do motor, identificação/edição da tabela e origem dos dados. Uma resposta de cálculo de uma revisão anterior não pode substituir o resultado de uma edição mais recente.

Estados sugeridos por critério: não calculado, pendente de dados, atendido, não atendido e não aplicável com justificativa. O projeto só pode apresentar conformidade global quando todos os critérios aplicáveis exigidos estiverem efetivamente verificados. “Página preenchida” e “etapa revisada” não equivalem a conformidade elétrica.

### Aplicação das referências visuais

O industrial terá a sequência **Projetos → Consumidores e cargas → Dimensionamento → Infraestrutura → Queda de tensão → Visão geral**. Relatórios e Configurações são funções auxiliares. A navegação residencial de três seções será preservada.

Reproduzir nas próximas etapas a lateral azul-escura, seleção azul, cabeçalho compacto, identificação do projeto, cartões claros, tabelas densas com leitura confortável e hierarquia visual das imagens. A página Consumidores e cargas usa a área principal completa, sem o antigo assistente lateral. Dimensionamento e Queda podem exibir detalhes contextuais do item selecionado. O mapa completo pertence somente à Visão geral; o editor topológico anterior deve ser compacto.

Não preencher cartões com dados fictícios, copiar um selo verde de referência ou apresentar imagens de equipamentos como evidência de catálogo. Telas ainda não implementadas devem comunicar sua condição real. A primeira validação visual será parte da Etapa 1, e não foi simulada nesta auditoria documental.

## 8. Verificação executada

Todos os comandos abaixo foram executados contra o código existente nesta auditoria, na pasta ativa. Nenhum teste industrial foi declarado existente.

| Comando | Resultado |
|---|---|
| `python -m unittest discover -s tests -q` | 80 testes; OK |
| `node tests/grid.test.cjs` | OK |
| `node tests/model.test.cjs` | OK |
| `node tests/report.test.mjs` | OK |
| `node tests/rooms.test.mjs` | OK |
| `node tests/ux.test.mjs` | OK |

Cobertura observada: grandezas e percursos, correções, seleção, validação, distribuição de fases, propostas, previsão residencial, estrutura/HTTP, migração e backup, colagem em grade, critérios do relatório, cadastro em lote e comportamento lógico de UX. As cinco suítes JavaScript não foram contadas como cinco testes individuais.

Os testes existentes não comprovam atendimento integral à norma. Não há ainda testes de catálogo de motores, 30 consumidores industriais, topologia entre painéis, infraestrutura por diâmetro externo, partida ou recuperação de múltiplos projetos industriais. Esses cenários pertencem às etapas correspondentes e à validação final.

Não houve nova inspeção visual em navegador nesta etapa, pois nenhuma tela foi alterada. Capturas anteriores do residencial existem em `docs/screenshots/`, mas não são evidência de implementação industrial.

## 9. Critérios de aceitação da Etapa 0

| Critério | Situação |
|---|---|
| Identificar código ativo, estrutura, tecnologias e dependências | Atendido |
| Documentar execução, rotas, componentes e serviços | Atendido |
| Identificar persistência e registrar ausência de banco SQL | Atendido; nenhum banco criado ou substituído |
| Examinar residencial e preservar seu comportamento | Atendido; nenhum arquivo de aplicação alterado nesta etapa |
| Identificar reutilização, problemas e riscos | Atendido |
| Examinar testes e regressões | Atendido; 80 testes Python e cinco suítes JavaScript aprovados |
| Propor arquitetura compatível e integração isolada | Atendido; proposta descrita, ainda não implementada |
| Entregar `docs/industrial/ETAPA_00.md` | Atendido |
| Respeitar parada entre etapas | Atendido; Etapa 1 aguarda autorização |

## 10. Entrega e pendências

**Arquivo criado nesta etapa:** `docs/industrial/ETAPA_00.md`. Nenhum arquivo de aplicação foi modificado. Nenhuma correção normativa, mudança visual, rota industrial ou funcionalidade futura foi implementada.

Não houve falha nos testes executados. Permanecem as limitações e riscos registrados nas seções 3, 5 e 6, especialmente a ausência de modelo industrial, topologia compartilhada, catálogo identificado, infraestrutura e verificações completas. As tabelas industriais deverão ser verificadas contra a referência aplicável na etapa de cálculo, sem assumir que trocar o rótulo da norma migra o motor.

Próxima entrega, somente após confirmação: **Etapa 1 — estrutura do VoltCalc Industrial**, com shell fiel às referências, navegação, modelos, validações iniciais e mecanismo de invalidação. CRUD de múltiplos projetos e cálculos industriais permanecem nas etapas posteriores previstas pelo roteiro.
