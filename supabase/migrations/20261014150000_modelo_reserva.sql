-- =====================================================================
-- MODELO DE RESERVA: o provedor falha e o chat responde por outro
--
-- Pedido do dono (14/10/2026), ao manter a Maritaca como chat principal.
--
-- ── O problema ──────────────────────────────────────────────────────
-- Quando o provedor de uma finalidade falhava, o turno registrava o erro e
-- terminava sem resposta: não havia segundo provedor. Com a Maritaca isso
-- deixa de ser hipótese. O crédito dela é PRÉ-PAGO (em 14/10, de madrugada,
-- a API respondeu 403 `insufficient_funds` por horas) e o nível inicial
-- limita a saída a 10 mil tokens por minuto.
--
-- ── Reserva NÃO é contingência ──────────────────────────────────────
-- `model_sem_credito` (24/09) é escolha de NEGÓCIO: o crédito do CLIENTE na
-- plataforma acabou e o assistente fica mais barato. `model_reserva` é
-- escolha de OPERAÇÃO: o PROVEDOR não atendeu (crédito da conta, chave,
-- limite, fora do ar) e a mesma chamada é refeita em outro. Uma coluna para
-- as duas coisas obrigaria a escolher entre barato e forte, e as duas
-- situações pedem o oposto.
--
-- Nulo = sem reserva; a falha segue como antes (erro registrado no trace).
-- =====================================================================

alter table public.ai_assignments
  add column if not exists model_reserva text,
  add column if not exists provider_reserva uuid references public.ai_providers(id) on delete set null;

comment on column public.ai_assignments.model_reserva is
  'Modelo que refaz a chamada quando o provedor principal falha (crédito, chave, limite, indisponível). NULL = sem reserva.';
comment on column public.ai_assignments.provider_reserva is
  'Provedor do modelo de reserva. Normalmente OUTRO provedor: reserva no mesmo provedor só cobre modelo descontinuado.';

-- Os dois andam juntos, como na contingência: meio preenchido parece pronto
-- na tela e só falha no dia em que o provedor cai.
alter table public.ai_assignments
  drop constraint if exists ai_assignments_reserva_completa;

alter table public.ai_assignments
  add constraint ai_assignments_reserva_completa check (
    (model_reserva is null and provider_reserva is null)
    or (btrim(coalesce(model_reserva, '')) <> '' and provider_reserva is not null)
  );

-- ── Embedding e OCR ficam FORA, e o banco é quem recusa ─────────────────
-- Embedding: vetor de outro modelo vive em outro espaço; a pergunta seria
-- comparada com documentos que não se comparam com ela, sem erro nenhum.
-- OCR: documento pessoal (RG, CPF, atestado) só vai para o provedor que o
-- administrador escolheu sabendo ONDE ele processa. Desviar para outro
-- provedor numa falha mandaria o documento para fora do país sem ninguém ter
-- escolhido isso — a mesma regra de `NAO_HERDA_CHAT` em src/lib/ai/config.ts.
alter table public.ai_assignments
  drop constraint if exists ai_assignments_reserva_finalidade;

alter table public.ai_assignments
  add constraint ai_assignments_reserva_finalidade check (
    purpose not in ('embedding', 'ocr', 'transcricao') or model_reserva is null
  );
