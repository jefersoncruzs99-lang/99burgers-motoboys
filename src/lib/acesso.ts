import "server-only";
import { cookies, headers } from "next/headers";
import { criarSupabaseServidor } from "./supabase/server";

export const COOKIE_MOTOBOY = "mb_motoboy";
export const COOKIE_ROTA = "mb_rota";

const UM_ANO = 60 * 60 * 24 * 365;

export async function guardarAcesso(nome: string, id: string, segredo: string) {
  const c = await cookies();
  c.set(nome, `${id}.${segredo}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UM_ANO,
  });
}

export async function apagarAcesso(nome: string) {
  const c = await cookies();
  c.delete(nome);
}

/** Lê o cookie "id.segredo" guardado no aparelho. */
export async function lerAcesso(nome: string): Promise<{ id: string; segredo: string } | null> {
  const c = await cookies();
  const v = c.get(nome)?.value;
  if (!v) return null;
  const i = v.indexOf(".");
  if (i < 0) return null;
  return { id: v.slice(0, i), segredo: v.slice(i + 1) };
}

function limpar(msg: string): string {
  return msg.replace(/^.*?ERROR:\s*/i, "").trim();
}

/** Chama uma função do banco como o motoboy logado (confere a chave lá dentro). */
export async function rpcMotoboy<T>(funcao: string, args: Record<string, unknown> = {}): Promise<T> {
  const a = await lerAcesso(COOKIE_MOTOBOY);
  if (!a) throw new Error("SEM_ACESSO");
  const supabase = await criarSupabaseServidor();
  const { data, error } = await supabase.rpc(funcao, { p_id: a.id, p_chave: a.segredo, ...args });
  if (error) {
    if (error.message.includes("Chave inválida")) throw new Error("SEM_ACESSO");
    throw new Error(limpar(error.message));
  }
  return data as T;
}

/** Chama uma função do banco como o gestor de rota logado (confere o PIN lá dentro). */
export async function rpcRota<T>(funcao: string, args: Record<string, unknown> = {}): Promise<T> {
  const a = await lerAcesso(COOKIE_ROTA);
  if (!a) throw new Error("SEM_ACESSO");
  const supabase = await criarSupabaseServidor();
  const { data, error } = await supabase.rpc(funcao, { p_rota: a.id, p_pin: a.segredo, ...args });
  if (error) {
    if (error.message.includes("PIN inválido")) throw new Error("SEM_ACESSO");
    throw new Error(limpar(error.message));
  }
  return data as T;
}

/** IP e navegador de quem está usando (guardados no aceite do contrato e do termo). */
export async function origemDoAcesso(): Promise<{ ip: string; ua: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0]?.trim() ?? "";
  return { ip, ua: h.get("user-agent") ?? "" };
}
