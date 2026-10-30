# Etapa 7 — Infraestrutura e ocupação

28/10/2026. Árvore ativa: `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`.

## Entrega e escopo

Implementada a página de infraestrutura com dados reais de trechos/ramais, edição de dimensões e referências, cálculo geométrico em Python e memória contextual. O roteiro original foi preservado. Queda de tensão, mapa final, relatórios/exportações e validação final das etapas 8–11 não foram antecipados.

O estado **Geometria atende** refere-se somente aos critérios calculados daquela infraestrutura. Não é declaração de conformidade integral da instalação. Os demais estados são **Não calculado**, **Pendente** e **Revisar**.

## Funcionalidades

- Tabela por trecho com cargas atendidas, comprimento físico, método, temperatura, elementos físicos, condutores, seções adotadas, infraestrutura, dimensões úteis, área externa ocupada, taxa de ocupação e situação.
- Contagens obtidas da topologia: derivações retiram os cabos que deixam de percorrer o trecho. PE e neutro participam da ocupação; quantidade de consumidores não multiplica automaticamente a formação.
- Cabos unipolares/condutores isolados usam o diâmetro externo de cada função; multipolares usam uma única envoltória para o cabo completo, multiplicada pela quantidade física de cabos.
- Cadastro de diâmetro com fabricante, modelo, documento/página/URL e edição quando disponível. A referência é vinculada à seção, material, isolação, formação e funções cadastradas. Mudanças na construção exigem reconfirmação; não há conversão fictícia de seção de cobre em diâmetro externo.
- Eletrodutos: soma das áreas externas dividida pela área interna útil; limites de 53%, 31% e 40% para um, dois e três ou mais elementos físicos. Dimensões usadas e fonte são exibidas na memória.
- Diâmetro interno mínimo por ocupação e menor opção suficiente dentre diâmetros internos que o usuário informar com referência. Sugestão não é aplicada automaticamente e não equivale a tamanho nominal comercial.
- Percurso contínuo entre caixas/extremidades declarado separadamente do comprimento de um segmento. Verificação de comprimento máximo interno/externo, redução por curvas de 90° e quantidade de curvas, somente no escopo explicitamente confirmado.
- Eletrocalha, calha lisa, calha perfurada e leito: encaixe em camada única horizontal, espaçamento livre, largura/altura úteis e referência do critério de projeto/fabricante. Limite percentual adicional é opcional e identificado como critério declarado, nunca como limite universal da norma.
- Outros encaminhamentos podem ser identificados, mas ficam pendentes de modelo específico.
- Pendências explícitas para fontes ausentes, construção alterada, caminhos incompletos, múltiplos condutos sem repartição, seleção parcial de condutores, arranjos não implementados e candidatos insuficientes.
- Persistência das entradas no repositório industrial com revisão, conflitos e migração aditiva v2–v6 para v7. Análises são transitórias, vinculadas à revisão e recalculadas ao reabrir.
- Mudanças nos dados físicos invalidam resultados e limpam confirmações de método, agrupamento e escopo dos condutores. A invalidação é conservadora no projeto inteiro, sem tentar deduzir automaticamente novos fatores.

## Fonte e versão

Base: PDF `C:\Users\jeanm\Downloads\NBR-5410.pdf`, ABNT NBR 5410:2004, SHA-256 `b3dc538362dae43a5e07f9a6c6a341db7cf90ada2d072c4e39c04b3ee43495e3` (identificação preservada da auditoria anterior). Consultadas as páginas físicas 128–129, impressas 120–121, especialmente 6.2.11.1.6 e 6.2.11.1.7. A página da ocupação foi renderizada e conferida visualmente.

Regra isolada: `nbr5410-2004-infrastructure-1`, cobertura parcial. Nenhuma tabela residencial de 1997 foi reaproveitada. Os valores das imagens de referência não foram tratados como resultados validados.

Não foi incorporado um catálogo universal de dimensões. O usuário informa a referência aplicável ao produto utilizado; o sistema registra essa proveniência, mas não autentica o conteúdo do catálogo. Sem ela, o resultado permanece pendente. Os exemplos automatizados são identificados como dados sintéticos de QA e não são instalados no catálogo do usuário.

## Arquivos

Novos:

- `data/industrial/contracts.v7.json`: contrato aditivo de dimensões, referências, arranjos e condições do percurso contínuo.
- `voltcalc/industrial/infrastructure_rules.py`: regras geométricas versionadas.
- `voltcalc/industrial/infrastructure.py`: contagens, análise por trecho, referências de construção, invalidação e serviço HTTP.
- `frontend/industrial/js/infrastructure-view.js`: tabela, painel contextual, memória, formulários e leitura dos dados físicos.
- `frontend/industrial/js/infrastructure-controller.js`: análise, edição, salvamento e controle de respostas obsoletas.
- `tests/industrial/test_infrastructure.py`, `tests/industrial/infrastructure.test.mjs`, `tests/industrial/browser-infrastructure.cjs`: testes Python, integração JS/Python e navegação em perfil isolado.
- Este relatório e evidências de interface.

