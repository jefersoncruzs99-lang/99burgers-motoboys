-- JÁ APLICADA no Supabase em 2026-10-29.
-- O próprio motoboy troca a foto pelo app (confere a chave). A imagem fica no banco e é servida em /foto/<id>.

create table if not exists public.mb_fotos (
  motoboy_id uuid primary key references public.mb_motoboys(id),
  imagem bytea not null,
  tipo text not null default 'image/jpeg' check (tipo in ('image/jpeg','image/png','image/webp')),
  atualizado_em timestamptz not null default now()
);
alter table public.mb_fotos enable row level security; -- sem políticas: só as funções acessam

create or replace function public.mb_m_salvar_foto(p_id uuid, p_chave text, p_base64 text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_img bytea; v_url text;
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  begin
    v_img := decode(p_base64, 'base64');
  exception when others then raise exception 'Imagem inválida';
  end;
  if length(v_img) < 1000 then raise exception 'Imagem inválida'; end if;
  if length(v_img) > 600000 then raise exception 'Foto muito grande'; end if;
  if substring(v_img from 1 for 3) <> '\xffd8ff'::bytea then raise exception 'Envie a foto em JPG'; end if;
  insert into public.mb_fotos (motoboy_id, imagem, tipo, atualizado_em) values (p_id, v_img, 'image/jpeg', now())
  on conflict (motoboy_id) do update set imagem = excluded.imagem, tipo = excluded.tipo, atualizado_em = now();
  v_url := '/foto/' || p_id::text || '?v=' || floor(extract(epoch from now()))::bigint::text;
  update public.mb_motoboys set foto_url = v_url where id = p_id;
  return v_url;
end $$;

create or replace function public.mb_m_remover_foto(p_id uuid, p_chave text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  update public.mb_fotos set imagem = ''::bytea, atualizado_em = now() where motoboy_id = p_id; -- limpa a imagem
  update public.mb_motoboys set foto_url = null where id = p_id;
end $$;

-- Lê a foto: liberada para quem aceitou o regulamento (autorização de imagem), para a administração
-- e para o próprio motoboy (cookie com a chave dele)
create or replace function public.mb_foto(p_motoboy uuid, p_quem uuid default null, p_chave text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('base64', encode(f.imagem, 'base64'), 'tipo', f.tipo, 'atualizado_em', f.atualizado_em)
  from public.mb_fotos f join public.mb_motoboys m on m.id = f.motoboy_id
  where f.motoboy_id = p_motoboy and m.foto_url like '/foto/%'
    and (public.mb_participa(p_motoboy) or auth.uid() is not null
         or (p_quem = p_motoboy and public.mb_motoboy_ok(p_quem, p_chave))) $$;

grant execute on function public.mb_m_salvar_foto(uuid, text, text) to anon, authenticated;
grant execute on function public.mb_m_remover_foto(uuid, text) to anon, authenticated;
grant execute on function public.mb_foto(uuid, uuid, text) to anon, authenticated;
