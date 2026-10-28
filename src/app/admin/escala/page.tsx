import Link from "next/link";
import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { NOMES_DIA_CURTO, dataCurta, diaDaSemana, hojeISO, segundaDaSemana, somarDias } from "@/lib/datas";
import { addEscala, gerarSemana, refazerDia, removerEscala } from "../actions";

export default async function AdminEscala({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const hoje = hojeISO();
  const inicio = segundaDaSemana(sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : hoje);
  const fim = somarDias(inicio, 6);
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const voltaUrl = `/admin/escala?semana=${inicio}`;

  const [{ data: turnos }, { data: escala }, { data: motoboys }, { data: feriados }, { data: registros }] = await Promise.all([
    supabase.from("mb_turnos").select("codigo, nome, setor, inicio, fim").order("ordem"),
    supabase.from("mb_escala").select("id, data, turno, origem, motoboy_id, mb_motoboys(nome)").gte("data", inicio).lte("data", fim),
    supabase.from("mb_motoboys").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("mb_feriados").select("data, nome").gte("data", inicio).lte("data", fim),
    supabase.from("mb_registros").select("data, turno, motoboy_id").gte("data", inicio).lte("data", fim),
  ]);

  const chegou = new Set((registros ?? []).map((r) => `${r.data}|${r.turno}|${r.motoboy_id}`));
  const feriadoDe = new Map((feriados ?? []).map((f) => [f.data, f.nome]));
  const vazia = (escala ?? []).length === 0;

  return (
    <>
      <div className="linha entre" style={{ flexWrap: "wrap" }}>
        <h1>Escala da semana</h1>
        <Link href="/admin/escala/padrao" className="botao">
          Semana padrão
        </Link>
      </div>
      <Mensagens erro={sp.erro} ok={sp.ok} />
      <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
        <Link className="botao" href={`/admin/escala?semana=${somarDias(inicio, -7)}`}>
          ← Semana anterior
        </Link>
        <strong>
          {dataCurta(inicio)} a {dataCurta(fim)}
        </strong>
        <Link className="botao" href={`/admin/escala?semana=${somarDias(inicio, 7)}`}>
          Próxima semana →
        </Link>
      </div>
      <form action={gerarSemana} className="cartao linha entre" style={{ flexWrap: "wrap" }}>
        <input type="hidden" name="inicio" value={inicio} />
        <input type="hidden" name="volta" value={voltaUrl} />
        <span className="muted">
          {vazia ? "Esta semana ainda está vazia." : "Completa só os turnos que estão sem ninguém."} Feriado usa a escala de domingo.
        </span>
        <button className={`botao ${vazia ? "primario" : ""}`}>Preencher pela semana padrão</button>
      </form>

      <div className="tabela-rolagem">
      <div className="grade-escala">
        {dias.map((d) => {
          const feriado = feriadoDe.get(d);
          const passado = d < hoje;
          return (
            <div key={d} className={`dia ${d === hoje ? "hoje" : ""}`} style={passado ? { opacity: 0.7 } : undefined}>
              <div className="linha entre">
                <strong>
                  {NOMES_DIA_CURTO[diaDaSemana(d)]} {dataCurta(d)}
                </strong>
                <Link className="muted pequeno" href={`/admin?data=${d}`}>
                  ver dia
                </Link>
              </div>
              {feriado && <span className="selo ama">Feriado: {feriado}</span>}
              {(turnos ?? []).map((t) => {
                const doTurno = (escala ?? []).filter((e) => e.data === d && e.turno === t.codigo);
                const livres = (motoboys ?? []).filter((m) => !doTurno.some((e) => e.motoboy_id === m.id));
                return (
                  <div key={t.codigo} className="bloco">
                    <div className="muted pequeno">
                      {t.nome} · {doTurno.length}
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {doTurno.map((e) => {
                        const nome = (e.mb_motoboys as unknown as { nome: string } | null)?.nome ?? "?";
                        return (
                          <form key={e.id} action={removerEscala} className="chip" title={e.origem === "troca" ? "Veio de troca" : undefined}>
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="volta" value={voltaUrl} />
                            {chegou.has(`${d}|${t.codigo}|${e.motoboy_id}`) ? "✅ " : ""}
                            {nome}
                            {e.origem === "troca" ? " ⇄" : ""}
                            <button aria-label={`Tirar ${nome}`}>×</button>
                          </form>
                        );
                      })}
                    </div>
                    {livres.length > 0 && (
                      <form action={addEscala} className="add-chip">
                        <input type="hidden" name="data" value={d} />
                        <input type="hidden" name="turno" value={t.codigo} />
                        <input type="hidden" name="volta" value={voltaUrl} />
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
              {!passado && (
                <form action={refazerDia}>
                  <input type="hidden" name="data" value={d} />
                  <input type="hidden" name="volta" value={voltaUrl} />
                  <button className="muted pequeno" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}>
                    refazer pelo padrão
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
      </div>
      <p className="muted pequeno">✅ = já chegou · ⇄ = entrou por troca. O mesmo motoboy não pode ficar duas vezes no mesmo turno.</p>
    </>
  );
}
