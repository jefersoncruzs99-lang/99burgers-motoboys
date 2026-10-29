import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { dataComDia, hojeISO, moeda } from "@/lib/datas";
import { ROTULO_FORMA, type EmAberto, type FormaPagamento } from "@/lib/tipos";
import { addAjuste, desfazerPagamento, pagar, removerAjuste } from "../actions";

interface Linha {
  motoboy_id: string;
  nome: string;
  pix: string | null;
  forma_pagamento: FormaPagamento;
  ativo: boolean;
  data_pagamento: string;
  aberto: EmAberto;
  tudo: EmAberto;
  sem_entregas: number;
}

const total = (a: EmAberto) => Number(a.diarias) + Number(a.entregas) + Number(a.ajustes);

export default async function AdminPagamentos({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const hoje = hojeISO();
  const [{ data: resumo, error }, { data: ajustes }, { data: historico }, { data: motoboys }] = await Promise.all([
    supabase.rpc("mb_a_resumo_pagamentos"),
    supabase.from("mb_ajustes").select("id, data, valor, motivo, mb_motoboys(nome)").is("pagamento_id", null).order("data"),
    supabase
      .from("mb_pagamentos")
      .select("id, data_pagamento, diarias, entregas, ajustes, total, observacao, forma, pago_em, mb_motoboys(nome)")
      .order("pago_em", { ascending: false })
      .limit(40),
    supabase.from("mb_motoboys").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const linhas = ((resumo as Linha[] | null) ?? []).filter((l) => l.tudo.dias > 0 || total(l.tudo) !== 0 || l.ativo);
  const datas = [...new Set(linhas.map((l) => l.data_pagamento))].sort();
  const nomeDe = (x: unknown) => (x as { nome: string } | null)?.nome ?? "?";

  return (
    <>
      <h1>Pagamentos</h1>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />
      <p className="muted">
        Cada pagamento inclui os dias <strong>antes</strong> da data do pagamento. Quinzenal: dias 1 e 16. Semanal: quarta-feira.
      </p>

      {datas.map((d) => {
        const doDia = linhas.filter((l) => l.data_pagamento === d);
        const soma = doDia.reduce((s, l) => s + total(l.aberto), 0);
        return (
          <section key={d} className={`cartao pilha ${d <= hoje ? "destaque" : ""}`}>
            <div className="linha entre" style={{ flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}>
                {d === hoje ? "Pagar hoje" : d < hoje ? "Atrasado" : "Próximo pagamento"} · {dataComDia(d)}
              </h2>
              <strong className="grande-valor" style={{ fontSize: "1.5rem" }}>
                {moeda(soma)}
              </strong>
            </div>
            <div className="tabela-rolagem">
              <table>
                <thead>
                  <tr>
                    <th>Motoboy</th>
                    <th>Turnos</th>
                    <th>Diárias</th>
                    <th>Entregas</th>
                    <th>Ajustes</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {doDia.map((l) => (
                    <tr key={l.motoboy_id}>
                      <td>
                        <strong>{l.nome}</strong>
                        <div className="muted pequeno">
                          {ROTULO_FORMA[l.forma_pagamento]}
                          {l.pix && <> · PIX {l.pix}</>}
                        </div>
                        {l.sem_entregas > 0 && <div className="pequeno" style={{ color: "var(--amarelo)" }}>{l.sem_entregas} turno(s) sem entregas lançadas</div>}
                        {total(l.tudo) !== total(l.aberto) && (
                          <div className="muted pequeno">Já acumulando para o próximo: {moeda(total(l.tudo) - total(l.aberto))}</div>
                        )}
                      </td>
                      <td>{l.aberto.dias}</td>
                      <td>{moeda(l.aberto.diarias)}</td>
                      <td>{moeda(l.aberto.entregas)}</td>
                      <td>{moeda(l.aberto.ajustes)}</td>
                      <td>
                        <strong>{moeda(total(l.aberto))}</strong>
                      </td>
                      <td>
                        {(l.aberto.dias > 0 || Number(l.aberto.ajustes) !== 0) && (
                          <form action={pagar} className="mini">
                            <input type="hidden" name="motoboy_id" value={l.motoboy_id} />
                            <input type="hidden" name="data" value={d} />
                            <select name="forma" defaultValue="pix" aria-label="Forma de pagamento" style={{ minHeight: 38 }}>
                              <option value="pix">PIX</option>
                              <option value="dinheiro">Dinheiro</option>
                            </select>
                            <button className="botao sucesso">Marcar pago</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="cartao pilha">
        <h2>Ajustes (vale, bônus, desconto)</h2>
        <form action={addAjuste} className="pilha">
          <div className="campos">
            <div className="campo">
              <label>Motoboy</label>
              <select name="motoboy_id" required defaultValue="">
                <option value="" disabled>
                  Escolha
                </option>
                {(motoboys ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label>Tipo</label>
              <select name="sinal" defaultValue="-">
                <option value="-">Desconto / vale (−)</option>
                <option value="+">Bônus / acréscimo (+)</option>
              </select>
            </div>
            <div className="campo">
              <label>Valor R$</label>
              <input name="valor" inputMode="decimal" required placeholder="0,00" />
            </div>
            <div className="campo">
              <label>Data</label>
              <input type="date" name="data" defaultValue={hoje} required />
            </div>
          </div>
          <div className="campo">
            <label>Motivo (o motoboy vê)</label>
            <input name="motivo" required placeholder="Ex.: vale combustível, bônus chuva" />
          </div>
          <button className="botao primario">Lançar ajuste</button>
        </form>
        {(ajustes ?? []).length > 0 && (
          <ul className="pessoas">
            {(ajustes ?? []).map((a) => (
              <li key={a.id}>
                <span>
                  {dataComDia(a.data)} · <strong>{nomeDe(a.mb_motoboys)}</strong> · {a.motivo}
                </span>
                <span className="mini">
                  <strong style={{ color: Number(a.valor) < 0 ? "var(--vermelho)" : "var(--verde)" }}>{moeda(a.valor)}</strong>
                  <form action={removerAjuste}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="botao">Remover</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao pilha">
        <h2>Pagamentos feitos</h2>
        {(historico ?? []).length === 0 && <p className="muted">Nenhum ainda.</p>}
        {(historico ?? []).length > 0 && (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Motoboy</th>
                  <th>Diárias</th>
                  <th>Entregas</th>
                  <th>Ajustes</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(historico ?? []).map((h) => (
                  <tr key={h.id}>
                    <td>
                      {dataComDia(h.data_pagamento)}
                      <div className="muted pequeno">{h.forma === "dinheiro" ? "💵 Dinheiro" : "PIX"}</div>
                    </td>
                    <td>
                      {nomeDe(h.mb_motoboys)}
                      {h.observacao && <div className="muted pequeno">{h.observacao}</div>}
                    </td>
                    <td>{moeda(h.diarias)}</td>
                    <td>{moeda(h.entregas)}</td>
                    <td>{moeda(h.ajustes)}</td>
                    <td>
                      <strong>{moeda(h.total)}</strong>
                    </td>
                    <td>
                      <details>
                        <summary className="muted pequeno">desfazer</summary>
                        <form action={desfazerPagamento} style={{ marginTop: 6 }}>
                          <input type="hidden" name="pagamento_id" value={h.id} />
                          <button className="botao perigo">Confirmar: desfazer</button>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
