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
    historico: { data: string; total: number; diarias: number; entregas: number; ajustes: number; forma?: string }[];
  };
}

export interface RegistroDia {
  id: string;
  chegada_em: string;
  faixa: number;
  valor_diaria: number;
  valor_entregas: number;
  qtd_entregas: number;
  pago_dinheiro?: boolean;
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
    pessoas: { motoboy_id: string; nome: string; foto_url: string | null; escalado: boolean; registro: RegistroDia | null }[];
    ocorrencias: {
      id: string;
      tipo: string;
      tipo_nome: string;
      pontos: number;
      status: StatusOcorrencia;
      descricao: string | null;
      ciente_em: string | null;
      contestacao: string | null;
      motoboy: string | null;
      por: string;
      em: string;
    }[];
  }[];
  motoboys: { id: string; nome: string }[];
  tipos_ocorrencia: TipoOcorrencia[];
}

export type StatusOcorrencia = "valida" | "contestada" | "anulada";

export interface TipoOcorrencia {
  codigo: string;
  nome: string;
  pontos: number;
  grupo: "negativa" | "positiva" | "registro";
}

export interface ItemRanking {
  pos: number;
  motoboy_id: string;
  nome: string;
  foto_url: string | null;
  entregas: number;
  pontos: number;
  turnos?: number;
  pontos_ocorrencias?: number;
}

export interface DadosRanking {
  periodo: "mes" | "ano" | "mes_anterior" | "ano_anterior";
  inicio: string;
  fim: string;
  ranking: ItemRanking[];
  campeao_anterior: ItemRanking | null;
  inicio_anterior: string;
  fim_anterior: string;
  eu?: string;
  participa?: boolean;
}

export interface ExtraMotoboy {
  foto_url: string | null;
  participa: boolean;
  prazo_contestacao_dias: number;
  qr_obrigatorio?: boolean;
  regulamento: { id: string; versao: number; titulo: string; texto: string; aceito_em: string | null } | null;
  mes: { pos?: number; pontos?: number; entregas?: number; turnos?: number; pontos_ocorrencias?: number };
  ocorrencias: {
    id: string;
    data: string;
    turno: Turno;
    tipo: string;
    tipo_nome: string;
    pontos: number;
    descricao: string | null;
    status: StatusOcorrencia;
    ciente_em: string | null;
    contestacao: string | null;
    decisao: string | null;
    criado_em: string;
    pode_contestar: boolean;
  }[];
  incentivos: { id: string; nome: string; descricao: string | null; tipo: TipoIncentivo; valor: number; atual: number | null; meta: number | null; texto: string }[];
  ganhos: { descricao: string; valor: number; criado_em: string; cancelado: boolean }[];
}

export type TipoIncentivo = "a_cada_entregas" | "meta_entregas_mes" | "mes_sem_negativas" | "top_mes" | "top_ano";

export const ROTULO_TIPO_INCENTIVO: Record<TipoIncentivo, string> = {
  a_cada_entregas: "A cada X entregas",
  meta_entregas_mes: "Meta de entregas no mês",
  mes_sem_negativas: "Mês sem intercorrência negativa",
  top_mes: "Posição no ranking do mês",
  top_ano: "Posição no ranking do ano",
};

export const ROTULO_STATUS_OCORRENCIA: Record<StatusOcorrencia, string> = {
  valida: "Válida",
  contestada: "Contestada (em análise)",
  anulada: "Anulada",
};

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
  foto_url: string | null;
}

export const ROTULO_TURNO: Record<Turno, string> = { manha: "Manhã · Marmitaria", noite: "Noite · Hamburgueria" };
export const ROTULO_FORMA: Record<FormaPagamento, string> = { semanal: "Semanal (quarta)", quinzenal: "Quinzenal (dias 1 e 16)" };
export const ROTULO_TIPO_OCORRENCIA: Record<string, string> = { falta: "Falta", atraso: "Atraso", problema: "Problema", outro: "Outro" };
