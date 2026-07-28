import { z } from "zod";
import type { PlanoCaptura, AcaoCaptura } from "@/lib/capture/browser";

/**
 * Schema da SAÍDA da IA que decide os prints (o "discernimento"): a partir do
 * inventário de elementos da página, escolhe o que capturar, recortar, destacar
 * e — no modo interativo — quais ações fazer antes. Mesmas travas de
 * `layout-schema.ts`: schema PLANO, `.nullable()` (não `.optional()`), sem
 * `oneOf` (a ação vira um objeto único com `tipo` + campos anuláveis). Cabe na
 * gramática de Anthropic/Google.
 */
const acaoSchema = z.object({
  tipo: z.enum(["clicar", "preencher", "esperar"]),
  /** ref do elemento (clicar/preencher); null para esperar. */
  ref: z.string().max(12).nullable(),
  /** texto a digitar (preencher); null caso contrário. */
  valor: z.string().max(400).nullable(),
  /** milissegundos (esperar); null caso contrário. */
  ms: z.number().int().nullable(),
});

const printSchema = z.object({
  /** ref de um elemento do inventário, ou "PAGINA" (inteira) ou "VIEWPORT" (tela visível). */
  alvo: z.string().max(12),
  /** destacar o elemento (spotlight) em vez de só recortá-lo. */
  destaque: z.boolean().nullable(),
  /** legenda educativa curta do print. */
  legenda: z.string().max(200).nullable(),
  /** ações a executar ANTES do print (só modo interativo). */
  acoes: z.array(acaoSchema).max(6).nullable(),
});

export const capturePlanSchema = z.object({
  prints: z.array(printSchema).max(16),
});

export type CapturePlan = z.infer<typeof capturePlanSchema>;

/**
 * Sugestão de CAMINHO de navegação (Fase 2): a IA, olhando os elementos da 1ª
 * tela, propõe um passo a passo em texto, quais campos precisam de valores do
 * autor e quais telas printar. O autor edita e preenche antes de rodar.
 */
const campoSchema = z.object({
  id: z.string().max(40),
  label: z.string().max(160),
  tipo: z.enum(["texto", "lista", "checkbox", "radio", "data", "numero"]),
  /** opções para lista/radio; null caso contrário. */
  opcoes: z.array(z.string().max(120)).max(20).nullable(),
});
export const caminhoSchema = z.object({
  /** passo a passo de navegação, humano e editável. */
  plano: z.string().max(4000),
  /** campos que a IA precisa que o autor preencha. */
  campos: z.array(campoSchema).max(20),
  /** telas/partes que a IA sugere printar. */
  prints: z.array(z.string().max(200)).max(12),
});
export type CaminhoSugerido = z.infer<typeof caminhoSchema>;
export type CampoNavegacao = z.infer<typeof campoSchema>;

/** Converte a saída plana da IA nos `PlanoCaptura` do motor (descarta ações inválidas). */
export function converterPlano(plan: CapturePlan, modo: "static" | "interactive"): PlanoCaptura[] {
  return plan.prints.map((p) => {
    const acoes: AcaoCaptura[] = [];
    if (modo === "interactive") {
      for (const a of p.acoes ?? []) {
        if (a.tipo === "clicar" && a.ref) acoes.push({ tipo: "clicar", ref: a.ref });
        else if (a.tipo === "preencher" && a.ref && a.valor != null) {
          acoes.push({ tipo: "preencher", ref: a.ref, valor: a.valor });
        } else if (a.tipo === "esperar" && a.ms != null) {
          acoes.push({ tipo: "esperar", ms: a.ms });
        }
      }
    }
    return {
      alvo: p.alvo,
      ...(p.destaque ? { destaque: true } : {}),
      ...(p.legenda ? { legenda: p.legenda } : {}),
      ...(acoes.length ? { acoes } : {}),
    };
  });
}
