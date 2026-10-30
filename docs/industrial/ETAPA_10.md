# Etapa 10 — Salvamento, recuperação e relatórios

Data: 29/10/2026. Árvore ativa: `C:\Users\jeanm\OneDrive\Desktop\dimensionamento`.

Implementação da Etapa 10 do roteiro original 0–11, em continuidade à Etapa 9. Nenhuma funcionalidade de proteção ou regra elétrica nova foi introduzida. A auditoria final da Etapa 11 não foi antecipada.

## Funcionalidades

- Relatório consolidado na aba Relatórios, gerado automaticamente ao abrir um projeto nessa seção, com atualização manual opcional.
- Dados gerais, versões, consumidores, motores e fontes, quadros, pontos, posições, trechos, circuitos, formações de cabos, condutores adotados, infraestrutura e condições cadastradas.
- Memória das potências/correntes, fontes utilizadas, dimensionamento e comparação de seções, ocupação, queda em regime permanente e diagrama com tabela de conexões.
- Pendências e limites explícitos, incluindo falhas de serviços. Ausência de valor permanece desconhecida. Nenhuma aprovação global é inferida; a página e o PDF exibem **Verificação parcial**.
- PDF paginado com fonte incorporada, cabeçalhos repetidos, revisão e identificação das entradas; CSV consolidado em formato longo; backup JSON recuperável.
- Importar projeto na página Projetos: seleção, validação e prévia antes da gravação. Cria cópia independente, preservando os projetos existentes e remapeando relações entre entidades.
- Fechar, reabrir, duplicar e recuperar preservam entradas, fontes, condições, topologia e posições. O relatório recalcula com os serviços atuais, descartando resultados antigos salvos no arquivo.
- Erros de arquivo, incompatibilidade de versões, servidor indisponível, quota e conflito de gravação são tratados sem apagar os registros de origem.

## Arquivos desta entrega

Novos:

- `voltcalc/industrial/reports.py`: consolidação, rastreabilidade, CSV e contrato da requisição.
- `voltcalc/industrial/report_pdf.py`: apresentação PDF; não contém fórmulas elétricas.
- `frontend/industrial/js/core/project-files.js`: envelope de backup, validação, migração e downloads.
- `frontend/industrial/js/core/reports.js`: cliente do serviço, verificação de versões e respostas.
- `frontend/industrial/js/reports-controller.js`, `reports-view.js`: geração, importação, exportações e apresentação.
- `requirements-industrial.txt`: dependência opcional de PDF, ReportLab 4.5.1 ou compatível até a próxima versão principal.
- `tests/industrial/test_reports.py`, `reports.test.mjs`: cobertura de relatório, arquivo e repositório.

Modificados:

- `voltcalc/web/api.py`, `assets.py`: endpoint POST `/api/industrial/reports` e lista explícita de novos scripts públicos.
- `frontend/industrial/js/core/repository.js`, `local-repository.js`: contrato e transação de importação como cópia.
- `frontend/industrial/js/app.js`, `pages.js`, `projects-view.js`, `overview-view.js`, `css/industrial.css`: integração, botões, estados, textos de disponibilidade e responsividade.
- `docs/industrial/DECISOES_ARQUITETURAIS.md`, `PENDENCIAS.md`: DA-41/42 e IND-56 a IND-59.
- Evidências em `docs/industrial/evidencias/etapa10_relatorio_desktop.jpg` e `etapa10_relatorio_mobile.jpg`.

As alterações preexistentes das etapas anteriores foram preservadas. `server.py`, motor residencial e tabelas residenciais não foram modificados.

## Persistência e formatos

Contrato industrial mantido em v9; envelope de backup e relatório possuem versões próprias. A exportação JSON preserva a revisão de origem. A importação reinicia as revisões da nova cópia, mantendo todos os vínculos por remapeamento de IDs. Migração de projetos industriais v2–v8 foi testada.

O repositório continua sendo localStorage por navegador e origem, com bloqueio de escrita e revisão otimista. Não há persistência de projetos no servidor Python. Guardar o backup fora do navegador permite recuperar os dados após troca de perfil/endereço; nenhuma rotina automática de backup externo foi adicionada.

