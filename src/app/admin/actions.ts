"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { exigirGestor } from "@/lib/auth";
import { exigir, inteiroOuNulo, marcado, numeroOuNulo, texto, textoOuNulo, uuidOuNulo } from "@/lib/form";
import { executar } from "@/lib/navegar";
import { somarDias } from "@/lib/datas";
import { criarSupabaseServidor } from "@/lib/supabase/server";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataDoForm(fd: FormData, campo = "data"): string {
  const d = texto(fd, campo);
  if (!DATA.test(d)) throw new Error("Data inválida.");
  return d;
}

/** Volta para a página indicada no campo "volta" do formulário (só caminhos internos /admin). */
function volta(fd: FormData, padrao: string): string {
  const v = texto(fd, "volta");
  return v.startsWith("/admin") && !v.startsWith("//") ? v : padrao;
}

function falhou(error: { message: string } | null) {
  if (error) throw new Error(error.message.replace(/^.*?ERROR:\s*/i, ""));
}

export async function sair() {
  const supabase = await criarSupabaseServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

// ===================== DIA =====================

function voltaDia(fd: FormData) {
  const d = texto(fd, "data");
  return DATA.test(d) ? `/admin?data=${d}` : "/admin";
}

export async function admChegada(fd: FormData) {
  await executar(voltaDia(fd), async () => {
    const { supabase } = await exigirGestor();
    const motoboy = uuidOuNulo(fd, "motoboy_id");
    if (!motoboy) throw new Error("Escolha o motoboy.");
    const { error } = await supabase.rpc("mb_a_registrar_chegada", {
      p_data: dataDoForm(fd),
      p_turno: exigir(texto(fd, "turno"), "Turno"),
      p_motoboy: motoboy,
      p_hora: exigir(texto(fd, "hora"), "Hora"),
      p_obs: textoOuNulo(fd, "obs"),
    });
    falhou(error);
  }, "Chegada registrada.");
}

export async function admEntregas(fd: FormData) {
  await executar(voltaDia(fd), async () => {
    const { supabase } = await exigirGestor();
    const registro = uuidOuNulo(fd, "registro_id");
    const valor = numeroOuNulo(fd, "valor", "Valor das entregas");
    if (!registro || valor === null) throw new Error("Informe o valor das entregas.");
    const { error } = await supabase.rpc("mb_a_lancar_entregas", { p_registro: registro, p_valor: valor });
    falhou(error);
  }, "Entregas lançadas.");
}

export async function admCorrigir(fd: FormData) {
  await executar(voltaDia(fd), async () => {
    const { supabase } = await exigirGestor();
    const registro = uuidOuNulo(fd, "registro_id");
    if (!registro) throw new Error("Registro inválido.");
    const { error } = await supabase.rpc("mb_a_corrigir_chegada", { p_registro: registro, p_hora: exigir(texto(fd, "hora"), "Hora") });
    falhou(error);
  }, "Horário corrigido e diária recalculada.");
}

export async function admRemover(fd: FormData) {
  await executar(voltaDia(fd), async () => {
    const { supabase } = await exigirGestor();
    const registro = uuidOuNulo(fd, "registro_id");
    if (!registro) throw new Error("Registro inválido.");
    const { data, error } = await supabase.from("mb_registros").delete().eq("id", registro).is("pagamento_id", null).select("id");
    falhou(error);
    if (!data?.length) throw new Error("Não foi possível apagar (já pago?).");
  }, "Chegada apagada.");
}

export async function admOcorrencia(fd: FormData) {
  await executar(voltaDia(fd), async () => {
    const { supabase, nome } = await exigirGestor();
    const { error } = await supabase.from("mb_ocorrencias").insert({
      data: dataDoForm(fd),
      turno: exigir(texto(fd, "turno"), "Turno"),
      motoboy_id: uuidOuNulo(fd, "motoboy_id"),
      tipo: exigir(texto(fd, "tipo"), "Tipo"),
      descricao: exigir(texto(fd, "descricao"), "Descrição"),
      registrado_por: `Adm: ${nome}`,
    });
    falhou(error);
  }, "Intercorrência registrada.");
}

// ===================== ESCALA =====================

export async function addEscala(fd: FormData) {
  await executar(volta(fd, "/admin/escala"), async () => {
    const { supabase } = await exigirGestor();
    const motoboy = uuidOuNulo(fd, "motoboy_id");
    if (!motoboy) throw new Error("Escolha o motoboy.");
    const { error } = await supabase
      .from("mb_escala")
      .insert({ data: dataDoForm(fd), turno: exigir(texto(fd, "turno"), "Turno"), motoboy_id: motoboy, origem: "manual" });
    falhou(error);
  });
}

export async function removerEscala(fd: FormData) {
  await executar(volta(fd, "/admin/escala"), async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    if (!id) throw new Error("Item inválido.");
    const { count } = await supabase.from("mb_registros").select("id", { count: "exact", head: true }).eq("escala_id", id);
    if (count) throw new Error("Esse motoboy já registrou chegada neste turno. Apague a chegada antes, na tela do dia.");
    const { error } = await supabase.from("mb_escala").delete().eq("id", id);
    falhou(error);
  });
}

