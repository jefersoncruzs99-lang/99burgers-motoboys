import Link from "next/link";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { VisaoDia } from "@/components/VisaoDia";
import { exigirGestor } from "@/lib/auth";
import { hojeISO } from "@/lib/datas";
import type { Dia } from "@/lib/tipos";
import { admChegada, admCorrigir, admDinheiro, admEntregas, admExcluirOcorrencia, admOcorrencia, admRemover } from "./actions";

export default async function AdminDia({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const hoje = hojeISO();
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : hoje;

  const [{ data: dia, error }, { count: trocasPendentes }, { data: motoboys }, { data: contrato }, { data: assinaturas }] = await Promise.all([
    supabase.rpc("mb_dia_json", { p_data: data }),
    supabase.from("mb_trocas").select("id", { count: "exact", head: true }).eq("status", "aceita"),
    supabase.from("mb_motoboys").select("id, nome, chave_hash").eq("ativo", true),
    supabase.from("mb_documentos").select("id").eq("tipo", "contrato").eq("ativo", true).maybeSingle(),
    supabase.from("mb_assinaturas").select("motoboy_id, documento_id"),
  ]);

  const semChave = (motoboys ?? []).filter((m) => !m.chave_hash);
  const assinaram = new Set((assinaturas ?? []).filter((a) => a.documento_id === contrato?.id).map((a) => a.motoboy_id));
  const semContrato = (motoboys ?? []).filter((m) => m.chave_hash && !assinaram.has(m.id));

  return (
    <>
      <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
        <h1>Escala do dia</h1>
        <Link href="/admin/qr" className="botao primario">
          📱 QR de chegada
        </Link>
      </div>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />
      {(trocasPendentes ?? 0) > 0 && (
        <div className="aviso">
          {trocasPendentes} troca(s) esperando aprovação. <Link href="/admin/trocas">Ver trocas</Link>
        </div>
      )}
      {semChave.length > 0 && (
        <div className="aviso">
          Sem chave de acesso: {semChave.map((m) => m.nome).join(", ")}. <Link href="/admin/motoboys">Gerar chave</Link>
        </div>
      )}
      {semContrato.length > 0 && (
        <div className="aviso">Ainda não assinaram o contrato atual: {semContrato.map((m) => m.nome).join(", ")}.</div>
      )}
      {dia && (
        <VisaoDia
          dia={dia as Dia}
          base="/admin"
          hoje={hoje}
          acoes={{ chegada: admChegada, entregas: admEntregas, ocorrencia: admOcorrencia, corrigir: admCorrigir, remover: admRemover, dinheiro: admDinheiro, excluirOcorrencia: admExcluirOcorrencia }}
        />
      )}
    </>
  );
}
