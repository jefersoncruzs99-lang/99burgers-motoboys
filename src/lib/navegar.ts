import "server-only";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";

/** Executa a ação e volta para a página com ?ok= ou ?erro=. */
export async function executar(caminho: string, fn: () => Promise<string | void>, sucesso?: string, aoSemAcesso?: string) {
  let destino = caminho;
  const sep = () => (destino.includes("?") ? "&" : "?");
  try {
    const msg = await fn();
    const ok = typeof msg === "string" ? msg : sucesso;
    if (ok) destino = `${destino}${sep()}ok=${encodeURIComponent(ok)}`;
  } catch (e) {
    unstable_rethrow(e);
    const m = e instanceof Error ? e.message : "Erro inesperado.";
    if (m === "SEM_ACESSO" && aoSemAcesso) redirect(aoSemAcesso);
    destino = `${destino}${sep()}erro=${encodeURIComponent(traduzir(m))}`;
  }
  revalidatePath(caminho.split("?")[0] ?? "/", "layout");
  redirect(destino);
}

export function traduzir(msg: string): string {
  if (msg.includes("duplicate key") && msg.includes("mb_escala")) return "Este motoboy já está nesse turno.";
  if (msg.includes("duplicate key") && msg.includes("telefone")) return "Já existe um motoboy com esse telefone.";
  if (msg.includes("duplicate key")) return "Já existe um registro com esses dados.";
  if (msg.includes("violates check constraint") && msg.includes("telefone")) return "Telefone inválido: use DDD + número (só números).";
  if (msg.includes("violates check constraint")) return "Valor inválido. Confira os campos.";
  return msg;
}
