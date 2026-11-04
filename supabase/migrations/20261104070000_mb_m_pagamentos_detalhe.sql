-- JÁ APLICADA no Supabase em 2026-11-04.
-- O motoboy vê o detalhe de cada pagamento já feito: diárias, entregas, cada vale/desconto/bônus com o motivo.

create or replace function public.mb_m_pagamentos(p_id uuid, p_chave text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'data', p.data_pagamento, 'forma', p.forma, 'diarias', p.diarias, 'entregas', p.entregas,
      'ajustes', p.ajustes, 'total', p.total, 'pago_em', p.pago_em,
      'turnos', (select count(*) from public.mb_registros r where r.pagamento_id = p.id),
      'qtd_entregas', (select coalesce(sum(r.qtd_entregas), 0) from public.mb_registros r where r.pagamento_id = p.id),
      'periodo_de', (select min(r.data) from public.mb_registros r where r.pagamento_id = p.id),
      'periodo_ate', (select max(r.data) from public.mb_registros r where r.pagamento_id = p.id),
      'itens_ajuste', coalesce((select jsonb_agg(jsonb_build_object('data', a.data, 'valor', a.valor, 'motivo', a.motivo) order by a.data)
        from public.mb_ajustes a where a.pagamento_id = p.id), '[]'::jsonb)
    ) order by p.data_pagamento desc, p.pago_em desc)
    from (select * from public.mb_pagamentos where motoboy_id = p_id order by data_pagamento desc, pago_em desc limit 12) p), '[]'::jsonb);
end $$;

grant execute on function public.mb_m_pagamentos(uuid, text) to anon, authenticated;
