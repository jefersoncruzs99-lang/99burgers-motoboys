"use client";

import { useActionState } from "react";
import { gerarChave, type EstadoChave } from "../actions";

export function GerarChave({ id, nome, telefone, temChave }: { id: string; nome: string; telefone: string; temChave: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoChave, FormData>(gerarChave, {});
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/m`;
  const msg = estado.chave
    ? `Olá, ${nome.split(" ")[0]}! Seu acesso ao app dos motoboys da 99:\n${link}\nTelefone: ${telefone}\nChave: ${estado.chave}`
    : "";
  return (
    <div className="pilha" style={{ gap: 6 }}>
      {estado.chave ? (
        <div className="ok pilha" style={{ gap: 6 }}>
          <span>
            Chave de {nome.split(" ")[0]}: <strong style={{ fontSize: "1.6rem", letterSpacing: ".2em" }}>{estado.chave}</strong>
          </span>
          <span className="pequeno">Anote ou envie agora. Ela não aparece de novo (dá para gerar outra se perder).</span>
          <a
            className="botao sucesso"
            href={`https://wa.me/55${telefone.replace(/^55/, "")}?text=${encodeURIComponent(msg)}`}
            target="_blank"
            rel="noreferrer"
          >
            Enviar pelo WhatsApp
          </a>
        </div>
      ) : (
        <form
          action={acao}
          onSubmit={(e) => {
            if (temChave && !confirm(`Gerar nova chave para ${nome}? A chave antiga para de funcionar.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button className={`botao ${temChave ? "" : "primario"}`} disabled={enviando}>
            {enviando ? "Gerando..." : temChave ? "Gerar nova chave" : "Gerar chave de acesso"}
          </button>
        </form>
      )}
      {estado.erro && <div className="erro">{estado.erro}</div>}
    </div>
  );
}
