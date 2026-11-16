# VoltCalc — versão Python · cargas e explicações v3

Servidor local e motor de dimensionamento em **Python 3.10 ou superior**, usando somente a biblioteca padrão. Não é necessário instalar pacotes com pip. A interface continua em HTML/CSS/JavaScript e solicita os resultados ao Python.

## Iniciar no Windows

Dê dois cliques em **Iniciar_VoltCalc.bat**, ou execute nesta pasta:

```powershell
python server.py --open
```

O site abre em http://127.0.0.1:8000/. Mantenha o terminal aberto durante o uso. Para encerrar, pressione Ctrl+C. Se a porta estiver ocupada, use `python server.py --port 8001 --open`.

Abrir o HTML diretamente não executa o motor Python. Os HTMLs das distribuições anteriores ficam em `archive/`; use o atalho na raiz ou o comando acima. Esta distribuição é para uso local, não para publicar diretamente na internet.

## Organização dos arquivos

- `voltcalc/calculations/`: cálculos elétricos, fatores, seleção e validação.
- `voltcalc/importers/`: leitura e validação de CSV.
- `voltcalc/web/`: servidor HTTP, rotas da API e lista de arquivos públicos.
- `frontend/`: HTML, estilos, imagens e módulos JavaScript separados em `core/`, `views/` e `features/`.
- `data/` e `examples/`: tabelas históricas e arquivos de exemplo.
- `tests/`: testes automatizados; `scripts/`: ferramentas de auditoria.
- `docs/`: documentação, análises e capturas de tela.
- `archive/`: versões anteriores preservadas, sem participação no site ativo.
- `server.py`, `engine.py` e `Iniciar_VoltCalc.bat`: entradas compatíveis mantidas na raiz.

Consulte [o mapa de pastas e funções](docs/ARCHITECTURE.md) para localizar cada responsabilidade. O servidor continua gerando `/tables.js` a partir de `data/nbr1997.json`. Também é possível iniciar com `python -m voltcalc --open`.

## Mudanças nesta versão

- Etapas curtas: Circuito, Grandezas, Instalação, Agrupamento, Condições e Resultado.
- Até 100 grupos de equipamentos por circuito, com quantidade, potência, unidade, FP e distância próprios. Cada grupo representa equipamentos na mesma posição.
- Alimentação da instalação definida no projeto; ligação fase–neutro, fase–fase ou trifásica equilibrada definida por circuito. Tensão automática pela rede ou manual.
- Percurso compartilhado em sequência ou ramais independentes desde o quadro. A tabela de resultados mostra corrente e queda por trecho e queda por grupo.
- Sugestão de disjuntor ou verificação de corrente nominal informada. A seção é selecionada considerando a proteção escolhida; um nominal inferior à corrente da carga é explicitamente incompatível.
- Explicações físicas nas ajudas, incluindo parede, agrupamento, condutores carregados, distâncias, I₂/In, curva e capacidade de interrupção.
- O resultado mostra Ib / (FCT × FCA), capacidade corrigida e critérios que determinaram a seção. O memorial inclui cargas, percurso e hipóteses.
- Backup v3 inclui alimentação, grupos, distâncias, rascunho e vínculo de edição. Importa v2 preservando tensão, distância, limite e carregados antigos. Ligação monofásica ambígua fica identificada como “a confirmar”. O armazenamento v2 é mantido separado do v3.

Conversão Python anterior:

- Matemática e seleção de seção/disjuntor transferidas para o Python; a interface não contém um motor alternativo de cálculo.
- Validação de I₂/In, números finitos e coerência de trifásico com três condutores carregados.
- Backup restaura a reatância; rascunho preserva o vínculo com o circuito em edição após recarregar.
- Atualização dos valores derivados de corrente e agrupamento após respostas do servidor.
- Indicação de indisponibilidade do servidor, sem mostrar um resultado anterior como se fosse atual.

## Projetos e backups

Os projetos ainda ficam no armazenamento local do navegador, não em banco de dados Python. Exporte backups JSON pelas Configurações. Um projeto salvo anteriormente por abertura direta do HTML não é transferido automaticamente para o endereço local: exporte o JSON na versão original e importe no site Python. Mudar de navegador, de `localhost` para `127.0.0.1` ou de porta também muda a origem do armazenamento.

## Testes

```powershell
python -m unittest discover -s tests -v
```

