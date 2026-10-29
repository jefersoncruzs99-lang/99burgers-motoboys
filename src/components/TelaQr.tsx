"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QrAtual } from "@/lib/qr";

/** QR de chegada que se renova sozinho (muda a cada janela de tempo). */
export function TelaQr({ obter, titulo }: { obter: () => Promise<QrAtual | { erro: string }>; titulo: string }) {
  const [qr, setQr] = useState<QrAtual | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [falta, setFalta] = useState(0);
  const fim = useRef(0);

  const buscar = useCallback(async () => {
    try {
      const r = await obter();
      if ("erro" in r) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      setQr(r);
      fim.current = Date.now() + r.restante * 1000;
    } catch {
      setErro("Sem conexão. Tentando de novo...");
      fim.current = Date.now() + 3000;
    }
  }, [obter]);

  useEffect(() => {
    void buscar();
    const t = setInterval(() => {
      const f = Math.max(0, Math.ceil((fim.current - Date.now()) / 1000));
      setFalta(f);
      if (fim.current && Date.now() >= fim.current + 300) {
        fim.current = Date.now() + 60_000; // evita buscar duas vezes
        void buscar();
      }
    }, 250);
    // mantém a tela acesa quando o navegador deixa
    let trava: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((w) => (trava = w)).catch(() => {});
    return () => {
      clearInterval(t);
      void trava?.release();
    };
  }, [buscar]);

  const pct = qr ? Math.min(100, (falta / qr.janela) * 100) : 0;
  return (
    <div className="tela-qr">
      <h1>{titulo}</h1>
      <p className="muted">Motoboy: abra a câmera do celular e aponte para o código.</p>
      <div className="qr-caixa" aria-live="polite">
        {qr ? <div className="qr-svg" dangerouslySetInnerHTML={{ __html: qr.svg }} /> : <div className="muted">Carregando...</div>}
      </div>
      <div className="progresso" style={{ maxWidth: 360, width: "100%" }}>
        <i style={{ width: `${pct}%`, transition: "width .25s linear" }} />
      </div>
      <p className="muted pequeno">Novo código em {falta}s · print ou foto não funcionam depois que o código muda</p>
      {erro && <div className="erro">{erro}</div>}
    </div>
  );
}
