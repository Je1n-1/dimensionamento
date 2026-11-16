# Exemplo completo: 9 cargas e 15.000 W

Atualizado em 07/11/2026. Substitui o exemplo anterior de seis registros, que deixava a ocupação pendente. Este é um exercício com hipóteses explícitas, sem declaração de conformidade integral.

## Abrir e reproduzir

No navegador usado nesta sessão, abra http://127.0.0.1:8000/industrial/ e selecione **Exemplo completo — 9 cargas · 15.000 W (importado)**. Os projetos anteriores foram preservados. Para outro navegador, importe `examples/industrial/exemplo_15000W.json` em Projetos → Importar projeto.

As entradas incluem um quadro, nove cargas unitárias, nove circuitos terminais, nove percursos independentes, nove eletrodutos e 27 condutores (fase, N e PE). Não são nove lâmpadas agrupadas em um único registro.

Use Calcular potências e correntes em Consumidores; Calcular condutores em Dimensionamento; Atualizar análises em Visão geral. Relatórios recalcula automaticamente. As análises detalhadas são recuperadas por recálculo; as entradas e resultados de corrente ficam salvos no navegador.

## Entradas e resultados

| Circuito | Fase | W | Distância m | Ib A | Fase/N/PE mm² | Queda % | Ocupação % |
|---|---|---:|---:|---:|---:|---:|---:|
| C-AQ-A | A + N | 2500 | 10 | 11.364 | 2.5/2.5/2.5 | 0.930 | 9.452 |
| C-AC-A | A + N | 1500 | 11 | 6.818 | 2.5/2.5/2.5 | 0.614 | 9.452 |
| C-IL-A | A + N | 1000 | 12 | 4.545 | 1.5/1.5/1.5 | 0.744 | 6.527 |
| C-AQ-B | B + N | 2500 | 11 | 11.364 | 2.5/2.5/2.5 | 1.023 | 9.452 |
| C-AC-B | B + N | 1500 | 12 | 6.818 | 2.5/2.5/2.5 | 0.669 | 9.452 |
| C-IL-B | B + N | 1000 | 13 | 4.545 | 1.5/1.5/1.5 | 0.806 | 6.527 |
| C-AQ-C | C + N | 2500 | 12 | 11.364 | 2.5/2.5/2.5 | 1.116 | 9.452 |
| C-AC-C | C + N | 1500 | 13 | 6.818 | 2.5/2.5/2.5 | 0.725 | 9.452 |
| C-IL-C | C + N | 1000 | 14 | 4.545 | 1.5/1.5/1.5 | 0.868 | 6.527 |

**Total: 15.000 W, 5.000 W por fase e 22,727 A por fase, com FP=1.** Maior queda: 1,1157%; maior ocupação: 9,451875%. Nenhum dado faltante nos serviços disponíveis. Status geral continua parcial, pois proteção e outras verificações não estão implementadas.

## Hipóteses e fontes

- Rede 380/220 V, 60 Hz; nove cargas fase-neutro de 220 V. Três aquecedores de 2.500 W, três de 1.500 W e três luminárias resistivas de 1.000 W. Quantidade 1 por registro. FP=1; sem motores, rendimento mecânico ou harmônicas.
- QD-DIDATICO é a origem de entrega BT assumida. Não há alimentador externo calculado. TN-S é hipótese de contexto, sem comprovação de aterramento.
- B1: condutores isolados em eletroduto na alvenaria; cobre, PVC/A 70 °C, ambiente 30 °C, sem radiação. Um circuito por eletroduto, dois condutores carregados e PE incluído. Fatores térmico e agrupamento = 1.
- Aquecedores: 2,5 mm²; iluminação: 1,5 mm². Seções adotadas iguais às sugeridas neste cenário; neutro e PE com a mesma seção.
- Diâmetros externos de 3,55 mm e 2,95 mm da página oficial Corfio, Cabo Flexível BWF 750 V: https://www.corfio.com.br/pt/produto/cabo-flexivel-bwf-750v (consulta 07/11/2026, sem edição declarada). Referência usada somente para geometria; não inventada como catálogo de impedância.
- Eletrodutos com **20 mm de diâmetro interno útil**, hipótese do exercício, não bitola comercial. Cada percurso interno tem 10 a 14 m, é retilíneo, sem curvas nem compartilhamento.
- R AC didática = 22,5/S ohm/km a 70 °C; X=0. Não representa medição nem valor de catálogo do fabricante.
- Perfil existente: limite total de queda 5% na origem de entrega BT e terminal 4%. Todas as quedas calculadas ficam abaixo de ambos.

## Cálculo explicado: AQ-C

Ib = 2.500 / (220 × 1) = 11,3636 A. Como Ft=Fg=1, a capacidade tabelada necessária é 11,3636 A. A análise seleciona 2,5 mm² pelos critérios implementados de capacidade e seção mínima; isso ainda não dimensiona disjuntor.

R = 22,5 / 2,5 = 9 ohm/km. ΔU = 2 × 12 × 11,3636 × 9 / 1.000 = 2,4545 V. ΔU% = 2,4545 / 220 × 100 = 1,1157%. O comprimento cadastrado é de ida; o fator 2 incorpora a volta pelo neutro.

Ocupação = 3 × (3,55 / 20)² × 100 = 9,451875%. As três envoltórias são fase, neutro e PE. O PE conta na ocupação, embora não seja condutor carregado para este cálculo térmico.

## Diagrama e entregas

- PDF didático: `output/pdf/voltcalc-15000w-9-cargas.pdf`, sete páginas, com diagrama legível, entradas, exemplo resolvido, tabelas e limites.
- Backup importável: `examples/industrial/exemplo_15000W.json`.
- CSV técnico: `examples/industrial/relatorio_15000W.csv`.
- Gerador: `examples/industrial/example_15kw.py`, funções `build_example`, `export_example` e `export_report`.

No diagrama, todos os nove circuitos partem do QD; a linha comum do desenho é uma convenção gráfica e não um eletroduto compartilhado. O mapa não é planta de locação nem projeto executivo.

## Limitações reais

Proteção, curto-circuito, coordenação, seccionamento automático, validação do aterramento e temperatura real do condutor não foram calculados. Não foram inventadas correntes de curto nem disjuntores para simular conclusão. Os dados do exercício completam os serviços existentes, sem antecipar o módulo futuro de proteção.

## Validação

230 testes Python e 19 suítes JavaScript; conferência de correntes, cabos, ocupação, queda, importação no navegador e leitura visual das sete páginas do PDF. Os 105 arquivos protegidos do residencial permanecem idênticos ao baseline. A suíte Python exige PYTHONIOENCODING=utf-8 e PYTHONUTF8=1 para o subprocesso de ajuda do servidor no Windows.
