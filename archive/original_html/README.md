# VoltCalc Guiado — MVP acadêmico

Aplicativo web offline com modo guiado ilustrado (6 etapas) e modo técnico, baseado no layout aprovado. Para usar, abra **index.html** em um navegador moderno com os arquivos `styles.css`, `tables.js` e `app.js` na mesma pasta. Não é necessário instalar nada.

## Recursos

- Seleção visual do tipo de carga e instalação com ilustrações SVG incorporadas ao aplicativo.
- Explicações de método de instalação, isolação, agrupamento, temperatura, tensão e queda de tensão.
- Cadastro, edição, duplicação, exclusão, salvamento local e backup JSON de circuitos.
- Cálculo de potência aparente/corrente monofásica e trifásica equilibrada.
- Consulta histórica às tabelas 31 e 32 (PVC, EPR/XLPE), correção por temperatura 35 e agrupamento 37, **item 1**, da **NBR 5410:1997** fornecida.
- Seleção **preliminar** de bitola e disjuntor para A1, A2, B1, B2, C e D nas condições cobertas pelo conjunto de dados; estimativa de queda de tensão.
- Quadro de cargas, resumo de dimensionamento, proteção, queda de tensão e relatório imprimível (botão *Exportar PDF* → *Salvar como PDF* do navegador).

## Cuidados

**Não é um software certificado, nem valida a segurança ou conformidade total da instalação.** A edição NBR 5410:1997 é histórica e não deve ser tratada como a edição vigente. Faltam tabelas E/F/G, agrupamentos especiais, aterramento, cabos PE/neutro, DR/DPS, partida de motores, curto-circuito térmico, seccionamento automático, seletividade e dados de fabricante. Os dispositivos de proteção são **somente nominais preliminares** com relação I₂/In presumida, não com curva/capacidade validada. Para método D, resistividade/profundidade necessitam verificação separada. Queda de tensão é estimativa simplificada. Não converta as imagens em identificação inequívoca do método sem confirmar dados da instalação. Nenhum estado da interface afirma que o projeto está aprovado.

## Arquivos

- `index.html` — estrutura do painel
- `styles.css` — apresentação responsiva
- `app.js` — navegação, cadastro, cálculos e relatórios
- `tables.js` — tabelas históricas do PDF usado como base didática
- `VoltCalc_Guiado_Abrir.html` — versão única, executável diretamente no navegador (gerada no pacote)

A versão HTML única contém tudo para rodar offline. Projetos ficam no `localStorage` do navegador; faça exportação JSON para backups.
