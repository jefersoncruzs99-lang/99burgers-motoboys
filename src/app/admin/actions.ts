"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { exigirGestor } from "@/lib/auth";
import { exigir, inteiroOuNulo, marcado, numeroOuNulo, texto, textoOuNulo, uuidOuNulo } from "@/lib/form";
import { executar } from "@/lib/navegar";
import { desenharQr, type QrAtual } from "@/lib/qr";
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
    const qtd = inteiroOuNulo(fd, "qtd", "Quantidade de entregas") ?? 0;
    const { error } = await supabase.rpc("mb_a_lancar_entregas", { p_registro: registro, p_valor: valor, p_qtd: qtd });
    falhou(error);
  }, "Entregas lançadas. Os pontos do ranking já foram atualizados.");
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

export async function admDinheiro(fd: FormData) {
  await executar(voltaDia(fd), async () => {
    const { supabase } = await exigirGestor();
    const registro = uuidOuNulo(fd, "registro_id");
    if (!registro) throw new Error("Turno inválido.");
    falhou((await supabase.rpc("mb_a_pagar_dinheiro", { p_registro: registro })).error);
  }, "Pago em dinheiro registrado. Esse turno saiu do saldo da quarta/quinzena.");
}

export async function obterQrAdmin(): Promise<QrAtual | { erro: string }> {
  try {
    const { supabase } = await exigirGestor();
    const { data, error } = await supabase.rpc("mb_a_qr");
    if (error) return { erro: error.message };
    return await desenharQr(data as { codigo: string; restante: number; janela: number });
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Erro." };
  }
}

export async function novoSegredoQr() {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    falhou((await supabase.rpc("mb_a_novo_segredo_qr")).error);
  }, "Novo segredo gerado: qualquer QR antigo parou de funcionar.");
}

export async function admOcorrencia(fd: FormData) {
  await executar(voltaDia(fd), async () => {
    const { supabase, nome } = await exigirGestor();
    const { error } = await supabase.from("mb_ocorrencias").insert({
      data: dataDoForm(fd),
      turno: exigir(texto(fd, "turno"), "Turno"),
      motoboy_id: uuidOuNulo(fd, "motoboy_id"),
      tipo: exigir(texto(fd, "tipo"), "Tipo"),
      descricao: textoOuNulo(fd, "descricao"),
      registrado_por: `Adm: ${nome}`,
    });
    falhou(error);
  }, "Intercorrência registrada.");
}

// ===================== ESCALA =====================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Todos os motoboys marcados no formulário (caixinhas com name="motoboy_id"). */
function motoboysMarcados(fd: FormData): string[] {
  const ids = fd.getAll("motoboy_id").filter((v): v is string => typeof v === "string" && UUID.test(v));
  if (!ids.length) throw new Error("Marque pelo menos um motoboy.");
  return [...new Set(ids)];
}

