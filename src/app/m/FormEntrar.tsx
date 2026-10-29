"use client";

import { useActionState } from "react";
import { entrarMotoboy, type EstadoEntrar } from "./actions";

export function FormEntrar({ destino }: { destino?: string } = {}) {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(entrarMotoboy, {});
  return (
    <form action={acao} className="cartao pilha">
      {destino && <input type="hidden" name="destino" value={destino} />}
      <div className="campo">
        <label htmlFor="telefone">Seu telefone (com DDD)</label>
        <input id="telefone" name="telefone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="71 99999-9999" required />
      </div>
      <div className="campo">
        <label htmlFor="chave">Sua chave de acesso (6 números)</label>
        <input
          id="chave"
          name="chave"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          required
          style={{ fontSize: "1.5rem", letterSpacing: ".3em", textAlign: "center" }}
        />
      </div>
      {estado.erro && <div className="erro">{estado.erro}</div>}
      <button className="botao primario grande" disabled={enviando}>
        {enviando ? "Entrando..." : "Entrar"}
      </button>
      <p className="muted pequeno">Não tem a chave? Peça para a administração da 99.</p>
      <p className="muted pequeno">
        Dica: depois de entrar, use o menu do navegador → <strong>Adicionar à tela inicial</strong>. O app fica como ícone no celular e
        você não precisa digitar a chave de novo.
      </p>
    </form>
  );
}
