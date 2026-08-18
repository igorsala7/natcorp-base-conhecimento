/**
 * A DOCUMENTAÇÃO DA API É ESTÁTICA — e vinha inteira para o navegador.
 *
 * 414 linhas de prosa, tabelas de parâmetros e exemplos de requisição, todas
 * marcadas `"use client"` por causa de UMA coisa: o botão de copiar deste
 * bloco de código. O `useToast` obrigava o boundary, o boundary contaminava o
 * arquivo, e o arquivo inteiro passava a ser baixado, parseado e hidratado
 * para entregar texto que nunca muda.
 *
 * É a forma mais comum de 70% de um produto virar cliente: não uma decisão de
 * arquitetura, e sim um hook interativo no lugar errado. A fronteira desce
 * para onde a interatividade realmente está — o `CopyButton`, que já existe,
 * já é cliente e já tem o feedback dentro do próprio botão.
 */
import type { ReactNode } from "react";
import { CopyButton } from "@/components/ui/copy-button";

/** Bloco de código com rótulo de linguagem e botão copiar. */
function Codigo({ lang, children }: { lang: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-2xs font-medium uppercase tracking-wide text-text-muted">{lang}</span>
        <CopyButton text={children} />
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 text-xs leading-relaxed text-text">
        <code>{children}</code>
      </pre>
    </div>
  );
}

type Param = { nome: string; tipo: string; obr?: boolean; desc: string };

