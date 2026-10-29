"use client";

import { TrocarFoto } from "@/components/TrocarFoto";
import { removerFoto, salvarFoto } from "../actions";

export function FotoMotoboy({ id, nome, foto }: { id: string; nome: string; foto: string | null }) {
  return <TrocarFoto id={id} nome={nome} foto={foto} enviar={salvarFoto} remover={removerFoto} />;
}
