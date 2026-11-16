# Etapa 2 — Gerenciamento de projetos industriais

## Conclusão

Etapa 2 concluída na árvore ativa `C:/Users/jeanm/OneDrive/Desktop/dimensionamento`. A entrega implementa gerenciamento e persistência de múltiplos projetos sobre a estrutura da Etapa 1. O roteiro original de 0 a 11 permanece preservado. A Etapa 3 não foi iniciada.

Aplicação: http://127.0.0.1:8000/industrial/#/projetos

## Funcionalidades implementadas

- Criar projeto com nome obrigatório, descrição e status administrativo; editar esses dados em modal.
- Salvar e reabrir o objeto completo do projeto, restaurando a seleção após recarregar a página. Fechar o projeto sem apagá-lo.
- Listar projetos em cartões e tabela; buscar por nome/descrição, filtrar por status e ordenar por nome ou última edição.
- Mostrar datas de criação/edição no modelo, última edição na interface e etapa atual, sem transformar navegação em conclusão de etapa.
- Duplicar com novos identificadores para projeto e entidades, remapeando referências internas. A cópia é independente e seus resultados são invalidados.
- Excluir mediante confirmação nominal, com foco inicial em cancelar e cancelamento por Escape. A exclusão preserva os outros projetos.
- Detectar conflito entre abas por revisão de gravação. Uma edição antiga não sobrescreve a mais recente e o formulário mantém o texto digitado quando ocorre erro.
- Informar falhas de leitura, quota/gravação, confirmação da gravação, formato inválido e indisponibilidade de bloqueio entre abas. Conteúdo inválido é preservado e não substituído por catálogo vazio.

A interface usa dados reais do catálogo. Os contadores vazios são zero; potência e cálculos permanecem não calculados. Os status “Em edição”, “Ativo” e “Arquivado” são administrativos, sem indicar conformidade elétrica.

## Persistência e contratos

Foi implementado um adaptador local de `ProjectRepository`, usando `localStorage` no namespace exclusivo `voltcalc_industrial_projects_v1`. O catálogo e a seleção são gravados em um único envelope, com Web Locks para serializar alterações entre abas, revisão esperada e leitura de confirmação. Não há acesso às chaves de armazenamento residencial.

O contrato ativo é `contracts.v2.json`/`schemaVersion: 2`, com `storageRevision`, `workflowStatus` e `currentStage`. `revision` continua representando entradas elétricas; a revisão de gravação é independente. O contrato v1 foi preservado. Não existia persistência industrial na Etapa 1; versões desconhecidas são recusadas sem migração destrutiva.

O repositório armazena os modelos completos já definidos para consumidores, parâmetros, circuitos, nós, trechos, resultados, pendências e configurações. Essa recuperação foi verificada com objetos de teste completos. Isso não implementa os formulários ou algoritmos das próximas etapas. O store continua invalidando resultados incompatíveis com revisão ou versões atuais.

As portas de condutores e proteção seguem separadas. A referência industrial continua `nbr-5410-2004`, versão `2004-unimplemented-v1`, sem tabelas implementadas e sem reaproveitamento silencioso da base residencial de 1997.

## Arquivos criados

- `data/industrial/contracts.v2.json` — contrato de persistência e campos administrativos.
- `frontend/industrial/js/core/local-repository.js` — armazenamento, concorrência, duplicação e validação de catálogo.
- `frontend/industrial/js/projects-controller.js` — operações, formulários, confirmação e tratamento de erros.
- `frontend/industrial/js/projects-view.js` — cartões, tabela, filtros e estados do catálogo.
- `tests/industrial/repository.test.mjs` — testes do adaptador e seus cenários de falha/isolamento.
- `docs/industrial/ETAPA_02.md` — este relatório.
- `docs/industrial/evidencias/etapa02_*.png` — evidências visuais descritas abaixo.

## Arquivos modificados

| Arquivo | Alteração |
| --- | --- |
| `frontend/industrial/js/app.js` | Integração do repositório, restauração, salvamento, eventos entre abas e atualização dos filtros sem perder foco |
| `frontend/industrial/js/pages.js` | Página de projetos real e disponibilidade explícita das funções futuras |
| `frontend/industrial/js/components.js` | Ícones de ações e métricas com valores reais |
| `frontend/industrial/js/core/repository.js` | Contrato de seleção persistida e revisão esperada |
| `frontend/industrial/js/core/state.js` | Limpeza da seleção em memória |
| `frontend/industrial/css/industrial.css` | Cartões, tabela, filtros, formulários e adaptação mobile |
| `voltcalc/industrial/contracts.py` | Carregamento do contrato v2 |
| `voltcalc/web/assets.py` | Permissão para servir os novos arquivos industriais e o contrato v2 |
| `tests/industrial/test_structure.py` | Verificação do contrato público v2 |
| `tests/industrial/contract_cases.json` | Atualização do caso de versão futura incompatível |
| `docs/industrial/DECISOES_ARQUITETURAIS.md` | Decisões DA-13 a DA-16 |
| `docs/industrial/PENDENCIAS.md` | Encerramento dos itens de Etapa 2 e acompanhamento das limitações |

