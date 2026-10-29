import { redirect } from "next/navigation";
import { Ranking } from "@/components/Ranking";
import { rpcMotoboy } from "@/lib/acesso";
import type { DadosRanking } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function RankingMotoboy({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  let dados: DadosRanking;
  try {
    dados = await rpcMotoboy<DadosRanking>("mb_m_ranking_t", { p_periodo: sp.periodo ?? "mes", p_turno: sp.turno ?? null });
  } catch (e) {
    if (e instanceof Error && e.message === "SEM_ACESSO") redirect("/m");
    throw e;
  }
  return (
    <main className="container pilha" style={{ maxWidth: 760, paddingBottom: 40 }}>
      <Ranking dados={dados} base="/m/ranking" voltar={{ href: "/m", rotulo: "Meu painel" }} />
    </main>
  );
}
