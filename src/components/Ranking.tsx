"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DadosRanking, ItemRanking } from "@/lib/tipos";
import { Avatar } from "./Avatar";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function nomePeriodo(periodo: string, inicio: string) {
  const [a, m] = inicio.split("-").map(Number);
  return periodo.startsWith("ano") ? `Boy do Ano ${a}` : `Boy do Mês · ${MESES[(m ?? 1) - 1]}`;
}

function rotuloAnterior(periodo: string, inicio: string) {
  const [a, m] = inicio.split("-").map(Number);
  return periodo.startsWith("ano") ? `Boy do Ano ${a}` : `Boy de ${MESES[(m ?? 1) - 1]}`;
}

/** Número que sobe de 0 até o valor (respeita quem prefere menos animação). */
function Contador({ valor, atraso = 0 }: { valor: number; atraso?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setN(valor);
      return;
    }
    let raf = 0;
    let inicio = 0;
    const dur = 1300;
    const t = setTimeout(() => {
      const passo = (ts: number) => {
        if (!inicio) inicio = ts;
        const p = Math.min(1, (ts - inicio) / dur);
        setN(Math.round(valor * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    }, atraso);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [valor, atraso]);
  return <>{n.toLocaleString("pt-BR")}</>;
}

function Confete() {
  const pedacos = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: ((i * 53) % 30) / 10,
        dur: 2.6 + ((i * 17) % 20) / 10,
        cor: ["#f5c542", "#ff9c00", "#ffffff", "#22c55e", "#ef4444", "#3b82f6"][i % 6],
        giro: (i * 47) % 360,
      })),
    [],
  );
  return (
    <div className="confete" aria-hidden="true">
      {pedacos.map((p, i) => (
        <i
          key={i}
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, background: p.cor, transform: `rotate(${p.giro}deg)` }}
        />
      ))}
    </div>
  );
}

function Degrau({ item, lugar, eu }: { item?: ItemRanking; lugar: 1 | 2 | 3; eu?: string }) {
  const anel = lugar === 1 ? "ouro" : lugar === 2 ? "prata" : "bronze";
  if (!item)
    return (
      <div className={`degrau d${lugar} vazio`}>
        <div className="pedestal">
          <span>{lugar}</span>
        </div>
      </div>
    );
  return (
    <div className={`degrau d${lugar} ${item.motoboy_id === eu ? "sou-eu" : ""}`}>
      {lugar === 1 && <div className="coroa">👑</div>}
      <Avatar nome={item.nome} foto={item.foto_url} tamanho={lugar === 1 ? 96 : 72} anel={anel} />
      <div className="nome-podio">{item.nome}</div>
      <div className="pontos-podio">
        <Contador valor={item.pontos} atraso={lugar === 1 ? 900 : lugar === 2 ? 600 : 300} /> <small>pts</small>
      </div>
      <div className="muted pequeno">{item.entregas} entregas</div>
      <div className="pedestal">
        <span>{lugar}º</span>
      </div>
    </div>
  );
}