export async function gerarSemana(fd: FormData) {
  await executar(volta(fd, "/admin/escala"), async () => {
    const { supabase } = await exigirGestor();
    const inicio = dataDoForm(fd, "inicio");
    const { data, error } = await supabase.rpc("mb_gerar_escala", { p_inicio: inicio, p_fim: somarDias(inicio, 6) });
    falhou(error);
    return Number(data) > 0
      ? `${data} lugar(es) preenchido(s) pela semana padrão. Turnos que já tinham gente não foram mexidos.`
      : "Nada para preencher: todos os turnos já têm gente ou a semana padrão está vazia.";
  });
}

export async function refazerDia(fd: FormData) {
  await executar(volta(fd, "/admin/escala"), async () => {
    const { supabase } = await exigirGestor();
    const { error } = await supabase.rpc("mb_refazer_dia", { p_data: dataDoForm(fd) });
    falhou(error);
  }, "Dia refeito pela semana padrão (manteve quem foi colocado à mão e quem já chegou).");
}

export async function addPadrao(fd: FormData) {
  await executar("/admin/escala/padrao", async () => {
    const { supabase } = await exigirGestor();
    const motoboy = uuidOuNulo(fd, "motoboy_id");
    const dow = inteiroOuNulo(fd, "dia_semana");
    if (!motoboy || dow === null || dow > 6) throw new Error("Escolha o motoboy.");
    const { error } = await supabase
      .from("mb_escala_padrao")
      .insert({ dia_semana: dow, turno: exigir(texto(fd, "turno"), "Turno"), motoboy_id: motoboy });
    falhou(error);
  });
}

export async function removerPadrao(fd: FormData) {
  await executar("/admin/escala/padrao", async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    if (!id) throw new Error("Item inválido.");
    const { error } = await supabase.from("mb_escala_padrao").delete().eq("id", id);
    falhou(error);
  });
}

// ===================== MOTOBOYS =====================

export async function salvarMotoboy(fd: FormData) {
  await executar("/admin/motoboys", async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    const forma = texto(fd, "forma_pagamento");
    const dados = {
      nome: exigir(texto(fd, "nome"), "Nome"),
      telefone: exigir(texto(fd, "telefone").replace(/\D/g, ""), "Telefone"),
      cpf: textoOuNulo(fd, "cpf"),
      pix: textoOuNulo(fd, "pix"),
      forma_pagamento: forma === "semanal" ? "semanal" : "quinzenal",
      observacao: textoOuNulo(fd, "observacao"),
      ativo: id ? marcado(fd, "ativo") : true,
    };
    const { error } = id
      ? await supabase.from("mb_motoboys").update(dados).eq("id", id)
      : await supabase.from("mb_motoboys").insert(dados);
    falhou(error);
    return id ? "Cadastro atualizado." : `${dados.nome} cadastrado. Agora gere a chave de acesso dele.`;
  });
}

