import Link from "next/link";
import { redirect } from "next/navigation";
import { GradePadrao, type DadosPadrao } from "@/components/GradeSemana";
import { Mensagens } from "@/components/Mensagens";
import { rpcEscala } from "@/lib/acesso";
import { escPadraoAdicionar, escPadraoRemover } from "../actions";

export const dynamic = "force-dynamic";

export default async function PadraoEscala({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  let dados: DadosPadrao;
  try {
    dados = await rpcEscala<DadosPadrao>("mb_e_padrao");
  } catch (e) {
    if (e instanceof Error && e.message === "SEM_ACESSO") redirect("/escala");
    throw e;
  }
  return (
    <main className="container pilha" style={{ paddingBottom: 40 }}>
      <div className="linha entre" style={{ flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Semana padrão</h1>
        <Link href="/escala" className="botao">
          ← Escala da semana
        </Link>
      </div>
      <p className="muted">É o modelo usado para preencher a escala. Mudar aqui não altera semanas já preenchidas. Feriados usam o domingo.</p>
      <Mensagens erro={sp.erro} ok={sp.ok} />
      <GradePadrao dados={dados} acoes={{ adicionar: escPadraoAdicionar, remover: escPadraoRemover }} />
    </main>
  );
}
