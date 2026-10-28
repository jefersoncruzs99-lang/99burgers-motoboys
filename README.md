# 99 Burgers · Motoboys

Escala, trocas, chegada com aceite do termo do dia, lançamento de entregas pelo gestor de rota,
contrato de prestação de serviço e pagamentos (semanal na quarta ou quinzenal nos dias 1 e 16).

Next.js 15 (App Router) + Supabase (mesmo projeto dos outros apps, tabelas com prefixo `mb_`) + Vercel.

## Acessos

| Quem | Onde | Como entra |
|---|---|---|
| Motoboy | `/m` | telefone + chave de 6 números (gerada em Administração → Motoboys) |
| Gestor de rota | `/rota` | escolhe o nome + PIN (cadastrado em Administração → Configurações) |
| Administração | `/admin` | login do painel 99 Burgers (perfil admin ou operator) |

Motoboys e gestores de rota **não acessam as tabelas**: usam funções `mb_m_*` e `mb_r_*` do banco que conferem
a chave/PIN a cada chamada (com bloqueio depois de 8 erros em 15 minutos). Não é usada a service role key.

## Regras

- Turnos: Manhã/Marmitaria 10:30–14:30 e Noite/Hamburgueria 18:00–23:00 (editáveis).
- Diária pela hora de chegada: cheia até 11:00/18:30, 2/3 até 12:00/19:30, depois 1/3.
- Valores: seg–sáb 30/20/10; domingo e feriado 35/23/12 (editáveis). Feriado usa a escala de domingo.
- Pagamento inclui os dias **antes** da data de pagamento.
- O mesmo motoboy nunca fica duplicado no mesmo turno (restrição no banco).
- Trocas: o motoboy pede, o colega aceita; com "troca automática" a escala muda na hora, senão a administração aprova.
- Contrato e termo do dia são versionados; cada aceite guarda nome, CPF, hash do texto, data/hora, IP e navegador.
  **Os textos são rascunho e precisam de revisão de um advogado.**

## Banco

Migrations em `supabase/migrations` (já aplicadas no projeto). Para mudar o banco, crie uma nova migration.

## Variáveis (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Adicione `https://<dominio>/auth/callback` nas Redirect URLs do Supabase Auth (para recuperar senha).
