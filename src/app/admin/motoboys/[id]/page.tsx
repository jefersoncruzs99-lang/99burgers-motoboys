import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { exigirGestor } from "@/lib/auth";
import { FUSO, ROTULO_FAIXA, dataComDia, hojeISO, moeda } from "@/lib/datas";
import { ROTULO_FORMA, ROTULO_STATUS_OCORRENCIA, ROTULO_TURNO, type Motoboy, type Turno } from "@/lib/tipos";

const ROTULO_DOC: Record<string, string> = { contrato: "Contrato", regulamento: "Regulamento", termo_diario: "Termo do dia" };

function quando(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, dateStyle: "short", timeStyle: "medium" }).format(new Date(iso));
}

const versao = (x: unknown) => (x as { versao: number } | null)?.versao;
const nome = (x: unknown) => (x as { nome: string } | null)?.nome ?? "";

export default async function Dossie({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, nome: quem } = await exigirGestor();
  const [{ data: m }, { data: ass }, { data: regs }, { data: ocs }, { data: pags }, { data: ajs }, { data: trocas }] = await Promise.all([
    supabase.from("mb_motoboys").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("mb_assinaturas")
      .select("id, nome_assinado, cpf_assinado, texto_hash, ip, user_agent, assinado_em, mb_documentos(tipo, versao, titulo)")
      .eq("motoboy_id", id)
      .order("assinado_em"),
    supabase
      .from("mb_registros")
      .select(
        "id, data, turno, chegada_em, faixa, valor_diaria, valor_entregas, qtd_entregas, origem_chegada, registrado_por, fora_da_escala, termo_aceito_em, ip, user_agent, entregas_lancadas_por, observacao, pagamento_id, qr_validado, mb_documentos(versao)",
      )
      .eq("motoboy_id", id)
      .order("data", { ascending: false })
      .limit(500),
    supabase
      .from("mb_ocorrencias")
      .select("id, data, turno, pontos, descricao, status, registrado_por, criado_em, ciente_em, ciente_ip, contestacao, contestada_em, decisao, decidida_em, mb_tipos_ocorrencia(nome)")
      .eq("motoboy_id", id)
      .order("criado_em", { ascending: false }),
    supabase.from("mb_pagamentos").select("*").eq("motoboy_id", id).order("data_pagamento", { ascending: false }),
    supabase.from("mb_ajustes").select("*").eq("motoboy_id", id).order("data", { ascending: false }),
    supabase
      .from("mb_trocas")
      .select("id, data, turno, status, criada_em, aceita_em, de_motoboy, para_motoboy, aceita_por")
      .or(`de_motoboy.eq.${id},aceita_por.eq.${id}`)
      .order("data", { ascending: false })
      .limit(100),
  ]);
  if (!m) notFound();
  const mb = m as Motoboy;
  const totalPago = (pags ?? []).reduce((s, p) => s + Number(p.total), 0);
  const chegadasProprias = (regs ?? []).filter((r) => r.origem_chegada === "motoboy").length;

  return (
    <div className="pilha dossie">
      <div className="linha entre nao-imprime" style={{ flexWrap: "wrap", gap: 8 }}>
        <Link href="/admin/motoboys" className="botao">
          ← Motoboys
        </Link>
        <BotaoImprimir />
      </div>

      <section className="cartao pilha">
        <div className="pessoa" style={{ gap: 16 }}>
          <Avatar nome={mb.nome} foto={mb.foto_url} tamanho={72} />
          <div>
            <span className="marca">DOSSIÊ DO PRESTADOR · 99BURGER&apos;S LTDA · CNPJ 40.161.847/0001-72</span>
            <h1 style={{ margin: "4px 0" }}>{mb.nome}</h1>
            <div className="muted pequeno">
              CPF {mb.cpf ?? "não informado"} · Telefone {mb.telefone} · {ROTULO_FORMA[mb.forma_pagamento]} · PIX {mb.pix ?? "—"} ·{" "}
              {mb.ativo ? "Ativo" : "Inativo"}
            </div>
            <div className="muted pequeno">
              Gerado em {quando(new Date().toISOString())} por {quem}. {chegadasProprias} chegada(s) confirmada(s) pelo próprio prestador com aceite do termo
              do dia · {(regs ?? []).length} período(s) no total · {moeda(totalPago)} pagos.
            </div>
          </div>
        </div>
      </section>

      <section className="cartao pilha">
        <h2>1. Documentos aceitos eletronicamente</h2>
        {(ass ?? []).length === 0 && <p className="muted">Nenhum documento aceito.</p>}
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Aceito em</th>
                <th>Nome e CPF informados</th>
                <th>IP / aparelho</th>
                <th>Hash SHA-256 do texto</th>
              </tr>
            </thead>
            <tbody>
              {(ass ?? []).map((a) => {
                const d = a.mb_documentos as unknown as { tipo: string; versao: number; titulo: string } | null;
                return (
                  <tr key={a.id}>
                    <td>
                      {ROTULO_DOC[d?.tipo ?? ""] ?? d?.tipo} v{d?.versao}
                      <div className="muted pequeno">{d?.titulo}</div>
                    </td>
                    <td>{quando(a.assinado_em)}</td>
                    <td>
                      {a.nome_assinado}
                      <div className="muted pequeno">{a.cpf_assinado}</div>
                    </td>
                    <td className="pequeno">
                      {a.ip || "—"}
                      <div className="muted" style={{ maxWidth: 260, wordBreak: "break-word" }}>
                        {a.user_agent}
                      </div>
                    </td>
                    <td className="pequeno" style={{ wordBreak: "break-all", maxWidth: 220 }}>
                      {a.texto_hash}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cartao pilha">
        <h2>2. Períodos de disponibilidade (chegadas e termo do dia)</h2>
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Turno</th>
                <th>Chegada</th>
                <th>Quem registrou</th>
                <th>Aceite do termo</th>
                <th>Diária</th>
                <th>Entregas</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {(regs ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{dataComDia(r.data)}</td>
                  <td>{ROTULO_TURNO[r.turno as Turno] ?? r.turno}</td>
                  <td>
                    {quando(r.chegada_em)}
                    <div className="muted pequeno">
                      {ROTULO_FAIXA[r.faixa]}
                      {r.fora_da_escala ? " · fora da escala" : ""}
                    </div>
                  </td>
                  <td className="pequeno">
                    {r.origem_chegada === "motoboy" ? "O próprio prestador (app)" : r.registrado_por}
                    {r.qr_validado && <div style={{ color: "var(--verde)" }}>✔ Presença validada por QR da loja</div>}
                    {r.observacao && <div className="muted">{r.observacao}</div>}
                  </td>
                  <td className="pequeno">
                    {r.termo_aceito_em ? (
                      <>
                        Termo v{versao(r.mb_documentos) ?? "?"} em {quando(r.termo_aceito_em)}
                        <div className="muted" style={{ maxWidth: 240, wordBreak: "break-word" }}>
                          IP {r.ip || "—"} · {r.user_agent}
                        </div>
                      </>
                    ) : (
                      <span className="muted">— (registrado pelo gestor)</span>
                    )}
                  </td>
                  <td>{moeda(r.valor_diaria)}</td>
                  <td>
                    {moeda(r.valor_entregas)}
                    <div className="muted pequeno">
                      {r.qtd_entregas} entrega(s){r.entregas_lancadas_por ? ` · ${r.entregas_lancadas_por}` : ""}
                    </div>
                  </td>
                  <td>{r.pagamento_id ? "Sim" : "Não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cartao pilha">
        <h2>3. Intercorrências, ciência e contestação</h2>
        {(ocs ?? []).length === 0 && <p className="muted">Nenhuma intercorrência.</p>}
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Intercorrência</th>
                <th>Registrada por</th>
                <th>Ciência do prestador</th>
                <th>Contestação</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {(ocs ?? []).map((o) => (
                <tr key={o.id}>
                  <td>{dataComDia(o.data)}</td>
                  <td>
                    {nome(o.mb_tipos_ocorrencia)} ({o.pontos} pts)
                    {o.descricao && <div className="muted pequeno">{o.descricao}</div>}
                  </td>
                  <td className="pequeno">
                    {o.registrado_por}
                    <div className="muted">{quando(o.criado_em)}</div>
                  </td>
                  <td className="pequeno">{o.ciente_em ? `${quando(o.ciente_em)} · IP ${o.ciente_ip || "—"}` : "Ainda não visualizou"}</td>
                  <td className="pequeno">
                    {o.contestacao ? (
                      <>
                        “{o.contestacao}”<div className="muted">{quando(o.contestada_em)}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="pequeno">
                    {ROTULO_STATUS_OCORRENCIA[o.status as keyof typeof ROTULO_STATUS_OCORRENCIA]}
                    {o.decisao && (
                      <div className="muted">
                        {o.decisao} · {quando(o.decidida_em)}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cartao pilha">
        <h2>4. Pagamentos e ajustes</h2>
        <div className="tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Diárias</th>
                <th>Entregas</th>
                <th>Ajustes/bônus</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(pags ?? []).map((p) => (
                <tr key={p.id}>
                  <td>
                    {dataComDia(p.data_pagamento)}
                    <div className="muted pequeno">
                      {p.forma === "dinheiro" ? "Dinheiro" : "PIX"}
                      {p.observacao ? ` · ${p.observacao}` : ""}
                    </div>
                  </td>
                  <td>{moeda(p.diarias)}</td>
                  <td>{moeda(p.entregas)}</td>
                  <td>{moeda(p.ajustes)}</td>
                  <td>
                    <strong>{moeda(p.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(ajs ?? []).length > 0 && (
          <ul className="pessoas">
            {(ajs ?? []).map((a) => (
              <li key={a.id}>
                <span>
                  {dataComDia(a.data)} · {a.motivo}
                  {!a.pagamento_id && <span className="muted"> (em aberto)</span>}
                </span>
                <strong>{moeda(a.valor)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao pilha">
        <h2>5. Trocas de período entre prestadores</h2>
        {(trocas ?? []).length === 0 && <p className="muted">Nenhuma troca.</p>}
        <ul className="pessoas">
          {(trocas ?? []).map((t) => (
            <li key={t.id}>
              <span>
                {dataComDia(t.data)} · {ROTULO_TURNO[t.turno as Turno] ?? t.turno} ·{" "}
                {t.de_motoboy === id ? "passou o período" : "assumiu o período de um colega"}
              </span>
              <span className="muted pequeno">
                {t.status} · pedida em {quando(t.criada_em)}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted pequeno">
          As trocas mostram que o prestador escolhe livremente seus períodos e pode se fazer substituir por colegas. Documento gerado em {hojeISO()}.
        </p>
      </section>
    </div>
  );
}