Os testes Python incluem casos analíticos de queda por trecho, cargas com fatores de potência diferentes, ligações, disjuntor informado, quadro por fase, importação CSV, API e compatibilidade com o motor anterior. Para os testes adicionais de migração, backups e preservação dos dados importados, com Node.js instalado: `node tests/model.test.cjs`.

## Quadro de cargas e CSV

Em **Quadro de cargas**, cada circuito apresenta ligação, tensão, VA, W, FP, fases, corrente e disjuntor informado ou sugerido. Os cartões mostram potência atribuída e corrente por fase R/S/T (equivalentes a A/B/C), maior corrente e diferença entre maior e menor. A tabela detalhada mostra a contribuição de cada circuito. O quadro também integra o memorial imprimível.

- `voltcalc/calculations/panel.py`: resumo elétrico do projeto, calculado em Python, sem depender dos dados térmicos ou das distâncias que ainda faltam.
- `voltcalc/importers/csv_import.py`: leitura e conferência do modelo CSV; `examples/residencia.csv` preserva o exemplo fornecido com oito circuitos.
- `frontend/js/board.js`: apresentação do quadro, sem fórmulas elétricas.
- `/api/panel`, `/api/import-csv` e `/api/example`: endpoints locais de resumo, prévia de importação e exemplo.

Use **Importar CSV** ou **Exemplo de 8 circuitos**. A prévia mostra os circuitos e divergências antes de abrir um novo projeto. O projeto anterior fica no armazenamento local para restauração; a próxima importação substitui essa cópia de restauração. Exporte JSON para arquivamento permanente. O CSV permanece um registro de origem e não acompanha mudanças posteriores no editor.

O importador aceita o cabeçalho do exemplo, delimitador ponto e vírgula, decimais com vírgula, UTF-8 ou Windows-1252 e uma única linha TOTAL, com esquema 3F+N+PE e rede 127/220 ou 220/380 V. O TOTAL não vira um circuito. Fase–neutro, fase–fase e trifásico equilibrado são reconhecidos conforme esquema/fases/tensão; arquivos com dados essenciais inválidos são recusados. Não importa `.xlsx` diretamente.

W/VA determina o FP do grupo agregado. Quantidade 1 representa o total cadastrado, não um equipamento físico. Distâncias, condições de instalação e parâmetros de proteção ausentes ficam vazios, sem seção ou queda fictícias. O circuito importado pode ser salvo ainda incompleto. Os nominais de disjuntores são escolhas informadas. O disjuntor do TOTAL fica apenas no registro original, sem dimensionamento do alimentador.

O quadro considera todas as cargas simultâneas e tensões nominais, sequência R/S/T a 120°, FP indutivo e soma fasorial das correntes. Em fase–fase, o rateio de W entre duas fases é uma convenção cadastral (50% em cada), e a corrente inteira percorre ambas. Em trifásico, cada carga é equilibrada. A “soma dos VA” é a soma cadastral dos circuitos, não necessariamente a potência aparente resultante. Nenhuma corrente incompleta é tratada como zero: se faltar grandeza, fase ou ligação de um circuito, os totais ficam indisponíveis. Tensões manuais incompatíveis com a rede também bloqueiam a composição.

