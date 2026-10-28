-- JÁ APLICADA no Supabase em 2026-10-28.
-- Ranking e incentivos valem para TODOS os motoboys ativos. Falta e atraso são só registro (0 ponto).
-- O aceite do regulamento registra a ciência das regras e autoriza a foto no ranking (sem aceite: aparecem as iniciais).
-- Fotos, quantidade de entregas, intercorrências com pontos (ciência e contestação pelo motoboy),
-- ranking (Boy do Mês / Boy do Ano), incentivos apurados automaticamente como ajustes (bônus)
-- e regulamento do programa com aceite eletrônico.

-- ===================== CONFIG / CAMPOS NOVOS =====================
alter table public.mb_config add column if not exists pontos_por_entrega integer not null default 1 check (pontos_por_entrega between 0 and 100);
alter table public.mb_config add column if not exists prazo_contestacao_dias integer not null default 7 check (prazo_contestacao_dias between 1 and 60);

alter table public.mb_motoboys add column if not exists foto_url text;
alter table public.mb_registros add column if not exists qtd_entregas integer not null default 0 check (qtd_entregas between 0 and 300);

alter table public.mb_documentos drop constraint if exists mb_documentos_tipo_check;
alter table public.mb_documentos add constraint mb_documentos_tipo_check check (tipo in ('contrato','termo_diario','regulamento'));

-- ===================== TIPOS DE INTERCORRÊNCIA =====================
create table if not exists public.mb_tipos_ocorrencia (
  codigo text primary key check (codigo ~ '^[a-z0-9_]{2,40}$'),
  nome text not null,
  pontos integer not null default 0 check (pontos between -100 and 100),
  grupo text not null default 'negativa' check (grupo in ('negativa','positiva','registro')),
  ativo boolean not null default true,
  ordem integer not null default 100
);
alter table public.mb_tipos_ocorrencia enable row level security;
drop policy if exists mb_tipos_ocorrencia_auth_all on public.mb_tipos_ocorrencia;
create policy mb_tipos_ocorrencia_auth_all on public.mb_tipos_ocorrencia for all to authenticated using (true) with check (true);

insert into public.mb_tipos_ocorrencia (codigo, nome, pontos, grupo, ordem) values
  ('esqueceu_bebida',      'Esqueceu bebida ou item do pedido',  -10, 'negativa', 10),
  ('trocou_pedido',        'Trocou pedidos',                     -10, 'negativa', 20),
  ('esqueceu_maquina',     'Esqueceu a maquininha',              -10, 'negativa', 30),
  ('pedido_danificado',    'Pedido derramado ou danificado',     -10, 'negativa', 40),
  ('endereco_errado',      'Entregou no endereço errado',        -10, 'negativa', 50),
  ('diferenca_dinheiro',   'Diferença no dinheiro recebido',     -10, 'negativa', 60),
  ('reclamacao_cliente',   'Reclamação de atendimento do cliente', -15, 'negativa', 70),
  ('demora_reclamada',     'Cliente reclamou de demora',          -5, 'negativa', 80),
  ('saiu_sem_troco',       'Saiu sem troco',                      -5, 'negativa', 90),
  ('nao_conferiu',         'Não conferiu o pedido na saída',      -5, 'negativa', 100),
  ('bag_suja',             'Bag sem higiene',                     -5, 'negativa', 110),
  ('elogio_cliente',       'Elogio de cliente',                   10, 'positiva', 200),
  ('ajudou_pico',          'Ajudou no pico / pegou rota extra',    5, 'positiva', 210),
  ('falta',                'Falta (só registro)',                  0, 'registro', 300),
  ('atraso',               'Atraso (só registro)',                 0, 'registro', 310),
  ('problema',             'Problema na rota (moto, pneu, acidente)', 0, 'registro', 320),
  ('outro',                'Outro',                                0, 'registro', 330)
on conflict (codigo) do nothing;

alter table public.mb_ocorrencias drop constraint if exists mb_ocorrencias_tipo_check;
alter table public.mb_ocorrencias drop constraint if exists mb_ocorrencias_tipo_fk;
alter table public.mb_ocorrencias add constraint mb_ocorrencias_tipo_fk foreign key (tipo) references public.mb_tipos_ocorrencia(codigo) on update cascade;
alter table public.mb_ocorrencias add column if not exists pontos integer not null default 0;
alter table public.mb_ocorrencias add column if not exists status text not null default 'valida' check (status in ('valida','contestada','anulada'));
alter table public.mb_ocorrencias add column if not exists ciente_em timestamptz;
alter table public.mb_ocorrencias add column if not exists ciente_ip text;
alter table public.mb_ocorrencias add column if not exists ciente_ua text;
alter table public.mb_ocorrencias add column if not exists contestacao text;
alter table public.mb_ocorrencias add column if not exists contestada_em timestamptz;
alter table public.mb_ocorrencias add column if not exists decisao text;
alter table public.mb_ocorrencias add column if not exists decidida_em timestamptz;
alter table public.mb_ocorrencias add column if not exists decidida_por uuid references auth.users(id) on delete set null;
create index if not exists idx_mb_ocorrencias_motoboy on public.mb_ocorrencias(motoboy_id, data);