export type EstadoChave = { chave?: string; erro?: string; id?: string };

export async function gerarChave(_: EstadoChave, fd: FormData): Promise<EstadoChave> {
  try {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    if (!id) return { erro: "Motoboy inválido." };
    const { data, error } = await supabase.rpc("mb_nova_chave", { p_motoboy: id });
    if (error) return { erro: error.message };
    revalidatePath("/admin/motoboys");
    return { chave: String(data), id };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

// ===================== PAGAMENTOS =====================

export async function pagar(fd: FormData) {
  await executar(volta(fd, "/admin/pagamentos"), async () => {
    const { supabase } = await exigirGestor();
    const motoboy = uuidOuNulo(fd, "motoboy_id");
    if (!motoboy) throw new Error("Motoboy inválido.");
    const { error } = await supabase.rpc("mb_registrar_pagamento", {
      p_motoboy: motoboy,
      p_data: dataDoForm(fd),
      p_observacao: textoOuNulo(fd, "observacao"),
    });
    falhou(error);
  }, "Pagamento registrado. O motoboy já vê no app.");
}

export async function desfazerPagamento(fd: FormData) {
  await executar(volta(fd, "/admin/pagamentos"), async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "pagamento_id");
    if (!id) throw new Error("Pagamento inválido.");
    const { error } = await supabase.rpc("mb_desfazer_pagamento", { p_pagamento: id });
    falhou(error);
  }, "Pagamento desfeito: os dias voltaram para em aberto.");
}

export async function addAjuste(fd: FormData) {
  await executar(volta(fd, "/admin/pagamentos"), async () => {
    const { supabase, user } = await exigirGestor();
    const motoboy = uuidOuNulo(fd, "motoboy_id");
    if (!motoboy) throw new Error("Escolha o motoboy.");
    const bruto = texto(fd, "valor").replace(/\s/g, "").replace(",", ".");
    const n = Number(bruto);
    if (!bruto || !Number.isFinite(n) || n === 0) throw new Error("Informe o valor do ajuste.");
    const valor = texto(fd, "sinal") === "-" ? -Math.abs(n) : Math.abs(n);
    const { error } = await supabase.from("mb_ajustes").insert({
      motoboy_id: motoboy,
      data: dataDoForm(fd),
      valor,
      motivo: exigir(texto(fd, "motivo"), "Motivo"),
      criado_por: user.id,
    });
    falhou(error);
  }, "Ajuste lançado.");
}

export async function removerAjuste(fd: FormData) {
  await executar(volta(fd, "/admin/pagamentos"), async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    if (!id) throw new Error("Ajuste inválido.");
    const { data, error } = await supabase.from("mb_ajustes").delete().eq("id", id).is("pagamento_id", null).select("id");
    falhou(error);
    if (!data?.length) throw new Error("Esse ajuste já foi pago.");
  }, "Ajuste removido.");
}

// ===================== TROCAS =====================

export async function decidirTroca(fd: FormData) {
  await executar("/admin/trocas", async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "troca_id");
    if (!id) throw new Error("Troca inválida.");
    const aprovar = texto(fd, "decisao") === "aprovar";
    const { error } = await supabase.rpc("mb_decidir_troca", { p_troca: id, p_aprovar: aprovar });
    falhou(error);
    return aprovar ? "Troca aprovada: a escala foi atualizada." : "Troca recusada.";
  });
}

// ===================== CONFIGURAÇÕES =====================

export async function salvarValores(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    const linhas = [];
    for (const tipo of ["semana", "domingo"]) {
      for (const faixa of [1, 2, 3]) {
        const v = numeroOuNulo(fd, `${tipo}_${faixa}`, "Valor");
        if (v === null) throw new Error("Preencha todos os valores.");
        linhas.push({ tipo_dia: tipo, faixa, valor: v });
      }
    }
    const { error } = await supabase.from("mb_valores").upsert(linhas);
    falhou(error);
  }, "Valores salvos. Valem para as próximas chegadas (as já registradas não mudam).");
}

