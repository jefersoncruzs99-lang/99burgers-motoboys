import Link from "next/link";
import { NOMES_DIA, NOMES_DIA_CURTO, dataCurta, dataLonga, diaDaSemana, somarDias } from "@/lib/datas";
import { Avatar } from "./Avatar";

type Acao = (fd: FormData) => Promise<void>;

interface TurnoEsc {
  codigo: string;
  nome: string;
  setor?: string;
  inicio?: string;
  fim?: string;
  feriado_como_domingo?: boolean;
}
interface Boy {
  id: string;
  nome: string;
  foto_url?: string | null;
}

export interface DadosSemana {
  inicio: string;
  fim: string;
  hoje: string;
  turnos: TurnoEsc[];
  escala: { id: string; data: string; turno: string; origem: string; motoboy_id: string; nome: string; foto_url?: string | null; chegou: boolean }[];
  motoboys: Boy[];
  feriados: Record<string, string>;
}

export interface DadosPadrao {
  turnos: TurnoEsc[];
  padrao: { id: string; dia_semana: number; turno: string; motoboy_id: string; nome: string; ativo: boolean; foto_url?: string | null }[];
  motoboys: Boy[];
}

const ICONE: Record<string, string> = { manha: "☀️", noite: "🌙" };
const ORDEM = [1, 2, 3, 4, 5, 6, 0];

