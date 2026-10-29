-- JÁ APLICADA no Supabase em 2026-10-29.
-- Forma de pagamento (PIX ou dinheiro) e "pago em dinheiro na hora" por turno.
-- O que não for pago na hora continua indo para a quarta (semanal) ou para os dias 1 e 16 (quinzenal).

alter table public.mb_pagamentos add column if not exists forma text not null default 'pix' check (forma in ('pix','dinheiro','outro'));

-- Paga um turno (diária + entregas) na hora, em dinheiro
create or replace function public.mb_pagar_turno_int(p_registro uuid, p_pago_por uuid, p_obs text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.mb_registros; v_id uuid;
begin
  select * into v from public.mb_registros where id = p_registro for update;
  if v.id is null then raise exception 'Turno não encontrado'; end if;
  if v.pagamento_id is not null then raise exception 'Este turno já foi pago'; end if;
  if v.valor_entregas = 0 and v.qtd_entregas = 0 then
    raise exception 'Lance as entregas deste turno antes de pagar em dinheiro';
  end if;
  insert into public.mb_pagamentos (motoboy_id, data_pagamento, diarias, entregas, ajustes, total, observacao, pago_por, forma)
  values (v.motoboy_id, public.mb_hoje(), v.valor_diaria, v.valor_entregas, 0, v.valor_diaria + v.valor_entregas, p_obs, p_pago_por, 'dinheiro')
  returning id into v_id;
  update public.mb_registros set pagamento_id = v_id where id = v.id;
  return v_id;
end $$;

create or replace function public.mb_a_pagar_dinheiro(p_registro uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_por text;
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  select coalesce(p.display_name, 'Administração') into v_por from public.profiles p where p.id = auth.uid();
  return public.mb_pagar_turno_int(p_registro, auth.uid(), 'Pago em dinheiro na hora (Adm: ' || coalesce(v_por, 'Administração') || ')');
end $$;

create or replace function public.mb_r_pagar_dinheiro(p_rota uuid, p_pin text, p_registro uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if not public.mb_rota_ok(p_rota, p_pin) then raise exception 'PIN inválido'; end if;
  if not exists (select 1 from public.mb_registros r where r.id = p_registro and r.data >= public.mb_hoje() - 7) then
    raise exception 'Só dá para pagar em dinheiro turnos dos últimos 7 dias';
  end if;
  select nome into v_nome from public.mb_gestores_rota where id = p_rota;
  return public.mb_pagar_turno_int(p_registro, null, 'Pago em dinheiro na hora (Rota: ' || v_nome || ')');
end $$;

-- Histórico do motoboy passa a mostrar a forma de pagamento
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.mb_m_painel(uuid, text)'::regprocedure) into v_def;
  if position('''forma'', p.forma' in v_def) = 0 then
    v_def := replace(v_def, '''entregas'', p.entregas, ''ajustes'', p.ajustes)', '''entregas'', p.entregas, ''ajustes'', p.ajustes, ''forma'', p.forma)');
    execute v_def;
  end if;
end $$;

-- Visão do dia: mostrar se o turno foi pago em dinheiro
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.mb_dia_json(date)'::regprocedure) into v_def;
  if position('pago_dinheiro' in v_def) = 0 then
    v_def := replace(v_def, '''pago'', r.pagamento_id is not null,',
      '''pago'', r.pagamento_id is not null, ''pago_dinheiro'', exists (select 1 from public.mb_pagamentos pg where pg.id = r.pagamento_id and pg.forma = ''dinheiro''),');
    execute v_def;
  end if;
end $$;

do $$
declare f text;
begin
  execute 'revoke all on function public.mb_pagar_turno_int(uuid, uuid, text) from public, anon, authenticated';
  execute 'revoke all on function public.mb_a_pagar_dinheiro(uuid) from public, anon';
  execute 'grant execute on function public.mb_a_pagar_dinheiro(uuid) to authenticated';
  execute 'revoke all on function public.mb_r_pagar_dinheiro(uuid, text, uuid) from public';
  execute 'grant execute on function public.mb_r_pagar_dinheiro(uuid, text, uuid) to anon, authenticated';
end $$;

-- App do motoboy fica sabendo se a loja exige QR na chegada
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.mb_m_extra(uuid, text)'::regprocedure) into v_def;
  if position('qr_obrigatorio' in v_def) = 0 then
    v_def := replace(v_def, '''prazo_contestacao_dias'', v_cfg.prazo_contestacao_dias,',
      '''prazo_contestacao_dias'', v_cfg.prazo_contestacao_dias, ''qr_obrigatorio'', v_cfg.qr_obrigatorio,');
    execute v_def;
  end if;
end $$;
