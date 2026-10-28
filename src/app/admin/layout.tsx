import Link from "next/link";
import { exigirGestor } from "@/lib/auth";
import { sair } from "./actions";

export const dynamic = "force-dynamic";

const MENU = [
  ["/admin", "Dia"],
  ["/admin/escala", "Escala"],
  ["/admin/motoboys", "Motoboys"],
  ["/admin/pagamentos", "Pagamentos"],
  ["/admin/trocas", "Trocas"],
  ["/admin/config", "Configurações"],
] as const;

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const { nome } = await exigirGestor();
  return (
    <>
      <header className="topo">
        <div className="container linha entre" style={{ flexWrap: "wrap", gap: 10 }}>
          <Link href="/admin" className="marca">
            MOTOBOYS 99
          </Link>
          <nav>
            {MENU.map(([href, rotulo]) => (
              <Link key={href} href={href}>
                {rotulo}
              </Link>
            ))}
          </nav>
          <form action={sair} className="mini">
            <span className="muted pequeno">{nome}</span>
            <button className="botao">Sair</button>
          </form>
        </div>
      </header>
      <main className="container pilha" style={{ paddingTop: 20, paddingBottom: 60 }}>
        {children}
      </main>
    </>
  );
}
