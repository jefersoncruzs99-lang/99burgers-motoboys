-- JÁ APLICADA no Supabase em 2026-11-02.
-- Pontos automáticos por turno trabalhado no domingo e no feriado (sem precisar lançar intercorrência).
-- Feriado que cai no domingo conta como feriado (vale o maior). Os tipos manuais equivalentes foram desativados
-- para não contar em dobro.

alter table public.mb_config add column if not exists pontos_domingo integer not null default 0 check (pontos_domingo between 0 and 100);
alter table public.mb_config add column if not exists pontos_feriado integer not null default 0 check (pontos_feriado between 0 and 100);
update public.mb_config set pontos_domingo = 10, pontos_feriado = 15 where id = 'padrao';
update public.mb_tipos_ocorrencia set ativo = false where codigo in ('trabalhou_domingo_74d', 'trabalhou_feriadao_a6a');

create or replace function public.mb_ranking_turno_int(p_inicio date, p_fim date, p_turno text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with cfg as (
    select coalesce(c.pontos_por_entrega, 1) as ppe, coalesce(c.pontos_domingo, 0) as pdom, coalesce(c.pontos_feriado, 0) as pfer
    from public.mb_config c where c.id = 'padrao'
  ), base as (
    select m.id, m.nome, case when public.mb_participa(m.id) then m.foto_url end as foto_url,
      coalesce((select sum(r.qtd_entregas) from public.mb_registros r where r.motoboy_id = m.id and r.data >= p_inicio and r.data < p_fim
                and (p_turno is null or r.turno = p_turno)), 0)::int as entregas,
      (select count(*) from public.mb_registros r where r.motoboy_id = m.id and r.data >= p_inicio and r.data < p_fim
                and (p_turno is null or r.turno = p_turno))::int as turnos,
      coalesce((select sum(o.pontos) from public.mb_ocorrencias o where o.motoboy_id = m.id and o.status <> 'anulada'
                and o.data >= p_inicio and o.data < p_fim and (p_turno is null or o.turno = p_turno)), 0)::int as pontos_ocorrencias,
      coalesce((select sum(case when exists (select 1 from public.mb_feriados f where f.data = r.data) then (select greatest(pfer, case when extract(dow from r.data) = 0 then pdom else 0 end) from cfg)
                               when extract(dow from r.data) = 0 then (select pdom from cfg) else 0 end)
                from public.mb_registros r where r.motoboy_id = m.id and r.data >= p_inicio and r.data < p_fim
                and (p_turno is null or r.turno = p_turno)), 0)::int as pontos_bonus
    from public.mb_motoboys m
    where m.ativo
  ), calc as (
    select b.*, b.entregas * (select ppe from cfg) + b.pontos_ocorrencias + b.pontos_bonus as pontos
    from base b where b.turnos > 0 or b.pontos_ocorrencias <> 0
  )
  select coalesce(jsonb_agg(jsonb_build_object('pos', x.pos, 'motoboy_id', x.id, 'nome', x.nome, 'foto_url', x.foto_url,
      'entregas', x.entregas, 'turnos', x.turnos, 'pontos_ocorrencias', x.pontos_ocorrencias, 'pontos_bonus', x.pontos_bonus,
      'pontos', x.pontos) order by x.pos, x.nome), '[]'::jsonb)
  from (select c.*, rank() over (order by c.pontos desc, c.entregas desc) as pos from calc c) x $$;
