# Comparação do VoltCalc com os materiais SENAI

Data: 21/10/2026. Código analisado: commit `b563eb8`, projeto em `C:/Users/jeanm/OneDrive/Desktop/dimensionamento`.

**Conclusão: aderência parcial.** O motor reproduz a corrente e os fatores dos exemplos básicos e chega à mesma seção final no exemplo principal de iluminação. Há divergências concretas na seção mínima de circuitos de força e na aplicação do limite de queda, além de diferenças de método que podem mudar a seção selecionada. Neutro, PE e luminotécnica ainda não são dimensionados.

Esta revisão não alterou o motor, as tabelas nem o projeto salvo no navegador. Foram acrescentados este relatório, um script de reprodução e seus resultados. A comparação não equivale a uma verificação integral da norma ou à validação de um projeto executivo.

## Materiais e procedimento

Os três PDFs recebidos foram identificados pelo título interno:

| Referência | Título | Páginas |
|---|---|---:|
| UE1 | Critérios para dimensionamento de condutores elétricos | 29 |
| UE2 | Dimensionando os condutores de circuitos elétricos | 23 |
| LUM | Projeto luminotécnico para ambientes internos | 30 |

A numeração deste relatório é a página do PDF, não a tela do curso. Foram lidos os textos dos três documentos e conferidas visualmente 15 páginas contendo tabelas e equações relevantes, inclusive fórmulas que não aparecem na extração textual. As alternativas de exercícios foram tratadas como alternativas, não como afirmações necessariamente corretas.

Foram comparados o código Python, seus dados e as explicações/formulários da interface. O script `scripts/audit_senai.py` executa os cenários sem acessar ou alterar dados do navegador. `docs/analysis/auditoria_senai.json` registra as entradas de referência das tabelas e os resultados calculados.

## O que coincide

### Exemplo principal do curso

UE2, pp. 4-11 e 15-19: iluminação de 1.000 VA em 127 V, cobre/PVC, condutores isolados em eletroduto embutido em alvenaria, método B1, dois condutores carregados, 35 °C, três circuitos agrupados, percurso de 12 m e limite de 4%.

| Grandeza | Material | VoltCalc |
|---|---:|---:|
| Corrente da carga | 7,87 A | 7,87401575 A |
| FCT | 0,94 | 0,94 |
| FCA | 0,70 | 0,70 |
| Corrente corrigida para consulta à tabela | 11,96 A, usando 7,87 A na conta | 11,96658928 A, preservando precisão |
| Seção final | 1,5 mm² | 1,5 mm² |

O site chama a corrente corrigida de **capacidade tabelada necessária do cabo**. Trata-se da mesma operação: `Ib / (FCT × FCA)`. Também aplica corretamente a operação inversa à capacidade do cabo: `Iz = Itab × FCT × FCA` (UE1, pp. 22-24).

O resultado do programa acrescenta uma sugestão nominal de disjuntor de 10 A. Essa sugestão não foi validada pelo exemplo do PDF, que demonstra os critérios dos condutores.

### Recorte das tabelas

Coincidiram **152 de 152 valores numéricos** conferidos:

- 48 fatores de temperatura de ar/solo, PVC/EPR/XLPE, impressos em UE1, pp. 18-20;
- 20 fatores de agrupamento para a primeira disposição, de 1 a 20 circuitos, em UE1 p. 20 / UE2 p. 10;
- 84 capacidades de corrente: sete linhas completas de cobre/PVC, de 0,5 a 6 mm², nas 12 colunas A1 a D, em UE2 p. 11 / UE1 p. 23.

Isso valida esse recorte, não todas as tabelas existentes no programa. As tabelas completas de EPR/XLPE não foram confrontadas célula por célula com esses PDFs.

### Potência, ligação e etapas

As conversões W/VA e o divisor `sqrt(3)` para potência trifásica total equilibrada estão coerentes com os casos cobertos. Fase-neutro e fase-fase usam dois condutores carregados, e trifásico equilibrado usa três. Entrada trifásica da residência não transforma os circuitos monofásicos em trifásicos.

