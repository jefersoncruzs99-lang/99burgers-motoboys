import { Mensagens, type ParamsPagina } from "@/components/Mensagens";
import { exigirGestor } from "@/lib/auth";
import { ROTULO_FAIXA, dataComDia, hojeISO } from "@/lib/datas";
import {
  addFeriado,
  novoSegredoQr,
  novaVersaoDocumento,
  removerFeriado,
  salvarConfig,
  salvarGestorRota,
  salvarTurno,
  salvarValores,
} from "../actions";

const hhmm = (t: string) => t.slice(0, 5);

export default async function AdminConfig({ searchParams }: { searchParams: ParamsPagina }) {
  const sp = await searchParams;
  const { supabase } = await exigirGestor();
  const hoje = hojeISO();
  const [{ data: config }, { data: turnos }, { data: valores }, { data: feriados }, { data: gestores }, { data: docs }, { data: assinaturas }] =
    await Promise.all([
      supabase.from("mb_config").select("*").maybeSingle(),
      supabase.from("mb_turnos").select("*").order("ordem"),
      supabase.from("mb_valores").select("*"),
      supabase.from("mb_feriados").select("*").gte("data", `${hoje.slice(0, 4)}-01-01`).order("data"),
      supabase.from("mb_gestores_rota").select("id, nome, ativo, pin_hash, pode_rota, pode_escala").order("nome"),
      supabase.from("mb_documentos").select("id, tipo, versao, titulo, texto, ativo, criado_em").order("versao", { ascending: false }),
      supabase.from("mb_assinaturas").select("documento_id"),
    ]);
  const valor = (tipo: string, faixa: number) => (valores ?? []).find((v) => v.tipo_dia === tipo && v.faixa === faixa)?.valor ?? "";
  const ativo = (tipo: string) => (docs ?? []).find((d) => d.tipo === tipo && d.ativo);
  const assinaturasDe = (id: string) => (assinaturas ?? []).filter((a) => a.documento_id === id).length;

  return (
    <>
      <h1>Configurações</h1>
      <Mensagens erro={sp.erro} ok={sp.ok} />

      <section className="cartao pilha">
        <h2>Valor da diária</h2>
        <p className="muted pequeno">Feriado usa o valor de domingo. Mudanças valem para as próximas chegadas.</p>
        <form action={salvarValores} className="pilha">
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th></th>
                  {[1, 2, 3].map((f) => (
                    <th key={f}>{ROTULO_FAIXA[f]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["semana", "Segunda a sábado"],
                  ["domingo", "Domingo e feriado"],
                ].map(([tipo, rotulo]) => (
                  <tr key={tipo}>
                    <td>{rotulo}</td>
                    {[1, 2, 3].map((f) => (
                      <td key={f}>
                        <input name={`${tipo}_${f}`} inputMode="decimal" defaultValue={String(valor(tipo!, f))} style={{ width: 90 }} required />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="botao primario">Salvar valores</button>
        </form>
      </section>

      <section className="cartao pilha">
        <h2>Turnos e horários</h2>
        {(turnos ?? []).map((t) => (
          <form key={t.codigo} action={salvarTurno} className="pilha bloco">
            <input type="hidden" name="codigo" value={t.codigo} />
            <div className="campos">
              <div className="campo">
                <label>Nome</label>
                <input name="nome" defaultValue={t.nome} required />
              </div>
              <div className="campo">
                <label>Setor</label>
                <input name="setor" defaultValue={t.setor} required />
              </div>
              <div className="campo">
                <label>Início</label>
                <input type="time" name="inicio" defaultValue={hhmm(t.inicio)} required />
              </div>
              <div className="campo">
                <label>Fim</label>
                <input type="time" name="fim" defaultValue={hhmm(t.fim)} required />
              </div>
              <div className="campo">
                <label>Diária cheia até</label>
                <input type="time" name="limite_cheia" defaultValue={hhmm(t.limite_cheia)} required />
              </div>
              <div className="campo">
                <label>2/3 até (depois: 1/3)</label>
                <input type="time" name="limite_meio" defaultValue={hhmm(t.limite_meio)} required />
              </div>
            </div>
            <button className="botao">Salvar {t.nome}</button>
          </form>
        ))}
      </section>

      <section className="cartao pilha">
        <h2>Feriados</h2>
        <p className="muted pequeno">No feriado a diária é de domingo e a escala segue a escala de domingo.</p>
        <form action={addFeriado} className="pilha">
          <div className="campos">
            <div className="campo">
              <label>Data</label>
              <input type="date" name="data" required />
            </div>
            <div className="campo">
              <label>Nome</label>
              <input name="nome" required placeholder="Ex.: Natal" />
            </div>
          </div>
          <label className="check">
            <input type="checkbox" name="refazer" defaultChecked /> Refazer a escala do dia pela escala de domingo
          </label>
          <button className="botao primario">Adicionar feriado</button>
        </form>
        <ul className="pessoas">
          {(feriados ?? []).map((f) => (
            <li key={f.data}>
              <span>
                {dataComDia(f.data)} · {f.nome}
              </span>
              <form action={removerFeriado}>
                <input type="hidden" name="data" value={f.data} />
                <button className="botao">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="cartao pilha">
        <h2>Acessos com PIN</h2>
        <p className="muted pequeno">
          Quem entra com nome + PIN. <strong>Gestor de rota</strong> entra em /rota (chegadas, entregas, intercorrências, QR e dinheiro).{" "}
          <strong>Monta a escala</strong> entra em /escala e só vê a escala da semana e a semana padrão.
        </p>
        {(gestores ?? []).map((g) => (
          <form key={g.id} action={salvarGestorRota} className="campos bloco">
            <input type="hidden" name="id" value={g.id} />
            <div className="campo">
              <label>Nome</label>
              <input name="nome" defaultValue={g.nome} required />
            </div>
            <div className="campo">
              <label>Novo PIN {g.pin_hash ? "(deixe vazio para manter)" : "(sem PIN: não consegue entrar)"}</label>
              <input name="pin" inputMode="numeric" maxLength={8} autoComplete="off" />
            </div>
            <label className="check">
              <input type="checkbox" name="pode_rota" defaultChecked={g.pode_rota} /> Gestor de rota
            </label>
            <label className="check">
              <input type="checkbox" name="pode_escala" defaultChecked={g.pode_escala} /> Monta a escala
            </label>
            <label className="check">
              <input type="checkbox" name="ativo" defaultChecked={g.ativo} /> Ativo
            </label>
            <button className="botao">Salvar</button>
          </form>
        ))}
        <form action={salvarGestorRota} className="campos bloco">
          <div className="campo">
            <label>Nova pessoa com PIN</label>
            <input name="nome" required placeholder="Nome" />
          </div>
          <div className="campo">
            <label>PIN (4 a 8 números)</label>
            <input name="pin" inputMode="numeric" maxLength={8} autoComplete="off" required />
          </div>
          <label className="check">
            <input type="checkbox" name="pode_rota" defaultChecked /> Gestor de rota
          </label>
          <label className="check">
            <input type="checkbox" name="pode_escala" /> Monta a escala
          </label>
          <button className="botao primario">Cadastrar</button>
        </form>
      </section>

      <section className="cartao pilha">
        <h2>Regras</h2>
        <form action={salvarConfig} className="pilha">
          <label className="check">
            <input type="checkbox" name="troca_automatica" defaultChecked={config?.troca_automatica ?? true} /> Troca automática: vale assim que o
            colega aceita (sem aprovação)
          </label>
          <label className="check">
            <input type="checkbox" name="qr_obrigatorio" defaultChecked={config?.qr_obrigatorio ?? true} /> Exigir QR code na chegada (o motoboy só
            confirma escaneando o QR do gestor de rota ou do tablet da loja)
          </label>
          <div className="campo" style={{ maxWidth: 320 }}>
            <label>Pode confirmar chegada a partir de quantos minutos antes do turno</label>
            <input name="checkin_antecedencia_min" inputMode="numeric" defaultValue={config?.checkin_antecedencia_min ?? 120} />
          </div>
          <button className="botao">Salvar regras</button>
        </form>
        <form action={novoSegredoQr} className="linha entre bloco" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="muted pequeno">Desconfia que alguém conseguiu copiar o QR? Gere um novo segredo e todo QR antigo para de funcionar.</span>
          <button className="botao">Gerar novo segredo do QR</button>
        </form>
      </section>

      {(["contrato", "regulamento", "termo_diario"] as const).map((tipo) => {
        const doc = ativo(tipo);
        const antigos = (docs ?? []).filter((d) => d.tipo === tipo && !d.ativo);
        return (
          <section key={tipo} className="cartao pilha">
            <h2>{tipo === "contrato" ? "Contrato de prestação de serviço" : tipo === "regulamento" ? "Regulamento do ranking e incentivos" : "Termo do dia (aceite na chegada)"}</h2>
            <div className="aviso pequeno">Rascunho: revise com um advogado antes de usar. Ao salvar, cria uma nova versão e guarda a antiga.</div>
            {doc && (
              <p className="muted pequeno" style={{ margin: 0 }}>
                Versão atual: v{doc.versao}
                {tipo !== "termo_diario" && <> · {assinaturasDe(doc.id)} aceite(s)</>}
                {tipo !== "termo_diario" && " · Uma nova versão pede aceite de novo para todos."}
              </p>
            )}
            <form action={novaVersaoDocumento} className="pilha">
              <input type="hidden" name="tipo" value={tipo} />
              <div className="campo">
                <label>Título</label>
                <input name="titulo" defaultValue={doc?.titulo ?? ""} required />
              </div>
              <div className="campo">
                <label>Texto</label>
                <textarea name="texto" rows={tipo === "contrato" ? 18 : 6} defaultValue={doc?.texto.trim() ?? ""} required />
              </div>
              <button className="botao">Publicar nova versão</button>
            </form>
            {antigos.length > 0 && (
              <details>
                <summary className="muted pequeno">Versões anteriores</summary>
                {antigos.map((d) => (
                  <details key={d.id} style={{ marginTop: 8 }}>
                    <summary className="pequeno">
                      v{d.versao} · {d.criado_em.slice(0, 10)}
                      {tipo !== "termo_diario" && <> · {assinaturasDe(d.id)} aceite(s)</>}
                    </summary>
                    <div className="texto-doc">{d.texto.trim()}</div>
                  </details>
                ))}
              </details>
            )}
          </section>
        );
      })}
    </>
  );
}
