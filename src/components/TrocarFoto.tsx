"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "./Avatar";

/** Reduz a foto no próprio aparelho (quadrada, até 600px, JPG) antes de enviar. */
async function reduzir(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error("Não consegui abrir essa imagem."));
      i.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const tam = Math.min(600, lado);
    const c = document.createElement("canvas");
    c.width = tam;
    c.height = tam;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Navegador sem suporte a imagens.");
    ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, tam, tam);
    return await new Promise<Blob>((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("Falha ao converter a foto."))), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function TrocarFoto({
  id,
  nome,
  foto,
  tamanho = 72,
  anel = "eu",
  enviar,
  remover,
  rotulo,
}: {
  id: string;
  nome: string;
  foto: string | null;
  tamanho?: number;
  anel?: "ouro" | "prata" | "bronze" | "eu";
  enviar: (fd: FormData) => Promise<{ ok?: boolean; erro?: string }>;
  remover?: (fd: FormData) => Promise<void>;
  rotulo?: string;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      const blob = await reduzir(arquivo);
      const fd = new FormData();
      fd.set("id", id);
      fd.set("foto", new File([blob], "foto.jpg", { type: "image/jpeg" }));
      const r = await enviar(fd);
      if (r.erro) setErro(r.erro);
      else router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pilha" style={{ alignItems: "center", gap: 4, zIndex: 1 }}>
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", position: "relative" }}
        title="Trocar foto"
        aria-label="Trocar foto"
        disabled={enviando}
      >
        <Avatar nome={nome} foto={foto} tamanho={tamanho} anel={anel} />
        <span className="selo" style={{ position: "absolute", bottom: -2, right: -4, background: "#000" }}>
          {enviando ? "..." : "📷"}
        </span>
      </button>
      <input ref={entrada} type="file" accept="image/*" onChange={escolher} hidden />
      {rotulo && !foto && <span className="muted pequeno">{rotulo}</span>}
      {foto && remover && (
        <form action={remover}>
          <input type="hidden" name="id" value={id} />
          <button className="muted pequeno" style={{ background: "none", border: 0, cursor: "pointer", textDecoration: "underline" }}>
            tirar foto
          </button>
        </form>
      )}
      {erro && <div className="erro pequeno">{erro}</div>}
    </div>
  );
}