A sequência atual (Circuito, Grandezas, Instalação, Agrupamento, Condições, Resultado) coleta os dados do procedimento da UE1 p. 10. A ordem de preenchimento pode diferir da exposição do curso; os critérios devem ser atendidos conjuntamente na seleção final.

## Divergências que precisam de correção

### 1. Seção mínima de circuitos de força

**Referência:** UE1 p. 5, tabela de seção mínima: nas instalações fixas com condutores/cabos isolados, cobre de 1,5 mm² para iluminação e 2,5 mm² para força; a nota inclui tomadas entre os circuitos de força.

**Código:** `voltcalc/calculations/sizing.py:94` aplica 2,5 mm² somente ao tipo `sockets`. Para `motor`, `shower`, `transformer` e `other`, o mínimo de cobre volta a 1,5 mm².

**Reprodução:** carga elétrica de entrada de 500 W, 220 V, FP 1, 5 m, B1/PVC, 35 °C e um circuito. Ao classificar como motor, o programa seleciona 1,5 mm². O cadastro representa a instalação fixa de alimentação; não é o cordão flexível interno do equipamento.

**Ação:** separar finalidade normativa (iluminação, força, sinalização etc.) da descrição do equipamento e aplicar a seção mínima pertinente. O tipo genérico “Outros” precisa de classificação explícita. Esse é um erro de regra que pode produzir uma seção inferior à indicada pelo material.

### 2. Limite de queda terminal livre até 20%

**Referência:** UE1 pp. 26-28 e UE2 p. 15 distinguem o limite de 4% nos circuitos terminais dos limites globais conforme a origem da instalação.

**Código:** `sizing.py:42` aceita qualquer limite positivo até 20%, e `frontend/js/views/forms.js` permite essa faixa. A ajuda trata 4% apenas como valor inicial configurável. Não há distinção entre circuito terminal e alimentador nem soma da queda anterior ao quadro.

**Reprodução:** iluminação de 1.000 W, 220 V, FP 1, 160 m, B1/PVC, 35 °C, um circuito e limite informado de 10%. O programa seleciona 1,5 mm² com queda de **9,09%**, atendendo ao limite digitado, embora ultrapasse o terminal apresentado no curso.

**Ação:** identificar a função do circuito, aplicar o teto pertinente ao modo normativo e calcular a parcela de queda já consumida a montante. Um modo de simulação com limite livre deve ficar distinguido da verificação normativa.

### 3. Queda estimada não reproduz a tabela do fabricante

**Referência:** UE2 pp. 15-17 calcula a queda unitária admissível e consulta a tabela Prysmian correspondente ao cabo, material do eletroduto, ligação e FP. Para 1,5 mm², circuito monofásico, eletroduto não magnético e FP 0,95, a tabela mostra **27,6 V/(A·km)**.

**Código:** `sizing.py:95-99` estima resistência pela resistividade ideal, seção nominal e temperatura de 70/90 °C. `circuits.py:146` calcula a queda por R/X; a reatância padrão é 0,08 Ω/km. O material do eletroduto é documental, sem alterar R/X. Não há cadastro de produto ou resistência máxima do condutor real.

As fórmulas de queda FN/FF e trifásica equilibrada são coerentes com a abordagem R/X descrita no [guia técnico da Schneider Electric](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions). Isso não torna os parâmetros genéricos equivalentes aos de um cabo de catálogo.

**Caso de fronteira criado para a auditoria, não extraído como exemplo resolvido do PDF:** iluminação de 1.500 W, 220 V, FP 0,95, 45 m, B1/PVC, 35 °C, um circuito, limite 4%.

| Verificação de 1,5 mm² | Resultado |
|---|---:|
| Corrente | 7,1770 A |
| Queda estimada pelo VoltCalc | 3,8431% |
| Queda usando 27,6 V/(A·km) da tabela da aula | 4,0518% |
| Decisão | Site seleciona 1,5 mm²; essa seção excede 4% pela tabela citada |

