# Matriz de validação — Etapa 11

30/10/2026. “Passou” se refere ao teste do escopo indicado, não à conformidade integral da instalação. Resultado global: auditoria encerrada com ressalvas.

| Requisito | Evidência principal | Resultado / limite |
|---|---|---|
| Arquitetura e residencial preservados | Suíte Python completa; suítes JS residenciais; 105 hashes | Passou; ressalvas SENAI continuam |
| Contratos, tipos e validação inicial | `test_structure.py`, `structure.test.mjs`, `consumers.test.mjs` | Passou para tipos declarados; cadastro não implica cálculo de todos os regimes |
| Cadastro unitário/múltiplos motores e duplicação | `motor-batch.test.mjs`, `consumers.test.mjs` | Passou; alterações individuais e invalidação |
| Unidades W/kW/VA/kVA/cv/hp e base ativa/mecânica/aparente | `test_currents.py` | Passou no domínio implementado, sem rendimento aplicado duas vezes |
| Placa, catálogo e estimativa | `test_currents.py`, `test_final_audit.py` | Passou; fonte explícita e catálogo limitado à referência transcrita |
| Alimentação FN/FF/3F/3FN e neutro | `test_currents.py`, `test_conductors.py`, `test_final_audit.py` | Passou; condições desconhecidas e harmônicas fora do domínio bloqueadas |
| Métodos, tabelas, material, isolação e correções | `test_conductors.py` | Passou nas tabelas incorporadas; sem extrapolação de células/condições ausentes |
| Pior trecho, agrupamento, seções, PE e neutro | `test_conductors.py` | Passou no escopo parcial; não dimensiona proteção/curto-circuito |
| TT, TN-S, TN-C, TN-C-S e IT | `test_final_audit.py`, contratos | Metadados testados; verificação elétrica de aterramento NÃO implementada |
| 30 consumidores, múltiplos quadros e derivações | `audit_fixture.py`, `test_final_audit.py`, QA no navegador | Passou: 4 quadros, 33 trechos, caminhos compartilhados e cargas no mesmo circuito |
| Topologia e operações atômicas | `test_topology.py`, `topology.test.mjs`, `workflow.test.mjs` | Passou; destinos e vínculos explícitos |
| Ocupação e envoltórias reais | `test_infrastructure.py`, `infrastructure.test.mjs` | Passou para escopo suportado; sem diâmetros inferidos da seção metálica |
| Queda no percurso completo | `test_voltage.py`, `test_final_audit.py`, `voltage.test.mjs` | 21 calculados; 9 especiais pendentes no cenário de 30 |
| Distância, motor, seção, temperatura e infraestrutura alterados | `test_final_audit.py`, `final-audit.test.mjs` | Recalcula/invalida; exige reconfirmação das fontes afetadas |
| Visão geral e mapa | `test_overview.py`, `overview.test.mjs`, QA | Passou; posição gráfica não vira comprimento físico |
| Proteção, partida e conformidade geral | Contratos, testes de serviços e relatório | NÃO implementados; estados honestos conferidos |
| Soma de potências e cadeias de transformação | `test_final_audit.py`, avisos da UI/relatório | Soma de registros testada; balanço de energia de cadeias NÃO implementado |
| Salvar/reabrir/duplicar/excluir | `repository.test.mjs`, `final-audit.test.mjs` | Passou em armazenamento de teste; sem exclusão de dados reais |
| Backup, importação, IDs e recuperação | `reports.test.mjs`, `final-audit.test.mjs`, QA | Passou; importação cria cópia independente; resultados recalculados |
| Quota, corrupção e conflitos | `repository.test.mjs`, `reports.test.mjs` | Passou no domínio simulado; não existe backup externo automático |
| PDF/CSV/JSON e segurança de células | `test_reports.py`, `reports.test.mjs`, benchmark e downloads | Passou; fonte grega incorporada e extração testada |
| Servidor indisponível e recuperação | QA offline/online, testes de serviços | Mensagem acionável, entradas preservadas, recálculo após recuperação |
| Navegação e responsividade | QA desktop e 390 × 844, evidências | Passou nos cenários exercitados; demais dispositivos não certificados |
| Desempenho e legibilidade | `run_final_benchmark.py`, inspeção visual de PDF | Geração ~2,8 s; ressalva: 396 páginas e mapa denso |

Totais: 224 testes Python, 18 suítes JavaScript; ver ETAPA_11.md para comandos, limitações e arquivos modificados. As evidências não autorizam expansão de escopo nem substituem revisão profissional.
