-- JÁ APLICADA no Supabase em 2026-10-29.
-- Acesso só para quem monta a escala: nome + PIN (mesmo cadastro do gestor de rota, com permissões separadas).

alter table public.mb_gestores_rota add column if not exists pode_rota boolean not null default true;
alter table public.mb_gestores_rota add column if not exists pode_escala boolean not null default false;

create or replace function public.mb_rota_ok(p_id uuid, p_pin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mb_gestores_rota g where g.id = p_id and g.ativo and g.pode_rota and g.pin_hash is not null
    and g.pin_hash = extensions.crypt(coalesce(p_pin,''), g.pin_hash)) $$;

create or replace function public.mb_rota_lista() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome) order by g.nome), '[]'::jsonb)
  from public.mb_gestores_rota g where g.ativo and g.pode_rota and g.pin_hash is not null $$;

create or replace function public.mb_escalador_ok(p_id uuid, p_pin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mb_gestores_rota g where g.id = p_id and g.ativo and g.pode_escala and g.pin_hash is not null
    and g.pin_hash = extensions.crypt(coalesce(p_pin,''), g.pin_hash)) $$;

create or replace function public.mb_escala_lista() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome) order by g.nome), '[]'::jsonb)
  from public.mb_gestores_rota g where g.ativo and g.pode_escala and g.pin_hash is not null $$;

create or replace function public.mb_escala_entrar(p_id uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if public.mb_bloqueado('e:' || p_id::text) then raise exception 'Muitas tentativas. Espere 15 minutos.'; end if;
  if not public.mb_escalador_ok(p_id, p_pin) then
    insert into public.mb_tentativas (chave) values ('e:' || p_id::text);
    raise exception 'PIN incorreto.';
  end if;
  return true;
end $$;

-- Dados da semana (mesmo formato para a administração e para quem monta a escala)
create or replace function public.mb_semana_json(p_inicio date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'inicio', p_inicio, 'fim', p_inicio + 6, 'hoje', public.mb_hoje(),
    'turnos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nome', t.nome) order by t.ordem) from public.mb_turnos t),
    'escala', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'data', e.data, 'turno', e.turno, 'origem', e.origem,
        'motoboy_id', e.motoboy_id, 'nome', m.nome,
        'chegou', exists (select 1 from public.mb_registros r where r.data = e.data and r.turno = e.turno and r.motoboy_id = e.motoboy_id))
        order by m.nome)
      from public.mb_escala e join public.mb_motoboys m on m.id = e.motoboy_id where e.data between p_inicio and p_inicio + 6), '[]'::jsonb),
    'motoboys', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome) order by m.nome)
      from public.mb_motoboys m where m.ativo), '[]'::jsonb),
    'feriados', coalesce((select jsonb_object_agg(f.data::text, f.nome) from public.mb_feriados f where f.data between p_inicio and p_inicio + 6), '{}'::jsonb)
  ) $$;

create or replace function public.mb_padrao_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'turnos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nome', t.nome) order by t.ordem) from public.mb_turnos t),
    'padrao', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'dia_semana', p.dia_semana, 'turno', p.turno,
        'motoboy_id', p.motoboy_id, 'nome', m.nome, 'ativo', m.ativo) order by m.nome)
      from public.mb_escala_padrao p join public.mb_motoboys m on m.id = p.motoboy_id), '[]'::jsonb),
    'motoboys', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome) order by m.nome)
      from public.mb_motoboys m where m.ativo), '[]'::jsonb)
  ) $$;

create or replace function public.mb_e_semana(p_id uuid, p_pin text, p_inicio date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.mb_escalador_ok(p_id, p_pin) then raise exception 'PIN inválido'; end if;
  return public.mb_semana_json(p_inicio);
end $$;

create or replace function public.mb_e_padrao(p_id uuid, p_pin text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.mb_escalador_ok(p_id, p_pin) then raise exception 'PIN inválido'; end if;
  return public.mb_padrao_json();
end $$;

create or replace function public.mb_e_adicionar(p_id uuid, p_pin text, p_datas date[], p_turno text, p_motoboys uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.mb_escalador_ok(p_id, p_pin) then raise exception 'PIN inválido'; end if;
  if exists (select 1 from unnest(p_datas) d where d < public.mb_hoje()) then raise exception 'Não dá para mexer em dias que já passaram'; end if;
  insert into public.mb_escala (data, turno, motoboy_id, origem)
  select d, p_turno, m, 'manual' from unnest(p_datas) d cross join unnest(p_motoboys) m
  join public.mb_motoboys mm on mm.id = m and mm.ativo
  on conflict (data, turno, motoboy_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.mb_e_gerar(p_id uuid, p_pin text, p_inicio date) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not public.mb_escalador_ok(p_id, p_pin) then raise exception 'PIN inválido'; end if;
  return public.mb_gerar_escala(greatest(p_inicio, public.mb_hoje()), p_inicio + 6);
end $$;

create or replace function public.mb_e_padrao_adicionar(p_id uuid, p_pin text, p_dias integer[], p_turno text, p_motoboys uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.mb_escalador_ok(p_id, p_pin) then raise exception 'PIN inválido'; end if;
  insert into public.mb_escala_padrao (dia_semana, turno, motoboy_id)
  select d::smallint, p_turno, m from unnest(p_dias) d cross join unnest(p_motoboys) m
  join public.mb_motoboys mm on mm.id = m and mm.ativo
  where d between 0 and 6
  on conflict (dia_semana, turno, motoboy_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.mb_escalador_ok(uuid, text) from public, anon, authenticated;
revoke all on function public.mb_semana_json(date) from public, anon;
revoke all on function public.mb_padrao_json() from public, anon;
grant execute on function public.mb_semana_json(date) to authenticated;
grant execute on function public.mb_padrao_json() to authenticated;
grant execute on function public.mb_escala_lista() to anon, authenticated;
grant execute on function public.mb_escala_entrar(uuid, text) to anon, authenticated;
grant execute on function public.mb_e_semana(uuid, text, date) to anon, authenticated;
grant execute on function public.mb_e_padrao(uuid, text) to anon, authenticated;
grant execute on function public.mb_e_adicionar(uuid, text, date[], text, uuid[]) to anon, authenticated;
grant execute on function public.mb_e_gerar(uuid, text, date) to anon, authenticated;
grant execute on function public.mb_e_padrao_adicionar(uuid, text, integer[], text, uuid[]) to anon, authenticated;