**Ação:** adicionar uma opção de cálculo pela tabela/catálogo identificado e apresentar a queda unitária admissível. Até lá, a estimativa deve continuar identificada como aproximação; não deve ser descrita como reprodução integral do procedimento do fabricante.

### 4. Condições de validade do agrupamento não verificadas

**Referência:** UE1 pp. 9 e 20-21 aborda temperatura máxima de serviço comum, intervalo de seções e regras específicas de agrupamentos. UE2 pp. 9-10 obtém a quantidade pelo trecho mais agrupado na planta.

**Código:** `corrections.py:28` usa quantidade e disposição. Não conhece os outros circuitos que compartilham o eletroduto, suas seções ou isolações. Não verifica as condições de aplicação nem calcula fatores para grupos heterogêneos.

**Ação:** explicitar as hipóteses enquanto o cadastro for simplificado e, depois, vincular circuitos a trechos/eletrodutos. Não basta contar todos os circuitos do projeto ou os grupos de equipamentos.

## Cobertura ainda incompleta

| Assunto | Material | Situação atual |
|---|---|---|
| Neutro | UE1 pp. 5-6 | Não dimensiona seção nem verifica condições de redução. |
| PE e aterramento | UE1 pp. 6-7 | Não aplica tabela de PE nem cálculo térmico, nem seções de aterramento. |
| Métodos E, F, G e demais disposições | UE1 p. 12 | Bandeja/ar livre ficam pendentes; só A1, A2, B1, B2, C e D têm colunas implementadas. |
| Agrupamento subterrâneo/espaçado | UE1 pp. 20-21 | Falta tabela/disposição; programa deixa seleção pendente em vez de inventar fator. |
| Resistividade térmica do solo | UE1 p. 21 | Valor é armazenado, mas não entra no fator. Alterar de 1 para 3 K·m/W produz o mesmo cálculo. A aplicabilidade depende da instalação descrita na referência. |
| Curto-circuito e seccionamento | UE1 p. 28 | Há comparação de capacidade de interrupção informada com Ik e coordenação nominal de sobrecarga, mas não verificação completa de energia passante, tempo, esquema de aterramento ou curva real. |
| Motor em kW mecânicos | UE1 pp. 15-16 | W/kW significam entrada elétrica; rendimento só é aplicado em CV/HP. A conversão de potência mecânica em kW precisa de um campo que indique a natureza da potência. Não se deve dividir por rendimento quando a potência já é de entrada. |
| Circuitos desequilibrados com neutro/harmônicas | UE1 pp. 14-16 | Um circuito `tri` é sempre equilibrado. O quadro soma circuitos por fase, mas isso não dimensiona um circuito trifásico desequilibrado nem seu neutro. |
| Restrições de uso do alumínio | UE2 p. 4, contexto residencial | O software permite alumínio sem classificar as condições de utilização. A existência de valores na tabela não autoriza seu uso em qualquer instalação. |

O programa informa várias dessas limitações. São funcionalidades ausentes, não campos que o usuário deixou de preencher.

## Percursos e apresentação dos resultados

O curso usa a corrente total e o maior percurso para consulta simplificada de queda. O exemplo soma 9 m na planta e duas subidas/descidas de 1,5 m, totalizando 12 m (UE2 pp. 15-16).

O VoltCalc oferece uma extensão desse procedimento: no percurso linear, cada trecho transporta a corrente das cargas a jusante; nos ramais independentes, cada percurso parte diretamente da proteção. Essa modelagem pode apresentar queda menor que concentrar toda a carga no ponto mais distante. A diferença não é, por si só, erro: depende da topologia declarada. Atualmente há seção e condições uniformes; não há rede com tronco comum e ramificações intermediárias.

Para alinhar a experiência ao curso:

