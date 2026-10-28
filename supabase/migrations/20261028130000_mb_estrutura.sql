-- JÁ APLICADA no Supabase em 2026-10-28.
-- App de motoboys: escala, trocas, chegada com aceite diário, lançamento do gestor de rota,
-- contrato de prestação de serviço e pagamentos (semanal na quarta ou quinzenal nos dias 1 e 16).
-- Prefixo mb_ para não conflitar com os outros apps do mesmo projeto.

create extension if not exists pgcrypto with schema extensions;

-- ===================== CONFIGURAÇÃO =====================

create table if not exists public.mb_config (
  id text primary key default 'padrao' check (id = 'padrao'),
  troca_automatica boolean not null default true,   -- troca vale assim que o colega aceita
  checkin_antecedencia_min integer not null default 120 check (checkin_antecedencia_min between 0 and 600),
  updated_at timestamptz not null default now()
);
insert into public.mb_config (id) values ('padrao') on conflict (id) do nothing;

create table if not exists public.mb_turnos (
  codigo text primary key check (codigo in ('manha','noite')),
  nome text not null,
  setor text not null,
  inicio time not null,
  fim time not null,
  limite_cheia time not null,  -- chegou até aqui: diária cheia
  limite_meio time not null,   -- chegou até aqui: 2/3; depois: 1/3
  ordem integer not null default 1,
  check (inicio < fim and limite_cheia <= limite_meio)
);
insert into public.mb_turnos (codigo, nome, setor, inicio, fim, limite_cheia, limite_meio, ordem) values
  ('manha', 'Manhã', 'Marmitaria', '10:30', '14:30', '11:00', '12:00', 1),
  ('noite', 'Noite', 'Hamburgueria', '18:00', '23:00', '18:30', '19:30', 2)
on conflict (codigo) do nothing;

-- Valor da diária por tipo de dia e faixa de chegada (1 = cheia, 2 = 2/3, 3 = 1/3)
create table if not exists public.mb_valores (
  tipo_dia text not null check (tipo_dia in ('semana','domingo')),
  faixa smallint not null check (faixa between 1 and 3),
  valor numeric(10,2) not null check (valor >= 0),
  primary key (tipo_dia, faixa)
);
insert into public.mb_valores (tipo_dia, faixa, valor) values
  ('semana', 1, 30), ('semana', 2, 20), ('semana', 3, 10),
  ('domingo', 1, 35), ('domingo', 2, 23), ('domingo', 3, 12)
on conflict do nothing;

create table if not exists public.mb_feriados (
  data date primary key,
  nome text not null
);

-- ===================== PESSOAS =====================

create table if not exists public.mb_motoboys (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique check (telefone ~ '^[0-9]{10,13}$'),
  cpf text,
  pix text,
  forma_pagamento text not null default 'quinzenal' check (forma_pagamento in ('semanal','quinzenal')),
  chave_hash text,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mb_gestores_rota (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pin_hash text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===================== ESCALA =====================

create table if not exists public.mb_escala_padrao (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null check (dia_semana between 0 and 6), -- 0 = domingo (feriado usa o domingo)
  turno text not null references public.mb_turnos(codigo),
  motoboy_id uuid not null references public.mb_motoboys(id) on delete cascade,
  unique (dia_semana, turno, motoboy_id)
);

create table if not exists public.mb_escala (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno text not null references public.mb_turnos(codigo),
  motoboy_id uuid not null references public.mb_motoboys(id) on delete cascade,
  origem text not null default 'manual' check (origem in ('padrao','manual','troca')),
  created_at timestamptz not null default now(),
  unique (data, turno, motoboy_id) -- o mesmo motoboy nunca fica duplicado no turno
);
create index if not exists idx_mb_escala_data on public.mb_escala(data);

create table if not exists public.mb_trocas (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid references public.mb_escala(id) on delete cascade,
  data date not null,
  turno text not null references public.mb_turnos(codigo),
  de_motoboy uuid not null references public.mb_motoboys(id) on delete cascade,
  para_motoboy uuid references public.mb_motoboys(id) on delete cascade, -- vazio = qualquer colega pode pegar
  status text not null default 'aberta' check (status in ('aberta','aceita','aprovada','recusada','cancelada')),
  motivo text,
  aceita_por uuid references public.mb_motoboys(id) on delete set null,
  criada_em timestamptz not null default now(),
  aceita_em timestamptz,
  decidida_em timestamptz,
  decidida_por uuid references auth.users(id) on delete set null
);
create index if not exists idx_mb_trocas_data on public.mb_trocas(data);

-- ===================== DOCUMENTOS =====================

create table if not exists public.mb_documentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('contrato','termo_diario')),
  versao integer not null,
  titulo text not null,
  texto text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (tipo, versao)
);
create unique index if not exists uq_mb_documento_ativo on public.mb_documentos(tipo) where ativo;

