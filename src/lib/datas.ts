export const FUSO = "America/Bahia";

/** Data de hoje (AAAA-MM-DD) no fuso da operação. */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

function parse(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function somarDias(iso: string, dias: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return fmt(d);
}

/** 0 = domingo */
export function diaDaSemana(iso: string): number {
  return parse(iso).getUTCDay();
}

/** Segunda-feira da semana da data. */
export function segundaDaSemana(iso: string): string {
  const dow = diaDaSemana(iso);
  return somarDias(iso, dow === 0 ? -6 : 1 - dow);
}

export const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const NOMES_DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** 28/10 */
export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Qua 28/10 */
export function dataComDia(iso: string): string {
  return `${NOMES_DIA_CURTO[diaDaSemana(iso)]} ${dataCurta(iso)}`;
}

export function dataLonga(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long" }).format(parse(iso));
}

/** Hora (HH:MM) de um instante, no fuso da operação. */
export function hora(instante: string | null | undefined): string {
  if (!instante) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(instante),
  );
}

/** Próxima data de pagamento (inclusive): semanal = quarta-feira; quinzenal = dias 1 e 16. */
export function proximaDataPagamento(forma: "semanal" | "quinzenal", ref: string): string {
  if (forma === "semanal") {
    const dow = diaDaSemana(ref);
    return somarDias(ref, (3 - dow + 7) % 7);
  }
  const [a, m, d] = ref.split("-").map(Number);
  if (d === 1 || d === 16) return ref;
  if ((d ?? 1) < 16) return `${a}-${String(m).padStart(2, "0")}-16`;
  const prox = new Date(Date.UTC(a ?? 1970, m ?? 1, 1));
  return fmt(prox);
}

export function moeda(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const ROTULO_FAIXA: Record<number, string> = { 1: "Diária cheia", 2: "2/3 da diária", 3: "1/3 da diária" };