-- Os pontos ficam gravados no momento do registro (mudar a tabela depois não altera o passado)
create or replace function public.mb_ocorrencia_pontos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select t.pontos into new.pontos from public.mb_tipos_ocorrencia t where t.codigo = new.tipo;
  if new.pontos is null then raise exception 'Tipo de intercorrência inválido'; end if;
  if new.pontos <> 0 and new.motoboy_id is null then raise exception 'Escolha o motoboy desta intercorrência'; end if;
  return new;
end $$;
drop trigger if exists trg_mb_ocorrencia_pontos on public.mb_ocorrencias;
create trigger trg_mb_ocorrencia_pontos before insert on public.mb_ocorrencias for each row execute function public.mb_ocorrencia_pontos();

-- ===================== INCENTIVOS =====================
create table if not exists public.mb_incentivos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  tipo text not null check (tipo in ('a_cada_entregas','meta_entregas_mes','mes_sem_negativas','top_mes','top_ano')),
  quantidade integer check (quantidade is null or quantidade > 0),  -- entregas (a cada / meta) ou mínimo de turnos (mês sem negativas)
  posicao integer check (posicao is null or posicao between 1 and 10), -- top_mes / top_ano
  valor numeric(10,2) not null check (valor > 0),
  inicio date not null default (now() at time zone 'America/Bahia')::date, -- conta a partir desta data
  ativo boolean not null default false,
  ordem integer not null default 100,
  criado_em timestamptz not null default now(),
  check (case when tipo in ('top_mes','top_ano') then posicao is not null else quantidade is not null end)
);

create table if not exists public.mb_incentivos_ganhos (
  id uuid primary key default gen_random_uuid(),
  incentivo_id uuid not null references public.mb_incentivos(id) on delete cascade,
  motoboy_id uuid not null references public.mb_motoboys(id) on delete cascade,
  referencia text not null,                 -- marco-3, 2026-10, 2026...
  valor numeric(10,2) not null,
  descricao text not null,
  ajuste_id uuid references public.mb_ajustes(id) on delete set null, -- apagar o ajuste cancela o prêmio (não é recriado)
  criado_em timestamptz not null default now(),
  unique (incentivo_id, motoboy_id, referencia)
);

do $$
declare t text;
begin
  foreach t in array array['mb_incentivos','mb_incentivos_ganhos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_auth_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_auth_all', t);
  end loop;
end $$;

insert into public.mb_incentivos (nome, descricao, tipo, quantidade, posicao, valor, ativo, ordem)
select * from (values
  ('A cada 100 entregas', 'A cada 100 entregas feitas você ganha R$ 50 de bônus.', 'a_cada_entregas', 100, null::int, 50.00, true, 10),
  ('Meta do mês', 'Fez 300 entregas no mês? Ganha R$ 100 de bônus.', 'meta_entregas_mes', 300, null::int, 100.00, false, 20),
  ('Mês nota 10', 'Mês sem nenhuma intercorrência negativa (mínimo de 12 turnos): R$ 40.', 'mes_sem_negativas', 12, null::int, 40.00, false, 30),
  ('Boy do Mês', '1º lugar do ranking do mês.', 'top_mes', null::int, 1, 100.00, false, 40),
  ('Vice do Mês', '2º lugar do ranking do mês.', 'top_mes', null::int, 2, 50.00, false, 50),
  ('Boy do Ano', '1º lugar do ranking do ano.', 'top_ano', null::int, 1, 1000.00, false, 60)
) v(nome, descricao, tipo, quantidade, posicao, valor, ativo, ordem)
where not exists (select 1 from public.mb_incentivos);

-- ===================== REGULAMENTO =====================
insert into public.mb_documentos (tipo, versao, titulo, texto)
select 'regulamento', 1, 'Regulamento do Ranking e dos Incentivos', $txt$
REGULAMENTO DO RANKING E DO PROGRAMA DE INCENTIVOS — 99BURGER'S LTDA (CNPJ 40.161.847/0001-72)

1. ABRANGÊNCIA
1.1. O ranking e os incentivos valem para todos os prestadores de serviço de entrega ativos da CONTRATANTE, de forma igual para todos.
1.2. Este regulamento complementa o contrato de prestação de serviços autônomos e não cria vínculo de emprego. O aceite no aplicativo registra que o prestador conhece estas regras.

