import Link from "next/link";
import { NOMES_DIA, NOMES_DIA_CURTO, dataCurta, diaDaSemana, somarDias } from "@/lib/datas";
import { AdicionarVarios } from "./AdicionarVarios";

type Acao = (fd: FormData) => Promise<void>;

export interface DadosSemana {
  inicio: string;
  fim: string;
  hoje: string;
  turnos: { codigo: string; nome: string }[];
  escala: { id: string; data: string; turno: string; origem: string; motoboy_id: string; nome: string; chegou: boolean }[];
  motoboys: { id: string; nome: string }[];
  feriados: Record<string, string>;
}

export interface DadosPadrao {
  turnos: { codigo: string; nome: string }[];
  padrao: { id: string; dia_semana: number; turno: string; motoboy_id: string; nome: string; ativo: boolean }[];
  motoboys: { id: string; nome: string }[];
}

const linkSutil = { background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" } as const;

/** Grade da semana (usada pela administração e por quem monta a escala). */
export function GradeSemana({
  dados,
  base,
  acoes,
  linkDia,
}: {
  dados: DadosSemana;
  base: string;
  acoes: { adicionar: Acao; remover: Acao; gerar: Acao; refazer: Acao };
  linkDia?: (data: string) => string;
}) {
  const { inicio, fim, hoje } = dados;
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const voltaUrl = `${base}?semana=${inicio}`;
  const vazia = dados.escala.length === 0;

  return (
    <>
      <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
        <Link className="botao" href={`${base}?semana=${somarDias(inicio, -7)}`}>
          ← Semana anterior
        </Link>
        <strong>
          {dataCurta(inicio)} a {dataCurta(fim)}
        </strong>
        <Link className="botao" href={`${base}?semana=${somarDias(inicio, 7)}`}>
          Próxima semana →
        </Link>
      </div>
      {fim >= hoje && (
        <form action={acoes.gerar} className="cartao linha entre" style={{ flexWrap: "wrap" }}>
          <input type="hidden" name="inicio" value={inicio} />
          <input type="hidden" name="volta" value={voltaUrl} />
          <span className="muted">
            {vazia ? "Esta semana ainda está vazia." : "Completa só os turnos que estão sem ninguém."} Feriado usa a escala de domingo.
          </span>
          <button className={`botao ${vazia ? "primario" : ""}`}>Preencher pela semana padrão</button>
        </form>
      )}

      <div className="tabela-rolagem">
        <div className="grade-escala">
          {dias.map((d) => {
            const feriado = dados.feriados[d];
            const passado = d < hoje;
            return (
              <div key={d} className={`dia ${d === hoje ? "hoje" : ""}`} style={passado ? { opacity: 0.7 } : undefined}>
                <div className="linha entre">
                  <strong>
                    {NOMES_DIA_CURTO[diaDaSemana(d)]} {dataCurta(d)}
                  </strong>
                  {linkDia && (
                    <Link className="muted pequeno" href={linkDia(d)}>
                      ver dia
                    </Link>
                  )}
                </div>
                {feriado && <span className="selo ama">Feriado: {feriado}</span>}
                {dados.turnos.map((t) => {
                  const doTurno = dados.escala.filter((e) => e.data === d && e.turno === t.codigo);
                  const livres = dados.motoboys.filter((m) => !doTurno.some((e) => e.motoboy_id === m.id));
                  return (
                    <div key={t.codigo} className="bloco">
                      <div className="muted pequeno">
                        {t.nome} · {doTurno.length}
                      </div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {doTurno.map((e) => (
                          <form key={e.id} action={acoes.remover} className="chip" title={e.origem === "troca" ? "Veio de troca" : undefined}>
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="volta" value={voltaUrl} />
                            {e.chegou ? "✅ " : ""}
                            {e.nome}
                            {e.origem === "troca" ? " ⇄" : ""}
                            {!passado && <button aria-label={`Tirar ${e.nome}`}>×</button>}
                          </form>
                        ))}
                      </div>
                      {!passado && (
                        <AdicionarVarios
                          acao={acoes.adicionar}
                          livres={livres}
                          ocultos={{ data: d, turno: t.codigo, volta: voltaUrl }}
                          dias={{
                            campo: "datas",
                            opcoes: dias
                              .filter((x) => x >= hoje)
                              .map((x) => ({ valor: x, rotulo: `${NOMES_DIA_CURTO[diaDaSemana(x)]} ${dataCurta(x)}`, marcado: x === d })),
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                {!passado && (
                  <form action={acoes.refazer}>
                    <input type="hidden" name="data" value={d} />
                    <input type="hidden" name="volta" value={voltaUrl} />
                    <button className="muted pequeno" style={linkSutil}>
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

const ORDEM = [1, 2, 3, 4, 5, 6, 0];

/** Grade da semana padrão. */
export function GradePadrao({ dados, acoes }: { dados: DadosPadrao; acoes: { adicionar: Acao; remover: Acao } }) {
  return (
    <div className="tabela-rolagem">
      <div className="grade-escala">
        {ORDEM.map((dow) => (
          <div key={dow} className="dia">
            <strong>{NOMES_DIA[dow]}</strong>
            {dados.turnos.map((t) => {
              const doTurno = dados.padrao.filter((p) => p.dia_semana === dow && p.turno === t.codigo);
              const livres = dados.motoboys.filter((m) => !doTurno.some((p) => p.motoboy_id === m.id));
              return (
                <div key={t.codigo} className="bloco">
                  <div className="muted pequeno">
                    {t.nome} · {doTurno.length}
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {doTurno.map((p) => (
                      <form key={p.id} action={acoes.remover} className="chip" style={p.ativo ? undefined : { opacity: 0.5 }}>
                        <input type="hidden" name="id" value={p.id} />
                        {p.nome}
                        {!p.ativo ? " (inativo)" : ""}
                        <button aria-label={`Tirar ${p.nome}`}>×</button>
                      </form>
                    ))}
                  </div>
                  <AdicionarVarios
                    acao={acoes.adicionar}
                    livres={livres}
                    ocultos={{ dia_semana: String(dow), turno: t.codigo }}
                    dias={{
                      campo: "dias",
                      opcoes: ORDEM.map((x) => ({ valor: String(x), rotulo: NOMES_DIA_CURTO[x] ?? "", marcado: x === dow })),
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
