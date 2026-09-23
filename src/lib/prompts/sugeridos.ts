import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PROMPTS SUGERIDOS — os prontos, que o administrador escreve.
 *
 * Pedido do dono (23/09): muita gente não consegue formular a pergunta. O
 * administrador cadastra prompts prontos, e eles aparecem no widget no MESMO
 * lugar dos que o próprio usuário salvou.
 *
 * ── Dois donos, uma tabela ────────────────────────────────────────────
 * `base_code IS NULL` é o conjunto da Natcorp, que vale para todo cliente;
 * preenchido é o do cliente, que só ele vê e só ele edita. O escopo aqui é
 * sempre `string | null`, e `null` NÃO é "qualquer um" — é literalmente o
 * catálogo global. Quem chama decide se a pessoa pode escrever naquele escopo;
 * este módulo não tem sessão para consultar.
 *
 * ── A elegibilidade NÃO mora aqui ─────────────────────────────────────
 * Quem decide o que um usuário vê é a função `prompts_sugeridos` no banco. Não
 * por gosto por SQL: o widget é código público, e filtrar do lado de cá
 * significaria trafegar a lista inteira até o navegador de alguém que não pode
 * ver metade dela. Ver o comentário da migration `..._prompts_sugeridos_rpc`.
 */

/** Um prompt como o USUÁRIO recebe: já filtrado, sem as regras de quem vê. */
export type PromptSugerido = {
  id: string;
  label: string;
  texto: string;
  /** Veio do catálogo da Natcorp (true) ou do próprio cliente (false). */
  global: boolean;
  favorito: boolean;
  categorias: string[];
};

/** Um prompt como o ADMINISTRADOR edita: com as seis allowlists à mostra. */
export type PromptAdmin = {
  id: string;
  label: string;
  texto: string;
  /** Visibilidade por base. Só faz diferença no catálogo global. */
  bases: string[];
  portais: string[];
  perfis: string[];
  empresas: string[];
  usuarios: string[];
  matriculas: string[];
  ativo: boolean;
  ordem: number;
  global: boolean;
  categoriaIds: string[];
};

export type Categoria = { id: string; nome: string; ordem: number; ativo: boolean; global: boolean };

export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { id?: string } : { id: string }))
  | { ok: false; error: string };

/** Escopo de escrita: `null` = catálogo global da Natcorp. */
export type Escopo = string | null;

const LIM_LABEL = 80;
const LIM_TEXTO = 8000;
const LIM_ITENS = 100;
const LIM_ITEM = 200;

const norm = (s: string) => s.trim().toLowerCase();

/** Escopo normalizado para gravar: `null` fica `null`, resto vira minúsculo. */
function escopoParaGravar(e: Escopo): string | null {
  if (e == null) return null;
  const v = e.trim();
  return v ? v.toLowerCase() : null;
}

/**
 * Limpa uma allowlist vinda de formulário: apara, descarta vazios, tira
 * repetição por caixa e corta o exagero.
 *
 * A deduplicação é por `lower(btrim())` porque é assim que o banco compara.
 * Guardar 'FOLHA' e 'Folha' como dois itens não muda o resultado da consulta,
 * mas faz a tela mostrar duas linhas idênticas e o admin achar que uma delas
 * não está funcionando.
 */
function listaLimpa(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const s = item.trim().slice(0, LIM_ITEM);
    if (!s) continue;
    const k = norm(s);
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(s);
    if (out.length >= LIM_ITENS) break;
  }
  return out;
}

// ── Lado do usuário ───────────────────────────────────────────────────

/**
 * O que ESTE usuário pode ver, já ordenado (favoritos primeiro).
 *
 * `base` sem valor devolve lista vazia em vez de devolver o catálogo global:
 * sem base não há identidade, e o favorito não teria a quem pertencer. É o
 * mesmo critério do `prompt-store.ts` para a biblioteca pessoal.
 */
export async function listarSugeridos(ident: {
  base?: string | null;
  portal?: string | null;
  perfil?: string | null;
  usuario?: string | null;
  empresa?: string | null;
  matricula?: string | null;
}): Promise<PromptSugerido[]> {
  const base = ident.base?.trim();
  if (!base) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("prompts_sugeridos", {
    base_ref: base,
    portal_ref: ident.portal?.trim() || null,
    perfil_ref: ident.perfil?.trim() || null,
    usuario_ref: ident.usuario?.trim() || null,
    empresa_ref: ident.empresa?.trim() || null,
    matricula_ref: ident.matricula?.trim() || null,
  });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    label: r.label,
    texto: r.texto,
    global: r.global,
    favorito: r.favorito,
    categorias: r.categorias ?? [],
  }));
}

