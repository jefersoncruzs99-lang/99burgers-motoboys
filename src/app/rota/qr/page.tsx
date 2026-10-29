import Link from "next/link";
import { redirect } from "next/navigation";
import { TelaQr } from "@/components/TelaQr";
import { COOKIE_ROTA, lerAcesso } from "@/lib/acesso";
import { obterQrRota } from "../actions";

export const dynamic = "force-dynamic";

export default async function QrRota() {
  if (!(await lerAcesso(COOKIE_ROTA))) redirect("/rota");
  return (
    <main className="container pilha" style={{ maxWidth: 560 }}>
      <Link href="/rota" className="botao" style={{ alignSelf: "flex-start" }}>
        ← Escala do dia
      </Link>
      <TelaQr obter={obterQrRota} titulo="QR de chegada" />
    </main>
  );
}
