/**
 * Cadastra as ferramentas do Microsoft Graph que agem COMO O USUÁRIO.
 *
 * Uso:
 *   npm run seed:graph                 # simula
 *   npm run seed:graph -- --aplicar
 *
 * ── Esta leva é só LEITURA, e o motivo é sequência, não cautela ─────────
 * Os escopos que a conta já concedeu incluem `Calendars.Read`, `Mail.Read` e
 * `Files.Read`, mas NÃO `Calendars.ReadWrite` nem `Files.ReadWrite`. Criar
 * evento ou salvar arquivo falharia com 403 até o registro no Azure ganhar
 * esses escopos e a conta reconectar. Cadastrar tools que só podem falhar
 * ensinaria o agente a oferecer o que não entrega.
 *
 * `Mail.Send` a conta JÁ tem (herdado do "Natcorp SSO"). Mesmo assim envio de
 * e-mail não entra aqui: escrita precisa da confirmação que mostra
 * destinatário e corpo antes de agir, e essa confirmação ainda não existe —
 * a atual só repete um rótulo fixo, o que contra injeção de prompt é teatro.
 *
 * ── Por que `identity_mode = 'user'` em todas ───────────────────────────
 * `/me/*` responde pela identidade que autenticou. Com a credencial da base,
 * o Graph devolveria a caixa da conta de serviço apresentada como a do
 * usuário — resposta errada com cara de certa.
 */
// @ts-expect-error — o pacote `pg` não traz tipos próprios.
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const GRAPH = "https://graph.microsoft.com/v1.0";
const BASE_CODE = "natcorp";

type Param = Record<string, unknown>;

const q = (nome: string, descricao: string, obrigatorio: boolean, extra: Param = {}): Param => ({
  nome, descricao, tipo: "string", origem: "modelo", obrigatorio, local: "query", ...extra,
});
const fixo = (nome: string, valor: string): Param => ({
  nome, descricao: "", tipo: "string", origem: "fixo", obrigatorio: true, local: "query", valorFixo: valor,
});

