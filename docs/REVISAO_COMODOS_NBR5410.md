# Cadastro por cômodo e cobertura normativa

Revisão de 24/10/2026. Esta é uma análise de cobertura do software, não uma certificação ou auditoria integral de todos os requisitos da instalação.

## Documentos conferidos

- `C:/Users/jeanm/Downloads/NBR-5410.pdf`: ABNT NBR 5410:2004, versão corrigida em 17/03/2008. Previsão residencial: itens 9.5.2 e 9.5.3, páginas impressas 182–184 (190–192 do PDF). Páginas 191–192 também renderizadas e inspecionadas.
- `C:/Users/jeanm/Downloads/NBR5410 - Instalações Elétricas de Baixa Tensão.pdf`: edição de novembro de 1997, com comentários. Previsão de cargas: 4.2.1.2.2–4.2.1.2.4.
- O catálogo da ABNT consultado apresenta a edição 2004 corrigida 2008: https://abntcatalogo.com.br/ . O software não deve renomear suas tabelas de 1997 como se já fossem dessa edição.

Diferenças relevantes para a interface: 2004 distingue salas/dormitórios dos demais cômodos; explicita duas tomadas de corrente sobre a bancada da pia (podem estar no mesmo ponto); admite, sob condição de quantidade conjunta, uma redução opcional na atribuição de potência dos pontos em certos ambientes. A implementação nova usa a regra geral de três pontos de 600 VA, sem aplicar essa redução. As exceções construtivas não são aprovadas automaticamente.

## O que foi implementado

- Cadastro simultâneo de ambientes por lista, separado por vírgulas, ponto e vírgula ou linhas; nomes distintos para dormitórios/banheiros repetidos.
- Grade única com uso do ambiente, área, perímetro, quantidades, distância, ligação e fator de potência. Alternância entre incluir TUG, iluminação ou ambas.
- `voltcalc/calculations/residential.py`, via `POST /api/residential`: prévia residencial dos mínimos numéricos de 9.5.2 da edição 2004/2008. Dados ausentes ou contagem abaixo do mínimo bloqueiam a aplicação da prévia. Campos sem relevância para a modalidade selecionada não são exigidos.
- Potência de iluminação para dimensionamento separada da potência nominal das lâmpadas; potência de TUG em VA por ambiente. Uma placa com duas tomadas não equivale obrigatoriamente a dois pontos.
- Aplicação explícita em lote, editável no inventário. Reaplicar atualiza grupos gerados ainda não aplicados; não duplica nem sobrescreve cargas manuais ou circuitos salvos. Conflitos são informados.
- Potência total ou unitária e unidade W/VA preservadas no JSON e na proposta. Ao enviar ao motor, a potência total é dividida pela quantidade para não multiplicar a carga novamente.
- Cada grupo é inicialmente representado na distância informada. Distribuição espacial e percursos precisam ser ajustados no circuito; a grade não infere a planta da casa.

## Cobertura e lacunas do motor

| Tema | Situação | Referência para revisão da edição 2004/2008 |
|---|---|---|
| Quantidade e previsão de carga residencial | Prévia numérica implementada; posição, uso real e exceções pendentes | 9.5.2 |
| Divisão dos circuitos | Heurística editável: iluminação/TUG separados por ambiente; demais consumidores individuais. Não é uma validação integral da divisão | 4.2.5; 9.5.3 |
| Corrente, ampacidade, temperatura, agrupamento e seção | Calculados nos métodos já suportados, ainda com base de dados de 1997. Revisar tabelas e rastreabilidade antes de declarar migração | 6.2 |
| Queda de tensão | Percursos cadastrados; falta integrar alimentador e queda total desde a origem | 6.2.7 |
| Proteção de sobrecarga | Ib/In/Iz e I₂ sob hipóteses cadastradas; curvas e dados de fabricante incompletos | 5.3 |
| Curto-circuito | Verifica capacidade de interrupção contra Ik informado; não calcula Ik nem curto térmico completo | 5.3 |
| Choque e desligamento automático | Faltam esquema TT/TN/IT, impedância do laço, tempos e resistência de aterramento | 5.1 |
| DR e condições em banheiros | Avisos de conferência; faltam seleção, associação e volumes/localização na planta | 5.1.3.2; 9.1 |
| Neutro, PE, aterramento e equipotencialização | Sem dimensionamento completo ou validação de harmônicas | 6.2; 6.4 |
| DPS e surtos | Sem seleção/coordenação completa | 5.4; 6.3 |
| Polos, seccionamento e coordenação | Não validados integralmente; multiplicidade de fases não basta para selecionar um produto | 6.3; 9.5.4 |
| Influências externas, ocupação de condutos e serviços de segurança | Cobertura incompleta | 4; 6; 6.6 |
| Inspeção e ensaios finais | Não realizados pelo software; dependem da instalação e medições | 7 |

A lista é um mapa de lacunas, não substitui a conferência requisito por requisito da norma. A interface e o PDF exibem esse escopo em “O que o VoltCalc verifica — e o que ainda falta”. O indicador global permanece preliminar; contagens atendidas não são aprovação integral.

## Validação

80 testes Python (incluindo limites de área/perímetro, regras por uso, seleção parcial, entradas inválidas e VA chegando corretamente ao dimensionamento). Suítes JavaScript de modelo/JSON, grade, relatório, UX e aplicação em lote. Teste visual isolado na porta 8002: três cômodos adicionados juntos, prévia, seis grupos no inventário e proposta com as correntes esperadas. Projetos do usuário na porta 8000 preservados.
