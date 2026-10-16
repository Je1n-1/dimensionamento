# Análise do VoltCalc Guiado

> Análise histórica da versão original, agora preservada em `original_html`. A versão Python foi criada posteriormente; consulte `README.md` para o funcionamento atual e as correções implementadas.

Data: 16/10/2026. Escopo: arquivos do ZIP fornecido, leitura do código, inspeção da imagem de apresentação e execução isolada das funções JavaScript. Os arquivos originais extraídos não foram alterados. O README foi tratado como documentação do produto, sem executar suas instruções como comandos do usuário.

O projeto é uma base funcional de pré-dimensionamento de circuitos. Já automatiza consultas e tentativas sucessivas de seção/disjuntor, que são etapas repetitivas do trabalho manual. A economia de horas é plausível como objetivo, mas ainda precisa ser medida em projetos representativos; esta análise não mediu produtividade.

**Estrutura e funcionamento**

| Arquivo | Papel |
| --- | --- |
| `VoltCalc_Guiado/index.html` | Estrutura da interface e carregamento dos arquivos |
| `VoltCalc_Guiado/styles.css` | Estilos, adaptação a diferentes larguras e impressão |
| `VoltCalc_Guiado/tables.js` | Dados de capacidade de corrente, temperatura e agrupamento |
| `VoltCalc_Guiado/app.js` | Estado, cálculos, formulários, persistência e relatórios |
| `VoltCalc_Guiado/VoltCalc_Guiado_Abrir.html` | Distribuição em HTML único, com os mesmos JS, CSS e tabelas |
| `VoltCalc_Guiado/README.md` | Escopo e limitações declaradas |
| `VoltCalc_Guiado/preview.png` | Imagem da interface fornecida no pacote |

Não há backend, banco de dados remoto ou dependências externas de execução declaradas nesses arquivos. O projeto mantém um conjunto de circuitos no armazenamento local do navegador. A exportação PDF utiliza a impressão do navegador.

O motor converte a potência em VA, calcula a corrente, determina o método de instalação, consulta a capacidade tabelada e aplica fatores de temperatura e agrupamento. Depois percorre seções em ordem crescente e escolhe a primeira combinação que atende aos critérios implementados de corrente, queda e sobrecarga com um disjuntor da lista interna.

**Pontos fortes**

- Modo guiado e técnico usam o mesmo motor, reduzindo divergências entre interfaces.
- Distingue W/kW, VA/kVA e potência mecânica em CV/HP, incluindo rendimento nesta última conversão.
- Considera a combinação de critérios na seleção, em vez de apenas dividir potência por tensão.
- Tem cadastro, duplicação, edição, backup e relatório: já existe um fluxo de projeto.
- Mantém pendente a seleção para métodos e agrupamentos não cobertos. Isso foi verificado para bandeja, ar livre e agrupamento subterrâneo.
- Escapa textos dinâmicos com `esc()` em diversos pontos; limita tamanho do JSON importado e quantidade de circuitos.
- A imagem fornecida apresenta hierarquia visual clara, desenhos das instalações e resumo lateral. O CSS inclui pontos de adaptação e indicadores de foco.

**Defeitos confirmados e prioridades**

| Prioridade | Constatação | Evidência e consequência | Correção proposta |
| --- | --- | --- | --- |
| Alta | Backup não restaura a reatância | `app.js:132–133`: exporta `reactance`, mas não a importa. No teste com 30 kVA, 380 V, FP 0,8 e 200 m, a configuração de 0,5 Ω/km produziu 50 mm². Ao importar com configuração local de 0,08 Ω/km, passou a 35 mm². | Restaurar e validar todos os parâmetros que influenciam o cálculo; testar ida e volta do backup. |
| Alta | I₂/In inválido não bloqueia a seleção | `app.js:35–49`: valores vazio, zero e −1 retornaram disjuntor e lista de erros vazia. O atributo HTML `min` não é uma validação do motor; vazio é convertido em zero. | Validar domínio e finitude na entrada do motor, com mensagem explícita e estado pendente. |
| Alta | Alimentação trifásica equilibrada aceita dois condutores carregados | `app.js:46`, `81`, `104`, `115`: alterar a alimentação atualiza `loaded`, mas é possível sobrescrevê-lo depois. Em teste PVC/B1, 30 kVA, 380 V, 35 °C e comprimento zero para isolar o critério, a seleção mudou de 16 para 10 mm² sem erro. | Validar coerência entre alimentação e condutores carregados, com regras explícitas para casos especiais. |
| Média | Recarregar durante edição perde a identidade da edição | `app.js:28–30`, `122–125`: persiste rascunho, mas não `editingId`. O teste editou um circuito, recarregou o estado e salvou; terminou com dois circuitos em vez de atualizar o existente. | Persistir vínculo de edição e validá-lo ao restaurar. |

Os valores acima são resultados do programa usados para demonstrar defeitos de software, não dimensionamentos recomendados para execução.

**Outras fragilidades observadas no código**

