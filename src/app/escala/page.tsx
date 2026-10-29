import Link from "next/link";
import { GradeSemana, type DadosSemana } from "@/components/GradeSemana";
import { Mensagens } from "@/components/Mensagens";
import { COOKIE_ESCALA, lerAcesso, rpcEscala } from "@/lib/acesso";
import { hojeISO, segundaDaSemana } from "@/lib/datas";
import { criarSupabaseServidor } from "@/lib/supabase/server";
import { FormEntrarEscala } from "./FormEntrarEscala";
import { escAdicionar, escGerar, escRefazer, escRemover, sairEscala } from "./actions";

export const dynamic = "force-dynamic";

export default async function AreaEscala({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const inicio = segundaDaSemana(sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : hojeISO());
  const acesso = await lerAcesso(COOKIE_ESCALA);
  let dados: DadosSemana | null = null;
  let falhou = false;
  if (acesso) {
    try {
      dados = await rpcEscala<DadosSemana>("mb_e_semana", { p_inicio: inicio });
    } catch (e) {
      falhou = !(e instanceof Error && e.message === "SEM_ACESSO");
    }
  }

  if (!dados) {
    const supabase = await criarSupabaseServidor();
    const { data: lista } = await supabase.rpc("mb_escala_lista");
    return (
      <main className="container pilha" style={{ maxWidth: 460, paddingTop: 40 }}>
        <Link href="/" className="muted">
          ← Início
        </Link>
        <h1>
          <span className="marca">NOVE NOVE BURGERS</span>
          <br />
          Escala dos motoboys
        </h1>
        {falhou && <div className="erro">Não foi possível carregar. Verifique a internet e tente de novo.</div>}
        {acesso && !falhou && <div className="aviso">Seu PIN mudou ou seu acesso foi retirado. Entre de novo.</div>}
        <FormEntrarEscala pessoas={(lista as { id: string; nome: string }[] | null) ?? []} />
      </main>
    );
  }

  return (
    <main className="container pilha" style={{ paddingBottom: 40 }}>
      <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
        <div>
          <span className="marca">MOTOBOYS 99 · ESCALA</span>
          <h1 style={{ fontSize: "1.7rem", margin: 0 }}>Escala da semana</h1>
        </div>
        <div className="mini">
          <Link href="/escala/padrao" className="botao">
            Semana padrão
          </Link>
          <form action={sairEscala}>
            <button className="botao">Sair</button>
          </form>
        </div>
      </div>
      <Mensagens erro={sp.erro} ok={sp.ok} />
      <GradeSemana
        dados={dados}
        base="/escala"
        diaSel={sp.dia}
        acoes={{ adicionar: escAdicionar, remover: escRemover, gerar: escGerar, refazer: escRefazer }}
      />
    </main>
  );
}
