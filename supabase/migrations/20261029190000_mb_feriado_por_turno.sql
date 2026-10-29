-- JÁ APLICADA no Supabase em 2026-10-29.
-- Feriado por turno: a noite segue a escala de domingo; a manhã segue a escala do próprio dia da semana.
-- (Os valores da diária no feriado continuam os de domingo.)
-- Também inclui a foto do motoboy nos dados da escala.

alter table public.mb_turnos add column if not exists feriado_como_domingo boolean not null default true;
update public.mb_turnos set feriado_como_domingo = false where codigo = 'manha';

create or replace function public.mb_gerar_escala(p_inicio date, p_fim date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer := 0; v_k integer; d date; v_dow smallint; v_feriado boolean;
begin
  if p_fim < p_inicio or p_fim - p_inicio > 62 then raise exception 'Período inválido (máximo 2 meses)'; end if;
  d := p_inicio;
  while d <= p_fim loop
    v_dow := extract(dow from d)::smallint;
    v_feriado := exists (select 1 from public.mb_feriados f where f.data = d);
    insert into public.mb_escala (data, turno, motoboy_id, origem)
    select d, p.turno, p.motoboy_id, 'padrao'
    from public.mb_escala_padrao p
    join public.mb_turnos t on t.codigo = p.turno
    join public.mb_motoboys m on m.id = p.motoboy_id and m.ativo
    where p.dia_semana = case when v_feriado and t.feriado_como_domingo then 0 else v_dow end
      and not exists (select 1 from public.mb_escala e where e.data = d and e.turno = p.turno)
    on conflict do nothing;
    get diagnostics v_k = row_count; v_n := v_n + v_k;
    d := d + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.mb_semana_json(p_inicio date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'inicio', p_inicio, 'fim', p_inicio + 6, 'hoje', public.mb_hoje(),
    'turnos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nome', t.nome, 'setor', t.setor,
        'inicio', to_char(t.inicio, 'HH24:MI'), 'fim', to_char(t.fim, 'HH24:MI'), 'feriado_como_domingo', t.feriado_como_domingo) order by t.ordem)
      from public.mb_turnos t),
    'escala', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'data', e.data, 'turno', e.turno, 'origem', e.origem,
        'motoboy_id', e.motoboy_id, 'nome', m.nome, 'foto_url', case when public.mb_participa(m.id) or auth.uid() is not null then m.foto_url end,
        'chegou', exists (select 1 from public.mb_registros r where r.data = e.data and r.turno = e.turno and r.motoboy_id = e.motoboy_id))
        order by m.nome)
      from public.mb_escala e join public.mb_motoboys m on m.id = e.motoboy_id where e.data between p_inicio and p_inicio + 6), '[]'::jsonb),
    'motoboys', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome,
        'foto_url', case when public.mb_participa(m.id) or auth.uid() is not null then m.foto_url end) order by m.nome)
      from public.mb_motoboys m where m.ativo), '[]'::jsonb),
    'feriados', coalesce((select jsonb_object_agg(f.data::text, f.nome) from public.mb_feriados f where f.data between p_inicio and p_inicio + 6), '{}'::jsonb)
  ) $$;

create or replace function public.mb_padrao_json() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'turnos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nome', t.nome, 'setor', t.setor,
        'inicio', to_char(t.inicio, 'HH24:MI'), 'fim', to_char(t.fim, 'HH24:MI'), 'feriado_como_domingo', t.feriado_como_domingo) order by t.ordem)
      from public.mb_turnos t),
    'padrao', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'dia_semana', p.dia_semana, 'turno', p.turno,
        'motoboy_id', p.motoboy_id, 'nome', m.nome, 'ativo', m.ativo,
        'foto_url', case when public.mb_participa(m.id) or auth.uid() is not null then m.foto_url end) order by m.nome)
      from public.mb_escala_padrao p join public.mb_motoboys m on m.id = p.motoboy_id), '[]'::jsonb),
    'motoboys', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome,
        'foto_url', case when public.mb_participa(m.id) or auth.uid() is not null then m.foto_url end) order by m.nome)
      from public.mb_motoboys m where m.ativo), '[]'::jsonb)
  ) $$;