2. PONTUAÇÃO
2.1. Cada entrega realizada vale pontos conforme a tabela vigente no aplicativo (inicialmente 1 ponto por entrega).
2.2. Intercorrências registradas pelo gestor de rota ou pela administração somam ou descontam pontos conforme a tabela de intercorrências vigente no aplicativo (por exemplo: esquecer bebida, trocar pedidos ou esquecer a maquininha descontam 10 pontos; elogio de cliente soma 10 pontos).
2.3. Os pontos servem apenas para o ranking e para os incentivos. Pontos negativos NUNCA geram desconto em dinheiro, multa, suspensão ou retirada de períodos.
2.4. Faltas e atrasos não descontam pontos: ficam apenas registrados, porque o prestador é livre para escolher os períodos em que se disponibiliza.
2.5. Alterações na tabela de pontos valem apenas para registros feitos depois da alteração.

3. CIÊNCIA E CONTESTAÇÃO
3.1. Toda intercorrência fica visível para o prestador no aplicativo, com data, tipo e detalhes.
3.2. O prestador pode marcar "Estou ciente" ou contestar, escrevendo sua versão, no prazo indicado no aplicativo (inicialmente 7 dias). A administração analisa e pode manter ou anular a intercorrência, registrando a decisão.
3.3. A data, a hora, o endereço IP e o aparelho usados na ciência ou na contestação ficam registrados.

4. RANKING
4.1. O ranking é mensal (Boy do Mês) e anual (Boy do Ano). Os prestadores veem nome, foto e pontuação total dos colegas; os detalhes das intercorrências de cada um são vistos só pelo próprio prestador e pela administração.
4.2. Em caso de empate, fica na frente quem tiver mais entregas.

5. INCENTIVOS
5.1. Os incentivos ativos, suas metas e valores ficam descritos no aplicativo. São prêmios por desempenho, pagos como bônus junto com o pagamento seguinte, e podem ser criados, alterados ou encerrados pela CONTRATANTE com aviso no aplicativo, sem afetar prêmios já conquistados.
5.2. Prêmios de metas mensais e de ranking são apurados depois do fechamento do mês (ou do ano).

6. USO DA IMAGEM
6.1. Ao aceitar, o prestador autoriza o uso da sua foto dentro do aplicativo e em telas internas da loja, exclusivamente para o ranking. Sem o aceite, o ranking mostra apenas o nome e as iniciais. A autorização pode ser revogada a qualquer momento, pedindo à administração a retirada da foto.

7. ACEITE ELETRÔNICO
7.1. O aceite deste regulamento no aplicativo, com nome, CPF, data, hora, endereço IP e aparelho registrados, tem validade de assinatura eletrônica (MP 2.200-2/2001, art. 10, § 2º, e Lei 14.063/2020).
$txt$
where not exists (select 1 from public.mb_documentos where tipo = 'regulamento');

-- ===================== FOTOS (Storage) =====================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mb-fotos', 'mb-fotos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists mb_fotos_insert on storage.objects;
drop policy if exists mb_fotos_update on storage.objects;
drop policy if exists mb_fotos_delete on storage.objects;
create policy mb_fotos_insert on storage.objects for insert to authenticated with check (bucket_id = 'mb-fotos');
create policy mb_fotos_update on storage.objects for update to authenticated using (bucket_id = 'mb-fotos');
create policy mb_fotos_delete on storage.objects for delete to authenticated using (bucket_id = 'mb-fotos');

-- ===================== RANKING =====================

-- Aceitou o regulamento vigente (ciência das regras + autorização da foto)
create or replace function public.mb_participa(p_motoboy uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.mb_documentos d where d.tipo = 'regulamento' and d.ativo)
      or exists (select 1 from public.mb_assinaturas a join public.mb_documentos d on d.id = a.documento_id
                 where d.tipo = 'regulamento' and d.ativo and a.motoboy_id = p_motoboy) $$;

-- Período: mes, mes_anterior, ano, ano_anterior
create or replace function public.mb_periodo(p_periodo text, p_ref date) returns daterange
language sql stable set search_path = '' as $$
  select case p_periodo
    when 'mes_anterior' then daterange((date_trunc('month', p_ref) - interval '1 month')::date, date_trunc('month', p_ref)::date)
    when 'ano' then daterange(date_trunc('year', p_ref)::date, (date_trunc('year', p_ref) + interval '1 year')::date)
    when 'ano_anterior' then daterange((date_trunc('year', p_ref) - interval '1 year')::date, date_trunc('year', p_ref)::date)
    else daterange(date_trunc('month', p_ref)::date, (date_trunc('month', p_ref) + interval '1 month')::date)
  end $$;