/**
 * Marca/desmarca favorito. `false` quer dizer "não pode" OU "faltou
 * identidade" — de propósito: distinguir os dois na resposta diria a quem
 * tentou adivinhar um id que aquele prompt existe.
 */
export async function favoritarSugerido(
  base: string,
  usuario: string,
  promptId: string,
  marcar: boolean,
): Promise<boolean> {
  if (!base?.trim() || !usuario?.trim() || !promptId) return false;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("prompt_favoritar", {
    prompt_ref: promptId,
    base_ref: base.trim(),
    usuario_ref: usuario.trim(),
    marcar,
  });
  return !error && data === true;
}

// ── Lado do administrador ─────────────────────────────────────────────

/** Todos os prompts de UM escopo, ativos e inativos, na ordem da tela. */
export async function listarParaAdmin(escopo: Escopo): Promise<PromptAdmin[]> {
  const supabase = createAdminClient();
  const base = escopoParaGravar(escopo);
  let q = supabase
    .from("prompt_sugerido")
    .select(
      "id, label, texto, bases, portais, perfis, empresas, usuarios, matriculas, ativo, ordem, base_code",
    )
    .order("ordem", { ascending: true })
    .order("label", { ascending: true })
    .limit(500);
  q = base === null ? q.is("base_code", null) : q.eq("base_code", base);
  const { data } = await q;
  if (!data?.length) return [];

  // Vínculos numa consulta só. São dezenas de linhas; um `in` resolve e evita
  // o embed aninhado do PostgREST, que depende de relação registrada no schema
  // cache e falha calado quando ela não está lá.
  const ids = data.map((p) => p.id);
  const { data: vinc } = await supabase
    .from("prompt_sugerido_categoria")
    .select("prompt_id, categoria_id")
    .in("prompt_id", ids);
  const porPrompt = new Map<string, string[]>();
  for (const v of vinc ?? []) {
    const lista = porPrompt.get(v.prompt_id) ?? [];
    lista.push(v.categoria_id);
    porPrompt.set(v.prompt_id, lista);
  }

  return data.map((p) => ({
    id: p.id,
    label: p.label,
    texto: p.texto,
    bases: p.bases ?? [],
    portais: p.portais ?? [],
    perfis: p.perfis ?? [],
    empresas: p.empresas ?? [],
    usuarios: p.usuarios ?? [],
    matriculas: p.matriculas ?? [],
    ativo: p.ativo,
    ordem: Number(p.ordem ?? 0),
    global: p.base_code === null,
    categoriaIds: porPrompt.get(p.id) ?? [],
  }));
}

export type EntradaPrompt = {
  id?: string | null;
  label: string;
  texto: string;
  bases?: unknown;
  portais?: unknown;
  perfis?: unknown;
  empresas?: unknown;
  usuarios?: unknown;
  matriculas?: unknown;
  ativo?: boolean;
  ordem?: number;
  categoriaIds?: unknown;
  /** Quem escreveu: usuário do Supabase (interno) ou login do ERP (cliente). */
  autor?: { id?: string | null; ref?: string | null };
};

