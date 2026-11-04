import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { ROTULO_FAIXA, dataComDia, hojeISO, hora, moeda } from "@/lib/datas";
import { ROTULO_FORMA, ROTULO_TURNO, type FormaPagamento, type Turno } from "@/lib/tipos";
import { addAjuste, desfazerPagamento, editarAjuste, pagar, removerAjuste } from "../actions";

type Item =
  | { tipo: "turno"; id: string; data: string; turno: Turno; chegada_em: string; faixa: number; valor_diaria: number; valor_entregas: number; qtd_entregas: number }
  | { tipo: "ajuste"; id: string; data: string; valor: number; motivo: string };

interface Grupo {
  data_pagamento: string;
  motoboy_id: string;
  nome: string;
  pix: string | null;
  forma_pagamento: FormaPagamento;
  diarias: number;
  entregas: number;
  ajustes: number;
  total: number;
  dias: number;
  sem_entregas: number;
  itens: Item[];
}

export default async function AdminPagamentos({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const hoje = hojeISO();
  const [{ data: periodos, error }, { data: ajustes }, { data: historico }, { data: motoboys }] = await Promise.all([
    supabase.rpc("mb_a_pagamentos_periodos"),
    supabase.from("mb_ajustes").select("id, data, valor, motivo, motoboy_id, mb_motoboys(nome)").is("pagamento_id", null).order("data"),
    supabase
      .from("mb_pagamentos")
      .select("id, data_pagamento, diarias, entregas, ajustes, total, observacao, forma, pago_em, mb_motoboys(nome)")
      .order("pago_em", { ascending: false })
      .limit(40),
    supabase.from("mb_motoboys").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const grupos = (periodos as Grupo[] | null) ?? [];
  const datas = [...new Set(grupos.map((g) => g.data_pagamento))].sort();
  const nomeDe = (x: unknown) => (x as { nome: string } | null)?.nome ?? "?";
  const atrasado = grupos.filter((g) => g.data_pagamento < hoje).reduce((s, g) => s + Number(g.total), 0);
  const deHoje = grupos.filter((g) => g.data_pagamento === hoje).reduce((s, g) => s + Number(g.total), 0);
  const futuro = grupos.filter((g) => g.data_pagamento > hoje).reduce((s, g) => s + Number(g.total), 0);

  return (
    <>
      <h1>Pagamentos</h1>
      <Mensagens erro={sp.erro ?? error?.message} ok={sp.ok} />
      <div className="numeros">
        <div className={`cartao ${atrasado > 0 ? "alerta" : ""}`}>
          <span className="muted">⚠️ Atrasado (não marcado como pago)</span>
          <b className="grande-valor" style={{ color: atrasado > 0 ? "var(--vermelho)" : undefined }}>
            {moeda(atrasado)}
          </b>
        </div>
        <div className="cartao destaque">
          <span className="muted">Pagar hoje</span>
          <b className="grande-valor">{moeda(deHoje)}</b>
        </div>
        <div className="cartao">
          <span className="muted">Acumulando para as próximas datas</span>
          <b className="grande-valor" style={{ color: "var(--branco)" }}>
            {moeda(futuro)}
          </b>
        </div>
      </div>
      <p className="muted pequeno">
        Cada turno vai para a primeira data de pagamento depois dele: quinzenal nos dias 1 e 16, semanal na quarta. Toque no nome para ver turno por
        turno. &quot;Marcar pago&quot; paga só o período daquele bloco.
      </p>
      {datas.length === 0 && <div className="ok">Nenhum valor em aberto. Tudo pago! ✅</div>}

      {datas.map((d) => {
        const doDia = grupos.filter((g) => g.data_pagamento === d);
        const soma = doDia.reduce((s, g) => s + Number(g.total), 0);
        const status = d < hoje ? "atrasado" : d === hoje ? "hoje" : "futuro";
        return (
          <section key={d} className={`cartao pilha pag-bloco pag-${status}`}>
            <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
              <div>
                <span className={`selo ${status === "atrasado" ? "falta" : status === "hoje" ? "ama" : ""}`}>
                  {status === "atrasado" ? "⚠️ Atrasado: venceu em" : status === "hoje" ? "💸 Pagar hoje" : "📅 Próximo pagamento"}
                </span>
                <h2 style={{ margin: "6px 0 0" }}>{dataComDia(d)}</h2>
                <span className="muted pequeno">{doDia.length} motoboy(s)</span>
              </div>
              <strong className="grande-valor" style={{ fontSize: "1.6rem" }}>
                {moeda(soma)}
              </strong>
            </div>
            <div className="pilha" style={{ gap: 8 }}>
              {doDia.map((g) => (
                <div key={g.motoboy_id} className="pag-linha">
                  <details className="pag-detalhe">
                    <summary>
                      <span className="pag-nome">
                        <strong>{g.nome}</strong>
                        <span className="muted pequeno">
                          {ROTULO_FORMA[g.forma_pagamento]}
                          {g.pix && <> · PIX {g.pix}</>} · {g.dias} turno(s)
                        </span>
                        {g.sem_entregas > 0 && (
                          <span className="pequeno" style={{ color: "var(--amarelo)" }}>
                            {g.sem_entregas} turno(s) sem entregas lançadas
                          </span>
                        )}
                      </span>
                      <strong className="pag-total">{moeda(g.total)}</strong>
                    </summary>
                    <div className="tabela-rolagem">
                      <table>
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Turno</th>
                            <th>Chegada</th>
                            <th>Diária</th>
                            <th>Entregas</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.itens.map((it) =>
                            it.tipo === "turno" ? (
                              <tr key={it.id}>
                                <td>{dataComDia(it.data)}</td>
                                <td>{ROTULO_TURNO[it.turno] ?? it.turno}</td>
                                <td>
                                  {hora(it.chegada_em)}
                                  <div className="muted pequeno">{ROTULO_FAIXA[it.faixa]}</div>
                                </td>
                                <td>{moeda(it.valor_diaria)}</td>
                                <td>
                                  {Number(it.valor_entregas) > 0 || it.qtd_entregas > 0 ? (
                                    <>
                                      {moeda(it.valor_entregas)}
                                      <div className="muted pequeno">{it.qtd_entregas} entrega(s)</div>
                                    </>
                                  ) : (
                                    <span style={{ color: "var(--amarelo)" }}>a lançar</span>
                                  )}
                                </td>
                                <td>
                                  <strong>{moeda(Number(it.valor_diaria) + Number(it.valor_entregas))}</strong>
                                </td>
                              </tr>
                            ) : (
                              <tr key={it.id}>
                                <td>{dataComDia(it.data)}</td>
                                <td colSpan={4}>
                                  {Number(it.valor) < 0 ? "Desconto / vale" : "Bônus"}: {it.motivo}
                                </td>
                                <td>
                                  <strong style={{ color: Number(it.valor) < 0 ? "var(--vermelho)" : "var(--verde)" }}>{moeda(it.valor)}</strong>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3}>
                              <strong>Total</strong>
                            </td>
                            <td>{moeda(g.diarias)}</td>
                            <td>{moeda(g.entregas)}</td>
                            <td>
                              <strong>{moeda(g.total)}</strong>
                              {Number(g.ajustes) !== 0 && <div className="muted pequeno">ajustes {moeda(g.ajustes)}</div>}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </details>
                  <form action={pagar} className="mini pag-pagar">
                    <input type="hidden" name="motoboy_id" value={g.motoboy_id} />
                    <input type="hidden" name="data" value={d} />
                    <select name="forma" defaultValue="pix" aria-label="Forma de pagamento" style={{ minHeight: 38 }}>
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                    </select>
                    <button className="botao sucesso">Marcar pago</button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="cartao pilha">
        <h2>Ajustes (vale, bônus, desconto)</h2>
        <p className="muted pequeno" style={{ margin: 0 }}>
          Dá para editar ou remover enquanto não foi pago. Se já foi pago, desfaça o pagamento lá embaixo, corrija e marque pago de novo.
        </p>
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
              <li key={a.id} style={{ flexWrap: "wrap" }}>
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
                <details style={{ width: "100%" }}>
                  <summary className="muted pequeno" style={{ cursor: "pointer", textDecoration: "underline" }}>
                    editar
                  </summary>
                  <form action={editarAjuste} className="pilha bloco" style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={a.id} />
                    <div className="campos">
                      <div className="campo">
                        <label>Motoboy</label>
                        <select name="motoboy_id" required defaultValue={a.motoboy_id}>
                          {(motoboys ?? []).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="campo">
                        <label>Tipo</label>
                        <select name="sinal" defaultValue={Number(a.valor) < 0 ? "-" : "+"}>
                          <option value="-">Desconto / vale (−)</option>
                          <option value="+">Bônus / acréscimo (+)</option>
                        </select>
                      </div>
                      <div className="campo">
                        <label>Valor R$</label>
                        <input name="valor" inputMode="decimal" required defaultValue={String(Math.abs(Number(a.valor))).replace(".", ",")} />
                      </div>
                      <div className="campo">
                        <label>Data</label>
                        <input type="date" name="data" required defaultValue={a.data} />
                      </div>
                    </div>
                    <div className="campo">
                      <label>Motivo (o motoboy vê)</label>
                      <input name="motivo" required defaultValue={a.motivo} />
                    </div>
                    <button className="botao primario">Salvar correção</button>
                  </form>
                </details>
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
