"use server";

import { redirect } from "next/navigation";
import { COOKIE_ESCALA, apagarAcesso, guardarAcesso, rpcEscala } from "@/lib/acesso";
import { exigir, texto, uuidOuNulo } from "@/lib/form";
import { executar } from "@/lib/navegar";
import { criarSupabaseServidor } from "@/lib/supabase/server";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EstadoEntrarEscala = { erro?: string };

export async function entrarEscala(_: EstadoEntrarEscala, fd: FormData): Promise<EstadoEntrarEscala> {
  const id = uuidOuNulo(fd, "gestor_id");
  const pin = texto(fd, "pin").replace(/\D/g, "");
  if (!id) return { erro: "Escolha seu nome." };
  if (pin.length < 4) return { erro: "Digite seu PIN." };
  const supabase = await criarSupabaseServidor();
  const { error } = await supabase.rpc("mb_escala_entrar", { p_id: id, p_pin: pin });
  if (error) return { erro: error.message.replace(/^.*?ERROR:\s*/i, "") };
  await guardarAcesso(COOKIE_ESCALA, id, pin);
  redirect("/escala");
}

export async function sairEscala() {
  await apagarAcesso(COOKIE_ESCALA);
  redirect("/escala");
}

function volta(fd: FormData) {
  const v = texto(fd, "volta");
  return v.startsWith("/escala") && !v.startsWith("//") ? v : "/escala";
}

function marcados(fd: FormData) {
  const ids = [...new Set(fd.getAll("motoboy_id").filter((v): v is string => typeof v === "string" && UUID.test(v)))];
  if (!ids.length) throw new Error("Marque pelo menos um motoboy.");
  return ids;
}

export async function escAdicionar(fd: FormData) {
  await executar(
    volta(fd),
    async () => {
      const ids = marcados(fd);
      const datasMarcadas = [...new Set(fd.getAll("datas").filter((v): v is string => typeof v === "string" && DATA.test(v)))];
      const data = texto(fd, "data");
      const datas = datasMarcadas.length ? datasMarcadas : DATA.test(data) ? [data] : [];
      if (!datas.length) throw new Error("Escolha o dia.");
      const n = await rpcEscala<number>("mb_e_adicionar", { p_datas: datas, p_turno: exigir(texto(fd, "turno"), "Turno"), p_motoboys: ids });
      const total = datas.length * ids.length;
      return `${n} lugar(es) adicionado(s).${total > n ? ` ${total - n} já estava(m) na escala.` : ""}`;
    },
    undefined,
    "/escala",
  );
}

export async function escRemover(fd: FormData) {
  await executar(
    volta(fd),
    async () => {
      const id = uuidOuNulo(fd, "id");
      if (!id) throw new Error("Item inválido.");
      await rpcEscala("mb_e_remover", { p_escala: id });
    },
    undefined,
    "/escala",
  );
}

export async function escGerar(fd: FormData) {
  await executar(
    volta(fd),
    async () => {
      const inicio = texto(fd, "inicio");
      if (!DATA.test(inicio)) throw new Error("Semana inválida.");
      const n = await rpcEscala<number>("mb_e_gerar", { p_inicio: inicio });
      return n > 0 ? `${n} lugar(es) preenchido(s) pela semana padrão.` : "Nada para preencher: os turnos já têm gente ou a semana padrão está vazia.";
    },
    undefined,
    "/escala",
  );
}

export async function escRefazer(fd: FormData) {
  await executar(
    volta(fd),
    async () => {
      const data = texto(fd, "data");
      if (!DATA.test(data)) throw new Error("Dia inválido.");
      await rpcEscala("mb_e_refazer_dia", { p_data: data });
    },
    "Dia refeito pela semana padrão.",
    "/escala",
  );
}

export async function escPadraoAdicionar(fd: FormData) {
  await executar(
    "/escala/padrao",
    async () => {
      const ids = marcados(fd);
      const dias = [...new Set(fd.getAll("dias").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
      const dow = Number(texto(fd, "dia_semana"));
      const lista = dias.length ? dias : Number.isInteger(dow) ? [dow] : [];
      const n = await rpcEscala<number>("mb_e_padrao_adicionar", { p_dias: lista, p_turno: exigir(texto(fd, "turno"), "Turno"), p_motoboys: ids });
      return `${n} lugar(es) adicionado(s) na semana padrão.`;
    },
    undefined,
    "/escala",
  );
}

export async function escPadraoRemover(fd: FormData) {
  await executar(
    "/escala/padrao",
    async () => {
      const id = uuidOuNulo(fd, "id");
      if (!id) throw new Error("Item inválido.");
      await rpcEscala("mb_e_padrao_remover", { p_padrao: id });
    },
    undefined,
    "/escala",
  );
}