create table if not exists public.mb_assinaturas (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references public.mb_motoboys(id) on delete cascade,
  documento_id uuid not null references public.mb_documentos(id),
  nome_assinado text not null,
  cpf_assinado text not null,
  texto_hash text not null,
  ip text,
  user_agent text,
  assinado_em timestamptz not null default now(),
  unique (motoboy_id, documento_id)
);

-- ===================== DIAS TRABALHADOS E PAGAMENTOS =====================

create table if not exists public.mb_pagamentos (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references public.mb_motoboys(id) on delete cascade,
  data_pagamento date not null,
  diarias numeric(10,2) not null default 0,
  entregas numeric(10,2) not null default 0,
  ajustes numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  observacao text,
  pago_em timestamptz not null default now(),
  pago_por uuid references auth.users(id) on delete set null
);
create index if not exists idx_mb_pagamentos_motoboy on public.mb_pagamentos(motoboy_id, data_pagamento desc);

create table if not exists public.mb_registros (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno text not null references public.mb_turnos(codigo),
  motoboy_id uuid not null references public.mb_motoboys(id) on delete cascade,
  escala_id uuid references public.mb_escala(id) on delete set null,
  fora_da_escala boolean not null default false,
  chegada_em timestamptz not null,
  faixa smallint not null check (faixa between 1 and 3),
  valor_diaria numeric(10,2) not null check (valor_diaria >= 0),
  valor_entregas numeric(10,2) not null default 0 check (valor_entregas >= 0),
  entregas_lancadas_por text,
  entregas_lancadas_em timestamptz,
  origem_chegada text not null check (origem_chegada in ('motoboy','gestor')),
  registrado_por text not null,
  termo_id uuid references public.mb_documentos(id),
  termo_aceito_em timestamptz,
  ip text,
  user_agent text,
  observacao text,
  pagamento_id uuid references public.mb_pagamentos(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (data, turno, motoboy_id)
);
create index if not exists idx_mb_registros_data on public.mb_registros(data);
create index if not exists idx_mb_registros_aberto on public.mb_registros(motoboy_id) where pagamento_id is null;

create table if not exists public.mb_ajustes (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references public.mb_motoboys(id) on delete cascade,
  data date not null,
  valor numeric(10,2) not null check (valor <> 0), -- positivo = bônus, negativo = vale/desconto
  motivo text not null,
  pagamento_id uuid references public.mb_pagamentos(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.mb_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  turno text not null references public.mb_turnos(codigo),
  motoboy_id uuid references public.mb_motoboys(id) on delete set null,
  tipo text not null check (tipo in ('falta','atraso','problema','outro')),
  descricao text,
  registrado_por text not null,
  criado_em timestamptz not null default now()
);
create index if not exists idx_mb_ocorrencias_data on public.mb_ocorrencias(data);

-- Tentativas de acesso (bloqueio depois de muitos erros)
create table if not exists public.mb_tentativas (
  id bigserial primary key,
  chave text not null,
  em timestamptz not null default now()
);
create index if not exists idx_mb_tentativas on public.mb_tentativas(chave, em desc);

-- ===================== SEGURANÇA =====================
-- Usuários logados do painel (dono e líder) administram. Motoboys e gestores de rota não acessam
-- as tabelas: usam funções mb_m_* e mb_r_* que conferem a chave/PIN a cada chamada.
do $$
declare t text;
begin
  foreach t in array array[
    'mb_config','mb_turnos','mb_valores','mb_feriados','mb_motoboys','mb_gestores_rota','mb_escala_padrao',
    'mb_escala','mb_trocas','mb_documentos','mb_assinaturas','mb_pagamentos','mb_registros','mb_ajustes','mb_ocorrencias'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_auth_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_auth_all', t);
  end loop;
end $$;
alter table public.mb_tentativas enable row level security; -- sem políticas: invisível

-- ===================== FUNÇÕES DE APOIO =====================

create or replace function public.mb_hoje() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/Bahia')::date $$;

create or replace function public.mb_tipo_dia(p_data date) returns text
language sql stable security definer set search_path = '' as $$
  select case when extract(dow from p_data) = 0 or exists(select 1 from public.mb_feriados f where f.data = p_data)
    then 'domingo' else 'semana' end $$;

-- Faixa da diária pela hora de chegada (horário da Bahia)
create or replace function public.mb_faixa(p_turno text, p_chegada timestamptz) returns smallint
language sql stable security definer set search_path = '' as $$
  select case
    when (p_chegada at time zone 'America/Bahia')::time <= t.limite_cheia then 1
    when (p_chegada at time zone 'America/Bahia')::time <= t.limite_meio then 2
    else 3 end::smallint
  from public.mb_turnos t where t.codigo = p_turno $$;

create or replace function public.mb_valor_diaria(p_data date, p_faixa smallint) returns numeric
language sql stable security definer set search_path = '' as $$
  select v.valor from public.mb_valores v where v.tipo_dia = public.mb_tipo_dia(p_data) and v.faixa = p_faixa $$;

-- Próxima data de pagamento a partir de uma data (inclusive)
create or replace function public.mb_proxima_data_pagamento(p_forma text, p_ref date) returns date
language sql immutable set search_path = '' as $$
  select case
    when p_forma = 'semanal' then p_ref + ((3 - extract(isodow from p_ref)::int + 7) % 7)  -- quarta-feira
    when extract(day from p_ref) = 1 or extract(day from p_ref) = 16 then p_ref
    when extract(day from p_ref) < 16 then date_trunc('month', p_ref)::date + 15
    else (date_trunc('month', p_ref) + interval '1 month')::date end $$;

-- Gera a escala a partir da semana padrão (só turnos ainda vazios; feriado usa a escala de domingo)
create or replace function public.mb_gerar_escala(p_inicio date, p_fim date) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_n integer := 0; v_k integer; d date; v_dow smallint;
begin
  if p_fim < p_inicio or p_fim - p_inicio > 62 then raise exception 'Período inválido (máximo 2 meses)'; end if;
  d := p_inicio;
  while d <= p_fim loop
    v_dow := case when exists(select 1 from public.mb_feriados f where f.data = d) then 0 else extract(dow from d)::smallint end;
    insert into public.mb_escala (data, turno, motoboy_id, origem)
    select d, p.turno, p.motoboy_id, 'padrao'
    from public.mb_escala_padrao p
    join public.mb_motoboys m on m.id = p.motoboy_id and m.ativo
    where p.dia_semana = v_dow
      and not exists (select 1 from public.mb_escala e where e.data = d and e.turno = p.turno)
    on conflict do nothing;
    get diagnostics v_k = row_count; v_n := v_n + v_k;
    d := d + 1;
  end loop;
  return v_n;
end $$;

-- Refaz um dia pela semana padrão (ex.: virou feriado). Mantém quem já chegou.
create or replace function public.mb_refazer_dia(p_data date) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.mb_escala e
  where e.data = p_data and e.origem = 'padrao'
    and not exists (select 1 from public.mb_registros r where r.escala_id = e.id);
  -- turnos que ainda têm alguém (chegou ou manual) não são completados; os vazios são gerados
  return public.mb_gerar_escala(p_data, p_data);
end $$;

-- Senhas: bloqueio após 8 erros em 15 minutos
create or replace function public.mb_bloqueado(p_chave text) returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) >= 8 from public.mb_tentativas where chave = p_chave and em > now() - interval '15 minutes' $$;

create or replace function public.mb_motoboy_ok(p_id uuid, p_chave text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mb_motoboys m where m.id = p_id and m.ativo and m.chave_hash is not null
    and m.chave_hash = extensions.crypt(coalesce(p_chave,''), m.chave_hash)) $$;

create or replace function public.mb_rota_ok(p_id uuid, p_pin text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mb_gestores_rota g where g.id = p_id and g.ativo and g.pin_hash is not null
    and g.pin_hash = extensions.crypt(coalesce(p_pin,''), g.pin_hash)) $$;

-- ===================== ACESSO =====================

create or replace function public.mb_motoboy_entrar(p_telefone text, p_chave text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_tel text := regexp_replace(coalesce(p_telefone,''), '[^0-9]', '', 'g'); v_id uuid;
begin
  if public.mb_bloqueado('m:' || v_tel) then raise exception 'Muitas tentativas. Espere 15 minutos.'; end if;
  select m.id into v_id from public.mb_motoboys m
  where m.ativo and (m.telefone = v_tel or m.telefone = '55' || v_tel or '55' || m.telefone = v_tel)
    and m.chave_hash is not null and m.chave_hash = extensions.crypt(coalesce(p_chave,''), m.chave_hash)
  limit 1;
  if v_id is null then
    insert into public.mb_tentativas (chave) values ('m:' || v_tel);
    raise exception 'Telefone ou chave incorretos.';
  end if;
  return v_id;
end $$;

create or replace function public.mb_rota_lista() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome) order by g.nome), '[]'::jsonb)
  from public.mb_gestores_rota g where g.ativo and g.pin_hash is not null $$;

