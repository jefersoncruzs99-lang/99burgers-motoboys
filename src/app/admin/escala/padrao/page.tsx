import Link from "next/link";
import { GradePadrao, type DadosPadrao } from "@/components/GradeSemana";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { addPadrao, removerPadrao } from "../../actions";

export default async function AdminPadrao({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const { data, error } = await supabase.rpc("mb_padrao_json");
  return (
    <>
      <div className="linha entre" style={{ flexWrap: "wrap" }}>
        <h1>Semana padrão</h1>
        <Link href="/admin/escala" className="botao">
          ← Escala da semana
        </Link>
      </div>
      <p className="muted">É o modelo usado para preencher a escala. Mudar aqui não altera semanas já preenchidas. Feriados usam o domingo.</p>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />
      {data && <GradePadrao
          dados={data as DadosPadrao}
          base="/admin/escala/padrao"
          dowSel={sp.dia !== undefined ? Number(sp.dia) : undefined}
          acoes={{ adicionar: addPadrao, remover: removerPadrao }}
        />}
    </>
  );
}
