import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { permissoesDoUsuario, taxonomiaDaBase } from "./permissoes-usuario";
import {
  decidirAcesso,
  permitidoPelaTaxonomia,
  type RegraAcesso,
  type ContextoAcesso,
  type ModuloDaTool,
} from "./acesso-regras";

/**
 * Contexto de acesso do TURNO: carrega uma vez o que decide, ferramenta a
 * ferramenta, se ela entra.
 *
 * Carregar por turno e não por ferramenta importa: com ~88 tools ativas, uma
 * consulta por tool seriam 88 idas ao banco e 88 chamadas ao ORDS por mensagem.
 *
 * ── As duas camadas, na ordem em que decidem ───────────────────────────
 *
 *   1. `ai_acesso_regras` — o que o cliente parametrizou na área /gestao.
 *      Tem PRECEDÊNCIA, como pedido. Decide sozinha quando fala da ferramenta.
 *   2. cruzamento automático com `/permissoes/v1/modulos` — o que a pessoa já
 *      pode abrir no APEX. Só é consultado quando a camada 1 fica em silêncio.
 *
 * Nenhuma das duas substitui a cerca que já existia (`ai_base_tools`,
 * `panel_scope`): elas somam.
 */

const REGRAS_TTL_MS = 60_000; // mesmo TTL do contexto da base, pelo mesmo motivo

type CacheRegras = { exp: number; regras: RegraAcesso[] };
const cacheRegras = new Map<string, CacheRegras>();

async function carregarRegras(baseCode: string): Promise<RegraAcesso[]> {
  const k = baseCode.trim().toLowerCase();
  const agora = Date.now();
  const hit = cacheRegras.get(k);
  if (hit && hit.exp > agora) return hit.regras;

  const db = createAdminClient();
  const { data } = await db
    .from("ai_acesso_regras")
    .select("painel, alvo_tipo, alvo, escopo_tipo, tool_key, modulo, submodulo, efeito")
    .eq("base_code", k)
    .eq("ativo", true)
    .range(0, 4999);

  const regras = (data ?? []) as RegraAcesso[];
  cacheRegras.set(k, { exp: agora + REGRAS_TTL_MS, regras });
  return regras;
}

/** Chamada pelas ações da tela de acessos, para a mudança valer na hora. */
export function invalidarRegrasAcesso(baseCode: string): void {
  cacheRegras.delete(baseCode.trim().toLowerCase());
  protegidasCache = null;
}

/**
 * Chaves das ferramentas que nenhuma regra de bloqueio alcança
 * (`ai_tools.protegida_de_bloqueio`). São as de ESTRUTURA e o menu de opções —
 * tabelas de domínio que traduzem o resto, e cuja ausência quebra consultas de
 * outros módulos.
 *
 * Global e não por base: a coluna é do catálogo, igual para todos os clientes.
 * TTL longo porque muda por decisão nossa, não por uso.
 */
let protegidasCache: { exp: number; chaves: Set<string> } | null = null;
const PROTEGIDAS_TTL_MS = 5 * 60_000;

async function carregarProtegidas(): Promise<Set<string>> {
  const agora = Date.now();
  if (protegidasCache && protegidasCache.exp > agora) return protegidasCache.chaves;

  const { data } = await createAdminClient()
    .from("ai_tools")
    .select("key")
    .eq("protegida_de_bloqueio", true)
    .range(0, 499);

  const chaves = new Set((data ?? []).map((t) => t.key));
  protegidasCache = { exp: agora + PROTEGIDAS_TTL_MS, chaves };
  return chaves;
}

/** Exposta para a tela de acessos desabilitar o que não dá para bloquear. */
export async function ferramentasProtegidas(): Promise<Set<string>> {
  return carregarProtegidas();
}

export type MotivoCorte =
  | { tipo: "regra"; efeito: "negar"; alvo_tipo: string; alvo: string | null }
  | { tipo: "taxonomia" };

export type ContextoDeAcesso = {
  /** `false` quando a ferramenta não pode ser oferecida neste turno. */
  permite(toolKey: string, modulos: readonly ModuloDaTool[]): true | MotivoCorte;
  /** Diagnóstico para o trace: o que foi possível apurar. */
  resumo: {
    regras: number;
    permissoesApuradas: boolean;
    modulosDoUsuario: number;
    taxonomiaConhecida: number;
    protegidas: number;
  };
};

/**
 * Monta o contexto de acesso do turno.
 *
 * Quando as permissões do ERP não puderem ser apuradas (base sem URL, ORDS
 * fora, credencial ruim), a camada 2 é DESLIGADA e só a camada 1 decide. Falha
 * de rede não é ausência de permissão: cortar tudo faria o chat perder as
 * ferramentas de dados no minuto em que a rede piscasse, com o sintoma
 * ("não tenho acesso aos seus dados") indistinguível de um defeito real.
 */
export async function montarContextoDeAcesso(
  baseCode: string,
  ctx: ContextoAcesso,
): Promise<ContextoDeAcesso> {
  const [regras, protegidas] = await Promise.all([carregarRegras(baseCode), carregarProtegidas()]);

  // A camada 2 só faz sentido com usuário e painel: sem eles não há o que
  // perguntar ao ERP.
  const podeCruzar = Boolean(ctx.usuario && ctx.painel);
  const [permissoes, taxonomia] = podeCruzar
    ? await Promise.all([
        permissoesDoUsuario(baseCode, ctx.usuario!, ctx.painel!),
        taxonomiaDaBase(baseCode),
      ])
    : [null, new Set<string>()];

  return {
    permite(toolKey, modulos) {
      const protegida = protegidas.has(toolKey);
      const d = decidirAcesso(regras, ctx, toolKey, modulos, protegida);
      if (d) {
        if (d.efeito === "negar") {
          return {
            tipo: "regra",
            efeito: "negar",
            alvo_tipo: d.regra.alvo_tipo,
            alvo: d.regra.alvo,
          };
        }
        // Permissão explícita do cliente VENCE o cruzamento automático — é o
        // que "o que parametrizarem tem mais prioridade" quer dizer.
        return true;
      }

      if (!permissoes) return true; // camada 2 desligada: não sabemos, não cortamos

      // Protegida também não cai pelo cruzamento automático. Se caísse, o
      // usuário que não tem o módulo ESTRUTURA no APEX — a maioria, porque
      // ninguém "abre a tela de sindicatos" — perderia a tradução de códigos em
      // todas as outras consultas.
      if (protegida) return true;

      return permitidoPelaTaxonomia(modulos, permissoes.modulos, taxonomia)
        ? true
        : { tipo: "taxonomia" };
    },
    resumo: {
      regras: regras.length,
      permissoesApuradas: permissoes !== null,
      modulosDoUsuario: permissoes?.modulos.length ?? 0,
      taxonomiaConhecida: taxonomia.size,
      protegidas: protegidas.size,
    },
  };
}