create or replace function public.mb_rota_entrar(p_id uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if public.mb_bloqueado('r:' || p_id::text) then raise exception 'Muitas tentativas. Espere 15 minutos.'; end if;
  if not public.mb_rota_ok(p_id, p_pin) then
    insert into public.mb_tentativas (chave) values ('r:' || p_id::text);
    raise exception 'PIN incorreto.';
  end if;
  return true;
end $$;

-- Admin: gera uma chave nova (6 dígitos) e devolve uma única vez
create or replace function public.mb_nova_chave(p_motoboy uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_chave text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  update public.mb_motoboys set chave_hash = extensions.crypt(v_chave, extensions.gen_salt('bf')) where id = p_motoboy;
  if not found then raise exception 'Motoboy não encontrado'; end if;
  return v_chave;
end $$;

create or replace function public.mb_definir_pin_rota(p_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  if coalesce(p_pin,'') !~ '^[0-9]{4,8}$' then raise exception 'O PIN precisa ter de 4 a 8 números'; end if;
  update public.mb_gestores_rota set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) where id = p_id;
end $$;

-- ===================== RESUMO DE PAGAMENTO =====================

-- Itens em aberto de um motoboy com data antes de p_ate (a data de pagamento não entra)
create or replace function public.mb_em_aberto(p_motoboy uuid, p_ate date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'diarias', coalesce((select sum(r.valor_diaria) from public.mb_registros r where r.motoboy_id = p_motoboy and r.pagamento_id is null and r.data < p_ate), 0),
    'entregas', coalesce((select sum(r.valor_entregas) from public.mb_registros r where r.motoboy_id = p_motoboy and r.pagamento_id is null and r.data < p_ate), 0),
    'ajustes', coalesce((select sum(a.valor) from public.mb_ajustes a where a.motoboy_id = p_motoboy and a.pagamento_id is null and a.data < p_ate), 0),
    'dias', (select count(*) from public.mb_registros r where r.motoboy_id = p_motoboy and r.pagamento_id is null and r.data < p_ate)
  ) $$;

-- Admin: registra o pagamento (marca como pagos os itens em aberto antes da data)
create or replace function public.mb_registrar_pagamento(p_motoboy uuid, p_data date, p_observacao text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_res jsonb; v_id uuid; v_total numeric;
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  v_res := public.mb_em_aberto(p_motoboy, p_data);
  v_total := (v_res->>'diarias')::numeric + (v_res->>'entregas')::numeric + (v_res->>'ajustes')::numeric;
  if (v_res->>'dias')::int = 0 and (v_res->>'ajustes')::numeric = 0 then raise exception 'Nada em aberto para pagar'; end if;
  insert into public.mb_pagamentos (motoboy_id, data_pagamento, diarias, entregas, ajustes, total, observacao, pago_por)
  values (p_motoboy, p_data, (v_res->>'diarias')::numeric, (v_res->>'entregas')::numeric, (v_res->>'ajustes')::numeric, v_total, p_observacao, auth.uid())
  returning id into v_id;
  update public.mb_registros set pagamento_id = v_id where motoboy_id = p_motoboy and pagamento_id is null and data < p_data;
  update public.mb_ajustes set pagamento_id = v_id where motoboy_id = p_motoboy and pagamento_id is null and data < p_data;
  return v_id;
end $$;

-- Admin: desfaz um pagamento lançado por engano
create or replace function public.mb_desfazer_pagamento(p_pagamento uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  update public.mb_registros set pagamento_id = null where pagamento_id = p_pagamento;
  update public.mb_ajustes set pagamento_id = null where pagamento_id = p_pagamento;
  delete from public.mb_pagamentos where id = p_pagamento;
end $$;

-- ===================== TROCAS =====================

create or replace function public.mb_aplicar_troca(p_troca uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.mb_trocas;
begin
  select * into v from public.mb_trocas where id = p_troca for update;
  if v.aceita_por is null then raise exception 'Ninguém aceitou esta troca ainda'; end if;
  if exists (select 1 from public.mb_escala e where e.data = v.data and e.turno = v.turno and e.motoboy_id = v.aceita_por) then
    raise exception 'Quem aceitou já está escalado neste turno';
  end if;
  if exists (select 1 from public.mb_registros r where r.escala_id = v.escala_id) then
    raise exception 'O turno já começou com o motoboy original';
  end if;
  update public.mb_escala set motoboy_id = v.aceita_por, origem = 'troca' where id = v.escala_id;
  if not found then raise exception 'O turno desta troca não está mais na escala'; end if;
  update public.mb_trocas set status = 'aprovada', decidida_em = now() where id = p_troca;
  -- outras trocas abertas do mesmo turno deixam de valer
  update public.mb_trocas set status = 'cancelada', decidida_em = now()
  where escala_id = v.escala_id and id <> p_troca and status in ('aberta','aceita');
end $$;

create or replace function public.mb_decidir_troca(p_troca uuid, p_aprovar boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  if p_aprovar then
    perform public.mb_aplicar_troca(p_troca);
    update public.mb_trocas set decidida_por = auth.uid() where id = p_troca;
  else
    update public.mb_trocas set status = 'recusada', decidida_em = now(), decidida_por = auth.uid()
    where id = p_troca and status in ('aberta','aceita');
  end if;
end $$;

-- ===================== MOTOBOY (chave) =====================

create or replace function public.mb_m_painel(p_id uuid, p_chave text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_hoje date := public.mb_hoje(); v_m public.mb_motoboys; v_contrato public.mb_documentos; v_termo public.mb_documentos;
  v_prox date; v_seguinte date;
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  select * into v_m from public.mb_motoboys where id = p_id;
  select * into v_contrato from public.mb_documentos where tipo = 'contrato' and ativo;
  select * into v_termo from public.mb_documentos where tipo = 'termo_diario' and ativo;
  v_prox := public.mb_proxima_data_pagamento(v_m.forma_pagamento, v_hoje);
  v_seguinte := public.mb_proxima_data_pagamento(v_m.forma_pagamento, v_prox + 1);
  return jsonb_build_object(
    'motoboy', jsonb_build_object('id', v_m.id, 'nome', v_m.nome, 'forma_pagamento', v_m.forma_pagamento),
    'hoje', v_hoje,
    'contrato', case when v_contrato.id is null then null else jsonb_build_object(
      'id', v_contrato.id, 'titulo', v_contrato.titulo, 'versao', v_contrato.versao, 'texto', v_contrato.texto,
      'assinado_em', (select a.assinado_em from public.mb_assinaturas a where a.motoboy_id = p_id and a.documento_id = v_contrato.id)) end,
    'termo', case when v_termo.id is null then null else jsonb_build_object('id', v_termo.id, 'titulo', v_termo.titulo, 'texto', v_termo.texto) end,
    'turnos', (select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nome', t.nome, 'setor', t.setor,
        'inicio', to_char(t.inicio, 'HH24:MI'), 'fim', to_char(t.fim, 'HH24:MI'),
        'limite_cheia', to_char(t.limite_cheia, 'HH24:MI'), 'limite_meio', to_char(t.limite_meio, 'HH24:MI')) order by t.ordem)
      from public.mb_turnos t),
    'valores_hoje', (select jsonb_object_agg(v.faixa::text, v.valor) from public.mb_valores v where v.tipo_dia = public.mb_tipo_dia(v_hoje)),
    'escala', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'data', e.data, 'turno', e.turno, 'feriado', (select f.nome from public.mb_feriados f where f.data = e.data),
        'registro', (select jsonb_build_object('chegada_em', r.chegada_em, 'faixa', r.faixa, 'valor_diaria', r.valor_diaria, 'valor_entregas', r.valor_entregas)
                     from public.mb_registros r where r.data = e.data and r.turno = e.turno and r.motoboy_id = p_id),
        'troca_aberta', exists(select 1 from public.mb_trocas x where x.escala_id = e.id and x.status in ('aberta','aceita'))
      ) order by e.data, e.turno)
      from public.mb_escala e where e.motoboy_id = p_id and e.data between v_hoje and v_hoje + 20), '[]'::jsonb),
    'registros_hoje', coalesce((select jsonb_agg(jsonb_build_object('turno', r.turno, 'chegada_em', r.chegada_em, 'faixa', r.faixa,
        'valor_diaria', r.valor_diaria, 'valor_entregas', r.valor_entregas, 'fora_da_escala', r.fora_da_escala))
      from public.mb_registros r where r.motoboy_id = p_id and r.data = v_hoje), '[]'::jsonb),
    'trocas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'data', x.data, 'turno', x.turno, 'status', x.status, 'motivo', x.motivo,
        'de_id', x.de_motoboy, 'de_nome', (select m.nome from public.mb_motoboys m where m.id = x.de_motoboy),
        'para_id', x.para_motoboy, 'para_nome', (select m.nome from public.mb_motoboys m where m.id = x.para_motoboy),
        'aceita_por_nome', (select m.nome from public.mb_motoboys m where m.id = x.aceita_por),
        'minha', x.de_motoboy = p_id,
        'pode_aceitar', x.status = 'aberta' and x.de_motoboy <> p_id and (x.para_motoboy is null or x.para_motoboy = p_id)
          and not exists (select 1 from public.mb_escala e where e.data = x.data and e.turno = x.turno and e.motoboy_id = p_id)
      ) order by x.data, x.turno)
      from public.mb_trocas x
      where x.data >= v_hoje and (
        x.de_motoboy = p_id or x.para_motoboy = p_id or x.aceita_por = p_id
        or (x.status = 'aberta' and x.para_motoboy is null))), '[]'::jsonb),
    'colegas', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome) order by m.nome)
      from public.mb_motoboys m where m.ativo and m.id <> p_id), '[]'::jsonb),
    'pagamento', jsonb_build_object(
      'proxima_data', v_prox, 'seguinte_data', v_seguinte,
      'proximo', public.mb_em_aberto(p_id, v_prox),
      'acumulando', (select jsonb_build_object(
          'total', coalesce(sum(r.valor_diaria + r.valor_entregas), 0), 'dias', count(*))
        from public.mb_registros r where r.motoboy_id = p_id and r.pagamento_id is null and r.data >= v_prox),
      'dias', coalesce((select jsonb_agg(jsonb_build_object('data', r.data, 'turno', r.turno, 'chegada_em', r.chegada_em, 'faixa', r.faixa,
          'valor_diaria', r.valor_diaria, 'valor_entregas', r.valor_entregas) order by r.data desc, r.turno)
        from public.mb_registros r where r.motoboy_id = p_id and r.pagamento_id is null), '[]'::jsonb),
      'ajustes', coalesce((select jsonb_agg(jsonb_build_object('data', a.data, 'valor', a.valor, 'motivo', a.motivo) order by a.data desc)
        from public.mb_ajustes a where a.motoboy_id = p_id and a.pagamento_id is null), '[]'::jsonb),
      'historico', coalesce((select jsonb_agg(jsonb_build_object('data', p.data_pagamento, 'total', p.total, 'diarias', p.diarias,
          'entregas', p.entregas, 'ajustes', p.ajustes) order by p.data_pagamento desc)
        from (select * from public.mb_pagamentos where motoboy_id = p_id order by data_pagamento desc limit 8) p), '[]'::jsonb)
    )
  );
