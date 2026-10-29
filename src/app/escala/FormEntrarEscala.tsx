"use client";

import { useActionState } from "react";
import { entrarEscala, type EstadoEntrarEscala } from "./actions";

export function FormEntrarEscala({ pessoas }: { pessoas: { id: string; nome: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrarEscala, FormData>(entrarEscala, {});
  if (pessoas.length === 0) {
    return <div className="aviso">Ninguém tem acesso à escala ainda. A administração libera em Configurações → Acessos com PIN.</div>;
  }
  return (
    <form action={acao} className="cartao pilha">
      <div className="campo">
        <label htmlFor="gestor_id">Quem é você?</label>
        <select id="gestor_id" name="gestor_id" required defaultValue={pessoas.length === 1 ? pessoas[0]?.id : ""}>
          <option value="" disabled>
            Escolha seu nome
          </option>
          {pessoas.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="pin">PIN</label>
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          required
          style={{ fontSize: "1.5rem", letterSpacing: ".3em", textAlign: "center" }}
        />
      </div>
      {estado.erro && <div className="erro">{estado.erro}</div>}
      <button className="botao primario grande" disabled={enviando}>
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
