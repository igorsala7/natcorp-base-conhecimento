import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorize, apiJson } from "@/lib/api/manage";
import { extrairDocumento } from "@/lib/analyze/extract-doc";
import { interpretarArquivos, type ArquivoIn } from "@/lib/analyze/files";
import { analisarDados } from "@/lib/analyze/analyze";
import { resolverModo } from "@/lib/analyze/doc-catalog";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/v1/extract — INTELIGÊNCIA DE DOCUMENTOS (imagem/PDF/Word/etc.) por OCR.
 * Auth: chave secreta `sk_` com escopo `data.analyze`. Dois modos:
 *
 *  - `extrair` (estruturado): identifica o TIPO e devolve os dados no padrão
 *    canônico do tipo (documentos pessoais, currículo, …). Direcionado aos
 *    CAMPOS DA TELA quando `campos` é enviado.
 *  - `analisar` (livre): responde ao `prompt` sobre o documento (ex.: "faça um
 *    resumo deste documento técnico sobre Java") — retorna texto.
 *
 * `modo` padrão = `auto`: campos → extrair; prompt de análise → analisar; senão extrair.
 *
 * JSON: { arquivos:[{nome,mime,base64}], modo?, prompt?/instrucao?, campos?, llm? }
 * multipart: arquivos como `file`; `campos`/`llm` como JSON; params por query.
 */
const campoSchema = z.object({
  ref: z.string().max(60).optional(),
  label: z.string().min(1).max(200),
  tipo: z.string().max(60).optional(),
  descricao: z.string().max(300).optional(),
});
const bodySchema = z.object({
  arquivos: z
    .array(z.object({ nome: z.string().max(200), mime: z.string().max(120).optional(), base64: z.string().max(30_000_000) }))
    .min(1)
    .max(10),
  modo: z.enum(["auto", "extrair", "analisar"]).optional(),
  prompt: z.string().max(8000).optional(),
  instrucao: z.string().max(8000).optional(),
  campos: z.array(campoSchema).max(200).optional(),
  llm: z.object({ provider: z.string().max(40).optional(), model: z.string().max(120).optional() }).optional(),
});
type Body = z.infer<typeof bodySchema>;

export async function POST(req: NextRequest) {
  const auth = await authorize(req, "data.analyze");
  if ("error" in auth) return auth.error;

  let body: Body;
  try {
    body = await lerRequisicao(req);
  } catch (e) {
    return apiJson({ error: "Payload inválido.", detalhe: (e as Error).message }, 400);
  }

  const prompt = body.prompt ?? body.instrucao;
  const modo = resolverModo(body.modo, !!body.campos?.length, prompt);

  try {
    if (modo === "analisar") {
      // Análise LIVRE do documento conforme o prompt (resumo, parecer, etc.).
      const arq = await interpretarArquivos(body.arquivos as ArquivoIn[]);
      if (!arq.imageParts.length && !arq.fileParts.length && !arq.texto) {
        return apiJson({ error: "Nenhum documento legível recebido." }, 400);
      }
      const r = await analisarDados({
        colunas: [],
        linhas: [],
        instrucao: prompt,
        persona: "O conteúdo é um DOCUMENTO/TEXTO (não uma tabela). Responda à instrução sobre o documento; se for resumo, cubra os pontos principais fielmente.",
        contextoArquivos: arq.texto,
        imageParts: arq.imageParts,
        fileParts: arq.fileParts,
        llm: body.llm,
        meta: { kind: "system" },
      });
      return apiJson({ ok: true, modo, analise: r.analise, arquivos: arq.metas }, 200);
    }

    // Extração ESTRUTURADA (catálogo/currículo/campos da tela).
    const r = await extrairDocumento({
      arquivos: body.arquivos as ArquivoIn[],
      campos: body.campos,
      instrucao: prompt,
      llm: body.llm,
      meta: { kind: "system" },
    });
    return apiJson({ ok: true, modo, ...r }, 200);
  } catch (e) {
    return apiJson({ error: "Falha ao processar o documento.", detalhe: (e as Error).message }, 500);
  }
}

/** JSON ou multipart (arquivos como `file`; `campos`/`llm` como JSON em `params`). */
async function lerRequisicao(req: NextRequest): Promise<Body> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return bodySchema.parse(await req.json());
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const arquivos: ArquivoIn[] = [];
    const extra: Record<string, unknown> = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") {
        if (k === "params") Object.assign(extra, JSON.parse(v));
        else if (k === "campos" || k === "llm") extra[k] = JSON.parse(v);
        else extra[k] = v;
        continue;
      }
      const bytes = new Uint8Array(await v.arrayBuffer());
      arquivos.push({ nome: v.name || k, mime: v.type, base64: Buffer.from(bytes).toString("base64") });
    }
    return bodySchema.parse({ ...extra, arquivos });
  }
  return bodySchema.parse(await req.json());
}
