import Link from "next/link";
import { Mensagens } from "@/components/Mensagens";
import { VisaoDia } from "@/components/VisaoDia";
import { COOKIE_ROTA, lerAcesso, rpcRota } from "@/lib/acesso";
import { hojeISO, somarDias } from "@/lib/datas";
import { criarSupabaseServidor } from "@/lib/supabase/server";
import type { Dia } from "@/lib/tipos";
import { FormEntrarRota } from "./FormEntrarRota";
import { rotaChegada, rotaEntregas, rotaOcorrencia, sairRota } from "./actions";

export const dynamic = "force-dynamic";

export default async function AreaRota({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : hoje;
  const acesso = await lerAcesso(COOKIE_ROTA);

  let dia: Dia | null = null;
  let falhou = false;
  if (acesso) {
    try {
      dia = await rpcRota<Dia>("mb_r_dia", { p_data: data });
    } catch (e) {
      falhou = !(e instanceof Error && e.message === "SEM_ACESSO");
    }
  }

  if (!dia) {
    const supabase = await criarSupabaseServidor();
    const { data: lista } = await supabase.rpc("mb_rota_lista");
    return (
      <main className="container pilha" style={{ maxWidth: 460, paddingTop: 40 }}>
        <Link href="/" className="muted">
          ← Início
        </Link>
        <h1>
          <span className="marca">NOVE NOVE BURGERS</span>
          <br />
          Gestor de rota
        </h1>
        {falhou && <div className="erro">Não foi possível carregar. Verifique a internet e tente de novo.</div>}
        {acesso && !falhou && <div className="aviso">Seu PIN mudou. Entre de novo.</div>}
        <FormEntrarRota gestores={(lista as { id: string; nome: string }[] | null) ?? []} />
      </main>
    );
  }

  return (
    <main className="container pilha" style={{ maxWidth: 900 }}>
      <div className="linha entre">
        <div>
          <span className="marca">MOTOBOYS 99 · ROTA</span>
          <h1 style={{ fontSize: "1.7rem", margin: 0 }}>Escala do dia</h1>
        </div>
        <form action={sairRota}>
          <button className="botao">Sair</button>
        </form>
      </div>
      <Mensagens erro={sp.erro} ok={sp.ok} />
      <VisaoDia
        dia={dia}
        base="/rota"
        hoje={hoje}
        minData={somarDias(hoje, -7)}
        acoes={{ chegada: rotaChegada, entregas: rotaEntregas, ocorrencia: rotaOcorrencia }}
      />
      <p className="muted pequeno">
        Chegadas pelo gestor: até 3 dias para trás. Entregas: até 7 dias, enquanto o dia não foi pago.
      </p>
    </main>
  );
}