/** Cria ou atualiza um prompt DENTRO do escopo — nunca o move para outro. */
export async function salvarPrompt(escopo: Escopo, entrada: EntradaPrompt): Promise<Resultado> {
  const label = (entrada.label ?? "").trim().slice(0, LIM_LABEL);
  const texto = (entrada.texto ?? "").trim().slice(0, LIM_TEXTO);
  if (!label) return { ok: false, error: "O título do prompt é obrigatório." };
  if (!texto) return { ok: false, error: "O texto do prompt é obrigatório." };

  const supabase = createAdminClient();
  const base = escopoParaGravar(escopo);
  const campos = {
    label,
    texto,
    bases: listaLimpa(entrada.bases),
    portais: listaLimpa(entrada.portais),
    perfis: listaLimpa(entrada.perfis),
    empresas: listaLimpa(entrada.empresas),
    usuarios: listaLimpa(entrada.usuarios),
    matriculas: listaLimpa(entrada.matriculas),
    ativo: entrada.ativo !== false,
    ordem: Number.isFinite(entrada.ordem) ? Number(entrada.ordem) : 0,
  };

  let id = entrada.id?.trim() || null;
  if (id) {
    // O `base_code` entra no WHERE, não no SET: editar não pode mudar o dono.
    // Sem isso, um id de outro cliente chegando pelo formulário viraria uma
    // edição bem-sucedida no catálogo alheio.
    let up = supabase.from("prompt_sugerido").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", id);
    up = base === null ? up.is("base_code", null) : up.eq("base_code", base);
    const { data, error } = await up.select("id").maybeSingle();
    if (error || !data) return { ok: false, error: error?.message ?? "Prompt não encontrado neste escopo." };
  } else {
    const { data, error } = await supabase
      .from("prompt_sugerido")
      .insert({
        ...campos,
        base_code: base,
        criado_por_id: entrada.autor?.id ?? null,
        criado_por_ref: entrada.autor?.ref ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Falha ao salvar." };
    id = data.id;
  }

  const r = await vincularCategorias(escopo, id!, entrada.categoriaIds);
  if (!r.ok) return r;
  return { ok: true, id: id! };
}

/**
 * Reescreve os vínculos de categoria do prompt.
 *
 * Só aceita categorias do MESMO escopo ou globais — um prompt do cliente pode
 * ser arquivado numa gaveta da Natcorp, mas nunca numa gaveta de outro cliente,
 * que é o caminho pelo qual o nome de uma categoria alheia vazaria na tela.
 */
async function vincularCategorias(
  escopo: Escopo,
  promptId: string,
  ids: unknown,
): Promise<Resultado> {
  const supabase = createAdminClient();
  const pedidos = Array.isArray(ids)
    ? [...new Set(ids.filter((v): v is string => typeof v === "string" && !!v.trim()))]
    : [];

  let validas: string[] = [];
  if (pedidos.length) {
    const base = escopoParaGravar(escopo);
    const filtro = base === null ? "base_code.is.null" : `base_code.is.null,base_code.eq.${base}`;
    const { data } = await supabase
      .from("prompt_categoria")
      .select("id")
      .in("id", pedidos)
      .or(filtro);
    validas = (data ?? []).map((c) => c.id);
  }

  const { error: eDel } = await supabase
    .from("prompt_sugerido_categoria")
    .delete()
    .eq("prompt_id", promptId);
  if (eDel) return { ok: false, error: eDel.message };
  if (!validas.length) return { ok: true };

  const { error } = await supabase
    .from("prompt_sugerido_categoria")
    .insert(validas.map((categoria_id) => ({ prompt_id: promptId, categoria_id })));
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function excluirPrompt(escopo: Escopo, id: string): Promise<Resultado> {
  if (!id) return { ok: false, error: "id ausente." };
  const supabase = createAdminClient();
  const base = escopoParaGravar(escopo);
  let del = supabase.from("prompt_sugerido").delete().eq("id", id);
  del = base === null ? del.is("base_code", null) : del.eq("base_code", base);
  const { error } = await del;
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── Categorias ────────────────────────────────────────────────────────

/**
 * As gavetas visíveis num escopo: as globais SEMPRE, mais as do cliente.
 *
 * "Geral" não está aqui e nunca estará — é o rótulo de quem não tem categoria,
 * decidido na hora de exibir. Se fosse linha, alguém a renomearia e existiriam
 * prompts órfãos de um nome que o código assume.
 */
export async function listarCategorias(escopo: Escopo): Promise<Categoria[]> {
  const supabase = createAdminClient();
  const base = escopoParaGravar(escopo);
  let q = supabase
    .from("prompt_categoria")
    .select("id, nome, ordem, ativo, base_code")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true })
    .limit(200);
  q = base === null ? q.is("base_code", null) : q.or(`base_code.is.null,base_code.eq.${base}`);
  const { data } = await q;
  return (data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    ordem: Number(c.ordem ?? 0),
    ativo: c.ativo,
    global: c.base_code === null,
  }));
}