- `persist()` retorna falha, mas vários caminhos de cadastro e edição ignoram esse retorno e exibem sucesso. Distinguir alteração em memória de gravação efetiva e mostrar erro quando a persistência falhar.
- A validação está dividida entre `clean()`, `markIssue()` e `calculate()`, com critérios diferentes. `clean()` normaliza enumerações, mas não garante tipos numéricos, finitude, IDs únicos, versão do backup ou referência técnica compatível.
- A primeira abertura começa na etapa 3 com um transformador de exemplo. Para uso real, oferecer explicitamente “novo projeto” e “abrir exemplo”, iniciando novos circuitos na etapa 1.
- Atualizações numéricas redesenham apenas o resumo lateral. Valores derivados dentro do painel principal, como corrente na etapa 2 e FCA na etapa 4, podem permanecer antigos até outra renderização.
- O relatório lista resultados e avisos gerais, mas omite entradas e resultados necessários para reconstruir cada cálculo: comprimento, fator de potência, método detalhado, fatores, capacidade corrigida, queda e hipóteses de proteção.
- Acessibilidade precisa de revisão: `field()` gera rótulos sem associação `for`/`id`; modais não implementam gerenciamento de foco; grupos visuais com `role="radio"` não implementam toda a interação de um grupo de opções.
- Cálculo, HTML, estado e armazenamento estão concentrados em `app.js`. A manutenção de fabricantes e novas regras aumentará o acoplamento se seguir esse padrão.

**Limites do dimensionamento atual**

O próprio pacote identifica as tabelas como transcrição histórica da NBR 5410:1997. O PDF de origem não acompanha o ZIP. Não foi possível conferir a transcrição célula a célula, e esta análise não estabelece conformidade com qualquer edição normativa.

O código ainda não implementa métodos E/F/G, vários agrupamentos, neutro/PE, DR/DPS, partida de motores, proteção térmica de curto-circuito, seccionamento ou seletividade. Resistividade e profundidade do solo são campos documentais; não alteram o cálculo. A curva B/C/D também não participa de uma verificação de atuação. A reatância é uma configuração geral e a resistência vem de uma aproximação por material, seção e temperatura-limite da isolação.

As seções mínimas estão resumidas a uma regra por material/tipo de carga em `app.js:49`. A aplicação precisa representar as condições de uso e a referência de cada regra para ampliar seu escopo técnico com rastreabilidade.

Também não há modelo de quadros, alimentadores e circuitos interligados. Cada circuito é calculado isoladamente; agrupamento é informado manualmente. Demanda, distribuição entre fases e queda acumulada ao longo do percurso são evoluções distintas do cadastro de circuitos existente.

**Preparação para dados de fabricantes**

Minha proposta é separar cinco responsabilidades, preservando inicialmente a interface:

1. **Motor de cálculo:** funções independentes de DOM, `localStorage` e variáveis globais. Recebem circuito, configurações e conjuntos de dados explicitamente; retornam resultados, justificativas, falhas e pendências.
2. **Regras técnicas versionadas:** edição, tabela, condição de aplicação, unidade, fonte e data de revisão. Manter regras normativas separadas de atributos comerciais de produtos.
3. **Catálogo de fabricantes:** identificação estável de produto, família, modelo, ficha técnica e revisão. Para cabos, armazenar material, isolação, seção, tensão nominal, condições dos dados de resistência/reatância e instalação. Para proteções, armazenar polos, corrente, tensão, capacidades declaradas e documentação de atuação/coordenação.
4. **Projeto e revisões:** guardar entradas, parâmetros, versões do motor e das bases e referência dos produtos escolhidos. Uma atualização de catálogo não deve alterar silenciosamente um projeto já emitido.
5. **Interface e memorial:** explicar o critério determinante da seção, alternativas elegíveis e verificações pendentes. Gerar memória de cálculo reproduzível por circuito.

O fluxo pode evoluir para: requisitos do circuito → critérios elétricos → produtos tecnicamente compatíveis → comparação de alternativas → memorial. Cada produto deve ser avaliado nas condições efetivas de uso; a marca sozinha não valida compatibilidade.

**Sequência de evolução sugerida**

Primeiro, corrigir os quatro defeitos reproduzidos e unificar validação/persistência. Depois, isolar o motor e construir casos de referência revisados, incluindo valores de fronteira e combinações fora do escopo. Em seguida, versionar as bases e enriquecer o memorial. Com essas fundações, incorporar um catálogo pequeno de fabricantes, validar o fluxo completo e só então ampliar catálogo e escopo de instalação.

Para medir o valor da automação, comparar tempo e retrabalho em um conjunto de projetos resolvidos manualmente e pelo aplicativo, registrando também quantos casos ficam pendentes. A meta de economizar horas deve incluir a revisão das entradas e das hipóteses.

**Verificação executada**

`node --check` passou em `app.js` e `tables.js`. O arquivo `audit.cjs` executa funções originais em contexto JavaScript isolado, com substitutos mínimos de DOM e armazenamento; não altera o código-fonte extraído. `evidencias.json` registra resultados e reproduções. A versão HTML única contém os mesmos JS, CSS e tabelas dos arquivos separados.

No exemplo original de 30 kVA e 380 V trifásico, o motor retornou 45,58 A, 10 mm², 50 A e queda estimada de 2,28%. A corrente foi comparada com a expressão aritmética correspondente; isso não valida toda a base técnica.

Não houve execução interativa em navegador, inspeção de impressão real ou medição de desempenho/acessibilidade em dispositivos. A avaliação visual se limita à imagem fornecida e ao CSS. Os testes são evidências dos comportamentos descritos, não uma certificação do software.
