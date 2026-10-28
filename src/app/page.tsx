import Link from "next/link";

export default function Inicio() {
  return (
    <main className="container pilha" style={{ maxWidth: 760, paddingTop: 40 }}>
      <div>
        <span className="marca">NOVE NOVE BURGERS</span>
        <h1 style={{ fontSize: "2rem" }}>Motoboys</h1>
        <p className="muted">Escolha como você vai entrar.</p>
      </div>
      <nav className="inicio" aria-label="Acessos">
        <Link href="/m">
          <b>🏍 Sou motoboy</b>
          <span className="muted">Confirmar chegada, ver minha escala, trocar turno e ver quanto tenho a receber.</span>
        </Link>
        <Link href="/rota">
          <b>📋 Gestor de rota</b>
          <span className="muted">Ver quem chegou e lançar o valor das entregas do dia.</span>
        </Link>
        <Link href="/admin">
          <b>⚙ Administração</b>
          <span className="muted">Escala, motoboys, pagamentos e contratos. Login do painel 99 Burgers.</span>
        </Link>
      </nav>
    </main>
  );
}