function nomeCurto(nome: string) {
  const p = nome.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]?.[0] ?? ""}.` : (p[0] ?? nome);
}

/** Card colorido do turno com as fotos de quem está escalado. */
function CardTurno({
  turno,
  pessoas,
  livres,
  podeMexer,
  remover,
  adicionar,
  ocultos,
  repetir,
  aviso,
}: {
  turno: TurnoEsc;
  pessoas: { id: string; nome: string; foto_url?: string | null; chegou?: boolean; troca?: boolean; inativo?: boolean }[];
  livres: Boy[];
  podeMexer: boolean;
  remover: Acao;
  adicionar: Acao;
  ocultos: Record<string, string>;
  repetir: { campo: string; opcoes: { valor: string; rotulo: string; marcado: boolean }[] };
  aviso?: string;
}) {
  return (
    <section className={`esc-turno t-${turno.codigo}`}>
      <header>
        <span className="esc-ico" aria-hidden="true">
          {ICONE[turno.codigo] ?? "🛵"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{turno.nome}</strong>
          <span>
            {turno.setor ? `${turno.setor} · ` : ""}
            {turno.inicio && turno.fim ? `${turno.inicio} às ${turno.fim}` : ""}
          </span>
        </div>
        <span className="esc-conta" key={pessoas.length}>
          {pessoas.length}
          <small>{pessoas.length === 1 ? "boy" : "boys"}</small>
        </span>
      </header>
      {aviso && <div className="esc-aviso">{aviso}</div>}
      <div className="esc-boys">
        {pessoas.length === 0 && (
          <div className="esc-vazio">
            Ninguém escalado ainda
            {podeMexer && ocultos.data && (
              <div className="pequeno" style={{ marginTop: 4 }}>
                Toque em <strong>⚡ Preencher a semana</strong> lá embaixo para puxar da semana padrão, ou adicione aqui.
              </div>
            )}
          </div>
        )}
        {pessoas.map((p, i) => (
          <div key={p.id} className={`esc-boy ${p.chegou ? "chegou" : ""} ${p.inativo ? "inativo" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
            <Avatar nome={p.nome} foto={p.foto_url} tamanho={64} anel={p.chegou ? "ouro" : undefined} />
            <span className="esc-nome">{nomeCurto(p.nome)}</span>
            {p.chegou && <span className="esc-tag ok">✅ chegou</span>}
            {p.troca && <span className="esc-tag">⇄ troca</span>}
            {p.inativo && <span className="esc-tag">inativo</span>}
            {podeMexer && !p.chegou && (
              <form action={remover} className="esc-x">
                <input type="hidden" name="id" value={p.id} />
                {ocultos.volta && <input type="hidden" name="volta" value={ocultos.volta} />}
                <button aria-label={`Tirar ${p.nome}`} title="Tirar da escala">
                  ×
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
      {podeMexer && livres.length > 0 && (
        <details className="esc-add">
          <summary>➕ Adicionar motoboys</summary>
          <form action={adicionar} className="pilha" style={{ gap: 12 }}>
            {Object.entries(ocultos).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <div className="esc-picks">
              {livres.map((m) => (
                <label key={m.id} className="esc-pick">
                  <input type="checkbox" name="motoboy_id" value={m.id} />
                  <Avatar nome={m.nome} foto={m.foto_url} tamanho={52} />
                  <span>{nomeCurto(m.nome)}</span>
                </label>
              ))}
            </div>
            <div>
              <div className="muted pequeno" style={{ marginBottom: 6 }}>
                Repetir também em:
              </div>
              <div className="esc-chips">
                {repetir.opcoes.map((d) => (
                  <label key={d.valor} className="esc-chip">
                    <input type="checkbox" name={repetir.campo} value={d.valor} defaultChecked={d.marcado} />
                    <span>{d.rotulo}</span>
                  </label>
                ))}
              </div>
            </div>
            <button className="botao primario">Colocar na escala</button>
          </form>
        </details>
      )}
    </section>
  );
}

/** Escala da semana, um dia por vez, com fotos (administração e quem monta a escala). */
export function GradeSemana({
  dados,
  base,
  acoes,
  linkDia,
  diaSel,
}: {
  dados: DadosSemana;
  base: string;
  acoes: { adicionar: Acao; remover: Acao; gerar: Acao; refazer: Acao };
  linkDia?: (data: string) => string;
  diaSel?: string;
}) {
  const { inicio, fim, hoje } = dados;
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const dia = diaSel && dias.includes(diaSel) ? diaSel : dias.includes(hoje) ? hoje : dias[0]!;
  const voltaUrl = `${base}?semana=${inicio}&dia=${dia}`;
  const vazia = dados.escala.length === 0;
  const passado = dia < hoje;
  const feriado = dados.feriados[dia];
  const futuros = dias.filter((x) => x >= hoje);

  return (
    <div className="esc pilha">
      <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
        <Link className="botao" href={`${base}?semana=${somarDias(inicio, -7)}`}>
          ←
        </Link>
        <strong>
          Semana de {dataCurta(inicio)} a {dataCurta(fim)}
        </strong>
        <Link className="botao" href={`${base}?semana=${somarDias(inicio, 7)}`}>
          →
        </Link>
      </div>

      <nav className="esc-dias" aria-label="Dias da semana">
        {dias.map((d) => {
          const n = (t: string) => dados.escala.filter((e) => e.data === d && e.turno === t).length;
          return (
            <Link
              key={d}
              href={`${base}?semana=${inicio}&dia=${d}`}
              className={`esc-dia ${d === dia ? "ativo" : ""} ${d === hoje ? "hoje" : ""} ${d < hoje ? "passou" : ""}`}
            >
              <span className="sem">{NOMES_DIA_CURTO[diaDaSemana(d)]}</span>
              <b>{d.slice(8, 10)}</b>
              <span className="contas">
                {dados.turnos.map((t) => (
                  <i key={t.codigo}>
                    {ICONE[t.codigo] ?? "•"}
                    {n(t.codigo)}
                  </i>
                ))}
              </span>
              {dados.feriados[d] && <span className="fer">★</span>}
            </Link>
          );
        })}
      </nav>

      <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>{dataLonga(dia).replace(/^./, (c) => c.toUpperCase())}</h2>
        {linkDia && (
          <Link className="botao" href={linkDia(dia)}>
            Ver chegadas do dia
          </Link>
        )}
      </div>
      {feriado && <div className="esc-feriado">🎉 Feriado: {feriado}</div>}
      {passado && <div className="muted pequeno">Este dia já passou: só para consulta.</div>}

      <div className="esc-turnos">
        {dados.turnos.map((t) => {
          const doTurno = dados.escala.filter((e) => e.data === dia && e.turno === t.codigo);
          return (
            <CardTurno
              key={t.codigo}
              turno={t}
              pessoas={doTurno.map((e) => ({ id: e.id, nome: e.nome, foto_url: e.foto_url, chegou: e.chegou, troca: e.origem === "troca" }))}
              livres={dados.motoboys.filter((m) => !doTurno.some((e) => e.motoboy_id === m.id))}
              podeMexer={!passado}
              remover={acoes.remover}
              adicionar={acoes.adicionar}
              ocultos={{ data: dia, turno: t.codigo, volta: voltaUrl }}
              repetir={{
                campo: "datas",
                opcoes: futuros.map((x) => ({ valor: x, rotulo: `${NOMES_DIA_CURTO[diaDaSemana(x)]} ${x.slice(8, 10)}`, marcado: x === dia })),
              }}
              aviso={
                feriado
                  ? t.feriado_como_domingo
                    ? "No feriado este turno segue a escala de domingo"
                    : `No feriado este turno segue a escala normal de ${NOMES_DIA[diaDaSemana(dia)]?.toLowerCase()}`
                  : undefined
              }
            />
          );
        })}
      </div>

      {fim >= hoje && (
        <div className="esc-acoes">
          <form action={acoes.gerar}>
            <input type="hidden" name="inicio" value={inicio} />
            <input type="hidden" name="volta" value={voltaUrl} />
            <button className={`botao ${vazia ? "primario" : ""}`}>⚡ Preencher a semana pela semana padrão</button>
          </form>
          {!passado && (
            <form action={acoes.refazer}>
              <input type="hidden" name="data" value={dia} />
              <input type="hidden" name="volta" value={voltaUrl} />
              <button className="botao">↺ Refazer este dia pelo padrão</button>
            </form>
          )}
        </div>
      )}
      <p className="muted pequeno">
        Preencher só completa turnos vazios. Refazer troca quem veio do padrão e mantém quem foi colocado à mão ou já chegou. O mesmo motoboy nunca
        fica duas vezes no mesmo turno.
      </p>
    </div>
  );
}

/** Semana padrão, um dia da semana por vez, com fotos. */
export function GradePadrao({
  dados,
  acoes,
  base,
  dowSel,
}: {
  dados: DadosPadrao;
  acoes: { adicionar: Acao; remover: Acao };
  base: string;
  dowSel?: number;
}) {
  const dow = dowSel !== undefined && dowSel >= 0 && dowSel <= 6 ? dowSel : 1;
  return (
    <div className="esc pilha">
      <nav className="esc-dias" aria-label="Dias da semana">
        {ORDEM.map((d) => {
          const n = (t: string) => dados.padrao.filter((p) => p.dia_semana === d && p.turno === t).length;
          return (
            <Link key={d} href={`${base}?dia=${d}`} className={`esc-dia ${d === dow ? "ativo" : ""}`}>
              <span className="sem">{NOMES_DIA_CURTO[d]}</span>
              <span className="contas">
                {dados.turnos.map((t) => (
                  <i key={t.codigo}>
                    {ICONE[t.codigo] ?? "•"}
                    {n(t.codigo)}
                  </i>
                ))}
              </span>
            </Link>
          );
        })}
      </nav>
      <h2 style={{ margin: 0 }}>{NOMES_DIA[dow]}</h2>
      <div className="esc-turnos">
        {dados.turnos.map((t) => {
          const doTurno = dados.padrao.filter((p) => p.dia_semana === dow && p.turno === t.codigo);
          return (
            <CardTurno
              key={t.codigo}
              turno={t}
              pessoas={doTurno.map((p) => ({ id: p.id, nome: p.nome, foto_url: p.foto_url, inativo: !p.ativo }))}
              livres={dados.motoboys.filter((m) => !doTurno.some((p) => p.motoboy_id === m.id))}
              podeMexer
              remover={acoes.remover}
              adicionar={acoes.adicionar}
              ocultos={{ dia_semana: String(dow), turno: t.codigo, volta: `${base}?dia=${dow}` }}
              repetir={{
                campo: "dias",
                opcoes: ORDEM.map((x) => ({ valor: String(x), rotulo: NOMES_DIA_CURTO[x] ?? "", marcado: x === dow })),
              }}
              aviso={dow === 0 && t.feriado_como_domingo ? "Esta escala também vale para os feriados" : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
