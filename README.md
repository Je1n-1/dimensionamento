# VoltCalc — versão Python · cargas e explicações v3

Servidor local e motor de dimensionamento em **Python 3.10 ou superior**, usando somente a biblioteca padrão. Não é necessário instalar pacotes com pip. A interface continua em HTML/CSS/JavaScript e solicita os resultados ao Python.

## Iniciar no Windows

Dê dois cliques em **Iniciar_VoltCalc.bat**, ou execute nesta pasta:

```powershell
python server.py --open
```

O site abre em http://127.0.0.1:8000/. Mantenha o terminal aberto durante o uso. Para encerrar, pressione Ctrl+C. Se a porta estiver ocupada, use `python server.py --port 8001 --open`.

Abrir o HTML diretamente não executa o motor Python. O arquivo `VoltCalc_Guiado_Abrir.html` agora explica como iniciar o servidor. Esta distribuição é para uso local, não para publicar diretamente na internet.

## Arquivos

- `server.py`: servidor HTTP local, arquivos da interface e API `/api/calculate`.
- `engine.py`: entrada compatível do motor Python.
- `circuits.py`: cargas diferentes, ligação, potência ativa/reativa e percursos.
- `sizing.py`: fatores, seleção de seção/disjuntor e explicação dos critérios.
- `data/nbr1997.json`: base histórica de tabelas, carregada pelo Python e fornecida à interface para consulta.
- `VoltCalc_Guiado/ui.js`: interface conectada ao Python; `model.js` mantém dados e migra backups; `help.js` contém as explicações dos pontos de interrogação.
- `VoltCalc_Guiado/illustrations.js` e `updates.css`: ilustrações e ajustes visuais. O antigo `app.js` não é mais carregado nem servido.
- `original_html/`: cópia preservada da versão anterior, com cálculo em JavaScript.
- `tests/test_engine.py`: testes de cálculo, entradas inválidas e API.
- `ANALISE.md` e `evidencias.json`: análise e evidências da **versão original**, anteriores a esta conversão.

O arquivo `VoltCalc_Guiado/tables.js` é uma cópia legada. O servidor gera a rota `/tables.js` a partir de `data/nbr1997.json`, que é a fonte usada pela versão Python.

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

São 28 testes Python, incluindo os casos analíticos de queda por trecho, cargas com fatores de potência diferentes, ligações, disjuntor informado e compatibilidade com o motor anterior. Para o teste adicional do modelo de dados e migração de backups, com Node.js instalado: `node tests/model.test.cjs`.

## Condições do novo modelo de cargas

Todos os equipamentos são considerados simultâneos. O motor soma P e Q sob a aproximação de FP = cos φ indutivo, calcula a potência aparente resultante e a corrente na tensão nominal. Cargas capacitivas, harmônicas e desequilíbrio não são modelados. Cada grupo trifásico deve representar potência total equilibrada nas três fases.

Na opção em sequência, as distâncias são posições de ida medidas desde o quadro ao longo do mesmo caminho, não comprimentos de trechos somados entre si. O motor ordena os pontos e usa as cargas a jusante em cada trecho. Na opção de ramais independentes, cada grupo sai diretamente do quadro, sem um tronco compartilhado. Redes com ramificações intermediárias ou malhas não estão representadas por essas duas opções.

A seção, material, isolação e condições térmicas são uniformes em todo o circuito. A corrente total e a proteção comum orientam a seleção, inclusive nos ramais independentes. O modelo estima queda na tensão nominal, sem fluxo de carga iterativo e sem a queda anterior ao quadro. O limite inicial de 4% é configurável e não representa uma regra normativa universal.

As designações de fases A/B/C não executam balanceamento automático dos circuitos do projeto. Material do eletroduto, curva do disjuntor e parâmetros de solo são registros sem verificação completa associada.

Fundamentos consultados para fórmulas e explicações: [queda de tensão](https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions), [dimensionamento e agrupamento](https://www.electrical-installation.org/enwiki/General_method_for_cable_sizing) e [seleção de proteção](https://www.electrical-installation.org/enwiki/Selection_of_a_circuit-breaker), Schneider Electric. Essas referências conceituais não atualizam a base histórica fornecida.

## Escopo técnico

Mantém a base histórica NBR 5410:1997 e o pré-dimensionamento parcial da versão fornecida. A conversão não atualiza ou certifica a base normativa. Métodos não cobertos, proteção completa, neutro/PE, DR/DPS, partida, seletividade e correções específicas de solo continuam fora do motor implementado. Catálogos de fabricantes ainda não foram incluídos.
