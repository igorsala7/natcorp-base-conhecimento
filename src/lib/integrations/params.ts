import { z } from "zod";
import type { TrackFields } from "@/lib/tracking/resolve";
import type { IdentityField, LoopConfig, ToolParam } from "./tools";
import { applyDateMask } from "./mask";

/** Identidade confiável, decifrada do token (nunca vinda do modelo). */
export type Identity = Partial<Record<IdentityField, string>>;

/**
 * O nome do parâmetro COMO O MODELO O VÊ.
 *
 * O cadastro guarda o nome que a API espera, e nem todo nome de API é aceito
 * como chave de propriedade num schema de ferramenta: a Anthropic exige
 * `^[a-zA-Z0-9_.-]{1,64}$` e recusa a requisição INTEIRA quando um caractere
 * escapa — foi o que derrubou o turno em 12/08/2026, quando as ferramentas do
 * Microsoft Graph (`$top`, `$search`, OData) enfim entraram no catálogo:
 *
 *   tools.5.custom.input_schema.properties: Property keys should match pattern
 *
 * Renomear no cadastro não serve: `top` não é `$top` para o Graph, e a chamada
 * sairia sem o parâmetro. Então traduzimos na fronteira — o modelo vê `top`, o
 * executor manda `$top` — e o cadastro continua descrevendo a API de verdade.
 */