1. Mostrar no preenchimento que a distância inclui subidas, descidas e desvios reais, sem somar os comprimentos de fase, neutro e PE.
2. Solicitar a quantidade de circuitos no trecho comum mais desfavorável, enquanto não houver cadastro de trechos.
3. Mostrar um memorial com `Ib → FCT/FCA → Ib' → Itab → Iz → queda → seção final` e referências identificadas.
4. Separar as seções de cada critério antes da escolha final. Hoje o programa exclui seções abaixo do mínimo antes de calcular `criteria` (`sizing.py:103`); por isso o exemplo mostra 1,5 mm² também em capacidade, enquanto a aula demonstra que 1 mm² suportaria a corrente, mas é descartado pelo mínimo de 1,5 mm². A decisão final coincide; a demonstração didática ainda difere.

## Luminotécnica

LUM pp. 14-22 descreve outro módulo, anterior ao dimensionamento elétrico das luminárias:

- definir iluminância e características do ambiente;
- escolher luminária e fluxo luminoso de catálogo;
- calcular `k = comprimento × largura / [altura útil × (comprimento + largura)]`;
- obter fator de utilização pela luminária, índice e refletâncias;
- definir fator de manutenção;
- calcular `fluxo total = área × iluminância / (Fu × Fm)`;
- determinar quantidade de luminárias e conferir distribuição, ofuscamento e reprodução de cores.

O VoltCalc recebe a quantidade e a potência das lâmpadas já escolhidas. Não calcula lux, lúmens, Fu, Fm, UGR ou distribuição luminosa. Isso é uma expansão de escopo: a futura luminotécnica pode alimentar os grupos de equipamentos do circuito.

Os valores de Fu do exemplo são de uma luminária/tabela específica; não devem virar uma tabela universal. A quantidade calculada precisa ser arredondada para cima e compatibilizada com a distribuição. O código “551” representa 50%, 50%, 10%; não equivale a usar refletâncias numéricas 5, 5, 1 nas fórmulas.

## Cuidados com a interpretação dos materiais

- **Alternativas não são gabarito:** em UE2 pp. 12-14, com três circuitos, 1.200 W/127 V e FCT 0,94/FCA 0,70, a corrente corrigida é 14,36 A. A opção 15,46 A não deve ser copiada como esperado. Em UE2 pp. 20-22, a primeira TUE resulta em 18,19 A corrigidos; a opção 19,7 A também não é a referência correta.
- **Precisão:** o exemplo usa 7,87 A arredondados e apresenta 11,96 A e 53,79 V/(A·km). Preservando precisão, obtêm-se 11,966589 A e 53,763333 V/(A·km). Essa pequena diferença é arredondamento, não falha do motor.
- **Desequilíbrio:** a expressão da UE1 p. 16 não deve ser generalizada como cálculo de todas as correntes de um sistema desequilibrado apenas a partir da potência total dividida por três. É necessário conhecer a distribuição por fase; a contagem térmica do neutro também depende das condições e harmônicas. Ver [Schneider: condutor neutro](https://www.electrical-installation.org/enwiki/Sizing_the_neutral_conductor). Não se deve mudar o programa para “quatro carregados sempre” apenas pela presença de neutro.
- **Edição:** os materiais de condutores referem-se à NBR 5410:2004; `data/nbr1997.json` identifica a base como 1997. O resultado da comparação numérica de parte das tabelas não autoriza trocar apenas o rótulo da edição. A migração exige revisão das regras, notas e referências completas. Esta análise não determina qual edição está vigente na data de um futuro projeto.

## Ordem de trabalho proposta

1. Corrigir a classificação/seção mínima dos circuitos de força e a verificação do limite terminal.
2. Validar queda por dados de cabo/fabricante, incluindo um teste com o caso de fronteira registrado.
3. Revisar a base normativa de forma rastreável, sem apenas renumerar tabelas.
4. Acrescentar neutro/PE e explicitar critérios ainda não verificados na proteção.
5. Evoluir o cadastro de trechos, agrupamentos e condições do solo.
6. Acrescentar luminotécnica como etapa opcional que gera cargas para os circuitos.

Reprodução: `python scripts/audit_senai.py --output docs/analysis/auditoria_senai.json`. O script registra o estado observado, inclusive divergências; não transforma essas divergências em comportamento correto nem substitui testes de aceitação de futuras correções.
