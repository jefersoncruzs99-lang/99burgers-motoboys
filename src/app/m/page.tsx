import Link from "next/link";
import { Mensagens } from "@/components/Mensagens";
import { COOKIE_MOTOBOY, lerAcesso, rpcMotoboy } from "@/lib/acesso";
import { ROTULO_FAIXA, dataComDia, dataLonga, hora, moeda } from "@/lib/datas";
import { ROTULO_FORMA, type PainelMotoboy, type TurnoInfo } from "@/lib/tipos";
import { FormEntrar } from "./FormEntrar";
import { aceitarTroca, assinarContrato, cancelarTroca, confirmarChegada, pedirTroca, sairMotoboy } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_TROCA: Record<string, string> = {
  aberta: "Esperando colega",
  aceita: "Aguardando administração",
  aprovada: "Troca feita",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export default async function AreaMotoboy({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const acesso = await lerAcesso(COOKIE_MOTOBOY);
  let p: PainelMotoboy | null = null;
  let falhou = false;
  if (acesso) {
    try {
      p = await rpcMotoboy<PainelMotoboy>("mb_m_painel");
    } catch (e) {
      falhou = !(e instanceof Error && e.message === "SEM_ACESSO");
    }
  }

  if (!p) {
    return (
      <main className="container pilha" style={{ maxWidth: 460, paddingTop: 40 }}>
        <Link href="/" className="muted">
          ← Início
        </Link>
        <h1>
          <span className="marca">NOVE NOVE BURGERS</span>
          <br />
          Área do motoboy
        </h1>
        {falhou && <div className="erro">Não foi possível carregar. Verifique a internet e tente de novo.</div>}
        {acesso && !falhou && <div className="aviso">Sua chave mudou. Entre de novo com a chave nova.</div>}
        <FormEntrar />
      </main>
    );
  }

  const contratoPendente = p.contrato !== null && !p.contrato.assinado_em;
  const tipoHoje = Object.keys(p.valores_hoje).length > 0 ? p.valores_hoje : {};
  const escalaHoje = p.escala.filter((e) => e.data === p.hoje);
  const proximos = p.escala.filter((e) => e.data > p.hoje || (e.data === p.hoje && !e.registro));
  const totalProximo = Number(p.pagamento.proximo.diarias) + Number(p.pagamento.proximo.entregas) + Number(p.pagamento.proximo.ajustes);
  const nomeTurno = (c: string) => p.turnos.find((t) => t.codigo === c)?.nome ?? c;
  const paraMim = p.trocas.filter((t) => t.pode_aceitar);
  const minhas = p.trocas.filter((t) => t.minha);

  return (
    <main className="container pilha" style={{ maxWidth: 760 }}>
      <div className="linha entre">
        <div>
          <span className="marca">MOTOBOYS 99</span>
          <h1 style={{ fontSize: "1.7rem", margin: 0 }}>Olá, {p.motoboy.nome.split(" ")[0]}!</h1>
          <p className="muted" style={{ textTransform: "capitalize", margin: 0 }}>
            {dataLonga(p.hoje)}
          </p>
        </div>
        <form action={sairMotoboy}>
          <button className="botao">Sair</button>
        </form>
      </div>
      <Mensagens erro={sp.erro} ok={sp.ok} />

      {contratoPendente && p.contrato && (
        <section className="cartao destaque pilha">
          <h2>Assine o contrato de prestação de serviço</h2>
          <p className="muted">Leia com atenção. Você só precisa assinar uma vez (ou quando o contrato for atualizado).</p>
          <div className="texto-doc">{p.contrato.texto.trim()}</div>
          <form action={assinarContrato} className="pilha">
            <div className="campos">
              <div className="campo">
                <label htmlFor="nome">Nome completo</label>
                <input id="nome" name="nome" defaultValue={p.motoboy.nome} required minLength={5} />
              </div>
              <div className="campo">
                <label htmlFor="cpf">CPF</label>
                <input id="cpf" name="cpf" inputMode="numeric" placeholder="000.000.000-00" required />
              </div>
            </div>
            <label className="check">
              <input type="checkbox" name="aceite" required /> Li e aceito o contrato de prestação de serviço (versão {p.contrato.versao})
            </label>
            <button className="botao primario grande">✍ Assinar contrato</button>
          </form>
        </section>
      )}

      <section className="pilha">
        <h2>Hoje</h2>
        {p.turnos.map((t) => (
          <CartaoHoje
            key={t.codigo}
            turno={t}
            escalado={escalaHoje.some((e) => e.turno === t.codigo)}
            registro={p.registros_hoje.find((r) => r.turno === t.codigo) ?? null}
            termo={p.termo}
            valores={tipoHoje}
            bloqueado={contratoPendente}
          />
        ))}
      </section>

      <section className="cartao pilha">
        <h2>A receber</h2>
        <p className="muted pequeno" style={{ margin: 0 }}>
          {ROTULO_FORMA[p.motoboy.forma_pagamento]}
        </p>
        <div className="numeros">
          <div className="cartao destaque">
            <span className="muted">Pagamento de {dataComDia(p.pagamento.proxima_data)}</span>
            <b className="grande-valor">{moeda(totalProximo)}</b>
            <span className="muted pequeno">{p.pagamento.proximo.dias} turno(s)</span>
          </div>
          <div className="cartao">
            <span className="muted">Já acumulando para {dataComDia(p.pagamento.seguinte_data)}</span>
            <b>{moeda(p.pagamento.acumulando.total)}</b>
            <span className="muted pequeno">{p.pagamento.acumulando.dias} turno(s)</span>
          </div>
        </div>
        {p.pagamento.dias.length > 0 && (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Turno</th>
                  <th>Chegada</th>
                  <th>Diária</th>
                  <th>Entregas</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {p.pagamento.dias.map((d) => (
                  <tr key={`${d.data}-${d.turno}`}>
                    <td>{dataComDia(d.data)}</td>
                    <td>{nomeTurno(d.turno)}</td>
                    <td>{hora(d.chegada_em)}</td>
                    <td>
                      {moeda(d.valor_diaria)}
                      <div className="muted pequeno">{ROTULO_FAIXA[d.faixa]}</div>
                    </td>
                    <td>{Number(d.valor_entregas) > 0 ? moeda(d.valor_entregas) : <span className="muted">a lançar</span>}</td>
                    <td>
                      <strong>{moeda(Number(d.valor_diaria) + Number(d.valor_entregas))}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {p.pagamento.ajustes.length > 0 && (
          <div className="pilha">
            <h3>Ajustes</h3>
            {p.pagamento.ajustes.map((a, i) => (
              <div key={i} className="linha entre">
                <span>
                  {dataComDia(a.data)} · {a.motivo}
                </span>
                <strong style={{ color: Number(a.valor) < 0 ? "var(--vermelho)" : "var(--verde)" }}>{moeda(a.valor)}</strong>
              </div>
            ))}
          </div>
        )}
        {p.pagamento.historico.length > 0 && (
          <details>
            <summary className="muted">Pagamentos anteriores</summary>
            <ul className="pessoas">
              {p.pagamento.historico.map((h) => (
                <li key={h.data}>
                  <span>{dataComDia(h.data)}</span>
                  <strong>{moeda(h.total)}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {paraMim.length > 0 && (
        <section className="cartao destaque pilha">
          <h2>Trocas para você</h2>
          {paraMim.map((t) => (
            <div key={t.id} className="linha entre">
              <span>
                <strong>{t.de_nome}</strong> quer passar o turno de <strong>{dataComDia(t.data)}</strong> · {nomeTurno(t.turno)}
                {t.motivo && <span className="muted"> · {t.motivo}</span>}
              </span>
              <form action={aceitarTroca}>
                <input type="hidden" name="troca_id" value={t.id} />
                <button className="botao primario">Aceitar</button>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="cartao pilha">
        <h2>Minha escala</h2>
        {proximos.length === 0 && <p className="muted">Você não tem turnos na escala nos próximos dias.</p>}
        <ul className="pessoas">
          {proximos.map((e) => (
            <li key={e.id}>
              <div>
                <span className="nome">{dataComDia(e.data)}</span> · {nomeTurno(e.turno)}
                {e.feriado && <span className="selo ama" style={{ marginLeft: 8 }}>Feriado: {e.feriado}</span>}
                {e.troca_aberta && <span className="selo extra" style={{ marginLeft: 8 }}>Troca pedida</span>}
              </div>
              {!e.troca_aberta && (
                <details>
                  <summary className="botao">Pedir troca</summary>
                  <form action={pedirTroca} className="pilha" style={{ marginTop: 8 }}>
                    <input type="hidden" name="escala_id" value={e.id} />
                    <select name="para" defaultValue="" aria-label="Para quem">
                      <option value="">Qualquer colega pode pegar</option>
                      {p.colegas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    <input name="motivo" placeholder="Motivo (opcional)" />
                    <button className="botao primario">Enviar pedido</button>
                  </form>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      {minhas.length > 0 && (
        <section className="cartao pilha">
          <h2>Meus pedidos de troca</h2>
          <ul className="pessoas">
            {minhas.map((t) => (
              <li key={t.id}>
                <span>
                  {dataComDia(t.data)} · {nomeTurno(t.turno)} → {t.aceita_por_nome ?? t.para_nome ?? "qualquer colega"}
                </span>
                <span className="mini">
                  <span className={`selo ${t.status === "aprovada" ? "ok" : t.status === "aberta" || t.status === "aceita" ? "ama" : ""}`}>
                    {STATUS_TROCA[t.status]}
                  </span>
                  {(t.status === "aberta" || t.status === "aceita") && (
                    <form action={cancelarTroca}>
                      <input type="hidden" name="troca_id" value={t.id} />
                      <button className="botao">Cancelar</button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function CartaoHoje({
  turno,
  escalado,
  registro,
  termo,
  valores,
  bloqueado,
}: {
  turno: TurnoInfo;
  escalado: boolean;
  registro: PainelMotoboy["registros_hoje"][number] | null;
  termo: PainelMotoboy["termo"];
  valores: Record<string, number>;
  bloqueado: boolean;
}) {
  return (
    <article className={`cartao turno ${registro ? "" : escalado ? "destaque" : ""}`}>
      <div className="cab">
        <h2>
          {turno.nome} <span className="muted" style={{ fontSize: "1rem" }}>· {turno.setor}</span>
        </h2>
        <span className="muted">
          {turno.inicio} às {turno.fim}
        </span>
      </div>
      {registro ? (
        <div className="ok">
          ✅ Chegada às <strong>{hora(registro.chegada_em)}</strong> · {ROTULO_FAIXA[registro.faixa]}: <strong>{moeda(registro.valor_diaria)}</strong>
          {Number(registro.valor_entregas) > 0 && <> · Entregas: <strong>{moeda(registro.valor_entregas)}</strong></>}
        </div>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>
            {escalado ? "Você está na escala deste turno." : "Você não está na escala deste turno, mas pode confirmar se vier."}
          </p>
          <p className="pequeno" style={{ margin: 0 }}>
            Começando até {turno.limite_cheia}: {moeda(valores["1"])} · até {turno.limite_meio}: {moeda(valores["2"])} · depois:{" "}
            {moeda(valores["3"])}
          </p>
          {bloqueado ? (
            <div className="aviso">Assine o contrato acima para confirmar sua chegada.</div>
          ) : (
            <form action={confirmarChegada} className="pilha">
              <input type="hidden" name="turno" value={turno.codigo} />
              {termo && (
                <details>
                  <summary className="muted">Ler o termo do dia</summary>
                  <div className="texto-doc" style={{ marginTop: 8 }}>
                    {termo.texto.trim()}
                  </div>
                </details>
              )}
              <label className="check">
                <input type="checkbox" name="aceite" required /> Aceito o termo do dia e estou disponível agora
              </label>
              <button className="botao primario grande cheio">✅ Cheguei</button>
            </form>
          )}
        </>
      )}
    </article>
  );
}
