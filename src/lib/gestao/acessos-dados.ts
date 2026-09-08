import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Dados da tela de acessos: o que existe para parametrizar, e o que já foi.
 *
 * O relatório de COBERTURA é a peça que justifica esta tela existir além do
 * formulário. Medido em 08/09/2026: das 124 ferramentas com módulo cadastrado,
 * 37 usam nomes de módulo que NÃO existem em `apex_programas` (`FINANCEIRO`,
 * `FÉRIAS`, `PONTO E FREQUÊNCIA`, `PAGAMENTO`, `DOCUMENTOS`…). A API de
 * permissões nunca vai devolvê-los, então o cruzamento automático não alcança
 * essas ferramentas — elas passam, e precisam aparecer em algum lugar para
 * alguém arrumar a taxonomia. Sem esta lista, o buraco fica invisível.
 */

export type ToolDaBase = {
  key: string;
  nome: string;
  descricaoUsuario: string | null;
  modulos: { modulo: string; submodulo: string | null }[];
  /** Falso quando nenhum módulo dela existe na taxonomia do ERP. */
  cobertaPelaTaxonomia: boolean;
};

export type RegraListada = {
  id: string;
  painel: string | null;
  alvo_tipo: "base" | "perfil" | "usuario";
  alvo: string | null;
  escopo_tipo: "tool" | "modulo" | "submodulo";
  tool_key: string | null;
  modulo: string | null;
  submodulo: string | null;
  efeito: "permitir" | "negar";
  observacao: string | null;
  criado_por: string | null;
  criado_em: string;
};

export type DadosAcessos = {
  tools: ToolDaBase[];
  regras: RegraListada[];
  /** Módulos e submódulos que o ERP conhece — alimenta os seletores. */
  taxonomia: { modulo: string; submodulos: string[] }[];
  semCobertura: number;
};

export async function carregarDadosAcessos(baseCode: string): Promise<DadosAcessos> {
  const db = createAdminClient();
  const alvo = baseCode.trim().replace(/([\\%_])/g, "\\$1");

  const [baseRow, regrasRes, modulosRes] = await Promise.all([
    db.from("ai_bases").select("id").ilike("base_code", alvo).maybeSingle(),
    db
      .from("ai_acesso_regras")
      .select(
        "id, painel, alvo_tipo, alvo, escopo_tipo, tool_key, modulo, submodulo, efeito, observacao, criado_por, criado_em",
      )
      .eq("base_code", baseCode.trim().toLowerCase())
      .eq("ativo", true)
      .order("criado_em", { ascending: false })
      .range(0, 999),
    db.from("ai_modules").select("modulo, submodulo").ilike("base_code", alvo).range(0, 4999),
  ]);

  // Taxonomia do ERP, agrupada. Set para o cruzamento; lista para o seletor.
  const porModulo = new Map<string, Set<string>>();
  for (const m of modulosRes.data ?? []) {
    const k = String(m.modulo).trim();
    if (!porModulo.has(k)) porModulo.set(k, new Set());
    if (m.submodulo) porModulo.get(k)!.add(String(m.submodulo).trim());
  }
  const chavesTaxonomia = new Set([...porModulo.keys()].map((m) => m.toLowerCase()));

  const baseId = baseRow.data?.id ?? null;
  if (!baseId) {
    return { tools: [], regras: (regrasRes.data ?? []) as RegraListada[], taxonomia: [], semCobertura: 0 };
  }

  // Só as ferramentas HABILITADAS nesta base: o catálogo global tem 127, mas o
  // cliente só pode parametrizar o que efetivamente roda para ele.
  const { data: baseTools } = await db
    .from("ai_base_tools")
    .select("tool_id, enabled, ai_tools!inner(id, key, name, descricao_usuario, active)")
    .eq("base_id", baseId)
    .eq("enabled", true)
    .range(0, 999);

  const linhas = (baseTools ?? []) as unknown as {
    tool_id: string;
    ai_tools: { id: string; key: string; name: string; descricao_usuario: string | null; active: boolean };
  }[];

  const ativas = linhas.filter((l) => l.ai_tools?.active);
  const ids = ativas.map((l) => l.tool_id);

  const tagsPorTool = new Map<string, { modulo: string; submodulo: string | null }[]>();
  if (ids.length > 0) {
    // `in` com ~90 ids cabe folgado; o teto do PostgREST é de LINHAS, e uma tool
    // costuma ter poucas tags.
    const { data: tags } = await db
      .from("ai_tool_modules")
      .select("tool_id, modulo, submodulo")
      .in("tool_id", ids)
      .range(0, 4999);
    for (const t of tags ?? []) {
      const lista = tagsPorTool.get(t.tool_id) ?? [];
      lista.push({ modulo: t.modulo, submodulo: t.submodulo });
      tagsPorTool.set(t.tool_id, lista);
    }
  }

  const tools: ToolDaBase[] = ativas
    .map((l) => {
      const modulos = tagsPorTool.get(l.tool_id) ?? [];
      return {
        key: l.ai_tools.key,
        nome: l.ai_tools.name,
        descricaoUsuario: l.ai_tools.descricao_usuario,
        modulos,
        // Sem tag nenhuma não é "descoberta": é ausência de eixo. Só conta como
        // falta de cobertura quem TEM tag e nenhuma delas existe no ERP.
        cobertaPelaTaxonomia:
          modulos.length === 0 ||
          modulos.some((m) => chavesTaxonomia.has(m.modulo.trim().toLowerCase())),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    tools,
    regras: (regrasRes.data ?? []) as RegraListada[],
    taxonomia: [...porModulo.entries()]
      .map(([modulo, subs]) => ({
        modulo,
        submodulos: [...subs].sort((a, b) => a.localeCompare(b, "pt-BR")),
      }))
      .sort((a, b) => a.modulo.localeCompare(b.modulo, "pt-BR")),
    semCobertura: tools.filter((t) => !t.cobertaPelaTaxonomia).length,
  };
}
