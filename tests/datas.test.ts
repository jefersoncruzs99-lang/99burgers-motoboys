import { describe, expect, it } from "vitest";
import { dataComDia, proximaDataPagamento, segundaDaSemana, somarDias } from "@/lib/datas";

describe("proximaDataPagamento", () => {
  it("semanal cai na quarta (inclusive)", () => {
    expect(proximaDataPagamento("semanal", "2026-10-28")).toBe("2026-10-28"); // quarta
    expect(proximaDataPagamento("semanal", "2026-10-29")).toBe("2026-11-04");
    expect(proximaDataPagamento("semanal", "2026-10-26")).toBe("2026-10-28");
  });
  it("quinzenal cai nos dias 1 e 16", () => {
    expect(proximaDataPagamento("quinzenal", "2026-10-28")).toBe("2026-11-01");
    expect(proximaDataPagamento("quinzenal", "2026-10-02")).toBe("2026-10-16");
    expect(proximaDataPagamento("quinzenal", "2026-10-16")).toBe("2026-10-16");
    expect(proximaDataPagamento("quinzenal", "2026-12-20")).toBe("2027-01-01");
  });
});

describe("datas", () => {
  it("segunda da semana", () => {
    expect(segundaDaSemana("2026-11-01")).toBe("2026-10-26"); // domingo
    expect(segundaDaSemana("2026-10-26")).toBe("2026-10-26");
  });
  it("somar e formatar", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(dataComDia("2026-10-28")).toBe("Qua 28/10");
  });
});
