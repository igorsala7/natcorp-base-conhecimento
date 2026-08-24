import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ChatTrace, persistirTrace, type TraceMeta } from "./trace";

/**
 * O que importa medir aqui é o que CHEGA no insert.
 *
 * `persistirTrace` é best-effort e disparado com `void`: se um campo parar de
 * ser gravado, nada quebra, nada aparece no log e ninguém percebe — a coluna só
 * fica silenciosamente nula. Foi assim que `ai_tool_casos.cortadas` passou sete
 * dias vazia. O teste existe para que o elo trace↔consumo não morra do mesmo
 * jeito.
 */
function supabaseFalso() {
  const inserido: Record<string, unknown>[] = [];
  const client = {
    from: (tabela: string) => ({
      insert: (linha: Record<string, unknown>) => {
        inserido.push({ _tabela: tabela, ...linha });
        return Promise.resolve({ error: null });
      },
    }),
  } as unknown as SupabaseClient<Database>;
  return { client, inserido };
}

const meta = (extra: Partial<TraceMeta> = {}): TraceMeta => ({
  desfecho: "resposta",
  pergunta: "quantos dias de férias eu tenho",
  ...extra,
});

describe("persistirTrace — elo com o consumo", () => {
  it("grava o turn_id recebido: é o join que diz quanto UM turno custou", async () => {
    const { client, inserido } = supabaseFalso();
    await persistirTrace(client, meta({ turnId: "11111111-2222-3333-4444-555555555555" }), new ChatTrace());

    expect(inserido).toHaveLength(1);
    expect(inserido[0]?._tabela).toBe("ai_chat_traces");
    expect(inserido[0]?.turn_id).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("sem turno vira NULO explícito, nunca ausente", async () => {
    // `undefined` some do JSON e a coluna fica com o default. Nulo explícito é o
    // que faz "não sei" ser legível na tabela — e nulo aqui NUNCA quer dizer
    // "custou zero".
    const { client, inserido } = supabaseFalso();
    await persistirTrace(client, meta(), new ChatTrace());

    expect(inserido[0]).toHaveProperty("turn_id");
    expect(inserido[0]?.turn_id).toBeNull();
  });

  it("id do trace só vai quando existe — sem ele o banco gera, como antes", async () => {
    const { client, inserido } = supabaseFalso();
    await persistirTrace(client, meta(), new ChatTrace());
    expect(inserido[0]).not.toHaveProperty("id");

    const outro = supabaseFalso();
    await persistirTrace(outro.client, meta({ id: "abc" }), new ChatTrace());
    expect(outro.inserido[0]?.id).toBe("abc");
  });

  it("falha do banco não derruba o chat", async () => {
    const client = {
      from: () => ({ insert: () => Promise.reject(new Error("banco fora")) }),
    } as unknown as SupabaseClient<Database>;

    await expect(persistirTrace(client, meta({ turnId: "t" }), new ChatTrace())).resolves.toBeUndefined();
  });
});
