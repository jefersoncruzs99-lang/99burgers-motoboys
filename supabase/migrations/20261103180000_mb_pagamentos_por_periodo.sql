-- JÁ APLICADA no Supabase em 2026-11-03.
-- Pagamentos em aberto separados pela data em que cada turno deveria ser pago
-- (um turno do dia X é pago na primeira data de pagamento depois de X), com o detalhe de cada turno e ajuste.

create or replace function public.mb_a_pagamentos_periodos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  return coalesce((
    with itens as (
      select r.motoboy_id, public.mb_proxima_data_pagamento(m.forma_pagamento, r.data + 1) as data_pagamento,
        jsonb_build_object('tipo', 'turno', 'id', r.id, 'data', r.data, 'turno', r.turno, 'chegada_em', r.chegada_em, 'faixa', r.faixa,
          'valor_diaria', r.valor_diaria, 'valor_entregas', r.valor_entregas, 'qtd_entregas', r.qtd_entregas) as item,
        r.valor_diaria as diaria, r.valor_entregas as entregas, 0::numeric as ajuste, (r.valor_entregas = 0 and r.qtd_entregas = 0) as sem_entregas
      from public.mb_registros r join public.mb_motoboys m on m.id = r.motoboy_id
      where r.pagamento_id is null
      union all
      select a.motoboy_id, public.mb_proxima_data_pagamento(m.forma_pagamento, a.data + 1),
        jsonb_build_object('tipo', 'ajuste', 'id', a.id, 'data', a.data, 'valor', a.valor, 'motivo', a.motivo),
        0, 0, a.valor, false
      from public.mb_ajustes a join public.mb_motoboys m on m.id = a.motoboy_id
      where a.pagamento_id is null
    ), grupos as (
      select i.data_pagamento, i.motoboy_id,
        sum(i.diaria) as diarias, sum(i.entregas) as entregas, sum(i.ajuste) as ajustes,
        count(*) filter (where i.item->>'tipo' = 'turno') as dias,
        count(*) filter (where i.sem_entregas) as sem_entregas,
        jsonb_agg(i.item order by i.item->>'data', i.item->>'turno') as itens
      from itens i group by i.data_pagamento, i.motoboy_id
    )
    select jsonb_agg(jsonb_build_object(
        'data_pagamento', g.data_pagamento, 'motoboy_id', g.motoboy_id, 'nome', m.nome, 'pix', m.pix, 'forma_pagamento', m.forma_pagamento,
        'diarias', g.diarias, 'entregas', g.entregas, 'ajustes', g.ajustes, 'total', g.diarias + g.entregas + g.ajustes,
        'dias', g.dias, 'sem_entregas', g.sem_entregas, 'itens', g.itens)
      order by g.data_pagamento, m.nome)
    from grupos g join public.mb_motoboys m on m.id = g.motoboy_id
  ), '[]'::jsonb);
end $$;

revoke all on function public.mb_a_pagamentos_periodos() from public, anon;
grant execute on function public.mb_a_pagamentos_periodos() to authenticated;