-- Ranking de um período (fim exclusive)
create or replace function public.mb_ranking_int(p_inicio date, p_fim date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with base as (
    select m.id, m.nome, case when public.mb_participa(m.id) then m.foto_url end as foto_url,
      coalesce((select sum(r.qtd_entregas) from public.mb_registros r where r.motoboy_id = m.id and r.data >= p_inicio and r.data < p_fim), 0)::int as entregas,
      (select count(*) from public.mb_registros r where r.motoboy_id = m.id and r.data >= p_inicio and r.data < p_fim)::int as turnos,
      coalesce((select sum(o.pontos) from public.mb_ocorrencias o where o.motoboy_id = m.id and o.status <> 'anulada'
                and o.data >= p_inicio and o.data < p_fim), 0)::int as pontos_ocorrencias
    from public.mb_motoboys m
    where m.ativo
  ), calc as (
    select b.*, b.entregas * coalesce((select c.pontos_por_entrega from public.mb_config c where c.id = 'padrao'), 1) + b.pontos_ocorrencias as pontos
    from base b where b.turnos > 0 or b.pontos_ocorrencias <> 0
  )
  select coalesce(jsonb_agg(jsonb_build_object('pos', x.pos, 'motoboy_id', x.id, 'nome', x.nome, 'foto_url', x.foto_url,
      'entregas', x.entregas, 'turnos', x.turnos, 'pontos_ocorrencias', x.pontos_ocorrencias, 'pontos', x.pontos) order by x.pos, x.nome), '[]'::jsonb)
  from (select c.*, rank() over (order by c.pontos desc, c.entregas desc) as pos from calc c) x $$;

-- Nome curto para o ranking dos colegas: "Fred S."
create or replace function public.mb_nome_curto(p_nome text) returns text
language sql immutable set search_path = '' as $$
  select case when array_length(regexp_split_to_array(trim(p_nome), '\s+'), 1) > 1
    then split_part(trim(p_nome), ' ', 1) || ' ' || left((regexp_split_to_array(trim(p_nome), '\s+'))[array_length(regexp_split_to_array(trim(p_nome), '\s+'), 1)], 1) || '.'
    else trim(p_nome) end $$;

create or replace function public.mb_ranking_json(p_periodo text, p_curto boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_hoje date := public.mb_hoje(); v_r daterange; v_ant daterange; v_lista jsonb; v_campeao jsonb;
begin
  v_r := public.mb_periodo(p_periodo, v_hoje);
  v_ant := case when p_periodo like 'ano%' then public.mb_periodo('ano_anterior', lower(v_r)) else public.mb_periodo('mes_anterior', lower(v_r)) end;
  v_lista := public.mb_ranking_int(lower(v_r), upper(v_r));
  v_campeao := public.mb_ranking_int(lower(v_ant), upper(v_ant)) -> 0;
  if p_curto then
    select coalesce(jsonb_agg(((x || jsonb_build_object('nome', public.mb_nome_curto(x->>'nome'))) - 'pontos_ocorrencias') - 'turnos'), '[]'::jsonb)
      into v_lista from jsonb_array_elements(v_lista) x;
    if v_campeao is not null then
      v_campeao := ((v_campeao || jsonb_build_object('nome', public.mb_nome_curto(v_campeao->>'nome'))) - 'pontos_ocorrencias') - 'turnos';
    end if;
  end if;
  return jsonb_build_object('periodo', p_periodo, 'inicio', lower(v_r), 'fim', upper(v_r) - 1, 'ranking', v_lista,
    'campeao_anterior', v_campeao, 'inicio_anterior', lower(v_ant), 'fim_anterior', upper(v_ant) - 1);
end $$;

-- ===================== APURAÇÃO DE INCENTIVOS =====================
create or replace function public.mb_conceder(p_inc uuid, p_motoboy uuid, p_ref text, p_desc text) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_aj uuid; v_valor numeric;
begin
  select valor into v_valor from public.mb_incentivos where id = p_inc;
  insert into public.mb_incentivos_ganhos (incentivo_id, motoboy_id, referencia, valor, descricao)
  values (p_inc, p_motoboy, p_ref, v_valor, p_desc)
  on conflict (incentivo_id, motoboy_id, referencia) do nothing
  returning id into v_id;
  if v_id is null then return 0; end if;
  insert into public.mb_ajustes (motoboy_id, data, valor, motivo)
  values (p_motoboy, public.mb_hoje(), v_valor, 'Incentivo: ' || p_desc)
  returning id into v_aj;
  update public.mb_incentivos_ganhos set ajuste_id = v_aj where id = v_id;
  return 1;
end $$;

create or replace function public.mb_apurar_int(p_motoboy uuid default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_inc public.mb_incentivos; v_m record; v_hoje date := public.mb_hoje(); v_n integer := 0;
  v_total integer; k integer; v_mes date; v_fim date; v_ano integer; v_qtd integer; v_item jsonb;
begin
  for v_inc in select * from public.mb_incentivos where ativo order by ordem loop
    if v_inc.tipo = 'a_cada_entregas' then
      for v_m in select m.id from public.mb_motoboys m where m.ativo and (p_motoboy is null or m.id = p_motoboy) loop
        select coalesce(sum(r.qtd_entregas), 0) into v_total from public.mb_registros r where r.motoboy_id = v_m.id and r.data >= v_inc.inicio;
        k := 1;
        while k <= v_total / v_inc.quantidade loop
          v_n := v_n + public.mb_conceder(v_inc.id, v_m.id, 'marco-' || k, format('%s (%s entregas)', v_inc.nome, k * v_inc.quantidade));
          k := k + 1;
        end loop;
      end loop;

    elsif v_inc.tipo in ('meta_entregas_mes', 'mes_sem_negativas', 'top_mes') then
      v_mes := date_trunc('month', v_inc.inicio)::date;
      while v_mes < date_trunc('month', v_hoje)::date loop   -- só meses fechados
        v_fim := (v_mes + interval '1 month')::date;
        if v_inc.tipo = 'top_mes' then
          for v_item in select * from jsonb_array_elements(public.mb_ranking_int(v_mes, v_fim)) loop
            if (v_item->>'pos')::int = v_inc.posicao and (v_item->>'pontos')::int > 0
               and (p_motoboy is null or (v_item->>'motoboy_id')::uuid = p_motoboy) then
              v_n := v_n + public.mb_conceder(v_inc.id, (v_item->>'motoboy_id')::uuid, to_char(v_mes, 'YYYY-MM'),
                format('%s %s', v_inc.nome, to_char(v_mes, 'MM/YYYY')));
            end if;
          end loop;
        else
          for v_m in select m.id from public.mb_motoboys m where m.ativo and (p_motoboy is null or m.id = p_motoboy) loop
            if v_inc.tipo = 'meta_entregas_mes' then
              select coalesce(sum(r.qtd_entregas), 0) into v_qtd from public.mb_registros r
              where r.motoboy_id = v_m.id and r.data >= greatest(v_mes, v_inc.inicio) and r.data < v_fim;
              if v_qtd >= v_inc.quantidade then
                v_n := v_n + public.mb_conceder(v_inc.id, v_m.id, to_char(v_mes, 'YYYY-MM'),
                  format('%s %s (%s entregas)', v_inc.nome, to_char(v_mes, 'MM/YYYY'), v_qtd));
              end if;
            else
              select count(*) into v_qtd from public.mb_registros r where r.motoboy_id = v_m.id and r.data >= v_mes and r.data < v_fim;
              if v_qtd >= v_inc.quantidade and not exists (
                select 1 from public.mb_ocorrencias o where o.motoboy_id = v_m.id and o.pontos < 0 and o.status <> 'anulada'
                  and o.data >= v_mes and o.data < v_fim) then
                v_n := v_n + public.mb_conceder(v_inc.id, v_m.id, to_char(v_mes, 'YYYY-MM'), format('%s %s', v_inc.nome, to_char(v_mes, 'MM/YYYY')));
              end if;
            end if;
          end loop;
        end if;
        v_mes := v_fim;
      end loop;

    elsif v_inc.tipo = 'top_ano' then
      v_ano := extract(year from v_inc.inicio)::int;
      while v_ano < extract(year from v_hoje)::int loop   -- só anos fechados
        for v_item in select * from jsonb_array_elements(public.mb_ranking_int(make_date(v_ano, 1, 1), make_date(v_ano + 1, 1, 1))) loop
          if (v_item->>'pos')::int = v_inc.posicao and (v_item->>'pontos')::int > 0
             and (p_motoboy is null or (v_item->>'motoboy_id')::uuid = p_motoboy) then
            v_n := v_n + public.mb_conceder(v_inc.id, (v_item->>'motoboy_id')::uuid, v_ano::text, format('%s %s', v_inc.nome, v_ano));
          end if;
        end loop;
        v_ano := v_ano + 1;
      end loop;
    end if;
  end loop;
  return v_n;
end $$;

-- Progresso do motoboy em cada incentivo ativo
create or replace function public.mb_progresso_incentivos(p_motoboy uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_inc public.mb_incentivos; v_hoje date := public.mb_hoje(); v_out jsonb := '[]'::jsonb; v_atual integer; v_meta integer;
  v_mes date := date_trunc('month', public.mb_hoje())::date; v_txt text; v_pos integer; v_neg boolean;
begin
  for v_inc in select * from public.mb_incentivos where ativo order by ordem loop
    v_atual := null; v_meta := null; v_txt := null;
    if v_inc.tipo = 'a_cada_entregas' then
      select coalesce(sum(qtd_entregas), 0) into v_atual from public.mb_registros where motoboy_id = p_motoboy and data >= v_inc.inicio;
      v_meta := v_inc.quantidade;
      v_txt := format('Faltam %s entregas para o próximo prêmio', v_meta - (v_atual % v_meta));
      v_atual := v_atual % v_meta;
    elsif v_inc.tipo = 'meta_entregas_mes' then
      select coalesce(sum(qtd_entregas), 0) into v_atual from public.mb_registros
      where motoboy_id = p_motoboy and data >= greatest(v_mes, v_inc.inicio);
      v_meta := v_inc.quantidade;
      v_txt := case when v_atual >= v_meta then 'Meta batida! O prêmio sai depois do fechamento do mês'
                    else format('Faltam %s entregas este mês', v_meta - v_atual) end;
    elsif v_inc.tipo = 'mes_sem_negativas' then
      select count(*) into v_atual from public.mb_registros where motoboy_id = p_motoboy and data >= v_mes;
      v_meta := v_inc.quantidade;
      v_neg := exists (select 1 from public.mb_ocorrencias o where o.motoboy_id = p_motoboy and o.pontos < 0 and o.status <> 'anulada' and o.data >= v_mes);
      v_txt := case when v_neg then 'Este mês já teve intercorrência negativa. Mês que vem tem mais!'
                    when v_atual >= v_meta then 'Tudo certo até agora: siga sem intercorrências'
                    else format('%s de %s turnos, sem intercorrências', v_atual, v_meta) end;
      if v_neg then v_atual := 0; end if;
    else
      select (x->>'pos')::int into v_pos from jsonb_array_elements(public.mb_ranking_int(
        case when v_inc.tipo = 'top_ano' then date_trunc('year', v_hoje)::date else v_mes end,
        case when v_inc.tipo = 'top_ano' then (date_trunc('year', v_hoje) + interval '1 year')::date else (v_mes + interval '1 month')::date end)) x
      where (x->>'motoboy_id')::uuid = p_motoboy;
      v_txt := case when v_pos is null then 'Faça entregas para entrar no ranking'
                    when v_pos <= v_inc.posicao then format('Você está em %sº. Segura a posição!', v_pos)
                    else format('Você está em %sº. Precisa chegar em %sº', v_pos, v_inc.posicao) end;
    end if;
    v_out := v_out || jsonb_build_object('id', v_inc.id, 'nome', v_inc.nome, 'descricao', v_inc.descricao, 'tipo', v_inc.tipo,
      'valor', v_inc.valor, 'atual', v_atual, 'meta', v_meta, 'texto', v_txt);
  end loop;
  return v_out;
end $$;

-- ===================== MOTOBOY =====================

-- Dados extras do app do motoboy: foto, regulamento, intercorrências, incentivos e ranking do mês
create or replace function public.mb_m_extra(p_id uuid, p_chave text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_reg public.mb_documentos; v_m public.mb_motoboys; v_cfg public.mb_config; v_participa boolean; v_eu jsonb;
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  select * into v_m from public.mb_motoboys where id = p_id;
  select * into v_cfg from public.mb_config where id = 'padrao';
  select * into v_reg from public.mb_documentos where tipo = 'regulamento' and ativo;
  v_participa := public.mb_participa(p_id);
  perform public.mb_apurar_int(p_id);
  select x into v_eu from jsonb_array_elements(public.mb_ranking_int(date_trunc('month', public.mb_hoje())::date,
    (date_trunc('month', public.mb_hoje()) + interval '1 month')::date)) x where (x->>'motoboy_id')::uuid = p_id;
  return jsonb_build_object(
    'foto_url', v_m.foto_url,
    'participa', v_participa,
    'prazo_contestacao_dias', v_cfg.prazo_contestacao_dias,
    'regulamento', case when v_reg.id is null then null else jsonb_build_object('id', v_reg.id, 'versao', v_reg.versao, 'titulo', v_reg.titulo,
      'texto', v_reg.texto, 'aceito_em', (select a.assinado_em from public.mb_assinaturas a where a.motoboy_id = p_id and a.documento_id = v_reg.id)) end,
    'mes', (coalesce(v_eu, '{}'::jsonb) - 'nome') - 'foto_url',
    'ocorrencias', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'data', o.data, 'turno', o.turno, 'tipo', o.tipo,
        'tipo_nome', t.nome, 'pontos', o.pontos, 'descricao', o.descricao, 'status', o.status, 'ciente_em', o.ciente_em,
        'contestacao', o.contestacao, 'decisao', o.decisao, 'criado_em', o.criado_em,
        'pode_contestar', o.contestacao is null and o.status = 'valida' and o.pontos < 0
          and o.criado_em > now() - make_interval(days => v_cfg.prazo_contestacao_dias)) order by o.criado_em desc)
      from public.mb_ocorrencias o join public.mb_tipos_ocorrencia t on t.codigo = o.tipo
      where o.motoboy_id = p_id and o.data >= public.mb_hoje() - 90), '[]'::jsonb),
    'incentivos', public.mb_progresso_incentivos(p_id),
    'ganhos', coalesce((select jsonb_agg(jsonb_build_object('descricao', g.descricao, 'valor', g.valor, 'criado_em', g.criado_em,
        'cancelado', g.ajuste_id is null) order by g.criado_em desc)
      from (select * from public.mb_incentivos_ganhos where motoboy_id = p_id order by criado_em desc limit 20) g), '[]'::jsonb)
  );
end $$;

create or replace function public.mb_m_ranking(p_id uuid, p_chave text, p_periodo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  return public.mb_ranking_json(case when p_periodo in ('mes','ano','mes_anterior','ano_anterior') then p_periodo else 'mes' end, true)
    || jsonb_build_object('eu', p_id, 'participa', public.mb_participa(p_id));
end $$;

-- Aceite de documento (regulamento ou contrato) com nome, CPF, hash do texto, IP e aparelho
create or replace function public.mb_m_aceitar_documento(p_id uuid, p_chave text, p_tipo text, p_nome text, p_cpf text, p_ip text, p_ua text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_doc public.mb_documentos; v_cpf text := regexp_replace(coalesce(p_cpf,''), '[^0-9]', '', 'g');
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  if p_tipo not in ('contrato','regulamento') then raise exception 'Documento inválido'; end if;
  select * into v_doc from public.mb_documentos where tipo = p_tipo and ativo;
  if v_doc.id is null then raise exception 'Documento não encontrado'; end if;
  if length(trim(coalesce(p_nome,''))) < 5 then raise exception 'Digite seu nome completo'; end if;
  if length(v_cpf) <> 11 then raise exception 'CPF deve ter 11 números'; end if;
  insert into public.mb_assinaturas (motoboy_id, documento_id, nome_assinado, cpf_assinado, texto_hash, ip, user_agent)
  values (p_id, v_doc.id, trim(p_nome), v_cpf, encode(extensions.digest(v_doc.texto, 'sha256'), 'hex'), left(p_ip, 100), left(p_ua, 400))
  on conflict (motoboy_id, documento_id) do nothing;
  update public.mb_motoboys set cpf = coalesce(cpf, v_cpf) where id = p_id;
end $$;

-- Ciência (e contestação opcional) de uma intercorrência
create or replace function public.mb_m_ocorrencia_ciente(p_id uuid, p_chave text, p_ocorrencia uuid, p_contestacao text, p_ip text, p_ua text) returns text
language plpgsql security definer set search_path = '' as $$
declare v public.mb_ocorrencias; v_prazo integer; v_txt text := nullif(trim(coalesce(p_contestacao, '')), '');
begin
  if not public.mb_motoboy_ok(p_id, p_chave) then raise exception 'Chave inválida'; end if;
  select * into v from public.mb_ocorrencias where id = p_ocorrencia and motoboy_id = p_id for update;
  if v.id is null then raise exception 'Intercorrência não encontrada'; end if;
  update public.mb_ocorrencias set ciente_em = coalesce(ciente_em, now()), ciente_ip = coalesce(ciente_ip, left(p_ip, 100)),
    ciente_ua = coalesce(ciente_ua, left(p_ua, 400)) where id = v.id;
  if v_txt is null then return 'ciente'; end if;
  select prazo_contestacao_dias into v_prazo from public.mb_config where id = 'padrao';
  if v.contestacao is not null then raise exception 'Você já contestou esta intercorrência'; end if;
  if v.status <> 'valida' then raise exception 'Esta intercorrência já foi analisada'; end if;
  if v.criado_em < now() - make_interval(days => v_prazo) then raise exception 'O prazo de % dias para contestar já passou', v_prazo; end if;
  update public.mb_ocorrencias set contestacao = left(v_txt, 1000), contestada_em = now(), status = 'contestada' where id = v.id;
  return 'contestada';
end $$;

-- ===================== GESTOR DE ROTA / ADMIN: ENTREGAS COM QUANTIDADE =====================
drop function if exists public.mb_r_lancar_entregas(uuid, text, uuid, numeric);
create or replace function public.mb_r_lancar_entregas(p_rota uuid, p_pin text, p_registro uuid, p_valor numeric, p_qtd integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if not public.mb_rota_ok(p_rota, p_pin) then raise exception 'PIN inválido'; end if;
  if p_valor is null or p_valor < 0 or p_valor > 5000 then raise exception 'Valor inválido'; end if;
  if p_qtd is null or p_qtd < 0 or p_qtd > 300 then raise exception 'Quantidade de entregas inválida'; end if;
  select nome into v_nome from public.mb_gestores_rota where id = p_rota;
  update public.mb_registros set valor_entregas = round(p_valor, 2), qtd_entregas = p_qtd,
    entregas_lancadas_por = 'Rota: ' || v_nome, entregas_lancadas_em = now()
  where id = p_registro and pagamento_id is null and data >= public.mb_hoje() - 7;
  if not found then raise exception 'Não foi possível lançar (dia já pago ou muito antigo)'; end if;
end $$;

drop function if exists public.mb_a_lancar_entregas(uuid, numeric);
create or replace function public.mb_a_lancar_entregas(p_registro uuid, p_valor numeric, p_qtd integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_por text;
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  if p_valor is null or p_valor < 0 or p_valor > 5000 then raise exception 'Valor inválido'; end if;
  if p_qtd is null or p_qtd < 0 or p_qtd > 300 then raise exception 'Quantidade de entregas inválida'; end if;
  select coalesce(p.display_name, 'Administração') into v_por from public.profiles p where p.id = auth.uid();
  update public.mb_registros set valor_entregas = round(p_valor, 2), qtd_entregas = p_qtd,
    entregas_lancadas_por = 'Adm: ' || coalesce(v_por, 'Administração'), entregas_lancadas_em = now()
  where id = p_registro and pagamento_id is null;
  if not found then raise exception 'Não foi possível lançar (dia já pago)'; end if;
end $$;

-- Visão do dia com quantidade de entregas, foto e intercorrências com pontos
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
            'motoboy_id', m.id, 'nome', m.nome, 'foto_url', m.foto_url, 'escalado', e.id is not null,
            'registro', case when r.id is null then null else jsonb_build_object(
              'id', r.id, 'chegada_em', r.chegada_em, 'faixa', r.faixa, 'valor_diaria', r.valor_diaria,
              'valor_entregas', r.valor_entregas, 'qtd_entregas', r.qtd_entregas, 'origem_chegada', r.origem_chegada,
              'fora_da_escala', r.fora_da_escala, 'entregas_lancadas_por', r.entregas_lancadas_por,
              'pago', r.pagamento_id is not null, 'observacao', r.observacao) end
          ) as x
          from public.mb_motoboys m
          left join public.mb_escala e on e.data = p_data and e.turno = t.codigo and e.motoboy_id = m.id
          left join public.mb_registros r on r.data = p_data and r.turno = t.codigo and r.motoboy_id = m.id
          where e.id is not null or r.id is not null) s), '[]'::jsonb),
      'ocorrencias', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'tipo', o.tipo, 'tipo_nome', tp.nome, 'pontos', o.pontos,
          'status', o.status, 'descricao', o.descricao, 'ciente_em', o.ciente_em, 'contestacao', o.contestacao,
          'motoboy', (select m.nome from public.mb_motoboys m where m.id = o.motoboy_id), 'por', o.registrado_por, 'em', o.criado_em) order by o.criado_em)
        from public.mb_ocorrencias o join public.mb_tipos_ocorrencia tp on tp.codigo = o.tipo
        where o.data = p_data and o.turno = t.codigo), '[]'::jsonb)
    ) order by t.ordem) from public.mb_turnos t), '[]'::jsonb),
    'motoboys', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome) order by m.nome)
      from public.mb_motoboys m where m.ativo), '[]'::jsonb),
    'tipos_ocorrencia', coalesce((select jsonb_agg(jsonb_build_object('codigo', t.codigo, 'nome', t.nome, 'pontos', t.pontos, 'grupo', t.grupo)
      order by t.ordem, t.nome) from public.mb_tipos_ocorrencia t where t.ativo), '[]'::jsonb)
  ) $$;

