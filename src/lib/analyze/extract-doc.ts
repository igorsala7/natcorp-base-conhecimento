import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModelEscolhido, type UsageMeta } from "@/lib/ai/config";
import { interpretarArquivos, type ArquivoIn } from "./files";
import { catalogoParaPrompt, tipoPorChave, normalizarChave, montarDados } from "./doc-catalog";

/** Campo-alvo da tela (rótulo/ref) para direcionar a extração. */
export type CampoAlvo = { ref?: string; label: string; tipo?: string; descricao?: string };

export type ExtracaoDoc = {
  /** Chave canônica do tipo (ex.: "comprovante_endereco") ou "outro". */
  tipo_documento: string;
  /** Rótulo legível do tipo. */
  tipo_label: string;
  /** O que foi encontrado (na extração direcionada, traz o `ref` da tela). */
  campos: { campo: string; valor: string; confianca: number; ref?: string }[];
  /** SCHEMA PADRÃO do tipo: todas as chaves canônicas (faltantes = null). Só no
   *  modo por-tipo (sem campos da tela). */
  dados?: Record<string, { valor: string | null; confianca: number }>;
  observacao?: string;
};

const schema = z.object({
  tipo_documento: z.string().describe("Chave do tipo do documento conforme o catálogo (ex.: comprovante_endereco, certidao_nascimento, rg…) ou 'outro'."),
  campos: z
    .array(
      z.object({
        campo: z.string().describe("Chave do dado — a chave canônica do tipo (modo por-tipo) OU o rótulo/ref da tela (modo direcionado)."),
        valor: z.string().describe("Valor lido do documento, no formato em que aparece."),
        confianca: z.number().min(0).max(1).describe("0..1 — segurança da leitura."),
        ref: z.string().optional().describe("O ref do campo da tela, quando fornecido."),
      }),
    )
    .describe("Só os dados EFETIVAMENTE presentes no documento."),
  observacao: z.string().optional().describe("O que ficou ilegível/duvidoso, se algo."),
});

/**
 * Extrai dados de DOCUMENTOS pessoais (imagem/PDF) por OCR do modelo de visão.
 * Identifica o TIPO e devolve os dados num PADRÃO canônico por tipo (catálogo).
 * Direcionado aos CAMPOS DA TELA quando fornecidos; senão, schema do tipo.
 */
export async function extrairDocumento(input: {
  arquivos: ArquivoIn[];
  campos?: CampoAlvo[];
  instrucao?: string;
  llm?: { provider?: string | null; model?: string | null };
  meta?: UsageMeta;
}): Promise<ExtracaoDoc> {
  const arq = await interpretarArquivos(input.arquivos ?? []);
  if (!arq.imageParts.length && !arq.fileParts.length && !arq.texto) {
    throw new Error("Nenhum documento legível recebido.");
  }
  const model = await languageModelEscolhido(input.llm, input.meta);
  const direcionado = !!input.campos?.length;

  const alvo = direcionado
    ? "CAMPOS DA TELA para preencher — em `campos`, retorne o VALOR de cada um que o documento fornecer, repetindo o mesmo " +
      "`ref` e usando o rótulo como `campo`; deixe de fora os que não aparecem no documento. Ainda assim, defina " +
      "`tipo_documento` com o tipo identificado:\n" +
      input.campos!
        .map((c) => `- ${c.label}${c.ref ? ` [ref:${c.ref}]` : ""}${c.tipo ? ` (${c.tipo})` : ""}${c.descricao ? ` — ${c.descricao}` : ""}`)
        .join("\n")
    : "Identifique o TIPO do documento e retorne os dados no PADRÃO daquele tipo: em `campos`, use EXATAMENTE as chaves " +
      "canônicas do tipo conforme o CATÁLOGO abaixo (omita as que não aparecem no documento). Defina `tipo_documento` " +
      "com a chave do tipo.\n\nCATÁLOGO DE TIPOS (tipo: chaves canônicas):\n" +
      catalogoParaPrompt();

  const promptText =
    "Você extrai dados de DOCUMENTOS pessoais (comprovante de endereço, certidões de nascimento/casamento/óbito, atestado " +
    "médico, RG, CPF, CNH, CTPS, título de eleitor, PIS, contracheque, dados bancários, passaporte, etc.) para preencher um " +
    "formulário. Faça OCR/leitura e extraia SOMENTE o que estiver no documento — NÃO invente. Datas no formato do documento; " +
    "CEP/telefone/CPF/CNPJ só com os dígitos que aparecem. Se algo estiver ilegível, diga em `observacao`.\n\n" +
    alvo +
    (input.instrucao ? `\n\nOBSERVAÇÃO DO SOLICITANTE: ${input.instrucao}` : "") +
    (arq.texto ? `\n\nCONTEÚDO TEXTUAL JÁ EXTRAÍDO DO(S) ARQUIVO(S):\n${arq.texto}` : "");

  const partes = [...arq.imageParts, ...arq.fileParts];
  const { object } = await generateObject({
    model,
    schema,
    ...(partes.length
      ? { messages: [{ role: "user" as const, content: [{ type: "text", text: promptText }, ...partes] as never }] }
      : { prompt: promptText }),
  });

  const chaveTipo = normalizarChave(object.tipo_documento);
  const tipo = tipoPorChave(chaveTipo);
  const res: ExtracaoDoc = {
    tipo_documento: tipo?.tipo ?? (chaveTipo || "outro"),
    tipo_label: tipo?.label ?? (object.tipo_documento || "Outro"),
    campos: object.campos,
    observacao: object.observacao,
  };
  // Modo por-tipo: entrega o schema PADRÃO do tipo (todas as chaves, faltantes null).
  if (!direcionado) res.dados = montarDados(tipo, object.campos);
  return res;
}