function Tabela({ params }: { params: Param[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Parâmetro</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.nome} className="border-t border-border align-top">
              <td className="whitespace-nowrap px-3 py-2">
                <code className="text-text">{p.nome}</code>
                {p.obr && <span className="ml-1 text-2xs font-semibold uppercase text-primary">obrig.</span>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-text-muted">{p.tipo}</td>
              <td className="px-3 py-2 text-text-muted">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Secao({ metodo, path, titulo, children }: { metodo: string; path: string; titulo: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-2xs font-bold text-primary">{metodo}</span>
        <code className="text-sm text-text">{path}</code>
        <span className="text-sm text-text-muted">— {titulo}</span>
        <span className="ml-auto text-text-muted transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-border px-4 py-4 text-sm leading-relaxed text-text-muted">{children}</div>
    </details>
  );
}

/**
 * `h3`, não `h4`: o cabeçalho da seção acima é `h2`, então pular para `h4`
 * abria um buraco na escada. Quem navega por títulos usa os níveis como
 * estrutura — um salto sugere um nível intermediário que não existe, e o
 * tamanho na tela (14px) não muda: hierarquia semântica e tamanho visual são
 * decisões separadas.
 */
const H = ({ children }: { children: ReactNode }) => <h3 className="text-sm font-semibold text-text">{children}</h3>;

// ————————————————————————————————————————————————————————————————
// Exemplos (strings simples — sem `${}` nem crases internas)
// ————————————————————————————————————————————————————————————————

const CURL_ANALYZE_JSON = `curl -X POST "$HOST/api/v1/analyze" \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "space": "documentacao-natcorp",
    "batchId": "IR59_20260731_0001",
    "final": true,
    "destino": "api",
    "instrucao": "Resuma os desligamentos por empresa e aponte anomalias",
    "columns": ["EMPRESA","MATRICULA","NOME","DATA"],
    "rows": [["700","365785","Joao","2026-07-01"], ["700","365786","Maria","2026-07-02"]]
  }'`;

const CURL_ANALYZE_CSVB64 = `# csv_b64 = base64 do CSV inteiro (não precisa escapar aspas/quebras no JSON)
curl -X POST "$HOST/api/v1/analyze" \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"space":"documentacao-natcorp","batchId":"IR59_x","final":true,
       "destino":"api","instrucao":"Analise os dados","csvBase64":"TUFUUklD..."}'`;

const CURL_ANALYZE_RAW = `# Corpo cru: o próprio CSV vira a tabela; parâmetros na query string
curl -X POST "$HOST/api/v1/analyze?space=documentacao-natcorp&batchId=IR59_x&final=true&destino=api&instrucao=Resuma" \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: text/csv" \\
  --data-binary @relatorio.csv

# multipart: tabela em 'data', anexos (OCR/visão) em 'arquivo'
curl -X POST "$HOST/api/v1/analyze?space=documentacao-natcorp&batchId=IR59_x&final=true" \\
  -H "Authorization: Bearer sk_live_..." \\
  -F data=@relatorio.csv -F arquivo=@nota.pdf`;

const CURL_ANALYZE_CHUNKS = `# Chunk 1..N-1 (não final) → { ok, recebidos_chunks, recebidos_linhas, final:false }
curl ... -d '{"space":"...","batchId":"L1","seq":0,"total":5,"columns":[...],"rows":[...]}'
curl ... -d '{"space":"...","batchId":"L1","seq":1,"rows":[...]}'
# Chunk final (fecha, monta 100% e analisa)
curl ... -d '{"space":"...","batchId":"L1","seq":4,"final":true,"rows":[...],"destino":"api","instrucao":"..."}'`;

const CURL_ANALYZE_CHAT = `# destino=chat → cai na conversa do usuário (exige identidade). Sem identidade, volta só via API.
curl -X POST "$HOST/api/v1/analyze" -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" \\
  -d '{"space":"documentacao-natcorp","batchId":"IR59_x","final":true,"destino":"chat",
       "instrucao":"Resuma minhas horas do mês",
       "identidade":{"empresa":"700","matricula":"365785","usuario":"365785","perfil":"MASTER","portal":"PO"},
       "csvBase64":"..."}'
# → 202 { ok, jobId, status:"na_fila" } — a análise cai no chat quando o worker terminar`;

const PLSQL_ANALYZE = `DECLARE
  l_resp CLOB;
  l_b64  CLOB;  -- base64 do CSV (use uma função clob_to_base64 no seu schema)
BEGIN
  l_b64 := clob_to_base64( gerar_csv_do_relatorio(59) );  -- seu CSV do IR

  apex_web_service.g_request_headers.DELETE;
  apex_web_service.g_request_headers(1).name  := 'Authorization';
  apex_web_service.g_request_headers(1).value := 'Bearer sk_live_...';
  apex_web_service.g_request_headers(2).name  := 'Content-Type';
  apex_web_service.g_request_headers(2).value := 'application/json';

  l_resp := apex_web_service.make_rest_request(
    p_url         => 'https://SEU_HOST/api/v1/analyze',
    p_http_method => 'POST',
    p_body        =>
      '{"space":"documentacao-natcorp",'
      || '"batchId":"IR59_' || TO_CHAR(SYSTIMESTAMP,'YYYYMMDDHH24MISSFF3') || '",'
      || '"final":true,"aguardar":true,"destino":"api",'   -- aguardar: espera o resultado (jobs pequenos)
      || '"instrucao":"Resuma os desligamentos por empresa e aponte anomalias",'
      || '"csvBase64":"' || l_b64 || '"}');

  -- Assíncrono: com "aguardar":true, l_resp já traz analise/resumo/meta se ficou pronto;
  -- senão traz { "jobId":"...", "status":"na_fila" } — aí faça o POLL:
  --   apex_web_service.make_rest_request(
  --     p_url => 'https://SEU_HOST/api/v1/analyze?jobId=' || l_job_id, p_http_method => 'GET');
  --   repita a cada ~2s até status = 'concluido' (ou 'erro').
  DBMS_OUTPUT.PUT_LINE( l_resp );
END;
/`;

const JS_ANALYZE = `const AUTH = { "Authorization": "Bearer sk_live_..." };
// 1) Envia (assíncrono) → recebe um jobId
const r = await fetch(HOST + "/api/v1/analyze", {
  method: "POST",
  headers: { ...AUTH, "Content-Type": "application/json" },
  body: JSON.stringify({
    space: "documentacao-natcorp",
    batchId: "IR59_" + Date.now(),
    final: true,
    destino: "api",
    instrucao: "Analise os dados e aponte anomalias",
    columns: ["EMPRESA", "NOME", "DATA"],
    rows: linhas,               // array de arrays
    // csvBase64: btoa(csv),    // alternativa ao rows
    llm: { provider: "anthropic", model: "claude-opus-4-8" },
  }),
});
const { jobId } = await r.json();

// 2) Poll até concluir
let job;
do {
  await new Promise((s) => setTimeout(s, 2000));
  job = await (await fetch(HOST + "/api/v1/analyze?jobId=" + jobId, { headers: AUTH })).json();
} while (job.status === "na_fila" || job.status === "analisando");
// job.analise, job.resumo, job.meta   (ou job.erro se status === "erro")`;

const CURL_EXTRACT_TIPO = `# Extração ESTRUTURADA (identifica o tipo e devolve o padrão canônico)
curl -X POST "$HOST/api/v1/extract" \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"arquivos":[{"nome":"conta_luz.jpg","mime":"image/jpeg","base64":"/9j/4AAQ..."}]}'
# → { ok, modo:"extrair", tipo_documento:"comprovante_endereco", tipo_label:"...",
#     dados:{ logradouro:{valor:"Rua X",confianca:0.95}, cep:{valor:"01310100",...}, cidade:{valor:null,confianca:0} } }`;

const CURL_EXTRACT_CAMPOS = `# Direcionado aos CAMPOS DA TELA (retorna o valor por campo, com o ref)
curl -X POST "$HOST/api/v1/extract" -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" \\
  -d '{"arquivos":[{"nome":"comprovante.pdf","mime":"application/pdf","base64":"..."}],
       "campos":[{"ref":"P59_ENDERECO","label":"Endereço"},
                 {"ref":"P59_CEP","label":"CEP","tipo":"número"},
                 {"label":"Cidade"},{"label":"UF"}]}'
# → { campos:[{campo:"Endereço",valor:"Rua X, 123",confianca:0.95,ref:"P59_ENDERECO"}, ...] }`;

const CURL_EXTRACT_ANALISAR = `# Análise LIVRE por prompt (resumo/parecer de um documento qualquer)
curl -X POST "$HOST/api/v1/extract" -H "Authorization: Bearer sk_live_..." -H "Content-Type: application/json" \\
  -d '{"arquivos":[{"nome":"java.pdf","mime":"application/pdf","base64":"..."}],
       "prompt":"faça um resumo deste documento técnico sobre programação em Java"}'
# → { ok, modo:"analisar", analise:"Este documento aborda ..." }`;

const CURL_EXTRACT_MULTIPART = `# multipart: manda o arquivo direto + campos como JSON
curl -X POST "$HOST/api/v1/extract" -H "Authorization: Bearer sk_live_..." \\
  -F file=@certidao.pdf \\
  -F 'campos=[{"label":"Nome"},{"label":"Data de Nascimento"}]'`;

const PLSQL_EXTRACT = `DECLARE
  l_resp CLOB;
  l_b64  CLOB := clob_to_base64( ler_arquivo_blob_base64(:doc_id) ); -- base64 do documento
BEGIN
  apex_web_service.g_request_headers.DELETE;
  apex_web_service.g_request_headers(1).name  := 'Authorization';
  apex_web_service.g_request_headers(1).value := 'Bearer sk_live_...';
  apex_web_service.g_request_headers(2).name  := 'Content-Type';
  apex_web_service.g_request_headers(2).value := 'application/json';

  l_resp := apex_web_service.make_rest_request(
    p_url => 'https://SEU_HOST/api/v1/extract', p_http_method => 'POST',
    p_body =>
      '{"arquivos":[{"nome":"documento.pdf","mime":"application/pdf","base64":"' || l_b64 || '"}],'
      || '"campos":[{"ref":"P59_ENDERECO","label":"Endereço"},{"ref":"P59_CEP","label":"CEP"}]}');

  -- Percorra l_resp.campos e faça APEX_UTIL.SET_SESSION_STATE nos itens da página.
END;
/`;

const JS_EXTRACT_FILL = `// No navegador (página APEX): extrai do documento e preenche os itens da tela
const fd = new FormData();
fd.append("file", arquivoInput.files[0]);
fd.append("campos", JSON.stringify([
  { ref: "P59_ENDERECO", label: "Endereço" },
  { ref: "P59_CEP", label: "CEP", tipo: "número" },
]));
const r = await fetch(HOST + "/api/v1/extract", {
  method: "POST",
  headers: { "Authorization": "Bearer sk_live_..." },   // sk_ só server-side em produção!
  body: fd,
});
const { campos } = await r.json();
campos.forEach((c) => { if (c.ref && c.confianca >= 0.6) apex.item(c.ref).setValue(c.valor); });`;

export function ApiDocs() {
  return (
    <section className="mt-10 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-text">Documentação das APIs</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
          Rotas server-to-server para análise de dados e leitura de documentos (OCR). Autenticação por chave
          secreta <code>sk_live_…</code> no header <code>Authorization: Bearer</code>. As rotas de análise/extração
          exigem o escopo <code>data.analyze</code>. Troque <code>$HOST</code> pelo domínio da sua instalação.
        </p>
      </div>

      {/* AUTENTICAÇÃO */}
      <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-text-muted">
        <H>Autenticação</H>
        <p className="mt-1">
          Crie uma chave acima com o escopo <code>data.analyze</code> e envie-a em todas as chamadas:
        </p>
        <div className="mt-2">
          <Codigo lang="http">{`Authorization: Bearer sk_live_xxxxxxxxxxxxxxxx
Content-Type: application/json`}</Codigo>
        </div>
        <ul className="mt-3 list-disc pl-5">
          <li>A chave é <b>secreta</b> — use só no backend (Oracle/servidor), nunca exposta no navegador do cliente final.</li>
          <li>Respostas: <code>200</code> ok · <code>400</code> payload inválido · <code>401</code> sem chave/chave inválida · <code>403</code> sem o escopo · <code>404</code> espaço inexistente · <code>413</code> excedeu o teto · <code>500</code> falha ao processar.</li>
        </ul>
      </div>

      {/* /api/v1/analyze */}
      <Secao metodo="POST" path="/api/v1/analyze" titulo="Análise de dados em lote (Interactive Reports)">
        <p>
          Recebe uma massa de dados (até <b>50.000 linhas</b>) em <b>um POST</b> ou em <b>chunks</b>, monta 100% no
          servidor e analisa com a IA. Cabe em modelo de <b>1M de contexto</b> via CSV compacto; se estourar, cai em
          <b> map-reduce</b> automático — sempre ancorado em <b>agregados exatos</b> calculados em código.
        </p>
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
          <b>Assíncrono:</b> o processamento pesado roda no <b>worker</b>. O POST final <b>enfileira</b> e responde{" "}
          <code>202</code> com um <code>jobId</code> + <code>status:&quot;na_fila&quot;</code>. Consulte o resultado por{" "}
          <code>GET /api/v1/analyze?jobId=…</code> (poll) ou receba no chat. Para jobs pequenos, <code>aguardar:true</code>{" "}
          faz um long-poll curto e já devolve o resultado.
        </p>

        <H>Parâmetros (JSON)</H>
        <Tabela
          params={[
            { nome: "space", tipo: "string", obr: true, desc: "slug do espaço (documentação) dono da análise." },
            { nome: "batchId", tipo: "string", obr: true, desc: "agrupa os chunks de um mesmo lote. Idempotente por (space, batchId)." },
            { nome: "rows", tipo: "array", desc: "linhas como arrays ou objetos. Alternativa a csv/csvBase64." },
            { nome: "csv / csvBase64", tipo: "string", desc: "o CSV como texto ou em base64 (recomendado). Auto-detecta o delimitador (, ; tab |)." },
            { nome: "columns", tipo: "string[]", desc: "cabeçalho. Se omitido e hasHeader≠false, usa a 1ª linha do CSV." },
            { nome: "delimiter / hasHeader", tipo: "string / bool", desc: "força o delimitador; hasHeader=false trata todas as linhas como dados." },
            { nome: "seq / total / final", tipo: "int / int / bool", desc: "chunking: fecha ao receber `total` chunks OU com final:true." },
            { nome: "aguardar", tipo: "bool", desc: "no POST final, faz long-poll curto (~15s) e devolve o resultado se ficar pronto; senão retorna o jobId." },
            { nome: "instrucao", tipo: "string", desc: "o que analisar (o prompt de orientação)." },
            { nome: "persona", tipo: "string", desc: "orientação adicional de sistema (tom, foco)." },
            { nome: "arquivos", tipo: "array", desc: "[{nome,mime,base64}] — Word/Excel/PDF/txt → texto; imagens e PDF escaneado → visão/OCR." },
            { nome: "llm", tipo: "object", desc: "{provider,model} — override do modelo (chave vem dos provedores já configurados)." },
            { nome: "destino", tipo: "enum", desc: '"api" (só Response) · "chat" (posta na conversa) · "ambos". Padrão: api.' },
            { nome: "track", tipo: "string", desc: "token de sessão cifrado (o mesmo que o widget gera)." },
            { nome: "identidade", tipo: "object", desc: "{empresa,matricula,usuario,perfil,portal,cpf} — alternativa/complemento ao track." },
          ]}
        />
        <p className="text-xs">
          <b>Regra do chat:</b> <code>destino:chat/ambos</code> exige identidade (track ou identidade). Sem ela, a análise
          <b> não vai ao chat</b> — volta só via API com um <code>aviso</code>.
        </p>

        <H>Resposta (fluxo assíncrono)</H>
        <Codigo lang="json">{`// chunk não-final
{ "ok": true, "batchId": "L1", "jobId": "5b1e...", "recebidos_chunks": 2, "recebidos_linhas": 2000, "final": false }

// chunk final → 202 (enfileirado; o worker analisa)
{ "ok": true, "batchId": "L1", "jobId": "5b1e...", "status": "na_fila", "final": true }

// GET /api/v1/analyze?jobId=5b1e...   (poll) — quando terminar:
{ "ok": true, "jobId": "5b1e...", "status": "concluido", "final": true,
  "analise": "A análise dos 5000 registros indica ...",
  "resumo": { "linhas": 5000, "colunas": 4, "por_coluna": [ /* somas/médias/min-máx/top exatos */ ] },
  "meta": { "linhas": 5000, "colunas": 4, "tokens_estimados": 240000, "reduzido": false },
  "conversationId": "..." }        // se destino incluiu chat

// status possíveis: "na_fila" · "analisando" · "concluido" · "erro"`}</Codigo>
        <Codigo lang="cURL — poll do resultado (GET)">{`curl -H "Authorization: Bearer sk_live_..." \\
  "$HOST/api/v1/analyze?space=documentacao-natcorp&batchId=IR59_x"
# ou por jobId:
curl -H "Authorization: Bearer sk_live_..." "$HOST/api/v1/analyze?jobId=5b1e..."`}</Codigo>

        <H>Exemplos</H>
        <Codigo lang="cURL — JSON (rows)">{CURL_ANALYZE_JSON}</Codigo>
        <Codigo lang="cURL — CSV em base64">{CURL_ANALYZE_CSVB64}</Codigo>
        <Codigo lang="cURL — corpo cru / multipart">{CURL_ANALYZE_RAW}</Codigo>
        <Codigo lang="cURL — chunks">{CURL_ANALYZE_CHUNKS}</Codigo>
        <Codigo lang="cURL — destino chat">{CURL_ANALYZE_CHAT}</Codigo>
        <Codigo lang="PL/SQL — Oracle (APEX_WEB_SERVICE)">{PLSQL_ANALYZE}</Codigo>
        <Codigo lang="JavaScript (fetch)">{JS_ANALYZE}</Codigo>
      </Secao>

      {/* /api/v1/extract */}
      <Secao metodo="POST" path="/api/v1/extract" titulo="Inteligência de documentos (OCR estruturado + análise)">
        <p>
          OCR de <b>imagem/PDF/Word</b>. Dois modos: <b>extrair</b> (identifica o tipo e devolve o padrão canônico do
          tipo — documentos pessoais, currículo… — ou direcionado aos campos da tela) e <b>analisar</b> (resposta livre
          por prompt, ex.: resumo). <code>modo:auto</code> (padrão) decide: campos → extrair; prompt de análise → analisar.
        </p>

        <H>Parâmetros</H>
        <Tabela
          params={[
            { nome: "arquivos", tipo: "array", obr: true, desc: "[{nome,mime,base64}] — 1 a 10 documentos (imagem/PDF/Word/etc.)." },
            { nome: "modo", tipo: "enum", desc: '"auto" (padrão) · "extrair" · "analisar".' },
            { nome: "prompt / instrucao", tipo: "string", desc: "a orientação. Em analisar, é o pedido (resumo, parecer…)." },
            { nome: "campos", tipo: "array", desc: "[{ref?,label,tipo?,descricao?}] — campos da tela para extração direcionada." },
            { nome: "llm", tipo: "object", desc: "{provider,model} — override do modelo (visão melhor com Anthropic)." },
          ]}
        />

        <H>Tipos reconhecidos (schema canônico por tipo)</H>
        <p className="text-xs">
          comprovante_endereco · certidao_nascimento · certidao_casamento · certidao_obito · atestado_medico · rg · cpf ·
          cnh · ctps · titulo_eleitor · pis_pasep · comprovante_pagamento · dados_bancarios · passaporte · curriculo ·{" "}
          <i>outro</i> (chave/valor livre). Cada campo vem com <code>valor</code> e <code>confianca</code> (0–1).
        </p>

        <H>Resposta</H>
        <Codigo lang="json">{`// modo extrair (por tipo)
{ "ok": true, "modo": "extrair", "tipo_documento": "comprovante_endereco",
  "tipo_label": "Comprovante de endereço",
  "dados": { "logradouro": {"valor":"Rua X","confianca":0.95}, "cep": {"valor":"01310100","confianca":0.96},
             "cidade": {"valor":null,"confianca":0} },
  "campos": [ { "campo":"logradouro","valor":"Rua X","confianca":0.95 } ] }

// modo analisar
{ "ok": true, "modo": "analisar", "analise": "Este documento aborda ..." }`}</Codigo>

        <H>Exemplos</H>
        <Codigo lang="cURL — por tipo">{CURL_EXTRACT_TIPO}</Codigo>
        <Codigo lang="cURL — direcionado à tela">{CURL_EXTRACT_CAMPOS}</Codigo>
        <Codigo lang="cURL — análise livre">{CURL_EXTRACT_ANALISAR}</Codigo>
        <Codigo lang="cURL — multipart">{CURL_EXTRACT_MULTIPART}</Codigo>
        <Codigo lang="PL/SQL — Oracle">{PLSQL_EXTRACT}</Codigo>
        <Codigo lang="JavaScript — extrai e preenche a tela (APEX)">{JS_EXTRACT_FILL}</Codigo>
      </Secao>

      {/* Outras rotas */}
      <Secao metodo="REF" path="/api/v1/*" titulo="Outras rotas do sistema">
        <ul className="list-disc pl-5">
          <li><code>POST /api/v1/chat</code> (alias <code>/api/ia</code>) — chat com IA (RAG + ferramentas), resposta em streaming SSE. Chave <b>pública</b> <code>pk_</code> + allowlist de origem.</li>
          <li><code>POST /api/v1/search</code> (alias <code>/api/docs</code>) — busca híbrida na documentação. Chave <code>pk_</code>.</li>
          <li><code>POST /api/v1/attach</code> — anexa um documento ao chat (multipart <code>file</code>); devolve o <code>attachment.id</code> para o chat.</li>
          <li><code>/api/manage/v1/…</code> — CRUD/publicação de conteúdo. Chave <code>sk_</code> com escopos <code>content.*</code>.</li>
          <li><code>GET /api/metrics</code> — observabilidade (chave <code>sk_</code> + <code>data.analyze</code>): profundidade das filas, concorrência (leases ativos), taxa de uso de IA (1min/5min), disjuntores e backend de cache.</li>
        </ul>
      </Secao>

      {/* Limites */}
      <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-text-muted">
        <H>Limites e notas</H>
        <ul className="mt-1 list-disc pl-5">
          <li>A análise em lote é <b>assíncrona</b> (processada no worker): o POST final devolve <code>202</code> + <code>jobId</code>; consulte por <code>GET …?jobId=…</code> ou <code>?space=…&amp;batchId=…</code>. Lotes concluídos são apagados após ~2 dias.</li>
          <li>Análise: até <b>50.000 linhas</b> por lote; orçamento de entrada configurável por <code>ANALYZE_MAX_INPUT_TOKENS</code> (padrão 500k).</li>
          <li>Arquivos: até <b>20 MB</b> cada; imagens vão à <b>visão</b>, PDF sem texto (escaneado) também (OCR nativo, melhor com Anthropic).</li>
          <li>Os agregados do <code>resumo</code> são <b>exatos</b> (calculados em código) — o modelo não “chuta” totais.</li>
          <li><b>Limites por base:</b> há um <b>semáforo de concorrência</b> (chamadas de IA simultâneas) e um <b>teto diário de tokens</b> por base — quando cheio, o chat responde “muitas solicitações”/“limite atingido” e as APIs retornam <code>429</code>. Ajuste por base em <code>tenant_limits</code> (ou os defaults por env).</li>
          <li>Envie os chunks <b>em sequência</b>; mande <code>instrucao</code>/<code>arquivos</code>/<code>identidade</code> no <b>POST final</b>.</li>
        </ul>
      </div>
    </section>
  );
}
