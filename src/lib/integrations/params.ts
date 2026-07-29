import { z } from "zod";
import type { TrackFields } from "@/lib/tracking/resolve";
import type { IdentityField, LoopConfig, ToolParam } from "./tools";
import { applyDateMask } from "./mask";

/** Identidade confiável, decifrada do token (nunca vinda do modelo). */
export type Identity = Partial<Record<IdentityField, string>>;

/** Mapeia a identidade decifrada do token (p_*) para os campos do motor. */
export function identityFromTrack(t: TrackFields): Identity {
  return {
    usuario: t.p_usuario,
    cod_empresa: t.p_empresa,
    matricula: t.p_matricula,
    perfil: t.p_perfil,
    portal: t.p_portal,
  };
}

/**
 * Schema Zod SÓ com os parâmetros que a IA preenche (origem = 'modelo').
 * É o `inputSchema` da tool no AI SDK — o modelo nunca vê os de identidade/fixo.
 *
 * Com `loop`, o parâmetro mensal (`loop.param`) é OMITIDO do schema e trocado
 * por dois campos de período (`loop.from` obrigatório, `loop.to` opcional): o
 * modelo informa o intervalo e o servidor itera mês a mês (ver `loop.ts`).
 */
export function buildModelSchema(
  params: ToolParam[],
  loop?: LoopConfig | null,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    if (p.origem !== "modelo") continue;
    if (loop && p.nome === loop.param) continue; // o servidor preenche por iteração
    let campo: z.ZodTypeAny;
    switch (p.tipo) {
      case "number":
        campo = z.number();
        break;
      case "boolean":
        campo = z.boolean();
        break;
      case "enum":
        campo =
          p.opcoes && p.opcoes.length > 0
            ? z.enum(p.opcoes as [string, ...string[]])
            : z.string();
        break;
      case "date":
        campo = z.string().describe(p.descricao || "Data no formato ISO (YYYY-MM-DD).");
        break;
      default:
        campo = z.string();
    }
    if (p.descricao && p.tipo !== "date") campo = campo.describe(p.descricao);
    shape[p.nome] = p.obrigatorio ? campo : campo.optional();
  }
  if (loop) {
    shape[loop.from] = z
      .string()
      .describe(
        `Início do período em ISO AAAA-MM. Para um ÚNICO mês, informe só este. Para um intervalo (ex.: o ano todo, ou abril a setembro), informe também ${loop.to}.`,
      );
    shape[loop.to] = z
      .string()
      .describe(`Fim do período em ISO AAAA-MM (inclusive). Omita para consultar um único mês (${loop.from}).`)
      .optional();
  }
  return z.object(shape);
}

export type ResolvedBuckets = {
  path: Record<string, string>;
  query: Record<string, string>;
  header: Record<string, string>;
  body: Record<string, unknown>;
};

/**
 * Resolve os valores finais de cada parâmetro por ORIGEM e distribui por LOCAL.
 * - identidade → do token (obrigatório e ausente = erro, não chuta);
 * - fixo       → o valor cadastrado;
 * - credencial → um campo do segredo da credencial (ex.: session_key);
 * - modelo     → o que a IA extraiu.
 * Datas recebem a máscara da API.
 */
export function resolveParams(
  params: ToolParam[],
  modelArgs: Record<string, unknown>,
  identity: Identity,
  credentialSecret?: Record<string, string>,
): ResolvedBuckets {
  const buckets: ResolvedBuckets = { path: {}, query: {}, header: {}, body: {} };

  for (const p of params) {
    let raw: unknown;
    if (p.origem === "identidade") raw = p.campoIdentidade ? identity[p.campoIdentidade] : undefined;
    else if (p.origem === "fixo") raw = p.valorFixo ?? undefined;
    else if (p.origem === "credencial") raw = p.campoCredencial ? credentialSecret?.[p.campoCredencial] : undefined;
    else raw = modelArgs[p.nome];

    if (raw === undefined || raw === null || raw === "") {
      if (p.obrigatorio) throw new Error(`Parâmetro obrigatório ausente: ${p.nome}`);
      continue;
    }

    // `none`: a IA preenche (fica em modelArgs, para guards), mas não vai na requisição.
    if (p.local === "none") continue;

    let val: string | number | boolean = raw as string | number | boolean;
    if (p.tipo === "date" && p.mascara && typeof val === "string") {
      val = applyDateMask(val, p.mascara);
    }

    if (p.local === "body") {
      buckets.body[p.nome] = val;
    } else {
      buckets[p.local][p.nome] = String(val);
    }
  }

  return buckets;
}
