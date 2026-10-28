import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { Pontos } from "@/components/Pontos";
import { exigirGestor } from "@/lib/auth";
import { dataComDia, hora, moeda } from "@/lib/datas";
import { ROTULO_TIPO_INCENTIVO, type TipoIncentivo } from "@/lib/tipos";
import { apurarIncentivos, decidirOcorrencia, salvarIncentivo, salvarPontuacao, salvarTipoOcorrencia } from "../actions";

const nomeDe = (x: unknown) => (x as { nome: string } | null)?.nome ?? "?";

export default async function AdminIncentivos({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const [{ data: incentivos }, { data: tipos }, { data: contestadas }, { data: ganhos }, { data: config }] = await Promise.all([
    supabase.from("mb_incentivos").select("*").order("ordem"),
    supabase.from("mb_tipos_ocorrencia").select("*").order("ordem").order("nome"),
    supabase
      .from("mb_ocorrencias")
      .select("id, data, tipo, pontos, descricao, contestacao, contestada_em, registrado_por, mb_motoboys(nome), mb_tipos_ocorrencia(nome)")
      .eq("status", "contestada")
      .order("contestada_em"),
    supabase
      .from("mb_incentivos_ganhos")
      .select("id, descricao, valor, criado_em, ajuste_id, mb_motoboys(nome)")
      .order("criado_em", { ascending: false })
      .limit(30),
    supabase.from("mb_config").select("pontos_por_entrega, prazo_contestacao_dias").maybeSingle(),
  ]);

  return (
    <>
      <h1>Incentivos e intercorrências</h1>
      <Mensagens erro={sp.erro} ok={sp.ok} />

      {(contestadas ?? []).length > 0 && (
        <section className="cartao alerta pilha">
          <h2>Contestações para analisar</h2>
          {(contestadas ?? []).map((o) => (
            <div key={o.id} className="bloco pilha" style={{ gap: 6 }}>
              <div>
                <Pontos valor={o.pontos} /> <strong>{nomeDe(o.mb_tipos_ocorrencia)}</strong> · {nomeDe(o.mb_motoboys)} · {dataComDia(o.data)}
                <div className="muted pequeno">
                  Registrado por {o.registrado_por}
                  {o.descricao && <> · “{o.descricao}”</>}
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>Versão do motoboy:</strong> {o.contestacao}
                </div>
              </div>
              <form action={decidirOcorrencia} className="pilha" style={{ gap: 6 }}>
                <input type="hidden" name="id" value={o.id} />
                <input name="justificativa" required placeholder="Justificativa da decisão (o motoboy vê)" />
                <div className="mini">
                  <button className="botao" name="decisao" value="manter">
                    Manter
                  </button>
                  <button className="botao sucesso" name="decisao" value="anular">
                    Anular (devolve os pontos)
                  </button>
                </div>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="cartao pilha">
        <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>🎯 Incentivos</h2>
          <form action={apurarIncentivos}>
            <button className="botao primario">Apurar prêmios agora</button>
          </form>
        </div>
        <p className="muted pequeno" style={{ margin: 0 }}>
          Os prêmios viram bônus em Pagamentos automaticamente (também quando o motoboy abre o app). Metas do mês e ranking são apurados depois que o mês
          fecha. Para cancelar um prêmio antes de pagar, remova o ajuste em Pagamentos. Cada incentivo conta a partir da data “vale a partir de”.
        </p>
        {(incentivos ?? []).map((i) => (
          <FormIncentivo key={i.id} i={i} />
        ))}
        <details>
          <summary className="botao">+ Novo incentivo</summary>
          <FormIncentivo />
        </details>
      </section>

      <section className="cartao pilha">
        <h2>Intercorrências e pontos</h2>
        <p className="muted pequeno" style={{ margin: 0 }}>
          Negativo tira pontos, positivo dá pontos, zero é só registro (como falta e atraso). Pontos nunca viram desconto em dinheiro. Mudar aqui vale só para
          os próximos registros.
        </p>
        <form action={salvarPontuacao} className="campos bloco">
          <div className="campo">
            <label>Pontos por entrega</label>
            <input name="pontos_por_entrega" inputMode="numeric" defaultValue={config?.pontos_por_entrega ?? 1} />
          </div>
          <div className="campo">
            <label>Prazo para contestar (dias)</label>
            <input name="prazo_contestacao_dias" inputMode="numeric" defaultValue={config?.prazo_contestacao_dias ?? 7} />
          </div>
          <button className="botao">Salvar</button>
        </form>
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Intercorrência</th>
                <th>Pontos</th>
                <th>Ativa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(tipos ?? []).map((t) => (
                <tr key={t.codigo}>
                  <td colSpan={4} style={{ padding: 0 }}>
                    <form action={salvarTipoOcorrencia} className="mini" style={{ padding: "6px 8px", flexWrap: "wrap" }}>
                      <input type="hidden" name="codigo" value={t.codigo} />
                      <input name="nome" defaultValue={t.nome} required style={{ flex: 1, minWidth: 200 }} />
                      <input name="pontos" defaultValue={t.pontos} inputMode="numeric" style={{ width: 70 }} aria-label="Pontos" />
                      <label className="check">
                        <input type="checkbox" name="ativo" defaultChecked={t.ativo} /> ativa
                      </label>
                      <button className="botao">Salvar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={salvarTipoOcorrencia} className="mini bloco" style={{ flexWrap: "wrap" }}>
          <input type="hidden" name="novo" value="1" />
          <input name="nome" required placeholder="Nova intercorrência (ex.: Esqueceu o molho)" style={{ flex: 1, minWidth: 220 }} />
          <input name="pontos" placeholder="-10" inputMode="numeric" style={{ width: 70 }} aria-label="Pontos" />
          <button className="botao primario">Adicionar</button>
        </form>
      </section>

      <section className="cartao pilha">
        <h2>Últimos prêmios</h2>
        {(ganhos ?? []).length === 0 && <p className="muted">Nenhum prêmio ainda.</p>}
        <ul className="pessoas">
          {(ganhos ?? []).map((g) => (
            <li key={g.id} style={g.ajuste_id ? undefined : { opacity: 0.5, textDecoration: "line-through" }}>
              <span>
                🏅 <strong>{nomeDe(g.mb_motoboys)}</strong> · {g.descricao}
                <span className="muted pequeno">
                  {" "}
                  · {dataComDia(g.criado_em.slice(0, 10))} {hora(g.criado_em)}
                </span>
              </span>
              <strong>{moeda(g.valor)}</strong>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

interface Incentivo {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: TipoIncentivo;
  quantidade: number | null;
  posicao: number | null;
  valor: number;
  inicio: string;
  ativo: boolean;
}

function FormIncentivo({ i }: { i?: Incentivo }) {
  return (
    <form action={salvarIncentivo} className="pilha bloco" style={i && !i.ativo ? { opacity: 0.75 } : undefined}>
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="campos">
        <div className="campo">
          <label>Nome</label>
          <input name="nome" defaultValue={i?.nome} required />
        </div>
        <div className="campo">
          <label>Tipo</label>
          <select name="tipo" defaultValue={i?.tipo ?? "a_cada_entregas"}>
            {Object.entries(ROTULO_TIPO_INCENTIVO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Quantidade (entregas ou turnos mínimos)</label>
          <input name="quantidade" inputMode="numeric" defaultValue={i?.quantidade ?? ""} />
        </div>
        <div className="campo">
          <label>Posição (para ranking)</label>
          <input name="posicao" inputMode="numeric" defaultValue={i?.posicao ?? ""} />
        </div>
        <div className="campo">
          <label>Prêmio R$</label>
          <input name="valor" inputMode="decimal" defaultValue={i ? String(i.valor).replace(".", ",") : ""} required />
        </div>
        <div className="campo">
          <label>Vale a partir de</label>
          <input type="date" name="inicio" defaultValue={i?.inicio} />
        </div>
      </div>
      <input name="descricao" defaultValue={i?.descricao ?? ""} placeholder="Explicação que o motoboy vê" />
      <div className="linha entre">
        <label className="check">
          <input type="checkbox" name="ativo" defaultChecked={i?.ativo ?? true} /> Ativo
        </label>
        <button className="botao">{i ? "Salvar" : "Criar incentivo"}</button>
      </div>
    </form>
  );
}
