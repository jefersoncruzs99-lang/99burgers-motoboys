-- JÁ APLICADA no Supabase em 2026-10-28.
-- Textos iniciais do contrato e do termo diário. RASCUNHO: revisar com advogado antes de usar.
-- Para mudar, crie uma nova versão em /admin/config (a versão antiga fica guardada com as assinaturas).

insert into public.mb_documentos (tipo, versao, titulo, texto)
select 'contrato', 1, 'Contrato de prestação de serviços autônomos de entrega', $txt$
CONTRATO DE PRESTAÇÃO DE SERVIÇOS AUTÔNOMOS DE ENTREGA

CONTRATANTE: 99BURGER'S LTDA, CNPJ 40.161.847/0001-72 ("Nove Nove Burger's").
CONTRATADO: o prestador identificado pelo nome e CPF informados na assinatura eletrônica deste contrato.

1. OBJETO
1.1. O CONTRATADO prestará, de forma autônoma e com veículo próprio, serviços de coleta e entrega de pedidos da CONTRATANTE (hamburgueria e marmitaria) aos clientes finais.
1.2. Este contrato tem natureza civil (arts. 593 e seguintes do Código Civil) e não cria vínculo de emprego entre as partes.

2. AUTONOMIA DO CONTRATADO
2.1. O CONTRATADO escolhe livremente os períodos em que se coloca à disposição, podendo recusar períodos e entregas sem qualquer penalidade.
2.2. O CONTRATADO pode trocar períodos com outros prestadores diretamente pelo aplicativo, sem precisar de autorização da CONTRATANTE.
2.3. Não há exclusividade: o CONTRATADO pode prestar serviços a outras empresas, inclusive concorrentes, e a aplicativos de entrega.
2.4. Não existe controle de jornada. O horário em que o CONTRATADO inicia sua disponibilidade é escolha dele e só influencia o valor de disponibilidade, que é proporcional ao período disponibilizado (cláusula 3).
2.5. A "escala" mostrada no aplicativo é apenas uma organização dos períodos em que os prestadores informaram disponibilidade, para que a operação saiba com quantos entregadores pode contar.

3. REMUNERAÇÃO
3.1. Pelo período em que se disponibilizar, o CONTRATADO recebe um valor de disponibilidade conforme a tabela vigente informada no aplicativo, proporcional ao horário em que iniciar a disponibilidade: valor integral, 2/3 ou 1/3.
3.2. Além disso, o CONTRATADO recebe o valor correspondente às entregas realizadas no período, apurado e lançado pela CONTRATANTE no aplicativo, onde o CONTRATADO pode conferir.
3.3. O pagamento é feito por PIX, semanalmente (às quartas-feiras) ou quinzenalmente (nos dias 1º e 16), conforme combinado com cada prestador, referente aos períodos anteriores à data de pagamento.
3.4. Eventuais adiantamentos, bônus ou descontos combinados aparecem no aplicativo antes do pagamento.

4. VEÍCULO, EQUIPAMENTOS E CUSTOS
4.1. O veículo, o celular, a bag térmica e os equipamentos de segurança (incluindo capacete) são do CONTRATADO, que arca com combustível, manutenção, documentação e seguro.
4.2. O CONTRATADO declara possuir CNH válida na categoria exigida e manter o veículo regularizado.
4.3. O CONTRATADO deve respeitar a legislação de trânsito. Multas e infrações cometidas durante as entregas são de responsabilidade do CONTRATADO.
4.4. Recomenda-se que o CONTRATADO mantenha seguro de acidentes pessoais e contribua para o INSS (por exemplo, como MEI).

5. CUIDADOS COM OS PEDIDOS
5.1. O CONTRATADO se compromete a transportar os pedidos com higiene, sem violar lacres e tratando os clientes com cordialidade.
5.2. Prejuízos causados por culpa comprovada do CONTRATADO (por exemplo, extravio do pedido ou do valor recebido) poderão ser descontados do pagamento, com aviso prévio no aplicativo.

6. DADOS PESSOAIS (LGPD)
6.1. A CONTRATANTE trata nome, CPF, telefone, chave PIX, registros de horário, endereço IP e aparelho usado no aplicativo apenas para executar este contrato, fazer os pagamentos e cumprir obrigações legais. O CONTRATADO pode pedir acesso ou correção dos seus dados a qualquer momento.

7. PRAZO E ENCERRAMENTO
7.1. O contrato vale por prazo indeterminado e pode ser encerrado por qualquer das partes, a qualquer momento, sem multa, com simples aviso. Os valores já devidos serão pagos na data de pagamento seguinte.

8. ASSINATURA ELETRÔNICA
8.1. As partes concordam que o aceite deste contrato no aplicativo, com nome, CPF, data, hora e endereço IP registrados, tem validade de assinatura eletrônica (MP 2.200-2/2001, art. 10, § 2º, e Lei 14.063/2020).
8.2. A cada período, o CONTRATADO confirma no aplicativo que está se disponibilizando por livre escolha, aceitando o termo do dia.

9. FORO
9.1. Fica eleito o foro da comarca da sede da CONTRATANTE para resolver qualquer questão deste contrato.
$txt$
where not exists (select 1 from public.mb_documentos where tipo = 'contrato');

insert into public.mb_documentos (tipo, versao, titulo, texto)
select 'termo_diario', 1, 'Termo do dia', $txt$
Confirmo que, por livre escolha, estou me disponibilizando neste período para fazer entregas como prestador de serviço autônomo da 99BURGER'S LTDA, com meu próprio veículo, nas condições do contrato de prestação de serviço que assinei no aplicativo.

Sei que não existe vínculo de emprego, que posso recusar entregas e que o valor de disponibilidade deste período é proporcional ao horário em que estou começando agora.
$txt$
where not exists (select 1 from public.mb_documentos where tipo = 'termo_diario');
