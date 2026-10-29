-- JÁ APLICADA no Supabase em 2026-10-29.
-- Quem monta a escala: refazer um dia pela semana padrão e tirar alguém da escala / da semana padrão.

create or replace function public.mb_e_refazer_dia(p_id uuid, p_pin text, p_data date) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not public.mb_escalador_ok(p_id, p_pin) then raise exception 'PIN inválido'; end if;
  if p_data < public.mb_hoje() then raise exception 'Não dá para mexer em dias que já passaram'; end if;
  return public.mb_refazer_dia(p_data);
end $$;

create or replace function public.mb_e_remover(p_id uuid, p_pin text, p_escala uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.mb_escala;
begin
  if not public.mb_escalador_ok(p_id, p_pin) then raise exception 'PIN inválido'; end if;
  select * into v from public.mb_escala where id = p_escala;
  if v.id is null then raise exception 'Este lugar não está mais na escala'; end if;
  if v.data < public.mb_hoje() then raise exception 'Não dá para mexer em dias que já passaram'; end if;
  if exists (select 1 from public.mb_registros r where r.escala_id = v.id) then
    raise exception 'Esse motoboy já registrou chegada neste turno';
  end if;
  delete from public.mb_escala where id = v.id;
end $$;

create or replace function public.mb_e_padrao_remover(p_id uuid, p_pin text, p_padrao uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.mb_escalador_ok(p_id, p_pin) then raise exception 'PIN inválido'; end if;
  delete from public.mb_escala_padrao where id = p_padrao;
end $$;

grant execute on function public.mb_e_refazer_dia(uuid, text, date) to anon, authenticated;
grant execute on function public.mb_e_remover(uuid, text, uuid) to anon, authenticated;
grant execute on function public.mb_e_padrao_remover(uuid, text, uuid) to anon, authenticated;