-- ===================== ADMIN =====================
create or replace function public.mb_a_ranking(p_periodo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  return public.mb_ranking_json(case when p_periodo in ('mes','ano','mes_anterior','ano_anterior') then p_periodo else 'mes' end, false);
end $$;

create or replace function public.mb_a_apurar_incentivos() returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  return public.mb_apurar_int(null);
end $$;

create or replace function public.mb_a_progresso(p_motoboy uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sem permissão'; end if;
  return public.mb_progresso_incentivos(p_motoboy);
end $$;

-- ===================== PERMISSÕES =====================
do $$
declare f text;
begin
  foreach f in array array[
    'mb_ocorrencia_pontos()','mb_participa(uuid)','mb_ranking_int(date, date)','mb_ranking_json(text, boolean)',
    'mb_conceder(uuid, uuid, text, text)','mb_apurar_int(uuid)','mb_progresso_incentivos(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'mb_a_lancar_entregas(uuid, numeric, integer)','mb_a_ranking(text)','mb_a_apurar_incentivos()','mb_a_progresso(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'mb_m_extra(uuid, text)','mb_m_ranking(uuid, text, text)','mb_m_aceitar_documento(uuid, text, text, text, text, text, text)',
    'mb_m_ocorrencia_ciente(uuid, text, uuid, text, text, text)','mb_r_lancar_entregas(uuid, text, uuid, numeric, integer)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