Não há aplicação de demanda, balanceamento automático, dimensionamento de alimentador/neutro, harmônicas ou cálculo de desequilíbrio de tensão. A diferença entre fases é informativa e não presume limite de aceitação. Fundamentos: [potência aparente instalada](https://www.electrical-installation.org/enwiki/Installed_apparent_power_%28kVA%29), [fator de potência](https://www.electrical-installation.org/enwiki/Definition_of_Power_Factor), Schneider Electric.

## Condições do novo modelo de cargas

Todos os equipamentos são considerados simultâneos. O motor soma P e Q sob a aproximação de FP = cos φ indutivo, calcula a potência aparente resultante e a corrente na tensão nominal. Cargas capacitivas, harmônicas e desequilíbrio não são modelados. Cada grupo trifásico deve representar potência total equilibrada nas três fases.

Na opção em sequência, as distâncias são posições de ida medidas desde o quadro ao longo do mesmo caminho, não comprimentos de trechos somados entre si. O motor ordena os pontos e usa as cargas a jusante em cada trecho. Na opção de ramais independentes, cada grupo sai diretamente do quadro, sem um tronco compartilhado. Redes com ramificações intermediárias ou malhas não estão representadas por essas duas opções.

A seção, material, isolação e condições térmicas são uniformes em todo o circuito. A corrente total e a proteção comum orientam a seleção, inclusive nos ramais independentes. O modelo estima queda na tensão nominal, sem fluxo de carga iterativo e sem a queda anterior ao quadro. O limite inicial de 4% é configurável e não representa uma regra normativa universal.

As designações de fases A/B/C (R/S/T) alimentam o quadro de distribuição, sem balanceamento automático. Material do eletroduto, curva do disjuntor e parâmetros de solo são registros sem verificação completa associada.

Fundamentos consultados para fórmulas e explicações: [queda de tensão](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions), [dimensionamento e agrupamento](https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing) e [seleção de proteção](https://www.electrical-installation.org/enwiki/Selection_of_a_circuit-breaker), Schneider Electric. Essas referências conceituais não atualizam a base histórica fornecida.

## Escopo técnico

Mantém a base histórica NBR 5410:1997 e o pré-dimensionamento parcial da versão fornecida. A conversão não atualiza ou certifica a base normativa. Métodos não cobertos, proteção completa, neutro/PE, DR/DPS, partida, seletividade e correções específicas de solo continuam fora do motor implementado. Catálogos de fabricantes ainda não foram incluídos.
# Edição técnica em grade

O modo técnico apresenta uma linha por circuito e três abas: Cargas, Instalação e Condições e proteção. As alterações da grade e dos seus detalhes são gravadas automaticamente no navegador e recalculadas no servidor Python. O modo guiado continua usando o mesmo cadastro; ao voltar à grade, o rascunho em edição é incorporado ao projeto.

- Cole células do Excel como texto tabulado, sem cabeçalho, começando na coluna desejada. Use vírgula ou ponto decimal, sem separador de milhar. As colunas e opções devem corresponder à aba exibida. Uma colagem inválida não é aplicada parcialmente.
- Tab avança entre controles e Enter desce na mesma coluna. A colagem pode criar novas linhas, até o limite de 300 circuitos.
- Circuitos com vários grupos são editados em **Detalhes → Grandezas**. A colagem na grade não substitui esses grupos por uma carga única.
- Selecione linhas para duplicar ou aplicar condições. A janela de aplicação mostra o circuito de origem e permite marcar os campos que serão substituídos.
- O Python retorna diagnósticos associados a campos e etapas. Campos inválidos aparecem destacados; limitações de tabelas e verificações de interrupção ficam explícitas antes do resultado.
- Resultados continuam preliminares, com a base histórica e as limitações já documentadas. A corrente nominal sugerida não representa verificação completa do dispositivo.

Verificação adicional: `node tests/grid.test.cjs` testa a colagem, proteção de múltiplos grupos, limites e preservação no backup. `tests/test_validation.py` cobre a associação das pendências aos campos.

## Correções térmicas e explicação dos bloqueios

Temperaturas intermediárias dentro da faixa implementada usam a próxima entrada superior da tabela, preservando o valor informado. Exemplo: 34 °C utiliza o fator de 35 °C. É uma política conservadora explícita do programa, sem interpolação e sem extrapolação; não é apresentada como uma nova regra normativa. A API registra a temperatura informada, a adotada, o fator, o ambiente e a referência em `corrections.temperature`. Os testes verificam todos os intervalos das tabelas de ar/solo e PVC/EPR/XLPE.

O fator de agrupamento continua automático nas condições cobertas. Dois ou mais circuitos enterrados exigem tabela específica ainda não implementada. Essa limitação é exibida em Agrupamento e no resultado, sem aplicar indevidamente o fator de feixe no ar. Grupos de equipamentos do mesmo circuito não incrementam automaticamente o número de circuitos agrupados.

`selectionBlockers` separa impedimentos à seleção das verificações complementares (por exemplo, interrupção do disjuntor). A tela mostra os valores calculados, o motivo do bloqueio e um botão que leva à etapa correspondente. Distâncias e topologia do percurso são editadas em Grandezas; Condições apresenta um resumo e um atalho para edição. A capacidade tabelada necessária é identificada como capacidade do cabo.

Teste de regressão: 1.700 W, 220 V, PVC, 34 °C, dois grupos a 50 m e 15 m. Dois circuitos enterrados deixam somente o agrupamento como bloqueio; um único circuito permite seleção preliminar com o fator térmico de 35 °C. Ver `tests/test_corrections.py`.
