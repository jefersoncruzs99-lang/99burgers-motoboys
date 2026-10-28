-- JÁ APLICADA no Supabase em 2026-10-28.
-- Administração: registrar chegada e lançar entregas pelo painel (usuário logado do painel 99).
create or replace function public.mb_a_registrar_chegada(p_data date, p_turno text, p_motoboy uuid, p_hora time, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_chegada timestamptz; v_faixa smallint; v_esc uuid; v_por text;
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  if p_data > public.mb_hoje() then raise exception 'Não dá para registrar chegada no futuro'; end if;
  select coalesce(p.display_name, 'Administração') into v_por from public.profiles p where p.id = auth.uid();
  v_chegada := (p_data + p_hora) at time zone 'America/Bahia';
  v_faixa := public.mb_faixa(p_turno, v_chegada);
  select id into v_esc from public.mb_escala where data = p_data and turno = p_turno and motoboy_id = p_motoboy;
  insert into public.mb_registros (data, turno, motoboy_id, escala_id, fora_da_escala, chegada_em, faixa, valor_diaria,
    origem_chegada, registrado_por, observacao)
  values (p_data, p_turno, p_motoboy, v_esc, v_esc is null, v_chegada, v_faixa, public.mb_valor_diaria(p_data, v_faixa),
    'gestor', 'Adm: ' || coalesce(v_por, 'Administração'), nullif(trim(coalesce(p_obs,'')), ''))
  on conflict (data, turno, motoboy_id) do nothing;
  if not found then raise exception 'Este motoboy já tem chegada registrada neste turno'; end if;
end $$;

create or replace function public.mb_a_lancar_entregas(p_registro uuid, p_valor numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare v_por text;
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  if p_valor is null or p_valor < 0 or p_valor > 5000 then raise exception 'Valor inválido'; end if;
  select coalesce(p.display_name, 'Administração') into v_por from public.profiles p where p.id = auth.uid();
  update public.mb_registros set valor_entregas = round(p_valor, 2), entregas_lancadas_por = 'Adm: ' || coalesce(v_por, 'Administração'),
    entregas_lancadas_em = now()
  where id = p_registro and pagamento_id is null;
  if not found then raise exception 'Não foi possível lançar (dia já pago)'; end if;
end $$;

-- Corrige o horário de chegada (recalcula faixa e diária)
create or replace function public.mb_a_corrigir_chegada(p_registro uuid, p_hora time) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; v_chegada timestamptz; v_faixa smallint;
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  select * into r from public.mb_registros where id = p_registro and pagamento_id is null;
  if not found then raise exception 'Registro não encontrado ou já pago'; end if;
  v_chegada := (r.data + p_hora) at time zone 'America/Bahia';
  v_faixa := public.mb_faixa(r.turno, v_chegada);
  update public.mb_registros set chegada_em = v_chegada, faixa = v_faixa, valor_diaria = public.mb_valor_diaria(r.data, v_faixa)
  where id = p_registro;
end $$;

-- Recalcula diárias ainda não pagas de um dia (depois de mudar valores ou marcar feriado)
create or replace function public.mb_a_recalcular_dia(p_data date) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  update public.mb_registros r set faixa = public.mb_faixa(r.turno, r.chegada_em),
    valor_diaria = public.mb_valor_diaria(r.data, public.mb_faixa(r.turno, r.chegada_em))
  where r.data = p_data and r.pagamento_id is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Resumo de pagamentos em aberto por motoboy até a próxima data de pagamento de cada um (exclusive),
-- ou até p_ate quando informado. Inclui o total em aberto geral (todos os dias até hoje).
create or replace function public.mb_a_resumo_pagamentos(p_ate date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'motoboy_id', x.id, 'nome', x.nome, 'pix', x.pix, 'forma_pagamento', x.forma_pagamento, 'ativo', x.ativo,
      'data_pagamento', x.ate,
      'aberto', public.mb_em_aberto(x.id, x.ate),
      'tudo', public.mb_em_aberto(x.id, public.mb_hoje() + 1),
      'sem_entregas', (select count(*) from public.mb_registros r where r.motoboy_id = x.id and r.pagamento_id is null
                        and r.data < x.ate and r.valor_entregas = 0)
    ) order by x.ate, x.nome) from (
      select m.*, coalesce(p_ate, public.mb_proxima_data_pagamento(m.forma_pagamento, public.mb_hoje())) as ate
      from public.mb_motoboys m
      where m.ativo or exists (select 1 from public.mb_registros r where r.motoboy_id = m.id and r.pagamento_id is null)
    ) x), '[]'::jsonb);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'mb_a_registrar_chegada(date, text, uuid, time, text)','mb_a_lancar_entregas(uuid, numeric)',
    'mb_a_corrigir_chegada(uuid, time)','mb_a_recalcular_dia(date)','mb_a_resumo_pagamentos(date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
