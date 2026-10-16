# VoltCalc — versão Python

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
- `engine.py`: conversões, corrente, correções, queda, seleção e validações.
- `data/nbr1997.json`: base histórica de tabelas, carregada pelo Python e fornecida à interface para consulta.
- `VoltCalc_Guiado/`: interface conectada ao Python.
- `original_html/`: cópia preservada da versão anterior, com cálculo em JavaScript.
- `tests/test_engine.py`: testes de cálculo, entradas inválidas e API.
- `ANALISE.md` e `evidencias.json`: análise e evidências da **versão original**, anteriores a esta conversão.

O arquivo `VoltCalc_Guiado/tables.js` é uma cópia legada. O servidor gera a rota `/tables.js` a partir de `data/nbr1997.json`, que é a fonte usada pela versão Python.

## Mudanças nesta versão

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

## Escopo técnico

Mantém a base histórica NBR 5410:1997 e o pré-dimensionamento parcial da versão fornecida. A conversão não atualiza ou certifica a base normativa. Métodos não cobertos, proteção completa, neutro/PE, DR/DPS, partida, seletividade e correções específicas de solo continuam fora do motor implementado. Catálogos de fabricantes ainda não foram incluídos.
