import { NextResponse } from "next/server";
import { COOKIE_MOTOBOY, lerAcesso } from "@/lib/acesso";
import { criarSupabaseServidor } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Foto enviada pelo próprio motoboy (guardada no banco). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const acesso = await lerAcesso(COOKIE_MOTOBOY);
  const supabase = await criarSupabaseServidor();
  const { data } = await supabase.rpc("mb_foto", { p_motoboy: id, p_quem: acesso?.id ?? null, p_chave: acesso?.segredo ?? null });
  const foto = data as { base64: string; tipo: string } | null;
  if (!foto?.base64) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(foto.base64, "base64"), {
    headers: { "Content-Type": foto.tipo, "Cache-Control": "private, max-age=604800, immutable" },
  });
}
