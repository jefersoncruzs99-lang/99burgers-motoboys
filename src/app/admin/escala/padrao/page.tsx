import Link from "next/link";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { NOMES_DIA } from "@/lib/datas";
import { addPadrao, removerPadrao } from "../../actions";

const ORDEM = [1, 2, 3, 4, 5, 6, 0];

export default async function AdminPadrao({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const [{ data: turnos }, { data: padrao }, { data: motoboys }] = await Promise.all([
    supabase.from("mb_turnos").select("codigo, nome").order("ordem"),
    supabase.from("mb_escala_padrao").select("id, dia_semana, turno, motoboy_id, mb_motoboys(nome, ativo)"),
    supabase.from("mb_motoboys").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return (
    <>
      <div className="linha entre" style={{ flexWrap: "wrap" }}>
        <h1>Semana padrão</h1>
        <Link href="/admin/escala" className="botao">
          ← Escala da semana
        </Link>
      </div>
      <p className="muted">
        É o modelo usado para preencher a escala. Mudar aqui não altera semanas já preenchidas. Feriados usam o domingo.
      </p>
      <Mensagens erro={sp.erro} ok={sp.ok} />
      <div className="tabela-rolagem">
      <div className="grade-escala">
        {ORDEM.map((dow) => (
          <div key={dow} className="dia">
            <strong>{NOMES_DIA[dow]}</strong>
            {(turnos ?? []).map((t) => {
              const doTurno = (padrao ?? []).filter((p) => p.dia_semana === dow && p.turno === t.codigo);
              const livres = (motoboys ?? []).filter((m) => !doTurno.some((p) => p.motoboy_id === m.id));
              return (
                <div key={t.codigo} className="bloco">
                  <div className="muted pequeno">
                    {t.nome} · {doTurno.length}
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {doTurno.map((p) => {
                      const m = p.mb_motoboys as unknown as { nome: string; ativo: boolean } | null;
                      return (
                        <form key={p.id} action={removerPadrao} className="chip" style={m?.ativo ? undefined : { opacity: 0.5 }}>
                          <input type="hidden" name="id" value={p.id} />
                          {m?.nome ?? "?"}
                          {m && !m.ativo ? " (inativo)" : ""}
                          <button aria-label={`Tirar ${m?.nome}`}>×</button>
                        </form>
                      );
                    })}
                  </div>
                  {livres.length > 0 && (
                    <form action={addPadrao} className="add-chip">
                      <input type="hidden" name="dia_semana" value={dow} />
                      <input type="hidden" name="turno" value={t.codigo} />
                      <select name="motoboy_id" defaultValue="" required aria-label="Adicionar motoboy">
                        <option value="" disabled>
                          + adicionar
                        </option>
                        {livres.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                      <button className="botao">OK</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
