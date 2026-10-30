# Cadastro individual de vários motores

27/10/2026 — melhoria do cadastro existente, sem antecipar etapas do roteiro.

## Comportamento

- Tipo Motor, quantidade 1: formulário anterior, sem cartões adicionais.
- Quantidade de 2 a 150: cartões individuais com tags sugeridas sem colisões. Cada cartão possui potência/unidade, distância/base, descrição, trecho e corrente de placa. Outras características permitem diferenças elétricas, de motor e instalação.
- Ajuste de apresentação aprovado pelo usuário: potência/unidade/base, tensão, frequência, ligação, fases, fator de potência, rendimento e corrente de placa ficam visíveis diretamente em “Dados elétricos deste motor”. O percurso tem grupo próprio. Polos, fator de serviço, fonte de corrente e condições adicionais permanecem em “Outras características”. Formulário de um motor e regras de herança/salvamento inalterados.
- Campos individuais vazios usam os dados comuns, identificados nos títulos do formulário. Selecionar unidade individual sugere a base da potência; ligação não é inferida da tensão.
- Os campos individuais vazios mostram `Comum: valor` como exemplo no campo ou opção do seletor. Esse texto não é gravado como entrada individual; continua acompanhando alterações dos dados comuns. Fases incompatíveis com a ligação efetiva são sinalizadas antes de salvar. Uma seleção existente incompatível é conservada para correção, nunca omitida silenciosamente do formulário.
- Salvar N motores valida todos e persiste uma única alteração do projeto com N consumidores de quantidade 1, cada um com seu registro Motor e IDs próprios. Tags duplicadas ou dados inválidos impedem todo o salvamento, indicando o cartão problemático.
- Reduzir a quantidade ignora os cartões excedentes no salvamento, mas conserva seus rascunhos na janela para um eventual aumento posterior. Voltar a 1 restaura a apresentação anterior.
- Dividir um registro existente sem vínculos mantém a identidade do primeiro motor. Registros vinculados à estrutura não são divididos automaticamente. Resultados são invalidados; confirmações nominais devem ser revistas individualmente. Nenhum circuito, seção ou proteção é criado por esta operação.

## Arquivos

- `frontend/industrial/js/core/consumers.js`: validação e composição atômica do lote.
- `frontend/industrial/js/consumers-controller.js`: quantidade dinâmica, preservação dos cartões, leitura dos dados comuns/individuais e salvamento único.
- `frontend/industrial/js/consumers-view.js`: cartões e identificação dos dados comuns.
- `frontend/industrial/css/industrial.css`: estilos dos cartões e altura legível dos seletores.
- `tests/industrial/motor-batch.test.mjs`: identidades, herança, diferenças individuais, rejeições atômicas, vínculos e formulário singular.

## Verificação

158 testes Python e 13 suítes JavaScript aprovados. No navegador: quantidade 1 sem seção adicional; 3 cartões; redução para 1 e retorno a 3 preservando potência individual; rejeição de tag repetida; salvamento de M1/M2/M3 como três registros de quantidade 1, com 10/20/10 cv e 10/35/10 m. Recarregamento preservou os três registros. Cancelar rascunho não cria novos consumidores.

Dados de teste em projeto separado de QA; nenhum dado do usuário foi alterado. Evidência: [cartões individuais](evidencias/ux_motores_individuais.png).

Limite atual: campos em branco herdam o valor comum; para um dado desconhecido em parte dos motores, deixe o comum vazio e informe apenas nos cartões conhecidos. Depois do lote, cada motor pode ser editado pelo formulário completo, inclusive catálogo e condições específicas.

### Verificação complementar — 28/10/2026

As suítes `motor-batch`, `consumers` e `workflow` foram executadas novamente e aprovadas após os ajustes de indicação dos valores comuns. No navegador, alterar a tensão comum de 380 para 440 V preservou a tensão individual de 220 V; o segundo cartão permaneceu sem sobrescrita individual, exibindo a nova referência comum. Ligação e fases incompatíveis apresentaram erro antes de salvar, preservando a escolha existente para correção.

A apresentação foi conferida em viewport de 390 × 844, sem transbordamento horizontal e sem erros no console. O rascunho foi cancelado ao concluir a verificação. Evidências: [valores comuns no desktop](evidencias/ux_motor_valores_comuns.png) e [cartões no celular](evidencias/ux_motor_valores_comuns_mobile.png).
