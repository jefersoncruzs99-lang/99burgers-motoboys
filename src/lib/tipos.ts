export type Turno = "manha" | "noite";
export type FormaPagamento = "semanal" | "quinzenal";

export interface TurnoInfo {
  codigo: Turno;
  nome: string;
  setor: string;
  inicio: string;
  fim: string;
  limite_cheia?: string;
  limite_meio?: string;
}

export interface EmAberto {
  diarias: number;
  entregas: number;
  ajustes: number;
  dias: number;
}

export interface PainelMotoboy {
  motoboy: { id: string; nome: string; forma_pagamento: FormaPagamento };
  hoje: string;
  contrato: { id: string; titulo: string; versao: number; texto: string; assinado_em: string | null } | null;
  termo: { id: string; titulo: string; texto: string } | null;
  turnos: TurnoInfo[];
  valores_hoje: Record<string, number>;
  escala: {
    id: string;
    data: string;
    turno: Turno;
    feriado: string | null;
    registro: { chegada_em: string; faixa: number; valor_diaria: number; valor_entregas: number } | null;
    troca_aberta: boolean;
  }[];
  registros_hoje: { turno: Turno; chegada_em: string; faixa: number; valor_diaria: number; valor_entregas: number; fora_da_escala: boolean }[];
  trocas: {
    id: string;
    data: string;
    turno: Turno;
    status: "aberta" | "aceita" | "aprovada" | "recusada" | "cancelada";
    motivo: string | null;
    de_id: string;
    de_nome: string;
    para_id: string | null;
    para_nome: string | null;
    aceita_por_nome: string | null;
    minha: boolean;
    pode_aceitar: boolean;
  }[];
  colegas: { id: string; nome: string }[];
  pagamento: {
    proxima_data: string;
    seguinte_data: string;
    proximo: EmAberto;
    acumulando: { total: number; dias: number };
    dias: { data: string; turno: Turno; chegada_em: string; faixa: number; valor_diaria: number; valor_entregas: number }[];
    ajustes: { data: string; valor: number; motivo: string }[];
    historico: { data: string; total: number; diarias: number; entregas: number; ajustes: number }[];
  };
}

export interface RegistroDia {
  id: string;
  chegada_em: string;
  faixa: number;
  valor_diaria: number;
  valor_entregas: number;
  origem_chegada: "motoboy" | "gestor";
  fora_da_escala: boolean;
  entregas_lancadas_por: string | null;
  pago: boolean;
  observacao: string | null;
}

export interface Dia {
  data: string;
  tipo_dia: "semana" | "domingo";
  feriado: string | null;
  turnos: {
    codigo: Turno;
    nome: string;
    setor: string;
    inicio: string;
    fim: string;
    pessoas: { motoboy_id: string; nome: string; escalado: boolean; registro: RegistroDia | null }[];
    ocorrencias: { id: string; tipo: string; descricao: string | null; motoboy: string | null; por: string; em: string }[];
  }[];
  motoboys: { id: string; nome: string }[];
}

export interface Motoboy {
  id: string;
  nome: string;
  telefone: string;
  cpf: string | null;
  pix: string | null;
  forma_pagamento: FormaPagamento;
  chave_hash: string | null;
  observacao: string | null;
  ativo: boolean;
}

export const ROTULO_TURNO: Record<Turno, string> = { manha: "Manhã · Marmitaria", noite: "Noite · Hamburgueria" };
export const ROTULO_FORMA: Record<FormaPagamento, string> = { semanal: "Semanal (quarta)", quinzenal: "Quinzenal (dias 1 e 16)" };
export const ROTULO_TIPO_OCORRENCIA: Record<string, string> = { falta: "Falta", atraso: "Atraso", problema: "Problema", outro: "Outro" };
