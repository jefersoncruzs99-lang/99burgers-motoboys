"use client";

import { useActionState } from "react";
import { entrarRota, type EstadoEntrarRota } from "./actions";

export function FormEntrarRota({ gestores }: { gestores: { id: string; nome: string }[] }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrarRota, FormData>(entrarRota, {});
  if (gestores.length === 0) {
    return <div className="aviso">Nenhum gestor de rota cadastrado. A administração cadastra em Configurações.</div>;
  }
  return (
    <form action={acao} className="cartao pilha">
      <div className="campo">
        <label htmlFor="gestor_id">Quem é você?</label>
        <select id="gestor_id" name="gestor_id" required defaultValue={gestores.length === 1 ? gestores[0]?.id : ""}>
          <option value="" disabled>
            Escolha seu nome
          </option>
          {gestores.map((g) => (
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
