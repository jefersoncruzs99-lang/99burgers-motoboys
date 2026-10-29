import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

export interface QrAtual {
  svg: string;
  restante: number;
  janela: number;
  url: string;
}

/** Monta o link /m/cheguei?c=CODIGO com o endereço do próprio app e desenha o QR em SVG. */
export async function desenharQr(dados: { codigo: string; restante: number; janela: number }): Promise<QrAtual> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/m/cheguei?c=${encodeURIComponent(dados.codigo)}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return { svg, restante: Math.max(1, dados.restante), janela: dados.janela, url };
}