const TOOLS = [
  {
    key: "ms_agenda_periodo",
    name: "Agenda do usuário (Microsoft)",
    // A descrição é o que decide o roteamento. Diz QUANDO usar, em vocabulário
    // de quem pergunta — e diz o que NÃO faz, para não competir com as tools de
    // RH que também falam de "agenda" (escala, férias).
    description:
      "Reuniões e compromissos do calendário Microsoft/Outlook DA PRÓPRIA PESSOA que está perguntando, " +
      "num intervalo de datas. Use para 'minha agenda', 'minhas reuniões de amanhã', 'o que tenho na " +
      "quinta', 'estou livre às 15h?', 'próximo compromisso'. Devolve título, horário de início e fim, " +
      "local, organizador, se é reunião online (Teams) e se a pessoa já respondeu ao convite. NÃO é " +
      "escala de trabalho nem férias — para isso use as ferramentas de RH.",
    // SEM verbos de criação e SEM "convite": esta tool só LÊ. Com eles, ela
    // vencia `ms_evento_criar` no ranking de "criar um invite" — e o pedido de
    // criação era atendido por uma consulta.
    search_terms:
      "agenda calendário consultar ver mostrar listar compromissos reuniões marcadas outlook " +
      "horário livre ocupado disponibilidade próxima reunião minha agenda o que tenho hoje amanhã semana",
    method: "GET",
    path_template: "/me/calendarView",
    params: [
      q("startDateTime", "Início do intervalo, ISO 8601 com fuso (ex.: 2026-08-10T00:00:00-03:00). Para 'amanhã', use 00:00 do dia seguinte.", true),
      q("endDateTime", "Fim do intervalo, ISO 8601 com fuso. Para um único dia, use 23:59:59 do mesmo dia.", true),
      fixo("$orderby", "start/dateTime"),
      fixo("$top", "50"),
      fixo("$select", "subject,start,end,location,organizer,isOnlineMeeting,onlineMeetingUrl,responseStatus,isAllDay,webLink"),
    ],
    response_hint:
      "Liste em ordem cronológica: horário (HH:mm), título e, quando houver, local ou 'Teams'. Converta as " +
      "datas para o fuso de Brasília. Se `isAllDay` for true, diga 'dia inteiro' em vez de horário. Se a " +
      "lista vier vazia, diga que não há compromissos no período — não invente.",
  },
  {
    key: "ms_email_recentes",
    name: "E-mails recentes (Microsoft)",
    description:
      "E-mails da CAIXA DE ENTRADA da própria pessoa que está perguntando, do mais recente para o mais " +
      "antigo. Use para 'meus e-mails', 'recebi algo do fulano?', 'o que chegou hoje', 'tenho e-mail não " +
      "lido'. Devolve remetente, assunto, data, se foi lido e uma prévia do texto. Não devolve o corpo " +
      "completo nem anexos.",
    search_terms:
      "email e-mail correio mensagem caixa de entrada inbox outlook recebi remetente assunto não lido " +
      "meus emails chegou mensagem nova",
    method: "GET",
    path_template: "/me/messages",
    params: [
      q("$top", "Quantos e-mails trazer (1 a 25). Padrão 10 quando a pessoa não especificar.", false),
      q("$search", "Termo de busca no assunto/corpo/remetente. DEIXE VAZIO para simplesmente listar os mais recentes. Quando usar, envolva em aspas duplas.", false),
      fixo("$select", "from,subject,receivedDateTime,isRead,bodyPreview,hasAttachments,webLink"),
    ],
    response_hint:
      "Liste como '• Remetente — Assunto (data)'. Marque os não lidos. Use a prévia só se ajudar a " +
      "responder a pergunta; não a reproduza inteira. Nunca invente conteúdo que não veio na resposta.",
  },
  {
    key: "ms_arquivos_recentes",
    name: "Arquivos recentes na nuvem (Microsoft)",
    description:
      "Arquivos que a própria pessoa abriu ou editou recentemente no OneDrive/SharePoint. Use para " +
      "'meus arquivos', 'em que eu estava trabalhando', 'o documento que abri ontem', 'meus últimos " +
      "arquivos'. Devolve nome, tipo, data da última modificação e o link para abrir.",
    search_terms:
      "arquivo documento onedrive sharepoint nuvem planilha apresentação word excel powerpoint pdf " +
      "meus arquivos recentes ultimo documento em que eu estava trabalhando",
    method: "GET",
    path_template: "/me/drive/recent",
    params: [q("$top", "Quantos arquivos trazer (1 a 25). Padrão 10.", false)],
    response_hint:
      "Liste como '• Nome do arquivo — modificado em <data>'. Inclua o link quando a pessoa pedir para " +
      "abrir. Não tente ler o conteúdo do arquivo: esta ferramenta só lista.",
  },
  {
    key: "ms_arquivo_buscar",
    name: "Buscar arquivo na nuvem (Microsoft)",
    description:
      "Procura um arquivo pelo NOME ou pelo conteúdo no OneDrive/SharePoint da própria pessoa. Use " +
      "quando ela citar um arquivo específico ('acha o contrato da Vivo', 'onde está a planilha de " +
      "custos'). Para apenas listar os últimos abertos, prefira a ferramenta de arquivos recentes.",
    search_terms: "buscar procurar achar encontrar arquivo documento planilha contrato onde está localizar",
    method: "GET",
    // O Graph exige a função na URL: /root/search(q='termo'). O placeholder do
    // path_template resolve isso sem inventar sintaxe de query.
    path_template: "/me/drive/root/search(q='{termo}')",
    params: [
      { nome: "termo", descricao: "O que procurar — nome do arquivo ou palavra do conteúdo. Sem aspas.", tipo: "string", origem: "modelo", obrigatorio: true, local: "path" },
      q("$top", "Quantos resultados (1 a 25). Padrão 10.", false),
    ],
    response_hint:
      "Liste os que casarem, com nome e data de modificação. Se nada voltar, diga que não encontrou e " +
      "sugira outro termo — não devolva lista vazia sem explicação.",
  },
];

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const c = new pg.Client(parseDbConfig());
  await c.connect();
  console.log(aplicar ? "MODO: GRAVANDO\n" : "MODO: simulação (use --aplicar)\n");

  try {
    const { rows: bases } = await c.query(`select id from ai_bases where base_code ilike $1`, [BASE_CODE]);
    if (!bases[0]) throw new Error(`Base "${BASE_CODE}" não encontrada.`);
    const baseId = bases[0].id;

    const { rows: creds } = await c.query(
      `select id, name from ai_base_credentials
        where base_id = $1 and auth_type = 'oauth2_user' and provider = 'microsoft' and active`,
      [baseId],
    );
    if (!creds[0]) throw new Error("Credencial delegada da Microsoft não encontrada nesta base.");
    console.log(`credencial: ${creds[0].name}\n`);

    for (const t of TOOLS) {
      if (aplicar) {
        // `on conflict (key)`: reexecutar o seed ATUALIZA em vez de duplicar —
        // é assim que a descrição, que é o que decide o roteamento, pode ser
        // afinada sem recriar nada.
        await c.query(
          `insert into ai_tools
             (key, name, description, search_terms, method, path_template, params, response_hint,
              auth_type, endpoint_kind, external_url, credential_id, identity_mode, active)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'oauth2_user','external',$9,$10,'user',true)
           on conflict (key) do update set
             name = excluded.name, description = excluded.description,
             search_terms = excluded.search_terms, method = excluded.method,
             path_template = excluded.path_template, params = excluded.params,
             response_hint = excluded.response_hint, auth_type = excluded.auth_type,
             endpoint_kind = excluded.endpoint_kind, external_url = excluded.external_url,
             credential_id = excluded.credential_id, identity_mode = excluded.identity_mode,
             active = true`,
          [t.key, t.name, t.description, t.search_terms, t.method, t.path_template,
           JSON.stringify(t.params), t.response_hint, GRAPH, creds[0].id],
        );
        const { rows: tr } = await c.query(`select id from ai_tools where key = $1`, [t.key]);
        await c.query(
          `insert into ai_base_tools (base_id, tool_id, enabled, credential_id)
           values ($1,$2,true,$3)
           on conflict (base_id, tool_id) do update set enabled = true, credential_id = excluded.credential_id`,
          [baseId, tr[0].id, creds[0].id],
        );
      }
      console.log(`${aplicar ? "OK  " : "    "}${t.key.padEnd(22)} ${t.method} ${GRAPH}${t.path_template}`);
    }
  } finally {
    await c.end();
  }
  if (!aplicar) console.log("\nNada gravado. Repita com --aplicar.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
