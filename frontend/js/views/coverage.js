/** Explicit scope map, not a declaration of normative conformity. */
export function coverageView() {
  return /* HTML */ `<details class="details normative-coverage">
    <summary>O que o VoltCalc verifica — e o que ainda falta</summary>
    <p>
      <strong>Referências separadas:</strong> previsão residencial por cômodo:
      NBR 5410:2004, corrigida 2008, 9.5.2. Dimensionamento de cabos/proteção:
      motor histórico de 1997, ainda sem migração integral.
    </p>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Parte do projeto</th>
            <th>Cobertura e dados necessários</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Previsão residencial</td>
            <td>
              Área, perímetro, uso, pontos de tomada e luz; prévia numérica por
              cômodo. Posição, bancada, equipamentos reais e exceções
              construtivas exigem conferência.
            </td>
          </tr>
          <tr>
            <td>Cabos e sobrecarga</td>
            <td>
              Calcula nos métodos/tabelas disponíveis: corrente, temperatura,
              agrupamento, seção e coordenação Ib/In/Iz/I₂. Hipóteses precisam
              ser confirmadas.
            </td>
          </tr>
          <tr>
            <td>Queda de tensão</td>
            <td>
              Calcula os percursos cadastrados. Queda total desde a origem,
              alimentadores e topologia completa não são verificados.
            </td>
          </tr>
          <tr>
            <td>Divisão e fases</td>
            <td>
              Proposta editável separa iluminação, TUG por ambiente e
              consumidores dedicados. Não valida integralmente demanda, entrada,
              polos ou exceções de circuitos mistos.
            </td>
          </tr>
          <tr>
            <td>Curto-circuito e desligamento</td>
            <td>
              Compara capacidade de interrupção com Ik informado. Não calcula
              Ik, energia passante, tempos de desligamento, seletividade ou
              coordenação por fabricante.
            </td>
          </tr>
          <tr>
            <td>Choque, aterramento e surtos</td>
            <td>
              Pendentes: esquema TT/TN/IT, PE, neutro, equipotencialização, DR,
              DPS, impedância do laço e resistência de aterramento.
            </td>
          </tr>
          <tr>
            <td>Condições e verificação final</td>
            <td>
              Pendentes: influências externas completas, volumes de banheiro,
              ocupação de eletrodutos, harmônicas, serviços de segurança,
              inspeção e ensaios.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      Uma quantidade ou um cálculo atendido não aprova o circuito inteiro. A
      ausência de dados ou de uma verificação continua sendo pendência.
    </p>
  </details>`;
}