export function chaveDoModelo(nome: string): string {
  const limpo = String(nome ?? "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64);
  // Sobrou vazio (nome só de símbolos) ou começou por caractere que confunde:
  // um nome qualquer é melhor que uma requisição recusada.
  return limpo.replace(/^[._-]+/, "") || "param";
}

/** Mapeia a identidade decifrada do token (p_*) para os campos do motor. */
export function identityFromTrack(t: TrackFields): Identity {
  return {
    usuario: t.p_usuario,
    cod_empresa: t.p_empresa,
    matricula: t.p_matricula,
    perfil: t.p_perfil,
    portal: t.p_portal,
    base: t.p_base,
    // Painel do Candidato. Já existia como campo de identidade resolvido no
    // LOGIN (ORDS); agora também chega pelo token, que é a única fonte quando
    // não há matrícula para o login resolver.
    cod_candidato: t.p_cod_candidato,
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
    if (p.origem !== "modelo" && p.origem !== "pessoa") continue;
    if (loop?.unit === "month" && p.nome === loop.param) continue; // o servidor preenche por mês
    // `pessoa`: a IA informa a MATRÍCULA-ALVO (quem consultar); vazio = o próprio usuário.
    // Sempre opcional; o guard escopo_pessoa libera conforme o painel (PO/PG/PC).
    if (p.origem === "pessoa") {
      const descBase =
        (p.descricao ? p.descricao + " " : "") +
        "Matrícula do COLABORADOR-ALVO da consulta — de QUEM o usuário quer ver. Deixe VAZIO para o PRÓPRIO usuário " +
        "logado. O sistema libera conforme o painel: Operador vê qualquer um; Gestor, só a equipe; Colaborador, só a si.";
      // Batching: se a matrícula-alvo TAMBÉM é o parâmetro de loop, a IA passa VÁRIAS numa
      // lista (uma consulta por colaborador, resultados juntados) — em vez de N chamadas.
      shape[chaveDoModelo(p.nome)] =
        loop?.unit === "values" && p.nome === loop.param
          ? z
              .array(z.string())
              .describe(
                descBase +
                  " Passe VÁRIAS matrículas numa lista quando o usuário pedir mais de um colaborador (ex.: uma lista inteira) " +
                  "— NÃO chame a ferramenta várias vezes; o sistema consulta cada matrícula e junta os resultados.",
              )
              .optional()
          : z.string().describe(descBase + " Informe uma matrícula por vez.").optional();
      continue;
    }
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
    // Loop por VALORES/BATCH: o parâmetro vira uma LISTA. `values` consulta um a um;
    // `batch` manda em lotes (a API aceita lista) — nos dois o modelo passa TODOS os valores.
    if ((loop?.unit === "values" || loop?.unit === "batch") && p.nome === loop.param) {
      campo = z
        .array(campo)
        .describe(
          (p.descricao ? p.descricao + " " : "") +
            (loop.unit === "batch"
              ? "Passe TODOS os valores numa lista (não divida você mesmo) — o sistema envia em lotes e junta os resultados."
              : "Passe UM valor, ou VÁRIOS numa lista se o usuário pedir mais de um — o sistema consulta cada um e junta os resultados."),
        );
    }
    shape[chaveDoModelo(p.nome)] = p.obrigatorio ? campo : campo.optional();
  }
  if (loop?.unit === "month") {
    shape[chaveDoModelo(loop.from!)] = z
      .string()
      .describe(
        `Início do período em ISO AAAA-MM. Para um ÚNICO mês, informe só este. Para um intervalo (ex.: o ano todo, ou abril a setembro), informe também ${loop.to}.`,
      );
    shape[chaveDoModelo(loop.to!)] = z
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
    else if (p.origem === "pessoa") {
      // Matrícula-alvo: usa a do MODELO se veio (o guard escopo_pessoa já validou/ajustou
      // pelo painel); senão cai para a IDENTIDADE (consulta do próprio usuário).
      const alvo = modelArgs[chaveDoModelo(p.nome)];
      raw = alvo != null && String(alvo).trim() !== "" ? alvo : identity[p.campoIdentidade ?? "matricula"];
    } else raw = modelArgs[chaveDoModelo(p.nome)];

    if (raw === undefined || raw === null || raw === "") {
      if (p.obrigatorio) throw new Error(mensagemParametroAusente(p));
      continue;
    }

    // `none`: a IA preenche (fica em modelArgs, para guards), mas não vai na requisição.
    if (p.local === "none") continue;

    let val: string | number | boolean = raw as string | number | boolean;
    if (p.tipo === "date" && p.mascara && typeof val === "string") {
      val = applyDateMask(val, p.mascara);
    }
    // P_BASE e P_PAINEL SEMPRE em MAIÚSCULO (exigência da API ORDS) — normaliza o valor
    // qualquer que seja a origem (identidade/token, fixo ou modelo) antes da requisição.
    if (typeof val === "string") {
      const nomeNorm = String(p.nome).toLowerCase().replace(/^p_/, "");
      if (nomeNorm === "base" || nomeNorm === "painel" || nomeNorm === "portal") val = val.toUpperCase();
    }

    if (p.local === "body") {
      buckets.body[p.nome] = val;
    } else {
      buckets[p.local][p.nome] = String(val);
    }
  }

  return buckets;
}

/**
 * Mensagem de parâmetro obrigatório ausente que diz DE ONDE ele deveria vir.
 *
 * Antes dizia só o nome ("Parâmetro obrigatório ausente: key"), e o nome do
 * parâmetro raramente é o nome do campo que falta: `key` vem de `session_key`
 * da credencial da base. Diagnosticar exigia abrir o cadastro da ferramenta,
 * ler a origem do parâmetro, descobrir o campo e só então conferir a
 * credencial — para cada base nova, toda vez.
 *
 * A mensagem chega ao log de execução e à resposta da ferramenta, então ela é
 * o que alguém lê primeiro. Dizer o campo e a tela encurta a investigação
 * inteira para uma frase.
 */
export function mensagemParametroAusente(p: ToolParam): string {
  const base = `Parâmetro obrigatório ausente: ${p.nome}`;
  if (p.origem === "credencial") {
    const campo = p.campoCredencial ? `"${p.campoCredencial}"` : "(campo não definido na ferramenta)";
    return (
      `${base}. Ele vem do campo ${campo} da credencial desta base, que está em branco. ` +
      `Preencha em Integrações › Bases / Clientes › editar a credencial.`
    );
  }
  if (p.origem === "identidade") {
    const campo = p.campoIdentidade ? `"${p.campoIdentidade}"` : "(campo não definido na ferramenta)";
    return (
      `${base}. Ele vem de ${campo} no token de rastreio, que não chegou nesta conversa. ` +
      `Confira o bloco que gera o token no painel.`
    );
  }
  if (p.origem === "fixo") {
    return `${base}. É um valor fixo e o cadastro da ferramenta está com ele em branco.`;
  }
  if (p.origem === "pessoa") {
    return `${base}. Nem o pedido informou a matrícula-alvo, nem o token de rastreio trouxe a do usuário.`;
  }
  return `${base}. O modelo não informou este parâmetro no pedido.`;
}
