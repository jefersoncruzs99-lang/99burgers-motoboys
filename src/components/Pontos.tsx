export function Pontos({ valor }: { valor: number }) {
  const v = Number(valor);
  return <span className={`pts ${v < 0 ? "neg" : v > 0 ? "pos" : "zero"}`}>{v > 0 ? `+${v}` : v === 0 ? "0" : v} pts</span>;
}
