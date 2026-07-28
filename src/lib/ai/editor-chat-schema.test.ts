import { describe, it, expect } from "vitest";
import { zodSchema } from "ai";
import {
  editorChatSchema,
  editorChatSchemaCompacto,
  parseEstiloDsl,
  normalizarTurnoCompacto,
  type EditorChatTurnCompacto,
} from "./editor-chat-schema";

/** Conta parâmetros com tipo-união (`type:[...,"null"]` ou `anyOf`) — a métrica
 * que Google/Anthropic usam para recusar "too many parameters with union types
 * (limit: 16)". Foi exatamente esse erro que motivou o schema compacto. */
function contarUnioes(node: unknown, acc = { n: 0 }): number {
  if (!node || typeof node !== "object") return acc.n;
  if (Array.isArray(node)) {
    for (const n of node) contarUnioes(n, acc);
    return acc.n;
  }
  const o = node as Record<string, unknown>;
  if (Array.isArray(o.type) && (o.type as unknown[]).includes("null")) acc.n++;
  if (Array.isArray(o.anyOf)) acc.n++;
  for (const v of Object.values(o)) contarUnioes(v, acc);
  return acc.n;
}

/** Mesmas guardas do structured output (OpenAI estrito), com o conversor real. */
describe("editor-chat-schema (JSON Schema para o provedor)", () => {
  const json = zodSchema(editorChatSchema).jsonSchema;

  it("não emite oneOf", () => {
    expect(JSON.stringify(json)).not.toContain('"oneOf"');
  });

  it("toda propriedade de todo objeto está em required (modo estrito)", () => {
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (o.type === "object" && o.properties && typeof o.properties === "object") {
        const req = Array.isArray(o.required) ? (o.required as string[]) : [];
        for (const p of Object.keys(o.properties as object)) {
          expect(req, `propriedade "${p}" fora de required`).toContain(p);
        }
      }
      for (const v of Object.values(o)) {
        if (Array.isArray(v)) v.forEach(walk);
        else walk(v);
      }
    };
    walk(json);
  });

  it("valida um turno com estrutura proposta", () => {
    const r = editorChatSchema.safeParse({
      mensagem: "Este artigo ficou amplo; sugiro separar em dois.",
      ops: null,
      ferramenta: null,
      perguntas: null,
      estrutura: [
        { tmp: "p1", tipo: "folder", titulo: "Configuração", pai: null },
        { tmp: "a1", tipo: "article", titulo: "Parâmetros gerais", pai: "p1" },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("editor chat — schema compacto (limite de uniões dos provedores)", () => {
  it("o schema completo estoura o teto (por isso o compacto existe)", () => {
    expect(contarUnioes(zodSchema(editorChatSchema).jsonSchema)).toBeGreaterThan(16);
  });

  it("o schema compacto fica DENTRO do teto de 16 uniões", () => {
    // Regressão da falha real do Gemini: "25 parameters with union types (limit: 16)".
    expect(contarUnioes(zodSchema(editorChatSchemaCompacto).jsonSchema)).toBeLessThanOrEqual(16);
  });

  it("compacto: sem oneOf e toda propriedade em required (modo estrito)", () => {
    const json = zodSchema(editorChatSchemaCompacto).jsonSchema;
    expect(JSON.stringify(json)).not.toContain('"oneOf"');
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (o.type === "object" && o.properties && typeof o.properties === "object") {
        const req = Array.isArray(o.required) ? (o.required as string[]) : [];
        for (const p of Object.keys(o.properties as object)) expect(req).toContain(p);
      }
      for (const v of Object.values(o)) {
        if (Array.isArray(v)) v.forEach(walk);
        else walk(v);
      }
    };
    walk(json);
  });
});

describe("parseEstiloDsl", () => {
  it("interpreta pares válidos e ignora o que não casa", () => {
    const e = parseEstiloDsl("bg:purple; largura:metade; posicao:centro; xyz:foo");
    expect(e).toMatchObject({ bg: "purple", largura: "metade", posicao: "centro" });
    expect(e?.tamanhoFonte).toBeNull();
  });

  it("aceita sinônimos de chave e '=' como separador", () => {
    const e = parseEstiloDsl("fundo=dark; fonte=lg; icone=alert");
    expect(e).toMatchObject({ bg: "dark", tamanhoFonte: "lg", icone: "alert" });
  });

  it("descarta valores fora do domínio; vazio → null", () => {
    expect(parseEstiloDsl("bg:roxo")).toBeNull();
    expect(parseEstiloDsl("")).toBeNull();
    expect(parseEstiloDsl(null)).toBeNull();
  });
});

describe("normalizarTurnoCompacto", () => {
  it("converte estilo-string em objeto e zera perguntas", () => {
    const compacto: EditorChatTurnCompacto = {
      mensagem: "ok",
      ops: [{ op: "estilizar", blockId: "b1", blocks: null, estilo: "bg:pink" }],
      ferramenta: null,
    };
    const t = normalizarTurnoCompacto(compacto);
    expect(t.perguntas).toBeNull();
    expect(t.estrutura).toBeNull();
    expect(t.ops?.[0]?.estilo).toMatchObject({ bg: "pink" });
  });
});
