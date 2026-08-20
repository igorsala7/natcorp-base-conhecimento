/**
 * RODADA DE PONTA A PONTA — pela rota real, não pelo modelo direto.
 *
 * `eval-cenarios.ts` mede a DECISÃO do modelo: manda pergunta, histórico e
 * ferramentas direto ao provedor. É o instrumento certo para assertividade, e o
 * errado para custo — ele não passa pelo `/api/v1/chat`, então não enxerga o
 * bloco de ferramentas, os breakpoints de cache, a poda entre passos nem o
 * prompt de sistema montado. Um ganho de cache é invisível ali por construção.
 *
 * Aqui cada turno entra pela porta do widget: chave `pk_`, token de rastreio
 * cifrado, SSE. O que sai é o que o cliente paga.
 *
 * ── Conversas, não perguntas soltas ─────────────────────────────────────────
 * O cache entre turnos só existe dentro de uma conversa e dentro do TTL de 5
 * minutos (medido: 83% dos turnos reais caem nessa janela, mediana de 57s).
 * Uma bateria de perguntas independentes mediria só o cache DENTRO do turno e
 * concluiria que a reordenação não serviu para nada. Por isso a bateria é de
 * CONVERSAS de 3 turnos, encadeadas como uma pessoa faria.
 *
 * ── Segurança ───────────────────────────────────────────────────────────────
 * Isto chama a API do CLIENTE de verdade. Só perguntas de LEITURA: nada que
 * crie férias, envie e-mail ou altere cadastro. A bateria é fixa e revisada —
 * não sorteia pergunta nem reusa turno de produção sem ler.
 *
 *   npm run rodada:e2e
 *   npm run rodada:e2e -- --url http://localhost:3008 --so-social
 */
import pg from "pg";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { encriptarRastreio } from "../src/lib/tracking/token";
import { tryDecryptSecret } from "../src/lib/crypto/secrets";

const arg = (n: string, p: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : p;
};
const URL_BASE = arg("url", "http://localhost:3008");
const SAIDA = arg("saida", "eval/rodada-e2e.md");
const ESPACO = arg("espaco", "a5e69064-8584-4327-9116-726b717ea604");
const CHAVE = arg("chave", "pk_live_77c1d31cadd25d2768ac7c93167023bf");

/** Identidade real do painel do Operador — a mesma que gerou 2.044 chamadas em 7 dias. */
const IDENTIDADE = {
  p_base: "natcorp", p_usuario: "365785", p_portal: "PO",
  p_empresa: "700", p_matricula: "365785", p_perfil: "MASTER",
};

/**
 * RELATÓRIO NA TELA, com os valores CONHECIDOS.
 *
 * Sem isto a rodada media só "respondeu ou não". Com uma tabela gerada aqui, a
 * soma, o maior valor e a contagem são conhecidos, e a assertividade da
 * finalidade `report_analysis` vira verificação — não impressão.
 */
const OCORRENCIAS = [
  "Salário Base", "Horas Extras 50%", "Adicional Noturno", "Vale Transporte",
  "Vale Refeição", "Plano de Saúde", "INSS", "IRRF", "FGTS", "Adiantamento",
];
const REL_LINHAS = OCORRENCIAS.map((nome, i) => [
  String(700 + (i % 3)), nome, i % 2 === 0 ? "Provento" : "Desconto",
  (12500 + i * 1375.5).toFixed(2), String(40 + i * 3),
]);
const REL_SOMA = REL_LINHAS.reduce((a, l) => a + Number(l[3]), 0);
const REL_MAIOR = REL_LINHAS.reduce((a, b) => (Number(b[3]) > Number(a[3]) ? b : a));
const REL_PROVENTOS = REL_LINHAS.filter((l) => l[2] === "Provento").length;
const RELATORIO = {
  nome: "Histórico Financeiro por Ocorrência — Março/2025",
  colunas: ["Empresa", "Ocorrência", "Tipo", "Valor", "Qtde"],
  linhas: REL_LINHAS,
  total: REL_LINHAS.length,
  incompleto: false,
};

/**
 * Mapa de campos de uma tela real do painel — o widget manda algo assim em toda
 * mensagem, e é o que liga `preencher_campo`, `marcar_opcao` e `destacar_tela`.
 */
