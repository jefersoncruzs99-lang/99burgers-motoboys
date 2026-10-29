-- JÁ APLICADA no Supabase em 2026-10-29.
-- Chegada presencial com QR code que muda a cada 30 segundos (mostrado pelo gestor de rota ou num tablet da loja).
-- O QR leva a /m/cheguei?c=CODIGO; ao abrir, o código vira um "ticket" de 10 minutos para o motoboy ler o termo e confirmar.

alter table public.mb_config add column if not exists qr_obrigatorio boolean not null default true;
alter table public.mb_config add column if not exists qr_segredo text not null default encode(extensions.gen_random_bytes(32), 'hex');
alter table public.mb_config add column if not exists qr_janela_seg integer not null default 30 check (qr_janela_seg between 10 and 300);
alter table public.mb_registros add column if not exists qr_validado boolean not null default false;

create table if not exists public.mb_qr_tickets (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references public.mb_motoboys(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '10 minutes',
  usado_em timestamptz,
  ip text
);
alter table public.mb_qr_tickets enable row level security; -- sem políticas: só as funções acessam
create index if not exists idx_mb_qr_tickets on public.mb_qr_tickets(motoboy_id, expira_em);

-- Código da janela de tempo (12 caracteres de um HMAC com o segredo da loja)
create or replace function public.mb_qr_codigo_janela(p_janela bigint) returns text
language sql stable security definer set search_path = '' as $$
  select left(encode(extensions.hmac(p_janela::text, c.qr_segredo, 'sha256'), 'hex'), 12)
  from public.mb_config c where c.id = 'padrao' $$;

create or replace function public.mb_qr_atual() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_j integer; v_w bigint; v_ep numeric := extract(epoch from now());
begin
  select qr_janela_seg into v_j from public.mb_config where id = 'padrao';
  v_w := floor(v_ep / v_j)::bigint;
  return jsonb_build_object('codigo', public.mb_qr_codigo_janela(v_w), 'janela', v_j,
    'restante', ceil((v_w + 1) * v_j - v_ep)::int);
end $$;

-- Código vale na janela atual e na anterior (30 a 60 segundos)
create or replace function public.mb_qr_valido(p_codigo text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_j integer; v_w bigint;
begin
  if p_codigo is null or length(p_codigo) <> 12 then return false; end if;
  select qr_janela_seg into v_j from public.mb_config where id = 'padrao';
  v_w := floor(extract(epoch from now()) / v_j)::bigint;
  return p_codigo = public.mb_qr_codigo_janela(v_w) or p_codigo = public.mb_qr_codigo_janela(v_w - 1);
end $$;

-- Gestor de rota / administração pegam o código atual para desenhar o QR
create or replace function public.mb_r_qr(p_rota uuid, p_pin text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.mb_rota_ok(p_rota, p_pin) then raise exception 'PIN inválido'; end if;
  return public.mb_qr_atual();
end $$;

create or replace function public.mb_a_qr() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  return public.mb_qr_atual();
end $$;

-- Motoboy leu o QR: troca o código por um ticket de 10 minutos
create or replace function public.mb_m_ler_qr(p_id uuid, p_chave text, p_codigo text, p_ip text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_t uuid;
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  if not public.mb_qr_valido(p_codigo) then
    raise exception 'QR vencido. Peça para o gestor mostrar o QR de novo e escaneie na hora.';
  end if;
  insert into public.mb_qr_tickets (motoboy_id, ip) values (p_id, left(p_ip, 100)) returning id into v_t;
  return v_t;
end $$;

-- Chegada com ticket do QR (a função antiga mb_m_chegar passa a chamar esta, sem ticket)
create or replace function public.mb_m_chegar_qr(p_id uuid, p_chave text, p_turno text, p_aceite boolean, p_ip text, p_ua text, p_ticket uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_hoje date := public.mb_hoje(); v_agora timestamptz := now(); v_t public.mb_turnos; v_cfg public.mb_config;
  v_local time := (now() at time zone 'America/Bahia')::time; v_contrato uuid; v_termo uuid; v_esc uuid; v_faixa smallint;
  v_r public.mb_registros; v_qr boolean := false;
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  if not coalesce(p_aceite, false) then raise exception 'Para confirmar, aceite o termo do dia'; end if;
  select * into v_t from public.mb_turnos where codigo = p_turno;
  if v_t.codigo is null then raise exception 'Turno inválido'; end if;
  select * into v_cfg from public.mb_config where id = 'padrao';
  if p_ticket is not null then
    update public.mb_qr_tickets set usado_em = now()
    where id = p_ticket and motoboy_id = p_id and usado_em is null and expira_em > now();
    v_qr := found;
    if not v_qr then raise exception 'QR vencido. Escaneie o QR do gestor de novo.'; end if;
  end if;
  if v_cfg.qr_obrigatorio and not v_qr then
    raise exception 'Para confirmar a chegada, escaneie o QR code com o gestor de rota.';
  end if;
  if v_local < v_t.inicio - make_interval(mins => v_cfg.checkin_antecedencia_min) then
    raise exception 'Ainda é cedo para confirmar o turno da %', lower(v_t.nome);
  end if;
  if v_local > v_t.fim then raise exception 'O turno da % já terminou. Fale com o gestor de rota.', lower(v_t.nome); end if;
  select id into v_contrato from public.mb_documentos where tipo = 'contrato' and ativo;
  if v_contrato is not null and not exists (select 1 from public.mb_assinaturas a where a.motoboy_id = p_id and a.documento_id = v_contrato) then
    raise exception 'Assine o contrato de prestação de serviço antes de confirmar';
  end if;
  select id into v_termo from public.mb_documentos where tipo = 'termo_diario' and ativo;
  select id into v_esc from public.mb_escala where data = v_hoje and turno = p_turno and motoboy_id = p_id;
  v_faixa := public.mb_faixa(p_turno, v_agora);
  insert into public.mb_registros (data, turno, motoboy_id, escala_id, fora_da_escala, chegada_em, faixa, valor_diaria,
    origem_chegada, registrado_por, termo_id, termo_aceito_em, ip, user_agent, qr_validado)
  values (v_hoje, p_turno, p_id, v_esc, v_esc is null, v_agora, v_faixa, public.mb_valor_diaria(v_hoje, v_faixa),
    'motoboy', 'motoboy', v_termo, v_agora, left(p_ip, 100), left(p_ua, 400), v_qr)
  on conflict (data, turno, motoboy_id) do nothing
  returning * into v_r;
  if v_r.id is null then raise exception 'Você já confirmou este turno hoje'; end if;
  return jsonb_build_object('faixa', v_r.faixa, 'valor_diaria', v_r.valor_diaria, 'chegada_em', v_r.chegada_em, 'fora_da_escala', v_r.fora_da_escala);
end $$;

create or replace function public.mb_m_chegar(p_id uuid, p_chave text, p_turno text, p_aceite boolean, p_ip text, p_ua text) returns jsonb
language sql security definer set search_path = '' as $$
  select public.mb_m_chegar_qr(p_id, p_chave, p_turno, p_aceite, p_ip, p_ua, null) $$;

-- Admin troca o segredo (invalida qualquer QR antigo)
create or replace function public.mb_a_novo_segredo_qr() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  update public.mb_config set qr_segredo = encode(extensions.gen_random_bytes(32), 'hex') where id = 'padrao';
end $$;

do $$
declare f text;
begin
  foreach f in array array['mb_qr_codigo_janela(bigint)','mb_qr_atual()','mb_qr_valido(text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['mb_a_qr()','mb_a_novo_segredo_qr()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['mb_r_qr(uuid, text)','mb_m_ler_qr(uuid, text, text, text)',
                           'mb_m_chegar_qr(uuid, text, text, boolean, text, text, uuid)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
