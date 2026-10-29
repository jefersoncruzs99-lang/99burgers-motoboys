import Link from "next/link";
import { ROTULO_FAIXA, dataLonga, hora, moeda, somarDias } from "@/lib/datas";
import { ROTULO_STATUS_OCORRENCIA, type Dia } from "@/lib/tipos";
import { Avatar } from "./Avatar";
import { Pontos } from "./Pontos";

type Acao = (fd: FormData) => Promise<void>;

export interface AcoesDia {
  chegada: Acao;
  entregas: Acao;
  ocorrencia: Acao;
  /** pagar o turno em dinheiro na hora */
  dinheiro?: Acao;
  /** só na administração */
  corrigir?: Acao;
  remover?: Acao;
}

/** Visão do dia: quem chegou, quem faltou, entregas e ocorrências. Usada pelo gestor de rota e pela administração. */
export function VisaoDia({ dia, base, acoes, hoje, minData }: { dia: Dia; base: string; acoes: AcoesDia; hoje: string; minData?: string }) {
  const anterior = somarDias(dia.data, -1);
  const proximo = somarDias(dia.data, 1);
  const podeVoltar = !minData || anterior >= minData;
  const podeRegistrar = dia.data <= hoje && (!minData || dia.data >= minData);

  return (
    <div className="pilha">
      <div className="linha entre">
        {podeVoltar ? (
          <Link className="botao" href={`${base}?data=${anterior}`}>
            ← Dia anterior
          </Link>
        ) : (
          <span />
        )}
        <div style={{ textAlign: "center" }}>
          <strong style={{ textTransform: "capitalize" }}>{dataLonga(dia.data)}</strong>
          <div className="muted pequeno">
            {dia.feriado ? `Feriado: ${dia.feriado} (valores de domingo)` : dia.tipo_dia === "domingo" ? "Domingo" : "Dia de semana"}
            {dia.data !== hoje && (
              <>
                {" · "}
                <Link href={base}>voltar para hoje</Link>
              </>
            )}
          </div>
        </div>
        {proximo <= somarDias(hoje, 14) ? (
          <Link className="botao" href={`${base}?data=${proximo}`}>
            Próximo dia →
          </Link>
        ) : (
          <span />
        )}
      </div>

      {dia.turnos.map((t) => {
        const chegaram = t.pessoas.filter((p) => p.registro);
        const escalados = t.pessoas.filter((p) => p.escalado);
        const faltando = escalados.filter((p) => !p.registro);
        const totalDiarias = chegaram.reduce((s, p) => s + Number(p.registro?.valor_diaria ?? 0), 0);
        const totalEntregas = chegaram.reduce((s, p) => s + Number(p.registro?.valor_entregas ?? 0), 0);
        const naoEscalados = dia.motoboys.filter((m) => !t.pessoas.some((p) => p.motoboy_id === m.id));
        return (
          <section key={t.codigo} className="cartao turno pilha">
            <div className="cab">
              <h2>
                {t.nome} <span className="muted" style={{ fontSize: "1rem" }}>· {t.setor}</span>
              </h2>
              <span className="muted">
                {t.inicio} às {t.fim}
              </span>
            </div>
            <div className="linha" style={{ flexWrap: "wrap", gap: 8 }}>
              <span className="selo ok">
                Chegaram {chegaram.length} de {escalados.length}
              </span>
              {faltando.length > 0 && <span className="selo falta">Faltando {faltando.length}</span>}
              <span className="muted pequeno">
                Diárias {moeda(totalDiarias)} · Entregas {moeda(totalEntregas)}
              </span>
            </div>

            {t.pessoas.length === 0 && <p className="muted">Ninguém na escala deste turno.</p>}
            <ul className="pessoas">
              {t.pessoas.map((p) => {
                const r = p.registro;
                return (
                  <li key={p.motoboy_id} style={{ flexWrap: "wrap" }}>
                    <div className="pessoa" style={{ minWidth: 200 }}>
                      <Avatar nome={p.nome} foto={p.foto_url} tamanho={44} />
                      <div>
                      <span className="nome">{p.nome}</span>
                      <div className="mini" style={{ marginTop: 4 }}>
                        {r ? (
                          <>
                            <span className="selo ok">
                              {hora(r.chegada_em)} · {ROTULO_FAIXA[r.faixa]}
                            </span>
                            {r.fora_da_escala && <span className="selo extra">Fora da escala</span>}
                            {r.origem_chegada === "gestor" && <span className="selo">Registrado por gestor</span>}
                            {r.pago && <span className="selo ama">{r.pago_dinheiro ? "💵 Pago em dinheiro" : "Pago"}</span>}
                          </>
                        ) : (
                          <span className="selo falta">Não chegou</span>
                        )}
                      </div>
                      {r && (
                        <div className="muted pequeno" style={{ marginTop: 4 }}>
                          Diária {moeda(r.valor_diaria)}
                          {r.qtd_entregas > 0 && <> · {r.qtd_entregas} entregas</>}
                          {r.observacao && <> · {r.observacao}</>}
                        </div>
                      )}
                      </div>
                    </div>

                    {r && !r.pago && (
                      <form action={acoes.entregas} className="mini">
                        <input type="hidden" name="data" value={dia.data} />
                        <input type="hidden" name="registro_id" value={r.id} />
                        <label className="muted pequeno" htmlFor={`qtd-${r.id}`}>
                          Qtd
                        </label>
                        <input
                          id={`qtd-${r.id}`}
                          name="qtd"
                          inputMode="numeric"
                          defaultValue={r.qtd_entregas > 0 ? String(r.qtd_entregas) : ""}
                          placeholder="0"
                          style={{ width: 64 }}
                          required
                        />
                        <label className="muted pequeno" htmlFor={`ent-${r.id}`}>
                          R$
                        </label>
                        <input
                          id={`ent-${r.id}`}
                          name="valor"
                          inputMode="decimal"
                          defaultValue={Number(r.valor_entregas) > 0 ? String(r.valor_entregas).replace(".", ",") : ""}
                          placeholder="0,00"
                          style={{ width: 90 }}
                          required
                        />
                        <button className="botao primario">{Number(r.valor_entregas) > 0 || r.qtd_entregas > 0 ? "Atualizar" : "Lançar"}</button>
                      </form>
                    )}
                    {r && r.pago && <strong>{moeda(Number(r.valor_diaria) + Number(r.valor_entregas))}</strong>}

                    {r && !r.pago && acoes.dinheiro && (Number(r.valor_entregas) > 0 || r.qtd_entregas > 0) && (
                      <details>
                        <summary className="botao">💵 Pago em dinheiro</summary>
                        <form action={acoes.dinheiro} className="pilha" style={{ marginTop: 8, gap: 6 }}>
                          <input type="hidden" name="data" value={dia.data} />
                          <input type="hidden" name="registro_id" value={r.id} />
                          <span className="pequeno">
                            Diária {moeda(r.valor_diaria)} + entregas {moeda(r.valor_entregas)} ={" "}
                            <strong>{moeda(Number(r.valor_diaria) + Number(r.valor_entregas))}</strong>
                          </span>
                          <button className="botao sucesso">Confirmar: paguei em dinheiro</button>
                        </form>
                      </details>
                    )}

                    {!r && podeRegistrar && (
                      <details>
                        <summary className="botao">Registrar chegada</summary>
                        <FormChegada acao={acoes.chegada} data={dia.data} turno={t.codigo} motoboy={p.motoboy_id} inicio={t.inicio} />
                      </details>
                    )}

                    {r && !r.pago && (acoes.corrigir || acoes.remover) && (
                      <details>
                        <summary className="muted pequeno">Corrigir</summary>
                        <div className="pilha" style={{ marginTop: 8 }}>
                          {acoes.corrigir && (
                            <form action={acoes.corrigir} className="mini">
                              <input type="hidden" name="data" value={dia.data} />
                              <input type="hidden" name="registro_id" value={r.id} />
                              <input type="time" name="hora" defaultValue={hora(r.chegada_em)} required />
                              <button className="botao">Mudar horário</button>
                            </form>
                          )}
                          {acoes.remover && (
                            <form action={acoes.remover}>
                              <input type="hidden" name="data" value={dia.data} />
                              <input type="hidden" name="registro_id" value={r.id} />
                              <button className="botao perigo">Apagar chegada</button>
                            </form>
                          )}
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>

            {podeRegistrar && naoEscalados.length > 0 && (
              <details>
                <summary className="muted">+ Veio alguém que não estava na escala</summary>
                <form action={acoes.chegada} className="pilha" style={{ marginTop: 8 }}>
                  <input type="hidden" name="data" value={dia.data} />
                  <input type="hidden" name="turno" value={t.codigo} />
                  <select name="motoboy_id" required defaultValue="" aria-label="Motoboy">
                    <option value="" disabled>
                      Escolha o motoboy
                    </option>
                    {naoEscalados.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                  <div className="mini">
                    <label htmlFor={`h-extra-${t.codigo}`}>Chegou às</label>
                    <input id={`h-extra-${t.codigo}`} type="time" name="hora" defaultValue={t.inicio} required />
                  </div>
                  <input name="obs" placeholder="Observação (opcional)" />
                  <button className="botao primario">Registrar chegada</button>
                </form>
              </details>
            )}

            <div className="pilha">
              <h3 style={{ margin: 0 }}>Intercorrências</h3>
              {t.ocorrencias.length === 0 && <p className="muted pequeno" style={{ margin: 0 }}>Nenhuma registrada.</p>}
              {t.ocorrencias.map((o) => (
                <div key={o.id} className="pequeno" style={o.status === "anulada" ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                  <Pontos valor={o.pontos} /> <strong>{o.tipo_nome}</strong>
                  {o.motoboy && <> · {o.motoboy}</>}
                  {o.descricao && <span className="muted"> · {o.descricao}</span>}
                  <span className="muted">
                    {" "}
                    · {o.por}, {hora(o.em)}
                  </span>
                  {o.status !== "valida" && <span className="selo ama" style={{ marginLeft: 6 }}>{ROTULO_STATUS_OCORRENCIA[o.status]}</span>}
                  {o.ciente_em && o.status === "valida" && <span className="selo ok" style={{ marginLeft: 6 }}>Motoboy ciente</span>}
                </div>
              ))}
              <details>
                <summary className="muted">+ Registrar intercorrência</summary>
                <form action={acoes.ocorrencia} className="pilha" style={{ marginTop: 8 }}>
                  <input type="hidden" name="data" value={dia.data} />
                  <input type="hidden" name="turno" value={t.codigo} />
                  <div className="campos">
                    <select name="motoboy_id" defaultValue="" aria-label="Motoboy">
                      <option value="">Motoboy (obrigatório se tiver pontos)</option>
                      {dia.motoboys.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                    <select name="tipo" required defaultValue="" aria-label="O que aconteceu">
                      <option value="" disabled>
                        O que aconteceu?
                      </option>
                      {(["negativa", "positiva", "registro"] as const).map((g) => (
                        <optgroup key={g} label={g === "negativa" ? "Tira pontos" : g === "positiva" ? "Dá pontos" : "Só registro (não conta ponto)"}>
                          {dia.tipos_ocorrencia
                            .filter((tp) => tp.grupo === g)
                            .map((tp) => (
                              <option key={tp.codigo} value={tp.codigo}>
                                {`${tp.nome}${tp.pontos !== 0 ? ` (${tp.pontos > 0 ? "+" : ""}${tp.pontos})` : ""}`}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <textarea name="descricao" rows={2} placeholder="Detalhes (opcional)" />
                  <button className="botao">Salvar intercorrência</button>
                </form>
              </details>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FormChegada({ acao, data, turno, motoboy, inicio }: { acao: Acao; data: string; turno: string; motoboy: string; inicio: string }) {
  return (
    <form action={acao} className="mini" style={{ marginTop: 8, flexWrap: "wrap" }}>
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="turno" value={turno} />
      <input type="hidden" name="motoboy_id" value={motoboy} />
      <input type="time" name="hora" defaultValue={inicio} required aria-label="Hora da chegada" />
      <input name="obs" placeholder="Obs. (opcional)" style={{ width: 160 }} />
      <button className="botao primario">Salvar</button>
    </form>
  );
}
