import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * O contexto da base é cacheado em memória por 60s e o chamador FILTRA a lista
 * de tools por pessoa (conta conectada, painel, perfil). Se o cache devolver o
 * próprio objeto, o corte de um usuário apaga a ferramenta para todos os
 * próximos — foi assim que o `ms_email_enviar` sumiu do segundo turno seguido,
 * sem corte, sem aviso e sem botão de conectar.
 */

/** Uma tabela por chamada de `.from()`, na ordem que `carregarBaseContext` usa. */
const respostas: unknown[] = [];
function thenable(valor: unknown) {
  const q: Record<string, unknown> = {};
  const enc = () => q;
  for (const m of ["select", "eq", "ilike", "in", "limit", "or"]) q[m] = enc;
  q.maybeSingle = async () => valor;
  q.then = (r: (v: unknown) => unknown) => Promise.resolve(valor).then(r);
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => thenable(respostas.shift() ?? { data: [] }) }),
}));

import { loadBaseContext, invalidateBaseContext } from "./resolve";

const BASE = { id: "b1", name: "Base", active: true, base_url: "https://api", credential_id: "c1", tool_routing: false };
const TOOLS = {
  data: [
    {
      base_url: null, credential_id: null, enabled: true, portais: [], empresas: [], perfis: [],
      tool: {
        id: "t1", key: "ms_email_enviar", name: "Enviar e-mail", description: "", method: "POST",
        path_template: "/me/sendMail", auth_type: "oauth2_user", params: [], response_hint: null,
        search_terms: null, body_mode: null, guard: null, cache_ttl: null, cache_scope: null, loop: null,
        endpoint_kind: "external", external_url: "https://graph.microsoft.com/v1.0", credential_id: "cat1",
        system_prompt: null, always_include: false, prioridade: 0, grupo_ambiguidade: null,
        panel_scope: null, exclude_self: false, identity_mode: "user", body_template: null, active: true,
      },
    },
  ],
};

function enfileirarCargaCompleta() {
  respostas.length = 0;
  respostas.push({ data: BASE });              // ai_bases
  respostas.push(TOOLS);                       // ai_base_tools
  respostas.push({ data: [{ id: "cat1", provider: "microsoft" }] }); // credencial do catálogo
  respostas.push({ data: [{ id: "b1cred", provider: "microsoft", base_id: "b1", is_global: false }] }); // credencial DESTA base
  respostas.push({ data: [] });                // ai_tool_priority_rules
}

describe("loadBaseContext — isolamento do cache", () => {
  beforeEach(() => invalidateBaseContext());

  it("o corte de um turno não apaga a ferramenta do turno seguinte", async () => {
    enfileirarCargaCompleta();
    const primeiro = await loadBaseContext("acme");
    expect(primeiro?.tools).toHaveLength(1);

    // O chamador filtra por pessoa, exatamente como o `tool-builder` faz.
    primeiro!.tools = primeiro!.tools.filter((t) => t.tool.identity_mode !== "user");
    expect(primeiro!.tools).toHaveLength(0);

    // Segundo turno DENTRO do TTL: sem ida ao banco (nada enfileirado) e ainda
    // com a ferramenta pessoal, para o corte poder acontecer de novo — com
    // trace, aviso e botão de conectar.
    const segundo = await loadBaseContext("acme");
    expect(segundo?.tools.map((t) => t.tool.key)).toEqual(["ms_email_enviar"]);

    // E o turno seguinte a um corte feito sobre um CACHE HIT também: são dois
    // caminhos de retorno diferentes, e proteger só o primeiro adiaria o
    // sintoma em um turno em vez de resolvê-lo.
    segundo!.tools = [];
    const terceiro = await loadBaseContext("acme");
    expect(terceiro?.tools.map((t) => t.tool.key)).toEqual(["ms_email_enviar"]);
  });

  it("a credencial da conta pessoal é a da BASE, não a do catálogo", async () => {
    enfileirarCargaCompleta();
    const ctx = await loadBaseContext("acme");
    expect(ctx?.tools[0]?.credentialId).toBe("b1cred");
    expect(ctx?.tools[0]?.provedorPessoal).toBe("microsoft");
  });

  it("sem credencial própria, usa a GLOBAL — há um app só no provedor", async () => {
    // A URL de callback do sistema é única, então cobrar um app por cliente
    // seria cobrar N registros que só poderiam apontar para a mesma URL.
    respostas.length = 0;
    respostas.push({ data: BASE });
    respostas.push(TOOLS);
    respostas.push({ data: [{ id: "cat1", provider: "microsoft" }] });
    respostas.push({ data: [{ id: "credGlobal", provider: "microsoft", base_id: "outra", is_global: true }] });
    respostas.push({ data: [] });
    const ctx = await loadBaseContext("acme");
    expect(ctx?.tools[0]?.credentialId).toBe("credGlobal");
  });

  it("com as duas, a da BASE ganha da global", async () => {
    respostas.length = 0;
    respostas.push({ data: BASE });
    respostas.push(TOOLS);
    respostas.push({ data: [{ id: "cat1", provider: "microsoft" }] });
    respostas.push({
      data: [
        { id: "credGlobal", provider: "microsoft", base_id: "outra", is_global: true },
        { id: "b1cred", provider: "microsoft", base_id: "b1", is_global: false },
      ],
    });
    respostas.push({ data: [] });
    const ctx = await loadBaseContext("acme");
    expect(ctx?.tools[0]?.credentialId).toBe("b1cred");
  });
});
