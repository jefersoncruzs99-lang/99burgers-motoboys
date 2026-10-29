"use server";

import { redirect } from "next/navigation";
import { COOKIE_ROTA, apagarAcesso, guardarAcesso, rpcRota } from "@/lib/acesso";
import { criarSupabaseServidor } from "@/lib/supabase/server";
import { exigir, inteiroOuNulo, numeroOuNulo, texto, textoOuNulo, uuidOuNulo } from "@/lib/form";
import { executar } from "@/lib/navegar";
import { desenharQr, type QrAtual } from "@/lib/qr";

export type EstadoEntrarRota = { erro?: string };

export async function entrarRota(_: EstadoEntrarRota, fd: FormData): Promise<EstadoEntrarRota> {
  const id = uuidOuNulo(fd, "gestor_id");
  const pin = texto(fd, "pin").replace(/\D/g, "");
  if (!id) return { erro: "Escolha seu nome." };
  if (pin.length < 4) return { erro: "Digite seu PIN." };
  const supabase = await criarSupabaseServidor();
  const { error } = await supabase.rpc("mb_rota_entrar", { p_id: id, p_pin: pin });
  if (error) return { erro: error.message.replace(/^.*?ERROR:\s*/i, "") };
  await guardarAcesso(COOKIE_ROTA, id, pin);
  redirect("/rota");
}

export async function sairRota() {
  await apagarAcesso(COOKIE_ROTA);
  redirect("/rota");
}

function volta(fd: FormData) {
  const data = texto(fd, "data");
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? `/rota?data=${data}` : "/rota";
}

function dataDoForm(fd: FormData) {
  const d = texto(fd, "data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Data inválida.");
  return d;
}

export async function rotaChegada(fd: FormData) {
  await executar(
    volta(fd),
    async () => {
      const motoboy = uuidOuNulo(fd, "motoboy_id");
      if (!motoboy) throw new Error("Escolha o motoboy.");
      await rpcRota("mb_r_registrar_chegada", {
        p_data: dataDoForm(fd),
        p_turno: exigir(texto(fd, "turno"), "Turno"),
        p_motoboy: motoboy,
        p_hora: exigir(texto(fd, "hora"), "Hora"),
        p_obs: textoOuNulo(fd, "obs"),
      });
    },
    "Chegada registrada.",
    "/rota",
  );
}

export async function rotaEntregas(fd: FormData) {
  await executar(
    volta(fd),
    async () => {
      const registro = uuidOuNulo(fd, "registro_id");
      const valor = numeroOuNulo(fd, "valor", "Valor das entregas");
      if (!registro || valor === null) throw new Error("Informe o valor das entregas.");
      const qtd = inteiroOuNulo(fd, "qtd", "Quantidade de entregas") ?? 0;
      await rpcRota("mb_r_lancar_entregas", { p_registro: registro, p_valor: valor, p_qtd: qtd });
    },
    "Entregas lançadas. Os pontos do ranking já foram atualizados.",
    "/rota",
  );
}

export async function rotaOcorrencia(fd: FormData) {
  await executar(
    volta(fd),
    async () => {
      await rpcRota("mb_r_ocorrencia", {
        p_data: dataDoForm(fd),
        p_turno: exigir(texto(fd, "turno"), "Turno"),
        p_motoboy: uuidOuNulo(fd, "motoboy_id"),
        p_tipo: exigir(texto(fd, "tipo"), "Tipo"),
        p_desc: textoOuNulo(fd, "descricao"),
      });
    },
    "Intercorrência registrada.",
    "/rota",
  );
}

export async function obterQrRota(): Promise<QrAtual | { erro: string }> {
  try {
    const d = await rpcRota<{ codigo: string; restante: number; janela: number }>("mb_r_qr");
    return await desenharQr(d);
  } catch (e) {
    return { erro: e instanceof Error && e.message === "SEM_ACESSO" ? "Entre de novo com seu PIN." : e instanceof Error ? e.message : "Erro." };
  }
}

export async function rotaDinheiro(fd: FormData) {
  await executar(
    volta(fd),
    async () => {
      const registro = uuidOuNulo(fd, "registro_id");
      if (!registro) throw new Error("Turno inválido.");
      await rpcRota("mb_r_pagar_dinheiro", { p_registro: registro });
    },
    "Pago em dinheiro registrado. Esse turno saiu do saldo da quarta/quinzena.",
    "/rota",
  );
}
