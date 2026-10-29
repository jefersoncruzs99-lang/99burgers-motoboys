import { TelaQr } from "@/components/TelaQr";
import { exigirGestor } from "@/lib/auth";
import { obterQrAdmin } from "../actions";

export default async function QrAdmin() {
  await exigirGestor();
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
      <TelaQr obter={obterQrAdmin} titulo="QR de chegada · 99 Burgers" />
      <p className="muted pequeno" style={{ textAlign: "center" }}>
        Dica: deixe esta tela aberta num tablet na entrada da loja. O código muda sozinho.
      </p>
    </div>
  );
}
