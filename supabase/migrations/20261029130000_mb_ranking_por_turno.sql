-- JÁ APLICADA no Supabase em 2026-10-29.
-- Ranking separado por turno (manhã / noite). Sem turno = geral (como antes).
-- As funções antigas continuam existindo e passam a chamar as novas com turno vazio.

create or replace function public.mb_ranking_turno_int(p_inicio date, p_fim date, p_turno text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with base as (
    select m.id, m.nome, case when public.mb_participa(m.id) then m.foto_url end as foto_url,
      coalesce((select sum(r.qtd_entregas) from public.mb_registros r where r.motoboy_id = m.id and r.data >= p_inicio and r.data < p_fim
                and (p_turno is null or r.turno = p_turno)), 0)::int as entregas,
      (select count(*) from public.mb_registros r where r.motoboy_id = m.id and r.data >= p_inicio and r.data < p_fim
                and (p_turno is null or r.turno = p_turno))::int as turnos,
      coalesce((select sum(o.pontos) from public.mb_ocorrencias o where o.motoboy_id = m.id and o.status <> 'anulada'
                and o.data >= p_inicio and o.data < p_fim and (p_turno is null or o.turno = p_turno)), 0)::int as pontos_ocorrencias
    from public.mb_motoboys m
    where m.ativo
  ), calc as (
    select b.*, b.entregas * coalesce((select c.pontos_por_entrega from public.mb_config c where c.id = 'padrao'), 1) + b.pontos_ocorrencias as pontos
    from base b where b.turnos > 0 or b.pontos_ocorrencias <> 0
  )
  select coalesce(jsonb_agg(jsonb_build_object('pos', x.pos, 'motoboy_id', x.id, 'nome', x.nome, 'foto_url', x.foto_url,
      'entregas', x.entregas, 'turnos', x.turnos, 'pontos_ocorrencias', x.pontos_ocorrencias, 'pontos', x.pontos) order by x.pos, x.nome), '[]'::jsonb)
  from (select c.*, rank() over (order by c.pontos desc, c.entregas desc) as pos from calc c) x $$;

create or replace function public.mb_ranking_int(p_inicio date, p_fim date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.mb_ranking_turno_int(p_inicio, p_fim, null) $$;

create or replace function public.mb_ranking_json_t(p_periodo text, p_curto boolean, p_turno text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_hoje date := public.mb_hoje(); v_r daterange; v_ant daterange; v_lista jsonb; v_campeao jsonb;
  v_turno text := case when p_turno in (select codigo from public.mb_turnos) then p_turno end;
begin
  v_r := public.mb_periodo(p_periodo, v_hoje);
  v_ant := case when p_periodo like 'ano%' then public.mb_periodo('ano_anterior', lower(v_r)) else public.mb_periodo('mes_anterior', lower(v_r)) end;
  v_lista := public.mb_ranking_turno_int(lower(v_r), upper(v_r), v_turno);
  v_campeao := public.mb_ranking_turno_int(lower(v_ant), upper(v_ant), v_turno) -> 0;
  if p_curto then
    select coalesce(jsonb_agg(((x || jsonb_build_object('nome', public.mb_nome_curto(x->>'nome'))) - 'pontos_ocorrencias') - 'turnos'), '[]'::jsonb)
      into v_lista from jsonb_array_elements(v_lista) x;
    if v_campeao is not null then
      v_campeao := ((v_campeao || jsonb_build_object('nome', public.mb_nome_curto(v_campeao->>'nome'))) - 'pontos_ocorrencias') - 'turnos';
    end if;
  end if;
  return jsonb_build_object('periodo', p_periodo, 'turno', v_turno, 'inicio', lower(v_r), 'fim', upper(v_r) - 1, 'ranking', v_lista,
    'campeao_anterior', v_campeao, 'inicio_anterior', lower(v_ant), 'fim_anterior', upper(v_ant) - 1,
    'turnos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nome', t.nome) order by t.ordem) from public.mb_turnos t));
end $$;

create or replace function public.mb_ranking_json(p_periodo text, p_curto boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.mb_ranking_json_t(p_periodo, p_curto, null) $$;

create or replace function public.mb_m_ranking_t(p_id uuid, p_chave text, p_periodo text, p_turno text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  return public.mb_ranking_json_t(case when p_periodo in ('mes','ano','mes_anterior','ano_anterior') then p_periodo else 'mes' end, true, p_turno)
    || jsonb_build_object('eu', p_id, 'participa', public.mb_participa(p_id));
end $$;

create or replace function public.mb_a_ranking_t(p_periodo text, p_turno text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  return public.mb_ranking_json_t(case when p_periodo in ('mes','ano','mes_anterior','ano_anterior') then p_periodo else 'mes' end, false, p_turno);
end $$;

do $$
begin
  execute 'revoke all on function public.mb_ranking_turno_int(date, date, text) from public, anon, authenticated';
  execute 'revoke all on function public.mb_ranking_json_t(text, boolean, text) from public, anon, authenticated';
  execute 'revoke all on function public.mb_a_ranking_t(text, text) from public, anon';
  execute 'grant execute on function public.mb_a_ranking_t(text, text) to authenticated';
  execute 'revoke all on function public.mb_m_ranking_t(uuid, text, text, text) from public';
  execute 'grant execute on function public.mb_m_ranking_t(uuid, text, text, text) to anon, authenticated';
end $$;