const CAMPOS_TELA = [
  { ref: "P1_EMPRESA", label: "Empresa", type: "select", value: "700" },
  { ref: "P1_FILIAL", label: "Filial", type: "select", value: "" },
  { ref: "P1_CENTRO_CUSTO", label: "Centro de Custo", type: "select", value: "" },
  { ref: "P1_MATRICULA", label: "Matrícula", type: "text", value: "" },
  { ref: "P1_SITUACAO", label: "Situação", type: "select", value: "ATIVO" },
  { ref: "P1_BUSCAR", label: "Buscar", type: "button", value: "" },
];

/**
 * A bateria. Cada conversa exercita um caminho diferente, e os turnos 2 e 3
 * dependem do 1 — que é o que faz o cache e a poda aparecerem.
 *
 * TODAS de leitura. Nenhuma cria, envia ou altera nada.
 */
type TurnoSpec = string | { pergunta: string; espera: (t: string) => boolean; exige: string };
const CONVERSAS: { nome: string; cenario: string; relatorio?: boolean; turnos: TurnoSpec[] }[] = [
  {
    nome: "social", cenario: "sem fonte",
    turnos: ["Olá", "tudo bem?", "obrigado"],
  },
  {
    nome: "documentacao", cenario: "rag",
    turnos: [
      "O que é período aquisitivo de férias?",
      "E o período de gozo, como funciona?",
      "Quantos dias posso vender?",
    ],
  },
  {
    nome: "dados_proprios", cenario: "tool",
    turnos: [
      "Quais são os meus dados cadastrais?",
      "Qual meu centro de custo?",
      "Há quanto tempo estou na empresa?",
    ],
  },
  {
    nome: "equipe_e_regra", cenario: "rag+tool",
    turnos: [
      "Quais são os colaboradores do meu centro de custo?",
      "Quantos deles estão ativos?",
      "O que a CLT diz sobre o período de experiência?",
    ],
  },
  {
    nome: "periodo_ausente", cenario: "portão de período",
    turnos: [
      "Quero ver as marcações de ponto da minha equipe",
      "do mês passado",
      "quantas pessoas apareceram nessa lista?",
    ],
  },
  {
    /**
     * A CONVERSA QUE DEU ERRADO EM 20/08, reproduzida.
     *
     * Seis turnos pedindo o FGTS por colaborador; o agente devolvia a lista de
     * pessoas ou o total agregado. Quando finalmente entendeu e ofereceu buscar,
     * o "Confirmado" não executou nada e o usuário escreveu "Desisto".
     *
     * Duas causas, as duas corrigidas: o portão de período bloqueou catorze
     * chamadas por não reconhecer "os dois meses", e a confirmação em texto
     * livre não virava execução.
     */
    nome: "fgts_por_colaborador", cenario: "regressão de 20/08",
    turnos: [
      "Quais colaboradores tiveram o desconto do FGTS?",
      {
        pergunta: "Eu estou pedindo por colaborador os valores do evento de FGTS para os dois meses. Entendeu?",
        // O que se exige aqui é MOVIMENTO: ou ele busca, ou pergunta o que falta —
        // o que não pode é reexplicar o relatório da tela, que foi a falha real.
        espera: (t) => !/rel[aá]t[oó]rio (que est[áa] )?aberto.{0,60}(n[ãa]o|sem) (det|reg|disc)/i.test(t),
        exige: "não reexplicar que a tela não tem o detalhe",
      },
      {
        pergunta: "Confirmado",
        espera: (t) => t.length > 120 && !/confirm(a|e)\b|posso (buscar|prosseguir|seguir)|deseja que eu/i.test(t),
        exige: "executar, não pedir confirmação de novo",
      },
      {
        /**
         * O turno que prova o quadro de fatos.
         *
         * "E o mês anterior?" não diz período, não diz pessoa e não diz empresa —
         * tudo isso ficou fixado nos turnos de cima. Sem o quadro, este é
         * exatamente o turno em que o portão de período dispara e a conversa
         * volta à estaca zero, que foi o que aconteceu em 20/08.
         */
        pergunta: "E o mês anterior?",
        espera: (t) => t.length > 80 && !/qual (per[íi]odo|m[êe]s)|informe o per[íi]odo|de qual per[íi]odo/i.test(t),
        exige: "usar o período e a pessoa já fixados, sem perguntar de novo",
      },
    ],
  },
  {
    nome: "analise_relatorio", cenario: "report_analysis", relatorio: true,
    turnos: [
      { pergunta: "Analise este relatório e me diga o que chama atenção.",
        espera: (t) => t.length > 200, exige: "análise com substância" },
      { pergunta: "Qual é a soma total dos valores?",
        espera: (t) => temNumero(t, REL_SOMA), exige: REL_SOMA.toFixed(2) },
      { pergunta: "Qual ocorrência tem o maior valor?",
        espera: (t) => t.includes(String(REL_MAIOR[1])), exige: String(REL_MAIOR[1]) },
      { pergunta: "Quantas são do tipo Provento?",
        espera: (t) => temNumero(t, REL_PROVENTOS), exige: String(REL_PROVENTOS) },
      {
        pergunta: "Qual o total de horas extras noturnas pagas?",
        /**
         * O CRITÉRIO É NÃO FABRICAR, não a forma de negar.
         *
         * Errei este teste TRÊS vezes enumerando verbos: reprovou "NÃO CONTENDO a
         * informação", depois "SEM CONSTAR o rubro específico" — as duas respostas
         * exemplares. O português tem formas demais de dizer que algo não está
         * ali, e caçá-las uma a uma é perseguir a redação em vez do que importa.
         *
         * O defeito que este caso existe para pegar é FABRICAR um total para uma
         * coluna que não existe. Então é isso que se mede: a resposta cita a
         * ocorrência pedida junto de um valor em dinheiro? Se não cita, não
         * inventou — e como ela chegou lá é escolha de redação dele.
         */
        espera: (t) => {
          const texto = String(t ?? "");
          // Um total fabricado apareceria como "horas extras noturnas ... R$ X".
          const fabricou = /horas?\s+extras?\s+noturnas?[^.!?]{0,80}?R\$\s*[\d.,]+/i.test(texto)
            || /R\$\s*[\d.,]+[^.!?]{0,40}?horas?\s+extras?\s+noturnas?/i.test(texto);
          return texto.length > 40 && !fabricou;
        },
        exige: "não inventar um total para a coluna inexistente",
      },
    ],
  },
];

