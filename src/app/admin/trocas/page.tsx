import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { dataComDia, hojeISO, somarDias } from "@/lib/datas";
import { decidirTroca } from "../actions";

const STATUS: Record<string, string> = {
  aberta: "Esperando colega",
  aceita: "Esperando aprovação",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export default async function AdminTrocas({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const { data: trocas, error } = await supabase
    .from("mb_trocas")
    .select("id, data, turno, status, motivo, criada_em, de:mb_motoboys!de_motoboy(nome), para:mb_motoboys!para_motoboy(nome), aceitou:mb_motoboys!aceita_por(nome), mb_turnos(nome)")
    .gte("data", somarDias(hojeISO(), -30))
    .order("data", { ascending: false })
    .limit(100);
  const { data: config } = await supabase.from("mb_config").select("troca_automatica").maybeSingle();
  const nome = (x: unknown) => (x as { nome: string } | null)?.nome;
  const lista = trocas ?? [];
  const pendentes = lista.filter((t) => t.status === "aceita");
  const outras = lista.filter((t) => t.status !== "aceita");

  return (
    <>
      <h1>Trocas de turno</h1>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />
      <p className="muted">
        {config?.troca_automatica
          ? "Troca automática ligada: quando o colega aceita, a escala já muda. Você só acompanha aqui."
          : "Troca automática desligada: depois que o colega aceita, você aprova aqui."}{" "}
        Dá para mudar em Configurações.
      </p>
      {pendentes.length > 0 && (
        <section className="cartao destaque pilha">
          <h2>Esperando aprovação</h2>
          {pendentes.map((t) => (
            <div key={t.id} className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
              <span>
                {dataComDia(t.data)} · {nome(t.mb_turnos)}: <strong>{nome(t.de)}</strong> → <strong>{nome(t.aceitou)}</strong>
                {t.motivo && <span className="muted"> · {t.motivo}</span>}
              </span>
              <form action={decidirTroca} className="mini">
                <input type="hidden" name="troca_id" value={t.id} />
                <button className="botao sucesso" name="decisao" value="aprovar">
                  Aprovar
                </button>
                <button className="botao perigo" name="decisao" value="recusar">
                  Recusar
                </button>
              </form>
            </div>
          ))}
        </section>
      )}
      <section className="cartao pilha">
        <h2>Últimos 30 dias e próximas</h2>
        {outras.length === 0 && <p className="muted">Nenhuma troca.</p>}
        <ul className="pessoas">
          {outras.map((t) => (
            <li key={t.id}>
              <span>
                {dataComDia(t.data)} · {nome(t.mb_turnos)}: <strong>{nome(t.de)}</strong> →{" "}
                {nome(t.aceitou) ?? nome(t.para) ?? "qualquer colega"}
                {t.motivo && <span className="muted"> · {t.motivo}</span>}
              </span>
              <span className="mini">
                <span className={`selo ${t.status === "aprovada" ? "ok" : t.status === "aberta" ? "ama" : ""}`}>{STATUS[t.status]}</span>
                {t.status === "aberta" && (
                  <form action={decidirTroca}>
                    <input type="hidden" name="troca_id" value={t.id} />
                    <button className="botao" name="decisao" value="recusar">
                      Cancelar
                    </button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
