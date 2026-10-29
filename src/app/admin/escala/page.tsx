import Link from "next/link";
import { GradeSemana, type DadosSemana } from "@/components/GradeSemana";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { hojeISO, segundaDaSemana } from "@/lib/datas";
import { addEscala, gerarSemana, refazerDia, removerEscala } from "../actions";

export default async function AdminEscala({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const inicio = segundaDaSemana(sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : hojeISO());
  const { data, error } = await supabase.rpc("mb_semana_json", { p_inicio: inicio });

  return (
    <>
      <div className="linha entre" style={{ flexWrap: "wrap" }}>
        <h1>Escala da semana</h1>
        <Link href="/admin/escala/padrao" className="botao">
          Semana padrão
        </Link>
      </div>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />
      {data && (
        <GradeSemana
          dados={data as DadosSemana}
          base="/admin/escala"
          acoes={{ adicionar: addEscala, remover: removerEscala, gerar: gerarSemana, refazer: refazerDia }}
          linkDia={(d) => `/admin?data=${d}`}
          diaSel={sp.dia}
        />
      )}
    </>
  );
}