export async function salvarTurno(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    const codigo = exigir(texto(fd, "codigo"), "Turno");
    const { error } = await supabase
      .from("mb_turnos")
      .update({
        nome: exigir(texto(fd, "nome"), "Nome"),
        setor: exigir(texto(fd, "setor"), "Setor"),
        inicio: exigir(texto(fd, "inicio"), "Início"),
        fim: exigir(texto(fd, "fim"), "Fim"),
        limite_cheia: exigir(texto(fd, "limite_cheia"), "Limite da diária cheia"),
        limite_meio: exigir(texto(fd, "limite_meio"), "Limite de 2/3"),
      })
      .eq("codigo", codigo);
    falhou(error);
  }, "Turno salvo.");
}

async function ajustarDiaFeriado(supabase: Awaited<ReturnType<typeof exigirGestor>>["supabase"], data: string, refazer: boolean) {
  if (refazer) falhou((await supabase.rpc("mb_refazer_dia", { p_data: data })).error);
  falhou((await supabase.rpc("mb_a_recalcular_dia", { p_data: data })).error);
}

export async function addFeriado(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    const data = dataDoForm(fd);
    const { error } = await supabase.from("mb_feriados").upsert({ data, nome: exigir(texto(fd, "nome"), "Nome do feriado") });
    falhou(error);
    await ajustarDiaFeriado(supabase, data, marcado(fd, "refazer"));
  }, "Feriado salvo. Diárias do dia em valor de domingo.");
}

export async function removerFeriado(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    const data = dataDoForm(fd);
    const { error } = await supabase.from("mb_feriados").delete().eq("data", data);
    falhou(error);
    await ajustarDiaFeriado(supabase, data, false);
  }, "Feriado removido.");
}

export async function salvarGestorRota(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    let id = uuidOuNulo(fd, "id");
    const nome = exigir(texto(fd, "nome"), "Nome");
    const pin = texto(fd, "pin").replace(/\D/g, "");
    if (!id && pin.length < 4) throw new Error("Defina um PIN de 4 a 8 números.");
    if (id) {
      const { error } = await supabase.from("mb_gestores_rota").update({ nome, ativo: marcado(fd, "ativo") }).eq("id", id);
      falhou(error);
    } else {
      const { data, error } = await supabase.from("mb_gestores_rota").insert({ nome }).select("id").single();
      falhou(error);
      id = String(data?.id);
    }
    if (pin) falhou((await supabase.rpc("mb_definir_pin_rota", { p_id: id, p_pin: pin })).error);
  }, "Gestor de rota salvo.");
}

export async function salvarConfig(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    const ant = inteiroOuNulo(fd, "checkin_antecedencia_min", "Antecedência") ?? 120;
    const { error } = await supabase
      .from("mb_config")
      .update({ troca_automatica: marcado(fd, "troca_automatica"), checkin_antecedencia_min: ant, updated_at: new Date().toISOString() })
      .eq("id", "padrao");
    falhou(error);
  }, "Configuração salva.");
}

export async function novaVersaoDocumento(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    const tipo = texto(fd, "tipo") === "termo_diario" ? "termo_diario" : "contrato";
    const titulo = exigir(texto(fd, "titulo"), "Título");
    const textoDoc = exigir(texto(fd, "texto"), "Texto");
    const { data: atual } = await supabase
      .from("mb_documentos")
      .select("versao, texto, titulo")
      .eq("tipo", tipo)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (atual && atual.texto.trim() === textoDoc.trim() && atual.titulo === titulo) throw new Error("O texto não mudou.");
    falhou((await supabase.from("mb_documentos").update({ ativo: false }).eq("tipo", tipo).eq("ativo", true)).error);
    const { error } = await supabase
      .from("mb_documentos")
      .insert({ tipo, versao: (atual?.versao ?? 0) + 1, titulo, texto: textoDoc, ativo: true });
    falhou(error);
    return tipo === "contrato"
      ? "Nova versão do contrato publicada. Cada motoboy vai precisar assinar de novo no app."
      : "Nova versão do termo do dia publicada.";
  });
}