/** Bate um número no texto, aceitando 1.234,56 e 1,234.56. */
function temNumero(txt: string, alvo: number): boolean {
  for (const bruto of String(txt).match(/[\d][\d.,]*/g) ?? []) {
    for (const c of [bruto.replace(/\./g, "").replace(",", "."), bruto.replace(/,/g, "")]) {
      const n = Number(c);
      if (Number.isFinite(n) && Math.abs(n - alvo) < 0.5) return true;
    }
  }
  return false;
}

type Turno = {
  conversa: string; cenario: string; n: number; pergunta: string;
  ms: number; ok: boolean; desfecho: string | null; erro?: string;
  convId: string | null; resposta: number;
  /** `null` = o turno não tinha resposta verificável. */
  acertou: boolean | null; exige?: string;
};

async function enviar(track: string, convId: string | null, historico: { role: string; content: string }[], pergunta: string, relatorio?: unknown) {
  const t0 = Date.now();
  const r = await fetch(`${URL_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: URL_BASE },
    body: JSON.stringify({
      key: CHAVE, track, conversationId: convId,
      messages: [...historico, { role: "user", content: pergunta }],
      page: { href: `${URL_BASE}/apex/rh/f?p=200:1`, path: "/apex/rh/f", title: "Painel do Operador" },
      /**
       * CAMPOS DA TELA — sem eles a medição mede outro sistema.
       *
       * O widget manda o mapa de campos em toda mensagem, e é ele que habilita
       * as ferramentas de formulário (presentes em 99% dos turnos reais). A
       * primeira versão deste executor não mandava nada: `formTools` saía vazio,
       * o bloco local encolhia e o prefixo de cache media um turno que não
       * existe em produção.
       */
      fields: CAMPOS_TELA,
      telaTem: { relatorio: false, tabela: false, campos: true },
      tela: { titulo: "Painel do Operador", regioes: ["Consulta de Colaboradores", "Filtros"] },
      ...(relatorio ? { reportData: relatorio } : {}),
    }),
  });
  if (!r.ok || !r.body) return { ms: Date.now() - t0, ok: false, erro: `HTTP ${r.status} ${(await r.text()).slice(0, 120)}`, texto: "", convId, desfecho: null as string | null };
  // O SSE carrega os tokens da resposta E o desfecho do turno.
  const dec = new TextDecoder();
  let buf = "", texto = "", desfecho: string | null = null, id = convId;
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const bruto = buf.slice(0, i); buf = buf.slice(i + 2);
      const linha = bruto.split("\n").find((l) => l.startsWith("data:"));
      if (!linha) continue;
      try {
        const ev = JSON.parse(linha.slice(5).trim()) as Record<string, unknown>;
        if (ev.type === "token") texto += String(ev.value ?? "");
        if (ev.type === "trace" && typeof ev.desfecho === "string") desfecho = ev.desfecho;
        if (ev.type === "clarify") desfecho = "clarify";
        if (ev.type === "done" && ev.conversationId) id = String(ev.conversationId);
      } catch { /* frame parcial */ }
    }
  }
  return { ms: Date.now() - t0, ok: true, texto, convId: id, desfecho };
}

async function main() {
  const soSocial = process.argv.includes("--so-social");
  const db = new pg.Client(parseDbConfig());
  await db.connect();
  // A chave do espaço fica CIFRADA em repouso; decifra pelo mesmo caminho da rota.
  const { rows: k } = await db.query<{ key_enc: string }>(
    `select key_enc from space_tracking_keys where space_id = $1`, [ESPACO]);
  const chave = k[0]?.key_enc ? tryDecryptSecret(k[0].key_enc) : null;
  if (!chave) { console.error("Espaço sem chave de rastreio (ou APP_ENCRYPTION_KEY errada)."); process.exit(1); }
  const track = encriptarRastreio(chave, { ...IDENTIDADE, exp: Math.floor(Date.now() / 1000) + 3600 });

  const marco = new Date().toISOString();
  console.log(`\nRODADA E2E · ${URL_BASE} · espaço ${ESPACO.slice(0, 8)}…`);
  console.log(`identidade: ${IDENTIDADE.p_base}/${IDENTIDADE.p_usuario} · painel ${IDENTIDADE.p_portal}`);
  console.log("SÓ LEITURA — nenhuma pergunta cria, envia ou altera nada.\n");

  const soConversa = arg("conversa", "");
  const lista = soSocial ? CONVERSAS.slice(0, 1) : soConversa ? CONVERSAS.filter((c) => c.nome === soConversa) : CONVERSAS;
  if (!lista.length) { console.error(`Conversa "${soConversa}" não existe.`); process.exit(1); }
  const turnos: Turno[] = [];
  for (const conv of lista) {
    console.log(`── ${conv.nome} (${conv.cenario})`);
    let convId: string | null = null;
    const hist: { role: string; content: string }[] = [];
    for (const [i, spec] of conv.turnos.entries()) {
      const pergunta = typeof spec === "string" ? spec : spec.pergunta;
      const verifica = typeof spec === "string" ? null : spec;
      /**
       * O relatório vai em TODOS os turnos, porque é o que o widget faz.
       *
       * A primeira versão mandava só no turno 1, supondo que ele viraria dataset
       * da conversa. Não vira: `dataset-conversa.ts` persiste apenas resultado de
       * FERRAMENTA (`dsN`) e deixa a tabela da TELA de fora justamente porque ela
       * chega de graça em toda mensagem. Medindo do jeito errado, os turnos 2 em
       * diante viam `dataset:registro total=0`, o modelo não tinha o relatório na
       * frente e ia consultar a API — e eu quase reportei isso como defeito do
       * produto.
       */
      const r = await enviar(track, convId, hist, pergunta, conv.relatorio ? RELATORIO : undefined);
      convId = r.convId;
      if (r.ok) { hist.push({ role: "user", content: pergunta }, { role: "assistant", content: r.texto }); }
      const acertou = verifica && r.ok ? verifica.espera(r.texto ?? "") : null;
      turnos.push({
        conversa: conv.nome, cenario: conv.cenario, n: i + 1, pergunta,
        ms: r.ms, ok: r.ok, desfecho: r.desfecho, erro: r.erro, convId, resposta: r.texto?.length ?? 0,
        acertou, exige: verifica?.exige,
      });
      const marca = !r.ok ? "ERRO" : acertou === false ? "ERROU" : acertou === true ? "OK" : r.desfecho === "clarify" ? "?" : "—";
      console.log(`   ${String(i + 1)}. ${marca.padEnd(5)} ${(r.ms / 1000).toFixed(1)}s  ${String(r.texto?.length ?? 0).padStart(5)} chars  "${pergunta.slice(0, 44)}"${acertou === false ? `  ← esperava ${verifica!.exige}` : ""}${r.erro ? `  ${r.erro}` : ""}`);
    }
  }

  // ── O que o cliente pagou, lido da fonte da verdade ─────────────────────────
  const { rows: u } = await db.query<{ purpose: string; provider: string; model: string; n: string; inp: string; outp: string; cr: string; cw: string; turnos: string }>(
    `select purpose, provider, model, count(*) n, sum(input_tokens) inp, sum(output_tokens) outp,
            sum(cache_read_tokens) cr, sum(cache_write_tokens) cw, count(distinct turn_id) turnos
       from ai_usage where created_at >= $1 group by 1,2,3 order by sum(input_tokens) desc`, [marco]);
  const { rows: pr } = await db.query<{ provider: string; model: string; pin: string; pout: string; mr: string; mw: string }>(
    `select provider, model, input_usd_mtok pin, output_usd_mtok pout,
            coalesce(cache_read_mult,0.1) mr, coalesce(cache_write_mult,1) mw from ai_model_prices`);
  const preco = (p: string, m: string) => pr.find((x) => x.provider === p && x.model === m);

  const md: string[] = [`# Rodada de ponta a ponta — ${marco.slice(0, 16).replace("T", " ")}`, "",
    `${turnos.length} turnos em ${lista.length} conversas, pela rota real (\`/api/v1/chat\`).`, ""];

  console.log("\n── CONSUMO (o que o cliente pagou) ".padEnd(92, "─"));
  console.log("  finalidade        modelo                    chamadas   entrada   cache_read  cache_write   US$");
  md.push("| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |", "|---|---|---|---|---|---|---|");
  let totalUsd = 0, totalIn = 0, totalCr = 0, totalCw = 0;
  for (const r of u) {
    const inp = Number(r.inp), outp = Number(r.outp), cr = Number(r.cr), cw = Number(r.cw);
    const p = preco(r.provider, r.model);
    const usd = p ? (inp * +p.pin + cr * +p.pin * +p.mr + cw * +p.pin * +p.mw + outp * +p.pout) / 1e6 : NaN;
    totalUsd += Number.isFinite(usd) ? usd : 0; totalIn += inp; totalCr += cr; totalCw += cw;
    console.log(`  ${r.purpose.padEnd(17)} ${(r.provider + ":" + r.model).slice(0, 24).padEnd(25)} ${String(r.n).padStart(8)} ${String(inp).padStart(9)} ${String(cr).padStart(12) } ${String(cw).padStart(12)} ${(Number.isFinite(usd) ? usd.toFixed(4) : "?").padStart(8)}`);
    md.push(`| \`${r.purpose}\` | \`${r.provider}:${r.model}\` | ${r.n} | ${inp} | ${cr} | ${cw} | ${Number.isFinite(usd) ? usd.toFixed(4) : "?"} |`);
  }
  const leitura = totalIn + totalCr ? (100 * totalCr) / (totalIn + totalCr) : 0;
  const reuso = totalCw ? totalCr / totalCw : 0;
  console.log(`\n  leitura de cache: ${leitura.toFixed(0)}%  ·  reuso ${reuso.toFixed(2)}× por escrita  ·  custo total US$ ${totalUsd.toFixed(4)}`);
  console.log(`  por turno: ${Math.round(totalIn / turnos.length)} tokens de entrada · US$ ${(totalUsd / turnos.length).toFixed(4)}`);
  md.push("", `**Cache:** leitura ${leitura.toFixed(0)}% · reuso ${reuso.toFixed(2)}× por escrita.`,
    `**Custo:** US$ ${totalUsd.toFixed(4)} em ${turnos.length} turnos (US$ ${(totalUsd / turnos.length).toFixed(4)}/turno, ${(totalUsd / turnos.length * 1000).toFixed(2)}/1k).`, "");

  // ── Poda entre passos: quanto ela tirou do caminho ──────────────────────────
  const { rows: poda } = await db.query<{ n: string; chars: string }>(
    `select count(*) n, coalesce(sum((e.v->'info'->>'chars_economizados')::bigint),0) chars
       from ai_chat_traces t, jsonb_array_elements(t.passos) e(v)
      where e.v->>'passo'='poda_passos' and t.created_at >= $1`, [marco]);
  console.log(`\n  poda entre passos: ${poda[0]!.n} vezes · ${Number(poda[0]!.chars).toLocaleString()} caracteres a menos (~${Math.round(Number(poda[0]!.chars) / 4).toLocaleString()} tokens)`);
  md.push(`**Poda entre passos:** ${poda[0]!.n} aplicações, ${Number(poda[0]!.chars).toLocaleString()} caracteres economizados (~${Math.round(Number(poda[0]!.chars) / 4).toLocaleString()} tokens).`, "");

  // ── Assertividade: o que cada turno fez ─────────────────────────────────────
  const { rows: tr } = await db.query<{ pergunta: string; desfecho: string; tools: string[]; tok: string; ms: string }>(
    `select t.pergunta, t.desfecho,
            array(select e2.v->'info'->>'tool' from jsonb_array_elements(t.passos) e2(v) where e2.v->>'passo'='tool_call') tools,
            (select e3.v->'info'->>'tokens_total' from jsonb_array_elements(t.passos) e3(v) where e3.v->>'passo'='resposta' limit 1) tok,
            t.duracao_ms ms
       from ai_chat_traces t where t.created_at >= $1 order by t.created_at`, [marco]);
  console.log("\n── POR TURNO ".padEnd(92, "─"));
  console.log("  turno                                          desfecho     tokens    s   ferramentas");
  md.push("## Turno a turno", "", "| pergunta | desfecho | tokens | s | ferramentas |", "|---|---|---|---|---|");
  for (const r of tr) {
    console.log(`  "${r.pergunta.slice(0, 42).padEnd(42)}" ${String(r.desfecho ?? "?").padEnd(12)} ${String(r.tok ?? "—").padStart(7)} ${(Number(r.ms) / 1000).toFixed(1).padStart(5)}  ${(r.tools ?? []).join(", ").slice(0, 40)}`);
    md.push(`| ${r.pergunta.slice(0, 60)} | ${r.desfecho ?? "?"} | ${r.tok ?? "—"} | ${(Number(r.ms) / 1000).toFixed(1)} | ${(r.tools ?? []).join(", ") || "—"} |`);
  }

  const verificaveis = turnos.filter((t) => t.acertou !== null);
  if (verificaveis.length) {
    const ok = verificaveis.filter((t) => t.acertou).length;
    console.log(`\n── ASSERTIVIDADE ${ok}/${verificaveis.length} (só os turnos de resposta verificável) `.padEnd(92, "─"));
    md.push("", `## Assertividade: ${ok}/${verificaveis.length}`, "", "| pergunta | exigia | acertou |", "|---|---|---|");
    for (const t of verificaveis) {
      console.log(`  ${t.acertou ? "OK   " : "ERROU"} "${t.pergunta.slice(0, 46).padEnd(46)}" exigia: ${t.exige}`);
      md.push(`| ${t.pergunta.slice(0, 50)} | ${t.exige} | ${t.acertou ? "✅" : "❌"} |`);
    }
  }

  const falhas = turnos.filter((t) => !t.ok);
  if (falhas.length) {
    console.log(`\n  ${falhas.length} turno(s) com ERRO:`);
    for (const f of falhas) console.log(`    "${f.pergunta.slice(0, 50)}" → ${f.erro}`);
    md.push("", "## Falhas", "", ...falhas.map((f) => `- \`${f.pergunta.slice(0, 60)}\` → ${f.erro}`));
  }

  await db.end();
  const dir = SAIDA.slice(0, SAIDA.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SAIDA, md.join("\n") + "\n", "utf8");
  console.log(`\nEscrito em ${SAIDA}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
