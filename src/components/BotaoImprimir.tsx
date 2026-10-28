"use client";

export function BotaoImprimir({ rotulo = "🖨 Imprimir / salvar PDF" }: { rotulo?: string }) {
  return (
    <button type="button" className="botao primario nao-imprime" onClick={() => window.print()}>
      {rotulo}
    </button>
  );
}