Modificados nesta etapa:

- `voltcalc/industrial/contracts.py`: contrato ativo v7.
- `voltcalc/web/api.py`, `voltcalc/web/assets.py`: rota `/api/industrial/infrastructure`, contrato e módulos publicados explicitamente.
- `frontend/industrial/js/core/migrations.js`, `core/services.js`: migração e cliente independente de infraestrutura.
- `frontend/industrial/js/app.js`, `pages.js`, `topology-view.js`: integração da página, versão e ligação contextual para ocupação.
- `frontend/industrial/css/industrial.css`: tabela, painel de diâmetros com rolagem local e formulários responsivos.
- Testes existentes de condutores, correntes, topologia, fluxo, lote de motores, estrutura HTTP e casos de contrato: atualização da referência ao contrato ativo, preservando testes dos contratos históricos.
- `docs/industrial/DECISOES_ARQUITETURAIS.md`, `PENDENCIAS.md`: decisões e limites.

Alterações anteriores da Etapa 6 e das revisões de cadastro foram preservadas, sem serem atribuídas a esta entrega.

## Testes e critérios de aceitação

- **177 testes Python aprovados**, incluindo regressão residencial, regras de infraestrutura, serviço e API HTTP.
- **14 suítes JavaScript aprovadas**, incluindo migração v2–v6, leitura/salvamento, duplicação, conflito de revisão, indisponibilidade do servidor, respostas obsoletas, contratos, escape de HTML e leitura dos formulários.
- Topologia com derivações: 12/8/4 unipolares, incluindo PE. Cenário multipolar em paralelo: 6/4/2 envoltórias, sem contar as veias novamente.
- Limites para 1/2/3+ elementos, igualdade no limite, diâmetro insuficiente, ausência de fonte, construção modificada, candidatos insuficientes, percurso contínuo, curvas, arranjo em camada única e ausência de limite universal de calhas.
- Operações inválidas recusadas sem mutação parcial; edição física invalida confirmações de condutores.
- Navegador em perfil efêmero separado: cálculo, alteração para diâmetro insuficiente, salvamento/reabertura, diâmetro ausente, recuperação do dado, mudança para leito e cancelamento.
- Desktop 1440 × 1000 e celular 390 × 844 sem transbordamento horizontal global; formulário móvel sem transbordamento interno. Nenhum erro JavaScript no cenário de interface.
- **105 arquivos protegidos do residencial e suporte inalterados**, por comparação SHA-256 com a linha de base existente.
- `git diff --check` sem erros de espaço em branco.

Comandos: `python -m unittest discover -s tests -q`; Node para as suítes `tests/**/*.test.mjs` e `tests/*.test.cjs`; `node tests/industrial/browser-infrastructure.cjs` com servidor QA na porta 8001. O teste de navegador usa Playwright do runtime local e Edge headless em perfil novo, sem acessar o navegador ou os projetos reais do usuário.

Logs: `tmp/industrial-stage7-python-tests.log`, `tmp/industrial-stage7-js-tests.json`, `tmp/industrial-stage7-browser-tests.json`.

Evidências: [desktop](evidencias/etapa07_infraestrutura_desktop.png), [formulário no celular](evidencias/etapa07_infraestrutura_mobile.png).

O perfil efêmero de QA foi encerrado e o servidor de teste da porta 8001 foi parado. A entrega está disponível em `http://127.0.0.1:8000/industrial/`; página, contrato v7 e API de infraestrutura responderam corretamente no servidor principal. O teste HTTP não persiste dados no servidor nem no navegador do usuário.

## Limitações e pendências

- Não há catálogo automático nem leitura automática de PDF. A referência dimensional deve ser informada para o produto efetivamente adotado, incluindo tolerância quando pertinente.
- Múltiplos condutos no mesmo trecho e repartição parcial de funções exigem modelo específico; não são somados como uma infraestrutura fictícia.
- Calhas/leitos: somente camada única horizontal. Camadas múltiplas, trifólios, disposição vertical, suportação/carga mecânica e outros arranjos continuam pendentes.
- Eletrodutos: percurso reto ou com curvas de 90° declaradas. Outros ângulos, exceção por aumento de tamanho nominal, raios de curvatura, deformação em curvas, caixas/acessibilidade, requisitos de produto, esforços mecânicos/químicos/térmicos e demais prescrições não são verificados automaticamente.
- Dimensão mínima é geométrica: não comprova facilidade de enfiação, margem de expansão, proteção, capacidade de corrente ou queda.
- Formação ou circuito inválido e condutor sem vínculo bloqueiam a ocupação; não se apresenta uma soma aparentemente completa que omita esses elementos.
- Análises detalhadas não são gravadas como resultados finais. Consolidação/exportação permanece na Etapa 10.

**Etapa 7 concluída no escopo parcial documentado, com pendências explícitas. Etapa 8 não iniciada.**
