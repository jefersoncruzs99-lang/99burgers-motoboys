/** "+ adicionar" com caixinhas: marca vários motoboys (e, se quiser, vários dias) de uma vez. */
export function AdicionarVarios({
  acao,
  livres,
  ocultos,
  dias,
}: {
  acao: (fd: FormData) => Promise<void>;
  livres: { id: string; nome: string }[];
  ocultos: Record<string, string>;
  /** dias para repetir: name do campo, opções e quais já vêm marcados */
  dias?: { campo: string; opcoes: { valor: string; rotulo: string; marcado: boolean }[] };
}) {
  if (livres.length === 0) return null;
  return (
    <details className="add-varios">
      <summary>+ adicionar</summary>
      <form action={acao} className="pilha" style={{ gap: 8 }}>
        {Object.entries(ocultos).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <div className="lista-check">
          {livres.map((m) => (
            <label key={m.id} className="check">
              <input type="checkbox" name="motoboy_id" value={m.id} /> {m.nome}
            </label>
          ))}
        </div>
        {dias && (
          <div>
            <div className="muted pequeno">Nos dias:</div>
            <div className="dias-check">
              {dias.opcoes.map((d) => (
                <label key={d.valor} className="check">
                  <input type="checkbox" name={dias.campo} value={d.valor} defaultChecked={d.marcado} /> {d.rotulo}
                </label>
              ))}
            </div>
          </div>
        )}
        <button className="botao primario">Adicionar marcados</button>
      </form>
    </details>
  );
}