end $$;

create or replace function public.mb_m_assinar_contrato(p_id uuid, p_chave text, p_nome text, p_cpf text, p_ip text, p_ua text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_doc public.mb_documentos; v_cpf text := regexp_replace(coalesce(p_cpf,''), '[^0-9]', '', 'g');
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  select * into v_doc from public.mb_documentos where tipo = 'contrato' and ativo;
  if v_doc.id is null then raise exception 'Nenhum contrato ativo'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 then raise exception 'Digite seu nome completo'; end if;
  if length(v_cpf) <> 11 then raise exception 'CPF deve ter 11 números'; end if;
  insert into public.mb_assinaturas (motoboy_id, documento_id, nome_assinado, cpf_assinado, texto_hash, ip, user_agent)
  values (p_id, v_doc.id, trim(p_nome), v_cpf, encode(extensions.digest(v_doc.texto, 'sha256'), 'hex'), left(p_ip, 100), left(p_ua, 400))
  on conflict (motoboy_id, documento_id) do nothing;
  update public.mb_motoboys set cpf = coalesce(cpf, v_cpf) where id = p_id;
end $$;

-- Motoboy confirma que chegou (com aceite do termo do dia). A diária sai pela faixa de horário.
create or replace function public.mb_m_chegar(p_id uuid, p_chave text, p_turno text, p_aceite boolean, p_ip text, p_ua text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_hoje date := public.mb_hoje(); v_agora timestamptz := now(); v_t public.mb_turnos; v_cfg public.mb_config;
  v_local time := (now() at time zone 'America/Bahia')::time; v_contrato uuid; v_termo uuid; v_esc uuid; v_faixa smallint; v_r public.mb_registros;
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  if not coalesce(p_aceite, false) then raise exception 'Para confirmar, aceite o termo do dia'; end if;
  select * into v_t from public.mb_turnos where codigo = p_turno;
  if v_t.codigo is null then raise exception 'Turno inválido'; end if;
  select * into v_cfg from public.mb_config where id = 'padrao';
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
    origem_chegada, registrado_por, termo_id, termo_aceito_em, ip, user_agent)
  values (v_hoje, p_turno, p_id, v_esc, v_esc is null, v_agora, v_faixa, public.mb_valor_diaria(v_hoje, v_faixa),
    'motoboy', 'motoboy', v_termo, v_agora, left(p_ip, 100), left(p_ua, 400))
  on conflict (data, turno, motoboy_id) do nothing
  returning * into v_r;
  if v_r.id is null then raise exception 'Você já confirmou este turno hoje'; end if;
  return jsonb_build_object('faixa', v_r.faixa, 'valor_diaria', v_r.valor_diaria, 'chegada_em', v_r.chegada_em, 'fora_da_escala', v_r.fora_da_escala);
end $$;

create or replace function public.mb_m_pedir_troca(p_id uuid, p_chave text, p_escala uuid, p_para uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_e public.mb_escala;
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  select * into v_e from public.mb_escala where id = p_escala and motoboy_id = p_id;
  if v_e.id is null then raise exception 'Este turno não é seu'; end if;
  if v_e.data < public.mb_hoje() then raise exception 'Este turno já passou'; end if;
  if exists (select 1 from public.mb_registros r where r.escala_id = v_e.id) then raise exception 'Você já confirmou este turno'; end if;
  if p_para = p_id then raise exception 'Escolha outro colega'; end if;
  if p_para is not null and exists (select 1 from public.mb_escala e where e.data = v_e.data and e.turno = v_e.turno and e.motoboy_id = p_para) then
    raise exception 'Esse colega já está escalado neste turno';
  end if;
  if exists (select 1 from public.mb_trocas x where x.escala_id = v_e.id and x.status in ('aberta','aceita')) then
    raise exception 'Já existe um pedido de troca para este turno';
  end if;
  insert into public.mb_trocas (escala_id, data, turno, de_motoboy, para_motoboy, motivo)
  values (v_e.id, v_e.data, v_e.turno, p_id, p_para, nullif(trim(coalesce(p_motivo,'')), ''));
end $$;

create or replace function public.mb_m_aceitar_troca(p_id uuid, p_chave text, p_troca uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v public.mb_trocas; v_auto boolean;
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  select * into v from public.mb_trocas where id = p_troca for update;
  if v.id is null or v.status <> 'aberta' then raise exception 'Esta troca não está mais disponível'; end if;
  if v.de_motoboy = p_id or (v.para_motoboy is not null and v.para_motoboy <> p_id) then raise exception 'Esta troca não é para você'; end if;
  if exists (select 1 from public.mb_escala e where e.data = v.data and e.turno = v.turno and e.motoboy_id = p_id) then
    raise exception 'Você já está escalado neste turno';
  end if;
  update public.mb_trocas set status = 'aceita', aceita_por = p_id, aceita_em = now() where id = p_troca;
  select troca_automatica into v_auto from public.mb_config where id = 'padrao';
  if v_auto then
    perform public.mb_aplicar_troca(p_troca);
    return 'aprovada';
  end if;
  return 'aceita';
end $$;

create or replace function public.mb_m_cancelar_troca(p_id uuid, p_chave text, p_troca uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  update public.mb_trocas set status = 'cancelada', decidida_em = now()
  where id = p_troca and de_motoboy = p_id and status in ('aberta','aceita');
  if not found then raise exception 'Não foi possível cancelar'; end if;
end $$;

-- ===================== GESTOR DE ROTA (PIN) =====================

create or replace function public.mb_r_dia(p_rota uuid, p_pin text, p_data date) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.mb_rota_ok(p_rota, p_pin) then raise exception 'PIN inválido'; end if;
  return public.mb_dia_json(p_data);
end $$;

-- Visão do dia (usada pelo gestor de rota e pela administração)
create or replace function public.mb_dia_json(p_data date) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'data', p_data,
    'tipo_dia', public.mb_tipo_dia(p_data),
    'feriado', (select f.nome from public.mb_feriados f where f.data = p_data),
    'turnos', coalesce((select jsonb_agg(jsonb_build_object(
      'codigo', t.codigo, 'nome', t.nome, 'setor', t.setor,
      'inicio', to_char(t.inicio, 'HH24:MI'), 'fim', to_char(t.fim, 'HH24:MI'),
      'pessoas', coalesce((select jsonb_agg(x order by x->>'nome') from (
          select jsonb_build_object(
            'motoboy_id', m.id, 'nome', m.nome, 'escalado', e.id is not null,
            'registro', case when r.id is null then null else jsonb_build_object(
              'id', r.id, 'chegada_em', r.chegada_em, 'faixa', r.faixa, 'valor_diaria', r.valor_diaria,
              'valor_entregas', r.valor_entregas, 'origem_chegada', r.origem_chegada, 'fora_da_escala', r.fora_da_escala,
              'entregas_lancadas_por', r.entregas_lancadas_por, 'pago', r.pagamento_id is not null, 'observacao', r.observacao) end
          ) as x
          from public.mb_motoboys m
          left join public.mb_escala e on e.data = p_data and e.turno = t.codigo and e.motoboy_id = m.id
          left join public.mb_registros r on r.data = p_data and r.turno = t.codigo and r.motoboy_id = m.id
          where e.id is not null or r.id is not null) s), '[]'::jsonb),
      'ocorrencias', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'tipo', o.tipo, 'descricao', o.descricao,
          'motoboy', (select m.nome from public.mb_motoboys m where m.id = o.motoboy_id), 'por', o.registrado_por, 'em', o.criado_em) order by o.criado_em)
        from public.mb_ocorrencias o where o.data = p_data and o.turno = t.codigo), '[]'::jsonb)
    ) order by t.ordem) from public.mb_turnos t), '[]'::jsonb),
    'motoboys', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome) order by m.nome)
      from public.mb_motoboys m where m.ativo), '[]'::jsonb)
  ) $$;