export async function addEscala(fd: FormData) {
  await executar(volta(fd, "/admin/escala"), async () => {
    const { supabase } = await exigirGestor();
    const ids = motoboysMarcados(fd);
    const turno = exigir(texto(fd, "turno"), "Turno");
    const marcadas = fd.getAll("datas").filter((v): v is string => typeof v === "string" && DATA.test(v));
    const datas = marcadas.length ? [...new Set(marcadas)] : [dataDoForm(fd)];
    const linhas = datas.flatMap((data) => ids.map((motoboy_id) => ({ data, turno, motoboy_id, origem: "manual" })));
    const { data, error } = await supabase
      .from("mb_escala")
      .upsert(linhas, { onConflict: "data,turno,motoboy_id", ignoreDuplicates: true })
      .select("id");
    falhou(error);
    const n = data?.length ?? 0;
    const repetidos = linhas.length - n;
    return `${n} lugar(es) adicionado(s) na escala.${repetidos > 0 ? ` ${repetidos} já estava(m) lá e foi(ram) ignorado(s).` : ""}`;
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
    const ids = motoboysMarcados(fd);
    const turno = exigir(texto(fd, "turno"), "Turno");
    const marcados = fd
      .getAll("dias")
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    const dow = inteiroOuNulo(fd, "dia_semana");
    const dias = marcados.length ? [...new Set(marcados)] : dow !== null && dow <= 6 ? [dow] : [];
    if (!dias.length) throw new Error("Escolha o dia.");
    const linhas = dias.flatMap((dia_semana) => ids.map((motoboy_id) => ({ dia_semana, turno, motoboy_id })));
    const { data, error } = await supabase
      .from("mb_escala_padrao")
      .upsert(linhas, { onConflict: "dia_semana,turno,motoboy_id", ignoreDuplicates: true })
      .select("id");
    falhou(error);
    return `${data?.length ?? 0} lugar(es) adicionado(s) na semana padrão.`;
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
    const forma = texto(fd, "forma") === "dinheiro" ? "dinheiro" : "pix";
    const { data: id, error } = await supabase.rpc("mb_registrar_pagamento", {
      p_motoboy: motoboy,
      p_data: dataDoForm(fd),
      p_observacao: textoOuNulo(fd, "observacao"),
    });
    falhou(error);
    if (forma !== "pix") falhou((await supabase.from("mb_pagamentos").update({ forma }).eq("id", String(id))).error);
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
      .update({
        troca_automatica: marcado(fd, "troca_automatica"),
        qr_obrigatorio: marcado(fd, "qr_obrigatorio"),
        checkin_antecedencia_min: ant,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "padrao");
    falhou(error);
  }, "Configuração salva.");
}

export async function novaVersaoDocumento(fd: FormData) {
  await executar("/admin/config", async () => {
    const { supabase } = await exigirGestor();
    const bruto = texto(fd, "tipo");
    const tipo = bruto === "termo_diario" || bruto === "regulamento" ? bruto : "contrato";
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
      : tipo === "regulamento"
        ? "Nova versão do regulamento publicada. Cada motoboy vai ver o aviso para aceitar de novo."
        : "Nova versão do termo do dia publicada.";
  });
}

// ===================== FOTO =====================

export async function salvarFoto(fd: FormData): Promise<{ ok?: boolean; erro?: string }> {
  try {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    const arquivo = fd.get("foto");
    if (!id) return { erro: "Motoboy inválido." };
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha uma foto." };
    if (arquivo.size > 2 * 1024 * 1024) return { erro: "Foto muito grande (máx. 2 MB)." };
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) return { erro: "Use uma foto JPG, PNG ou WEBP." };
    const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
    const caminho = `${id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("mb-fotos").upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    if (error) return { erro: error.message };
    const url = supabase.storage.from("mb-fotos").getPublicUrl(caminho).data.publicUrl;
    const { error: e2 } = await supabase.from("mb_motoboys").update({ foto_url: url }).eq("id", id);
    if (e2) return { erro: e2.message };
    const { data: antigas } = await supabase.storage.from("mb-fotos").list(id);
    const apagar = (antigas ?? []).map((o) => `${id}/${o.name}`).filter((c) => c !== caminho);
    if (apagar.length) await supabase.storage.from("mb-fotos").remove(apagar);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { erro: e instanceof Error ? e.message : "Erro inesperado." };
  }
}

export async function removerFoto(fd: FormData) {
  await executar("/admin/motoboys", async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    if (!id) throw new Error("Motoboy inválido.");
    const { data: antigas } = await supabase.storage.from("mb-fotos").list(id);
    if (antigas?.length) await supabase.storage.from("mb-fotos").remove(antigas.map((o) => `${id}/${o.name}`));
    falhou((await supabase.from("mb_motoboys").update({ foto_url: null }).eq("id", id)).error);
  }, "Foto removida.");
}

// ===================== INTERCORRÊNCIAS / INCENTIVOS =====================

export async function salvarTipoOcorrencia(fd: FormData) {
  await executar("/admin/incentivos", async () => {
    const { supabase } = await exigirGestor();
    const novo = texto(fd, "novo") === "1";
    const nome = exigir(texto(fd, "nome"), "Nome");
    const bruto = texto(fd, "pontos").replace(",", ".");
    const pontos = Math.round(Number(bruto || "0"));
    if (!Number.isFinite(pontos) || pontos < -100 || pontos > 100) throw new Error("Pontos entre -100 e 100.");
    const grupo = pontos < 0 ? "negativa" : pontos > 0 ? "positiva" : "registro";
    if (novo) {
      const codigo =
        nome
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 36) || "tipo";
      const { error } = await supabase
        .from("mb_tipos_ocorrencia")
        .insert({ codigo: `${codigo}_${Date.now().toString(36).slice(-3)}`, nome, pontos, grupo, ordem: grupo === "negativa" ? 150 : grupo === "positiva" ? 250 : 340 });
      falhou(error);
    } else {
      const codigo = exigir(texto(fd, "codigo"), "Código");
      const { error } = await supabase.from("mb_tipos_ocorrencia").update({ nome, pontos, grupo, ativo: marcado(fd, "ativo") }).eq("codigo", codigo);
      falhou(error);
    }
  }, "Intercorrência salva. Os novos pontos valem para os próximos registros.");
}

export async function salvarIncentivo(fd: FormData) {
  await executar("/admin/incentivos", async () => {
    const { supabase } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    const tipo = texto(fd, "tipo");
    const tipos = ["a_cada_entregas", "meta_entregas_mes", "mes_sem_negativas", "top_mes", "top_ano"];
    if (!tipos.includes(tipo)) throw new Error("Tipo de incentivo inválido.");
    const porPosicao = tipo === "top_mes" || tipo === "top_ano";
    const valor = numeroOuNulo(fd, "valor", "Valor");
    if (!valor) throw new Error("Informe o valor do prêmio.");
    const quantidade = porPosicao ? null : inteiroOuNulo(fd, "quantidade", "Quantidade");
    const posicao = porPosicao ? inteiroOuNulo(fd, "posicao", "Posição") : null;
    if (!porPosicao && !quantidade) throw new Error("Informe a quantidade.");
    if (porPosicao && !posicao) throw new Error("Informe a posição.");
    const dados = {
      nome: exigir(texto(fd, "nome"), "Nome"),
      descricao: textoOuNulo(fd, "descricao"),
      tipo,
      quantidade,
      posicao,
      valor,
      ativo: marcado(fd, "ativo"),
      ...(texto(fd, "inicio") ? { inicio: dataDoForm(fd, "inicio") } : {}),
    };
    const { error } = id ? await supabase.from("mb_incentivos").update(dados).eq("id", id) : await supabase.from("mb_incentivos").insert(dados);
    falhou(error);
  }, "Incentivo salvo.");
}

export async function apurarIncentivos() {
  await executar("/admin/incentivos", async () => {
    const { supabase } = await exigirGestor();
    const { data, error } = await supabase.rpc("mb_a_apurar_incentivos");
    falhou(error);
    return Number(data) > 0 ? `${data} prêmio(s) novo(s) lançado(s) como bônus.` : "Nenhum prêmio novo para lançar agora.";
  });
}

export async function decidirOcorrencia(fd: FormData) {
  await executar(volta(fd, "/admin/incentivos"), async () => {
    const { supabase, user } = await exigirGestor();
    const id = uuidOuNulo(fd, "id");
    if (!id) throw new Error("Intercorrência inválida.");
    const anular = texto(fd, "decisao") === "anular";
    const { error } = await supabase
      .from("mb_ocorrencias")
      .update({
        status: anular ? "anulada" : "valida",
        decisao: exigir(texto(fd, "justificativa"), "Justificativa da decisão"),
        decidida_em: new Date().toISOString(),
        decidida_por: user.id,
      })
      .eq("id", id);
    falhou(error);
    return anular ? "Intercorrência anulada: os pontos voltaram." : "Intercorrência mantida.";
  });
}

export async function salvarPontuacao(fd: FormData) {
  await executar("/admin/incentivos", async () => {
    const { supabase } = await exigirGestor();
    const pts = inteiroOuNulo(fd, "pontos_por_entrega", "Pontos por entrega") ?? 1;
    const prazo = inteiroOuNulo(fd, "prazo_contestacao_dias", "Prazo") ?? 7;
    const { error } = await supabase.from("mb_config").update({ pontos_por_entrega: pts, prazo_contestacao_dias: prazo }).eq("id", "padrao");
    falhou(error);
  }, "Regras de pontuação salvas.");
}