Os resultados são recuperados por recálculo determinístico das entradas. Não há cache offline de cálculos: sem o servidor, a análise fica indisponível e as entradas salvas permanecem intactas. PDF/CSV exportados registram um retrato da revisão e das versões usadas naquela emissão. O hash identifica as entradas, mas não certifica a fonte nem assina o documento.

JSON: formato industrial próprio, até 4 MB; importação de PDF/CSV ou JSON residencial não suportada. CSV: UTF-8 com BOM, delimitador ponto e vírgula, colunas Projeto/Revisão/Seção/Item/Linha/Campo/Valor, proteção contra interpretação de fórmulas. Não é o modelo de importação de consumidores.

PDF: `python -m pip install -r requirements-industrial.txt`. Dependência instalada e verificada neste ambiente. Na ausência de ReportLab, a API retorna instrução útil e JSON/CSV continuam disponíveis. Fontes incorporadas incluem acentos e símbolos utilizados na memória. Os arquivos são gerados sob demanda, sem salvar dados do projeto no servidor.

## Testes e evidências

- **216 testes Python aprovados**, abrangendo regressão residencial, relatório, fonte de catálogo de motor, preservação das entradas, rejeição de resultados forjados, versões, CSV, PDF com texto longo e API HTTP.
- **17 suítes JavaScript aprovadas**, incluindo backup completo, migração, importação sem sobrescrita, remapeamento, posições, reabertura, duplicação, conflitos, quota, corrupção, respostas obsoletas, versões incompatíveis, escape e indisponibilidade do servidor.
- **105 arquivos protegidos inalterados**, comparados por SHA-256 com a linha de base da Etapa 6. Verificação de whitespace sem erros.
- Navegador na origem isolada `127.0.0.1:8001`: downloads reais de JSON, PDF e CSV; prévia e importação do backup; original preservado; fechamento, reabertura e recarga da página. A cópia recuperou 1 consumidor, 1 quadro, 1 trecho, posições e resultado de 4,4 kW / 0,909% de queda / 3 itens pendentes.
- Tela móvel 390 × 844: largura do documento 375 px, sem transbordamento horizontal global; controles de exportação disponíveis. Override removido após a verificação. Nenhum erro JavaScript observado.
- PDF sintético de três consumidores renderizado por Poppler e inspecionado visualmente, incluindo diagrama, tabelas, comparação de seções e memória de queda. Cabeçalhos e rodapés permanecem legíveis, sem sobreposição. O documento completo tem dezenas de páginas por incluir os dados e a memória técnica detalhada.

Comandos: `$env:PYTHONIOENCODING='utf-8'; python -X utf8 -m unittest discover -s tests -q`; Node em `tests/**/*.test.mjs` e `tests/*.test.cjs`. Logs: `tmp/industrial-stage10-python-tests.log`, `tmp/industrial-stage10-js-tests.json`. PDF sintético: `output/pdf/voltcalc-industrial-qa.pdf`; não representa instalação real.

Servidor principal deixado em `http://127.0.0.1:8000/industrial/`. Residencial, industrial, script do relatório e contrato v9 responderam HTTP 200. Endpoint de relatórios gerou PDF válido a partir de fixture sintética de motor, sem gravar projetos no servidor. Servidor e aba de QA na porta 8001 encerrados. A versão final do PDF de referência tem 38 páginas; valores apresentados arredondados a seis algarismos significativos, preservando a precisão integral das entradas no JSON.

## Limitações e próximo marco

- Proteção, coordenação, curto-circuito, partida, harmônicas e demais condições excluídas pelos serviços anteriores permanecem não verificadas. As ressalvas SENAI não foram corrigidas silenciosamente.
- Fontes de placa, catálogo e valores manuais permanecem declaradas pelo usuário; não há autenticação de fabricante.
- O diagrama é esquemático. Grafos densos podem exigir consulta ao mapa interativo; a tabela conserva as conexões completas. O relatório técnico é extenso; não foi criado editor de modelos de relatório.
- Revisão de desempenho em grandes projetos e auditoria global continuam reservadas à Etapa 11.
- Nenhum registro da origem do usuário na porta 8000 foi excluído ou modificado. O projeto importado para teste ficou restrito à origem de QA 8001.

**Etapa 10 concluída no escopo documentado. Etapa 11 não iniciada.**