-- Gestor de rota registra a chegada de quem não conseguiu confirmar pelo celular
create or replace function public.mb_r_registrar_chegada(p_rota uuid, p_pin text, p_data date, p_turno text, p_motoboy uuid, p_hora time, p_obs text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_chegada timestamptz; v_faixa smallint; v_esc uuid;
begin
  if not public.mb_rota_ok(p_rota, p_pin) then raise exception 'PIN inválido'; end if;
  if p_data > public.mb_hoje() or p_data < public.mb_hoje() - 3 then raise exception 'Só dá para registrar até 3 dias para trás'; end if;
  select nome into v_nome from public.mb_gestores_rota where id = p_rota;
  v_chegada := (p_data + p_hora) at time zone 'America/Bahia';
  v_faixa := public.mb_faixa(p_turno, v_chegada);
  select id into v_esc from public.mb_escala where data = p_data and turno = p_turno and motoboy_id = p_motoboy;
  insert into public.mb_registros (data, turno, motoboy_id, escala_id, fora_da_escala, chegada_em, faixa, valor_diaria,
    origem_chegada, registrado_por, observacao)
  values (p_data, p_turno, p_motoboy, v_esc, v_esc is null, v_chegada, v_faixa, public.mb_valor_diaria(p_data, v_faixa),
    'gestor', 'Rota: ' || v_nome, nullif(trim(coalesce(p_obs,'')), ''))
  on conflict (data, turno, motoboy_id) do nothing;
  if not found then raise exception 'Este motoboy já tem chegada registrada neste turno'; end if;
end $$;

create or replace function public.mb_r_lancar_entregas(p_rota uuid, p_pin text, p_registro uuid, p_valor numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if not public.mb_rota_ok(p_rota, p_pin) then raise exception 'PIN inválido'; end if;
  if p_valor is null or p_valor < 0 or p_valor > 5000 then raise exception 'Valor inválido'; end if;
  select nome into v_nome from public.mb_gestores_rota where id = p_rota;
  update public.mb_registros set valor_entregas = round(p_valor, 2), entregas_lancadas_por = 'Rota: ' || v_nome, entregas_lancadas_em = now()
  where id = p_registro and pagamento_id is null and data >= public.mb_hoje() - 7;
  if not found then raise exception 'Não foi possível lançar (dia já pago ou muito antigo)'; end if;
end $$;

create or replace function public.mb_r_ocorrencia(p_rota uuid, p_pin text, p_data date, p_turno text, p_motoboy uuid, p_tipo text, p_desc text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if not public.mb_rota_ok(p_rota, p_pin) then raise exception 'PIN inválido'; end if;
  select nome into v_nome from public.mb_gestores_rota where id = p_rota;
  insert into public.mb_ocorrencias (data, turno, motoboy_id, tipo, descricao, registrado_por)
  values (p_data, p_turno, p_motoboy, p_tipo, nullif(trim(coalesce(p_desc,'')), ''), 'Rota: ' || v_nome);
end $$;

-- ===================== PERMISSÕES DAS FUNÇÕES =====================
do $$
declare f text;
begin
  -- internas: ninguém chama direto pela API
  foreach f in array array[
    'mb_tipo_dia(date)','mb_faixa(text, timestamptz)','mb_valor_diaria(date, smallint)','mb_bloqueado(text)',
    'mb_motoboy_ok(uuid, text)','mb_rota_ok(uuid, text)','mb_em_aberto(uuid, date)','mb_aplicar_troca(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- administração (usuário logado do painel)
  foreach f in array array[
    'mb_gerar_escala(date, date)','mb_refazer_dia(date)','mb_nova_chave(uuid)','mb_definir_pin_rota(uuid, text)',
    'mb_registrar_pagamento(uuid, date, text)','mb_desfazer_pagamento(uuid)','mb_decidir_troca(uuid, boolean)','mb_dia_json(date)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- motoboy e gestor de rota (conferem chave/PIN dentro da função)
  foreach f in array array[
    'mb_motoboy_entrar(text, text)','mb_rota_lista()','mb_rota_entrar(uuid, text)',
    'mb_m_painel(uuid, text)','mb_m_assinar_contrato(uuid, text, text, text, text, text)','mb_m_chegar(uuid, text, text, boolean, text, text)',
    'mb_m_pedir_troca(uuid, text, uuid, uuid, text)','mb_m_aceitar_troca(uuid, text, uuid)','mb_m_cancelar_troca(uuid, text, uuid)',
    'mb_r_dia(uuid, text, date)','mb_r_registrar_chegada(uuid, text, date, text, uuid, time, text)',
    'mb_r_lancar_entregas(uuid, text, uuid, numeric)','mb_r_ocorrencia(uuid, text, date, text, uuid, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