export function Ranking({ dados, base, voltar }: { dados: DadosRanking; base: string; voltar?: { href: string; rotulo: string } }) {
  const lista = dados.ranking;
  const eu = dados.eu;
  const lider = Math.max(1, ...lista.map((i) => i.pontos));
  const meu = eu ? lista.find((i) => i.motoboy_id === eu) : undefined;
  const top = (p: number) => lista.find((i) => i.pos === p) ?? undefined;
  // empates: os 3 primeiros da lista ocupam o pódio
  const podio = [lista[0], lista[1], lista[2]];
  const resto = lista.slice(3);
  const link = (periodo: string, turno?: string | null) => `${base}?periodo=${periodo}${turno ? `&turno=${turno}` : ""}`;
  const nomeTurno = dados.turno ? dados.turnos?.find((t) => t.codigo === dados.turno)?.nome : null;
  const abas: [string, string][] = [
    ["mes", "Mês"],
    ["ano", "Ano · Boy do Ano"],
    ["mes_anterior", "Mês passado"],
  ];

  return (
    <div className="ranking pilha">
      <div className="linha entre" style={{ flexWrap: "wrap", gap: 8 }}>
        {voltar ? (
          <Link href={voltar.href} className="botao">
            ← {voltar.rotulo}
          </Link>
        ) : (
          <span />
        )}
        <nav className="abas-ranking">
          {abas.map(([k, r]) => (
            <Link key={k} href={link(k, dados.turno)} className={dados.periodo === k ? "ativa" : ""}>
              {r}
            </Link>
          ))}
        </nav>
      </div>
      {(dados.turnos?.length ?? 0) > 1 && (
        <nav className="abas-ranking abas-turno" aria-label="Turno">
          <Link href={link(dados.periodo, null)} className={!dados.turno ? "ativa" : ""}>
            Geral
          </Link>
          {dados.turnos?.map((t) => (
            <Link key={t.codigo} href={link(dados.periodo, t.codigo)} className={dados.turno === t.codigo ? "ativa" : ""}>
              {t.codigo === "manha" ? "☀️ " : t.codigo === "noite" ? "🌙 " : ""}
              {t.nome}
            </Link>
          ))}
        </nav>
      )}

      <header className="titulo-ranking">
        <div className="trofeu">🏆</div>
        <h1>{nomePeriodo(dados.periodo, dados.inicio)}</h1>
        {nomeTurno && <div className="selo-turno">{dados.turno === "manha" ? "☀️" : "🌙"} Turno da {nomeTurno.toLowerCase()}</div>}
        <p className="muted">
          {dados.inicio.split("-").reverse().join("/")} a {dados.fim.split("-").reverse().join("/")} · 1 entrega = 1 ponto, intercorrências somam ou
          tiram
        </p>
      </header>

      {lista.length === 0 ? (
        <div className="cartao" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.2rem" }}>Ninguém pontuou ainda neste período{nomeTurno ? ` no turno da ${nomeTurno.toLowerCase()}` : ""}.</p>
          <p className="muted">A primeira entrega já coloca você no topo!</p>
        </div>
      ) : (
        <section className="palco">
          <Confete />
          <div className="podio">
            <Degrau item={podio[1]} lugar={2} eu={eu} />
            <Degrau item={podio[0]} lugar={1} eu={eu} />
            <Degrau item={podio[2]} lugar={3} eu={eu} />
          </div>
        </section>
      )}

      {resto.length > 0 && (
        <ol className="lista-ranking">
          {resto.map((i, idx) => (
            <li key={i.motoboy_id} className={i.motoboy_id === eu ? "sou-eu" : ""} style={{ animationDelay: `${1.1 + idx * 0.08}s` }}>
              <span className="pos">{i.pos}º</span>
              <Avatar nome={i.nome} foto={i.foto_url} tamanho={40} anel={i.motoboy_id === eu ? "eu" : undefined} />
              <div className="meio">
                <div className="linha entre">
                  <strong>
                    {i.nome}
                    {i.motoboy_id === eu && <span className="selo extra" style={{ marginLeft: 6 }}>Você</span>}
                  </strong>
                  <strong className="pts-lista">{i.pontos.toLocaleString("pt-BR")} pts</strong>
                </div>
                <div className="barra">
                  <i style={{ width: `${Math.max(3, (Math.max(0, i.pontos) / lider) * 100)}%`, animationDelay: `${1.2 + idx * 0.08}s` }} />
                </div>
                <span className="muted pequeno">{i.entregas} entregas</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {dados.campeao_anterior && (
        <div className="cartao campeao-anterior">
          <Avatar nome={dados.campeao_anterior.nome} foto={dados.campeao_anterior.foto_url} tamanho={52} anel="ouro" />
          <div>
            <div className="muted pequeno">
              {rotuloAnterior(dados.periodo, dados.inicio_anterior)}
              {nomeTurno ? ` · ${nomeTurno}` : ""}
            </div>
            <strong style={{ fontSize: "1.1rem" }}>🥇 {dados.campeao_anterior.nome}</strong>
            <div className="muted pequeno">
              {dados.campeao_anterior.pontos} pts · {dados.campeao_anterior.entregas} entregas
            </div>
          </div>
        </div>
      )}

      {meu && meu.pos > 3 && (
        <div className="minha-posicao">
          Você está em <strong>{meu.pos}º</strong> com <strong>{meu.pontos} pts</strong>
          {(() => {
            const acima = top(meu.pos - 1) ?? lista[lista.indexOf(meu) - 1];
            return acima ? <> · faltam {acima.pontos - meu.pontos + 1} pts para passar {acima.nome}</> : null;
          })()}
        </div>
      )}
    </div>
  );
}
