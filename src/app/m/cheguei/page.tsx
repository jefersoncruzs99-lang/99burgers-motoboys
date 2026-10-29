import Link from "next/link";
import { COOKIE_MOTOBOY, lerAcesso, origemDoAcesso, rpcMotoboy } from "@/lib/acesso";
import { FUSO, ROTULO_FAIXA, moeda } from "@/lib/datas";
import type { PainelMotoboy } from "@/lib/tipos";
import { FormEntrar } from "../FormEntrar";
import { confirmarChegada } from "../actions";

export const dynamic = "force-dynamic";

function minutosAgora(): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date())
    .split(":")
    .map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
const min = (hhmm?: string) => {
  const [h, m] = (hhmm ?? "00:00").split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export default async function Cheguei({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const codigo = (sp.c ?? "").replace(/[^0-9a-f]/gi, "").slice(0, 12);
  const destino = `/m/cheguei?c=${codigo}`;
  const acesso = await lerAcesso(COOKIE_MOTOBOY);

  const telaLogin = (aviso?: string) => (
    <main className="container pilha" style={{ maxWidth: 460, paddingTop: 30 }}>
      <h1>
        <span className="marca">MOTOBOYS 99</span>
        <br />
        Confirmar chegada
      </h1>
      {aviso && <div className="aviso">{aviso}</div>}
      <p className="muted">Entre com seu telefone e chave. Se o QR vencer enquanto isso, é só escanear de novo.</p>
      <FormEntrar destino={destino} />
    </main>
  );

  if (!acesso) return telaLogin();

  let ticket: string | null = null;
  let erro: string | null = null;
  let p: PainelMotoboy;
  try {
    const { ip } = await origemDoAcesso();
    try {
      ticket = await rpcMotoboy<string>("mb_m_ler_qr", { p_codigo: codigo, p_ip: ip });
    } catch (e) {
      if (e instanceof Error && e.message === "SEM_ACESSO") throw e;
      erro = e instanceof Error ? e.message : "QR inválido.";
    }
    p = await rpcMotoboy<PainelMotoboy>("mb_m_painel");
  } catch (e) {
    if (e instanceof Error && e.message === "SEM_ACESSO") return telaLogin("Sua chave mudou. Entre de novo.");
    throw e;
  }

  const abertos = p.turnos.filter((t) => !p.registros_hoje.some((r) => r.turno === t.codigo));
  const agora = minutosAgora();
  const sugerido = abertos.find((t) => agora >= min(t.inicio) - 120 && agora <= min(t.fim)) ?? abertos[0];
  const contratoPendente = p.contrato !== null && !p.contrato.assinado_em;

  return (
    <main className="container pilha" style={{ maxWidth: 520, paddingTop: 20 }}>
      <Link href="/m" className="muted">
        ← Meu painel
      </Link>
      <h1 style={{ margin: 0 }}>Olá, {p.motoboy.nome.split(" ")[0]}! 👋</h1>

      {erro ? (
        <div className="cartao alerta pilha">
          <strong style={{ fontSize: "1.2rem" }}>⏱ {erro}</strong>
          <p className="muted" style={{ margin: 0 }}>
            O QR muda a cada 30 segundos. Aponte a câmera de novo para o QR que está na tela do gestor.
          </p>
        </div>
      ) : contratoPendente ? (
        <div className="cartao alerta pilha">
          <strong>Antes de confirmar, assine o contrato no seu painel.</strong>
          <Link href="/m" className="botao primario">
            Ir para o contrato
          </Link>
          <span className="muted pequeno">Depois é só escanear o QR de novo.</span>
        </div>
      ) : abertos.length === 0 ? (
        <div className="ok">Você já confirmou todos os turnos de hoje. ✅</div>
      ) : (
        <form action={confirmarChegada} className="cartao destaque pilha">
          <input type="hidden" name="ticket" value={ticket ?? ""} />
          <div className="ok pequeno">✅ QR da loja lido. Você tem 10 minutos para confirmar.</div>
          <fieldset className="pilha" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
            <legend className="muted" style={{ marginBottom: 6 }}>
              Qual turno?
            </legend>
            {abertos.map((t) => (
              <label key={t.codigo} className="check cartao" style={{ padding: 12 }}>
                <input type="radio" name="turno" value={t.codigo} defaultChecked={t.codigo === sugerido?.codigo} required />
                <span>
                  <strong>
                    {t.nome} · {t.setor}
                  </strong>
                  <span className="muted pequeno" style={{ display: "block" }}>
                    {t.inicio} às {t.fim} · cheia até {t.limite_cheia} ({moeda(p.valores_hoje["1"])}), {ROTULO_FAIXA[2]} até {t.limite_meio} (
                    {moeda(p.valores_hoje["2"])}), depois {moeda(p.valores_hoje["3"])}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {p.termo && (
            <details>
              <summary className="muted">Ler o termo do dia</summary>
              <div className="texto-doc" style={{ marginTop: 8 }}>
                {p.termo.texto.trim()}
              </div>
            </details>
          )}
          <label className="check">
            <input type="checkbox" name="aceite" required /> Aceito o termo do dia e estou disponível agora
          </label>
          <button className="botao primario cheio cheguei-grande">✅ Cheguei</button>
        </form>
      )}
    </main>
  );
}
