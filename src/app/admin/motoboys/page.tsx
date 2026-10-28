import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { dataCurta, hora } from "@/lib/datas";
import { ROTULO_FORMA, type Motoboy } from "@/lib/tipos";
import { salvarMotoboy } from "../actions";
import { GerarChave } from "./GerarChave";

function telefoneBonito(t: string) {
  const n = t.replace(/^55/, "");
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : t;
}

export default async function AdminMotoboys({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const [{ data: motoboys }, { data: contrato }, { data: assinaturas }] = await Promise.all([
    supabase.from("mb_motoboys").select("*").order("ativo", { ascending: false }).order("nome"),
    supabase.from("mb_documentos").select("id, versao").eq("tipo", "contrato").eq("ativo", true).maybeSingle(),
    supabase.from("mb_assinaturas").select("motoboy_id, documento_id, assinado_em, nome_assinado, cpf_assinado, ip"),
  ]);
  const lista = (motoboys ?? []) as Motoboy[];

  return (
    <>
      <h1>Motoboys</h1>
      <Mensagens erro={sp.erro} ok={sp.ok} />

      <details className="cartao" open={lista.length === 0}>
        <summary>
          <strong>+ Cadastrar motoboy</strong>
        </summary>
        <FormMotoboy />
      </details>

      {lista.map((m) => {
        const ass = (assinaturas ?? []).find((a) => a.motoboy_id === m.id && a.documento_id === contrato?.id);
        return (
          <section key={m.id} className="cartao pilha" style={m.ativo ? undefined : { opacity: 0.6 }}>
            <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ margin: 0 }}>
                  {m.nome} {!m.ativo && <span className="selo">Inativo</span>}
                </h2>
                <div className="muted pequeno">
                  {telefoneBonito(m.telefone)} · {ROTULO_FORMA[m.forma_pagamento]}
                  {m.pix && <> · PIX: {m.pix}</>}
                </div>
                <div className="mini" style={{ marginTop: 6, flexWrap: "wrap" }}>
                  {m.chave_hash ? <span className="selo ok">Tem chave</span> : <span className="selo falta">Sem chave</span>}
                  {ass ? (
                    <span className="selo ok" title={`${ass.nome_assinado} · CPF ${ass.cpf_assinado} · IP ${ass.ip ?? "-"}`}>
                      Contrato v{contrato?.versao} assinado em {dataCurta(ass.assinado_em.slice(0, 10))} {hora(ass.assinado_em)}
                    </span>
                  ) : (
                    <span className="selo ama">Contrato pendente</span>
                  )}
                </div>
              </div>
              {m.ativo && <GerarChave id={m.id} nome={m.nome} telefone={m.telefone} temChave={!!m.chave_hash} />}
            </div>
            <details>
              <summary className="muted">Editar cadastro</summary>
              <FormMotoboy m={m} />
            </details>
          </section>
        );
      })}
    </>
  );
}

function FormMotoboy({ m }: { m?: Motoboy }) {
  return (
    <form action={salvarMotoboy} className="pilha" style={{ marginTop: 12 }}>
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="campos">
        <div className="campo">
          <label>Nome completo</label>
          <input name="nome" defaultValue={m?.nome} required />
        </div>
        <div className="campo">
          <label>Telefone (com DDD)</label>
          <input name="telefone" inputMode="numeric" defaultValue={m?.telefone} placeholder="71999999999" required />
        </div>
        <div className="campo">
          <label>CPF</label>
          <input name="cpf" inputMode="numeric" defaultValue={m?.cpf ?? ""} />
        </div>
        <div className="campo">
          <label>Chave PIX</label>
          <input name="pix" defaultValue={m?.pix ?? ""} />
        </div>
        <div className="campo">
          <label>Pagamento</label>
          <select name="forma_pagamento" defaultValue={m?.forma_pagamento ?? "quinzenal"}>
            <option value="quinzenal">{ROTULO_FORMA.quinzenal}</option>
            <option value="semanal">{ROTULO_FORMA.semanal}</option>
          </select>
        </div>
        <div className="campo">
          <label>Observação</label>
          <input name="observacao" defaultValue={m?.observacao ?? ""} />
        </div>
      </div>
      {m && (
        <label className="check">
          <input type="checkbox" name="ativo" defaultChecked={m.ativo} /> Ativo (desmarque quando parar de trabalhar com a 99)
        </label>
      )}
      <button className="botao primario">{m ? "Salvar" : "Cadastrar"}</button>
    </form>
  );
}
