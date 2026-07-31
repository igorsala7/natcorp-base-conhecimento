import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { normalizeInvite, type InviteSpec } from "@/lib/calendar/ics";

/**
 * Ferramenta de CONVITE/AGENDA do chat: a IA reúne os dados do evento (título,
 * data/hora, local, participantes…) e gera um arquivo .ics para o usuário baixar
 * e adicionar ao Google Agenda / Outlook / Apple Calendar. Padrão sink (como
 * `gerar_relatorio`): a tool só COLETA a intenção; a rota materializa o .ics e o
 * entrega pelo canal `file`.
 */

/** O pedido é para criar um convite/evento/agenda? Libera a ferramenta. */
export const RX_CONVITE =
  /\bconvite\b|\bagenda(r|mento)?\b|\bevento\b|reuni[ãa]o|\blembrete\b|calend[áa]rio|\binvite\b|\.ics\b|marcar\s+(uma\s+)?(reuni[ãa]o|call|conversa|hor[áa]rio|compromisso)/i;
export function pedeConvite(pergunta: string): boolean {
  return RX_CONVITE.test(String(pergunta ?? ""));
}

/** Diretriz (alta prioridade) para o fluxo de convite. */
export function inviteDirective(): string {
  return (
    "CONVITE / AGENDA (arquivo .ics): quando o usuário pedir para CRIAR um convite, evento, reunião, agendamento ou " +
    "lembrete de calendário, use a ferramenta `gerar_convite` — ela produz um arquivo .ics que o usuário baixa e adiciona " +
    "ao Google Agenda, Outlook ou Apple Calendar. ANTES de chamar, verifique se você tem os dados MÍNIMOS: título, DATA e " +
    "HORÁRIO de início. Se faltar algum, PERGUNTE de forma objetiva — em UMA mensagem, liste tudo o que precisa (não pergunte " +
    "um item por vez). Pergunte também, quando fizer sentido, a DURAÇÃO (ou horário de fim), o LOCAL (endereço, sala ou link " +
    "da reunião), os PARTICIPANTES (e-mails) e uma DESCRIÇÃO/pauta — mas não trave por esses: com título + data + início já " +
    "dá para gerar. Datas e horas são no horário de Brasília; resolva expressões como 'amanhã'/'sexta que vem' usando a data " +
    "de hoje do contexto. Quando tiver o essencial, CHAME `gerar_convite` (NÃO descreva o convite em texto nem peça para o " +
    "usuário criar manualmente — a ferramenta gera o arquivo). Depois confirme, em uma linha curta, o que foi agendado."
  );
}

const inviteInput = z.object({
  titulo: z.string().describe("Título do evento/convite (ex.: 'Reunião de alinhamento — Projeto X')."),
  inicio: z
    .string()
    .describe("Data e hora de INÍCIO (horário de Brasília). Use 'AAAA-MM-DD HH:MM' (ex.: 2026-08-12 14:30) ou 'DD/MM/AAAA HH:MM'."),
  fim: z.string().optional().describe("Data e hora de FIM (mesmo formato). Se omitido, usa `duracao_min` (ou 60 min)."),
  duracao_min: z.number().optional().describe("Duração em minutos quando não há `fim` (padrão 60)."),
  dia_inteiro: z.boolean().optional().describe("true para evento de DIA INTEIRO (sem horário)."),
  local: z.string().optional().describe("Local: endereço, sala ou link da reunião (ex.: 'Google Meet: …')."),
  descricao: z.string().optional().describe("Descrição/pauta do evento."),
  participantes: z.array(z.string()).optional().describe("E-mails dos participantes convidados."),
  organizador_email: z.string().optional().describe("E-mail do organizador."),
  organizador_nome: z.string().optional().describe("Nome do organizador."),
  lembrete_min: z.number().optional().describe("Minutos antes do início para um lembrete/alarme (ex.: 15)."),
});

/** Tool `gerar_convite` — coleta os dados e emite o .ics no fim do turno. */
export function buildInviteTool(sink: InviteSpec[]): ToolSet {
  return {
    gerar_convite: tool({
      description:
        "Cria um CONVITE de agenda (.ics) para o usuário baixar e adicionar ao Google Agenda/Outlook/Apple Calendar. " +
        "Use quando o usuário pedir para criar/agendar um evento, reunião, compromisso ou lembrete. Só chame quando já " +
        "tiver ao menos TÍTULO, DATA e HORÁRIO de início — se faltar, PERGUNTE antes (título, data, hora, e opcionalmente " +
        "duração/fim, local, participantes e descrição). Não descreva o convite em texto: esta ferramenta gera o arquivo.",
      inputSchema: inviteInput,
      execute: async (input) => {
        const spec = normalizeInvite(input);
        if (!spec) return { erro: "Preciso de ao menos TÍTULO, DATA e HORÁRIO de início (válidos) para criar o convite." };
        sink.push(spec);
        return {
          ok: true,
          mensagem: `Convite "${spec.titulo}" criado para ${spec.inicioLabel}. Entreguei o arquivo .ics ao usuário para download.`,
        };
      },
    }),
  };
}