## Testes e verificações

### Regressão automatizada

- `python -m unittest discover -s tests -q`: **87 testes aprovados** (80 residenciais e 7 da estrutura industrial).
- **7 suítes JavaScript aprovadas**: `grid.test.cjs`, `model.test.cjs`, `report.test.mjs`, `rooms.test.mjs`, `ux.test.mjs`, `industrial/structure.test.mjs` e `industrial/repository.test.mjs`, todas em `tests/`.
- O teste de repositório cobre criação, gravação, edição, datas, seleção, fechamento/reabertura com nova instância, recuperação completa, duplicação/remapeamento, isolamento, busca/filtros/ordenação, exclusão e conflito de revisão.
- Falhas simuladas: quota, acesso ao armazenamento, gravação não confirmada, catálogo corrompido, versão desconhecida, seleção inválida, ausência de Web Locks e nome vazio. Inclui criação concorrente e preservação da chave residencial de controle.
- Comparação SHA-256 dos **106 arquivos da linha de base protegida**: nenhuma alteração. O registro está em `tmp/industrial_stage2_baseline.json`. A lista exclui arquivos industriais, temporários e a integração autorizada em `voltcalc/web/assets.py`.
- `git diff --check -- voltcalc/web/assets.py`: sem erro de whitespace.

### Verificação no navegador

Executada em origem separada `http://127.0.0.1:8001`, com projetos de QA criados exclusivamente para o teste:

1. Criar, salvar, fechar, reabrir e recarregar a página, preservando os dados e a seleção.
2. Criar segundo projeto sem alterar o primeiro; duplicar e conferir sua presença independente.
3. Digitar busca continuamente, filtrar status e selecionar ordenação por nome.
4. Editar o mesmo projeto em duas abas: a primeira gravação foi preservada; a gravação com revisão antiga foi recusada e o rascunho permaneceu no formulário.
5. Cancelar exclusão por Escape, confirmar exclusão e recarregar, preservando os demais projetos.
6. Conferir desktop e mobile de 390 px. O excesso de largura causado pelos rótulos de ações foi corrigido e retestado; não houve transbordamento horizontal da página.
7. Remover os projetos temporários, recarregar e confirmar catálogo de QA vazio; encerrar o servidor de teste.
8. Reiniciar o servidor principal na porta 8000, abrir a entrega e confirmar catálogo sem dados demonstrativos, botão de criação disponível e ausência de erros/avisos no console observado.

Não foram criados projetos de teste na origem principal. Os testes com entidades elétricas completas pertencem à suíte automatizada; não são resultados calculados nem dados de demonstração inseridos na aplicação.

### Evidências

- [Catálogo desktop durante QA](evidencias/etapa02_projetos_desktop.png)
- [Catálogo mobile durante QA](evidencias/etapa02_projetos_mobile.png)
- [Conflito real entre abas](evidencias/etapa02_conflito_entre_abas.png)
- [Confirmação de exclusão](evidencias/etapa02_confirmacao_exclusao.png)
- [Entrega na origem principal, sem projetos de QA](evidencias/etapa02_entrega.png)

## Limitações e pendências

- Persistência local ao perfil e à origem do navegador. Trocar porta, endereço ou perfil não transfere o catálogo; limpar dados do navegador pode removê-lo. Não há sincronização multiusuário nem banco remoto.
- O limite defensivo é 500 projetos, sujeito à quota do navegador; não é uma homologação de desempenho nesse volume.
- Sem Web Locks as alterações são recusadas; não foi adotado fallback de concorrência inseguro.
- Catálogo inválido é preservado e bloqueado. Recuperação avançada, importação/exportação e backups permanecem na Etapa 10.
- Cadastro de consumidores permanece na Etapa 3; cálculos, topologia, infraestrutura, proteções e demais funções seguem suas etapas originais.
- Nenhum critério industrial foi calculado ou declarado conforme nesta entrega. As ressalvas SENAI e da Etapa 0 permanecem registradas, sem alteração do motor residencial.

**Encerramento:** Etapa 2 entregue. A Etapa 3 aguarda confirmação expressa do usuário.
