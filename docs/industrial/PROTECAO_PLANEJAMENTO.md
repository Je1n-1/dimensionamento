# Continuidade — preparação do módulo de proteção

07/11/2026. O usuário autorizou concluir a melhoria de vínculos e seguir o planejamento. O roteiro industrial original 0–11 já foi executado com ressalvas e continua intacto. Ele reserva proteção elétrica a módulo futuro; este documento define a continuidade, sem apresentar uma nova etapa numerada como parte do roteiro original.

## Estado verificado

Existem portas separadas `ProtectionService` em Python e JavaScript, mas sem implementação. O contrato v9 não possui cadastro completo de dispositivos de proteção. O dimensionamento atual fornece Ib e candidatos de capacidade, mas a análise de proteção deverá usar a **seção efetivamente adotada**, com capacidade corrigida correspondente a cada trecho. Não poderá usar a capacidade de um candidato diferente como se fosse a do cabo instalado.

## Ordem de implementação

1. **Contrato e cadastro de dispositivos por circuito:** fabricante/modelo/referência, função, dados nominais e ajustes aplicáveis, rastreabilidade e migração aditiva de projetos v9. Distinguir dispositivo único e conjunto de dispositivos com funções diferentes. Sem escolha definitiva automática a partir apenas da corrente de carga.
2. **Verificação de sobrecarga:** serviço Python isolado e regras identificadas por edição/fonte, com entradas necessárias e condições de aplicação verificadas. Resultados por critério, motivos e hipóteses. Tratar motores e combinações de dispositivos separadamente; não aplicar silenciosamente uma regra residencial.
3. **Curto-circuito:** registrar origem e ponto das correntes presumidas, grandezas de interrupção pertinentes ao dispositivo, atuação e solicitação térmica. Ausências ficam pendentes. Uma capacidade de interrupção isolada não comprova toda a proteção.
4. **Seccionamento e aterramento:** condições específicas de TN/TT/IT com dados do sistema, do percurso de falta e dos dispositivos. Cadastrar o esquema não significa verificá-lo.
5. **Partida, coordenação e seletividade:** incorporar curvas e documentos do fabricante quando disponíveis. Não inferir coordenação de uma letra de curva ou multiplicador genérico.
6. **Integração e regressão:** apresentação contextual nos circuitos, consolidação no relatório, exemplo didático específico e testes de limites, dados incompletos, revisões, backup e regressão residencial.

## Critérios de aceite do primeiro incremento funcional

- Entradas desconhecidas permanecem desconhecidas; nenhuma corrente de falta, curva, I²t, ajuste ou dispositivo é inventado.
- Regras novas exigem revisão das fontes normativas e de fabricante antes da implementação numérica. Fotografias de telas não são fonte normativa.
- Cada critério informa atendido/não atendido/pendente/não aplicável, referência, dados usados e motivo. Não há “Conforme” global enquanto existirem verificações obrigatórias ausentes.
- O serviço de condutores permanece independente. Resultado de proteção é invalidado se carga, seção adotada, trecho, condição ou dispositivo relevante mudar.
- Importação, duplicação e armazenamento preservam vínculos e isolam projetos antigos. Sugestões são editáveis e aplicadas explicitamente.

## Situação desta entrega

Preparação técnica e ordem de trabalho registradas. Nenhuma seleção ou verificação de proteção foi implementada neste bloco de UX/exemplo. O próximo incremento funcional começa pelo contrato/cadastro e verificação de sobrecarga com fontes revisadas; curto-circuito, seccionamento e partida não devem ser anunciados como concluídos por esse incremento.
