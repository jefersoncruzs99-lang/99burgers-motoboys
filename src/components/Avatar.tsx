/** Foto redonda do motoboy (ou iniciais quando não tem foto). */
export function Avatar({ nome, foto, tamanho = 40, anel }: { nome: string; foto?: string | null; tamanho?: number; anel?: "ouro" | "prata" | "bronze" | "eu" }) {
  const iniciais = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("")
    .toUpperCase();
  const tom = [...nome].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className={`avatar ${anel ? `anel-${anel}` : ""}`}
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38, ["--tom" as string]: String(tom) }}
      aria-hidden="true"
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" width={tamanho} height={tamanho} loading="lazy" />
      ) : (
        iniciais || "?"
      )}
    </span>
  );
}
