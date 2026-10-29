"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COOKIE_MOTOBOY, apagarAcesso, guardarAcesso, origemDoAcesso, rpcMotoboy } from "@/lib/acesso";
import { criarSupabaseServidor } from "@/lib/supabase/server";
import { marcado, texto, textoOuNulo, uuidOuNulo } from "@/lib/form";
import { executar } from "@/lib/navegar";
import { ROTULO_FAIXA, hora, moeda } from "@/lib/datas";

export type EstadoEntrar = { erro?: string };

export async function entrarMotoboy(_: EstadoEntrar, fd: FormData): Promise<EstadoEntrar> {
  const telefone = texto(fd, "telefone").replace(/\D/g, "");
  const chave = texto(fd, "chave").replace(/\D/g, "");
  if (telefone.length < 10 || chave.length !== 6) return { erro: "Digite o telefone com DDD e a chave de 6 números." };
  const supabase = await criarSupabaseServidor();
  const { data, error } = await supabase.rpc("mb_motoboy_entrar", { p_telefone: telefone, p_chave: chave });
  if (error || !data) return { erro: error?.message.replace(/^.*?ERROR:\s*/i, "") ?? "Telefone ou chave incorretos." };
  await guardarAcesso(COOKIE_MOTOBOY, String(data), chave);
  const destino = texto(fd, "destino");
  redirect(destino.startsWith("/m") && !destino.startsWith("//") ? destino : "/m");
}

export async function sairMotoboy() {
  await apagarAcesso(COOKIE_MOTOBOY);
  redirect("/m");
}

export async function assinarContrato(fd: FormData) {
  await executar(
    "/m",
    async () => {
      if (!marcado(fd, "aceite")) throw new Error("Marque que leu e aceita o contrato.");
      const { ip, ua } = await origemDoAcesso();
      await rpcMotoboy("mb_m_assinar_contrato", {
        p_nome: texto(fd, "nome"),
        p_cpf: texto(fd, "cpf"),
        p_ip: ip,
        p_ua: ua,
      });
    },
    "Contrato assinado. Obrigado!",
    "/m",
  );
}

export async function confirmarChegada(fd: FormData) {
  await executar(
    "/m",
    async () => {
      const turno = texto(fd, "turno");
      if (!marcado(fd, "aceite")) throw new Error("Para confirmar, marque que aceita o termo do dia.");
      const { ip, ua } = await origemDoAcesso();
      const r = await rpcMotoboy<{ faixa: number; valor_diaria: number; chegada_em: string; fora_da_escala: boolean }>("mb_m_chegar_qr", {
        p_turno: turno,
        p_aceite: true,
        p_ip: ip,
        p_ua: ua,
        p_ticket: uuidOuNulo(fd, "ticket"),
      });
      return `Chegada confirmada às ${hora(r.chegada_em)}. ${ROTULO_FAIXA[r.faixa] ?? ""}: ${moeda(r.valor_diaria)}.${
        r.fora_da_escala ? " Você não estava na escala deste turno; o gestor de rota vai ver." : ""
      }`;
    },
    undefined,
    "/m",
  );
}

export async function pedirTroca(fd: FormData) {
  await executar(
    "/m",
    async () => {
      const escala = uuidOuNulo(fd, "escala_id");
      if (!escala) throw new Error("Turno inválido.");
      await rpcMotoboy("mb_m_pedir_troca", {
        p_escala: escala,
        p_para: uuidOuNulo(fd, "para"),
        p_motivo: textoOuNulo(fd, "motivo"),
      });
    },
    "Pedido de troca enviado. Avise o colega pelo WhatsApp para ele aceitar no app.",
    "/m",
  );
}

export async function aceitarTroca(fd: FormData) {
  await executar(
    "/m",
    async () => {
      const id = uuidOuNulo(fd, "troca_id");
      if (!id) throw new Error("Troca inválida.");
      const status = await rpcMotoboy<string>("mb_m_aceitar_troca", { p_troca: id });
      return status === "aprovada"
        ? "Troca feita! O turno já está na sua escala."
        : "Troca aceita. Falta a administração aprovar.";
    },
    undefined,
    "/m",
  );
}

export async function cancelarTroca(fd: FormData) {
  await executar(
    "/m",
    async () => {
      const id = uuidOuNulo(fd, "troca_id");
      if (!id) throw new Error("Troca inválida.");
      await rpcMotoboy("mb_m_cancelar_troca", { p_troca: id });
    },
    "Pedido de troca cancelado.",
    "/m",
  );
}

export async function aceitarRegulamento(fd: FormData) {
  await executar(
    "/m",
    async () => {
      if (!marcado(fd, "aceite")) throw new Error("Marque que leu e aceita o regulamento.");
      const { ip, ua } = await origemDoAcesso();
      await rpcMotoboy("mb_m_aceitar_documento", {
        p_tipo: "regulamento",
        p_nome: texto(fd, "nome"),
        p_cpf: texto(fd, "cpf"),
        p_ip: ip,
        p_ua: ua,
      });
    },
    "Regulamento aceito. Bora pro topo do ranking! 🏆",
    "/m",
  );
}

export async function responderOcorrencia(fd: FormData) {
  await executar(
    "/m",
    async () => {
      const id = uuidOuNulo(fd, "ocorrencia_id");
      if (!id) throw new Error("Intercorrência inválida.");
      const contestacao = textoOuNulo(fd, "contestacao");
      if (texto(fd, "acao") === "contestar" && !contestacao) throw new Error("Escreva sua versão para contestar.");
      const { ip, ua } = await origemDoAcesso();
      const r = await rpcMotoboy<string>("mb_m_ocorrencia_ciente", {
        p_ocorrencia: id,
        p_contestacao: texto(fd, "acao") === "contestar" ? contestacao : null,
        p_ip: ip,
        p_ua: ua,
      });
      return r === "contestada" ? "Contestação enviada. A administração vai analisar." : "Ciência registrada.";
    },
    undefined,
    "/m",
  );
}

export async function salvarMinhaFoto(fd: FormData): Promise<{ ok?: boolean; erro?: string }> {
  try {
    const arquivo = fd.get("foto");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha uma foto." };
    if (arquivo.size > 600_000) return { erro: "Foto muito grande. Tente outra." };
    const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
    await rpcMotoboy("mb_m_salvar_foto", { p_base64: base64 });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "SEM_ACESSO") return { erro: "Entre de novo com sua chave." };
    return { erro: e instanceof Error ? e.message : "Erro ao salvar a foto." };
  }
}

export async function removerMinhaFoto() {
  await executar(
    "/m",
    async () => {
      await rpcMotoboy("mb_m_remover_foto");
    },
    "Foto removida.",
    "/m",
  );
}
