import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { Ranking } from "@/components/Ranking";
import { exigirGestor } from "@/lib/auth";
import type { DadosRanking } from "@/lib/tipos";

export default async function RankingAdmin({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const { data, error } = await supabase.rpc("mb_a_ranking", { p_periodo: sp.periodo ?? "mes" });
  const dados = data as DadosRanking | null;
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }} className="pilha">
      <Mensagens erro={error?.message} />
      {dados && <Ranking dados={dados} base="/admin/ranking" />}
      {dados && dados.ranking.length > 0 && (
        <details className="cartao">
          <summary>
            <strong>Detalhe da pontuação (só a administração vê)</strong>
          </summary>
          <div className="tabela-rolagem" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Motoboy</th>
                  <th>Turnos</th>
                  <th>Entregas</th>
                  <th>Intercorrências</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {dados.ranking.map((i) => (
                  <tr key={i.motoboy_id}>
                    <td>{i.pos}º</td>
                    <td>{i.nome}</td>
                    <td>{i.turnos}</td>
                    <td>{i.entregas}</td>
                    <td>{i.pontos_ocorrencias}</td>
                    <td>
                      <strong>{i.pontos}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