export async function salvarCategoria(
  escopo: Escopo,
  entrada: { id?: string | null; nome: string; ordem?: number; ativo?: boolean },
): Promise<Resultado> {
  const nome = (entrada.nome ?? "").trim().slice(0, 60);
  if (!nome) return { ok: false, error: "O nome da categoria é obrigatório." };
  const supabase = createAdminClient();
  const base = escopoParaGravar(escopo);
  const campos = {
    nome,
    ordem: Number.isFinite(entrada.ordem) ? Number(entrada.ordem) : 0,
    ativo: entrada.ativo !== false,
  };

  if (entrada.id) {
    let up = supabase.from("prompt_categoria").update(campos).eq("id", entrada.id);
    up = base === null ? up.is("base_code", null) : up.eq("base_code", base);
    const { data, error } = await up.select("id").maybeSingle();
    if (error) return { ok: false, error: mensagemDeCategoria(error.message) };
    if (!data) return { ok: false, error: "Categoria não encontrada neste escopo." };
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("prompt_categoria")
    .insert({ ...campos, base_code: base })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: mensagemDeCategoria(error?.message) };
  return { ok: true, id: data.id };
}

/** O índice único guarda a regra; aqui só traduzimos para quem está na tela. */
function mensagemDeCategoria(msg?: string): string {
  if (msg && /prompt_categoria_nome_uq|duplicate key/i.test(msg)) {
    return "Já existe uma categoria com esse nome.";
  }
  return msg ?? "Falha ao salvar a categoria.";
}

/**
 * Exclui a gaveta. Os vínculos caem por cascata e os prompts continuam vivos —
 * passam a aparecer em "Geral". É o comportamento que a tela promete ao dizer
 * "sem categoria aparece em Geral": apagar a gaveta não pode apagar o conteúdo.
 */
export async function excluirCategoria(escopo: Escopo, id: string): Promise<Resultado> {
  if (!id) return { ok: false, error: "id ausente." };
  const supabase = createAdminClient();
  const base = escopoParaGravar(escopo);
  let del = supabase.from("prompt_categoria").delete().eq("id", id);
  del = base === null ? del.is("base_code", null) : del.eq("base_code", base);
  const { error } = await del;
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── Vocabulário real, para a tela não virar campo de texto livre ──────

export type Vocabulario = {
  portais: { id: string; nome: string }[];
  perfis: string[];
  /** Códigos de empresa (p_empresa é código no ERP: 700, 1, 2…), não nomes. */
  empresas: string[];
  /** Só preenchido no catálogo global — é lá que escolher base faz sentido. */
  bases: { code: string; nome: string }[];
};

/** Os três painéis do produto. Fixos: vêm do P_PAINEL do APEX. */
export const PORTAIS: { id: string; nome: string }[] = [
  { id: "PO", nome: "Operador" },
  { id: "PG", nome: "Gestor" },
  { id: "PC", nome: "Colaborador" },
];

/**
 * O que a tela oferece em cada dimensão.
 *
 * ── Quatro origens diferentes, de propósito ───────────────────────────
 * · portal  → constante: são três, vêm do P_PAINEL.
 * · base    → cadastro (`ai_bases`), e só no escopo global.
 * · perfil e empresa → OBSERVAÇÃO: o que já apareceu em conversa. Nenhum
 *   dos dois é enum — chegam do ERP como texto ('MASTER', 'PORTAL_COLAB',
 *   '700'), e uma lista fixa no código envelheceria calada. Campo livre
 *   produziria 'Folha' onde o ERP manda 'FOLHA': um prompt que não
 *   aparece para ninguém e não dá erro em lugar nenhum.
 *
 * Usuário e matrícula NÃO têm seletor. Identificam pessoas, e no catálogo
 * global (sem base) a consulta montaria, na tela de um administrador, a
 * lista de logins e matrículas de todos os clientes.
 */
export async function vocabularioDoEscopo(escopo: Escopo): Promise<Vocabulario> {
  const supabase = createAdminClient();
  const base = escopoParaGravar(escopo);

  const [voc, bases] = await Promise.all([
    supabase.rpc("vocabulario_rastreio", { base_ref: base ?? undefined }),
    base === null
      ? supabase
          .from("ai_bases")
          .select("base_code, name")
          .eq("active", true)
          .order("base_code")
          .limit(500)
      : Promise.resolve({ data: null }),
  ]);

  const por = (campo: string) =>
    (voc.data ?? []).filter((r) => r.campo === campo).map((r) => r.valor).filter(Boolean);

  return {
    portais: PORTAIS,
    perfis: por("perfil"),
    empresas: por("empresa"),
    bases: (bases.data ?? []).map((b) => ({ code: b.base_code, nome: b.name ?? b.base_code })),
  };
}
