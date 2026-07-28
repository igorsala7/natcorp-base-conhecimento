import "server-only";
import { PERSONA_PADRAO, REGRAS_ABSOLUTAS } from "@/lib/ai/prompt-cascade";
import {
  STRUCTURE_INSTRUCTIONS, READ_INSTRUCTIONS, CONTENT_INSTRUCTIONS,
  PADRAO_DE_ARTIGO, CABECALHO_PREFERENCIAS,
} from "@/lib/importer/prompts";
import {
  SISTEMA_IA_TEXTO, INSTRUCAO_TEXTO, TOM_LABEL,
  ONTOLOGIA_PROMPT, ICONES_INSTRUCOES, EMBEDDINGS_CONTEXTO,
} from "@/lib/ai/prompt-defaults";

/**
 * Registro dos prompts e temperaturas parametrizáveis (Sistema → Prompts).
 * O `default` de cada campo é a constante DO CÓDIGO — que continua sendo o
 * fallback. A tela grava só o que for alterado; o resolver (prompts.ts) usa o
 * override quando existe, senão o default daqui.
 */
export type PromptFieldType = "text" | "number";
export type PromptField = {
  key: string;
  label: string;
  type?: PromptFieldType;   // default "text"
  rows?: number;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  default: string | number;
};
export type PromptCategory = {
  key: string;
  label: string;
  description: string;
  fields: PromptField[];
};

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    key: "assistente",
    label: "Assistente (chat / RAG)",
    description: "A persona padrão e as regras absolutas do assistente que responde perguntas (portal, widget e API). A persona por documentação continua sendo definida em cada documentação; aqui é o padrão e a política de segurança.",
    fields: [
      { key: "persona_padrao", label: "Persona padrão", rows: 4, default: PERSONA_PADRAO,
        hint: "Usada quando a documentação/chave do widget não define uma persona própria." },
      { key: "regras_absolutas", label: "Regras absolutas (segurança)", rows: 14, default: REGRAS_ABSOLUTAS,
        hint: "São SEMPRE anexadas ao final do prompt. Mudar aqui altera a política de segurança do assistente — edite com cuidado." },
    ],
  },
  {
    key: "ia_no_texto",
    label: "IA no texto (editor)",
    description: "Reescrever, expandir, resumir, ajustar tom e corrigir formatação de um trecho no editor.",
    fields: [
      { key: "sistema", label: "Instrução de sistema", rows: 5, default: SISTEMA_IA_TEXTO },
      { key: "reescrever", label: "Ação — Reescrever", rows: 2, default: INSTRUCAO_TEXTO.reescrever },
      { key: "expandir", label: "Ação — Expandir", rows: 3, default: INSTRUCAO_TEXTO.expandir },
      { key: "resumir", label: "Ação — Resumir", rows: 2, default: INSTRUCAO_TEXTO.resumir },
      { key: "tom", label: "Ação — Mudar o tom", rows: 2, default: INSTRUCAO_TEXTO.tom },
      { key: "formatar", label: "Ação — Ajustar formatação", rows: 6, default: INSTRUCAO_TEXTO.formatar },
      { key: "tom_formal", label: "Rótulo do tom — Formal", default: TOM_LABEL.formal },
      { key: "tom_casual", label: "Rótulo do tom — Casual", default: TOM_LABEL.casual },
      { key: "tom_tecnico", label: "Rótulo do tom — Técnico", default: TOM_LABEL.tecnico },
    ],
  },
  {
    key: "importador_estrutura",
    label: "Importador — estrutura",
    description: "Como a IA organiza a árvore (pastas e artigos) a partir dos títulos e do documento (usado quando o documento chega sem hierarquia própria).",
    fields: [
      { key: "structure_instructions", label: "Agrupar títulos (árvore plana)", rows: 16, default: STRUCTURE_INSTRUCTIONS },
      { key: "read_instructions", label: "Ler o documento (visão do PDF)", rows: 16, default: READ_INSTRUCTIONS },
    ],
  },
  {
    key: "importador_artigo",
    label: "Importador — artigo / Melhorar layout",
    description: "O mesmo prompt que transforma texto cru em blocos ricos, na importação e no “Melhorar layout” do editor. Reformata, não reescreve.",
    fields: [
      { key: "content_instructions", label: "Reformatar em blocos ricos", rows: 18, default: CONTENT_INSTRUCTIONS },
      { key: "padrao_de_artigo", label: "Padrão de artigo (referência)", rows: 10, default: PADRAO_DE_ARTIGO },
      { key: "cabecalho_preferencias", label: "Cabeçalho — preferências do autor", rows: 2, default: CABECALHO_PREFERENCIAS },
    ],
  },
  {
    key: "ontologia",
    label: "Ontologia (termos e sinônimos)",
    description: "Como a IA extrai os termos de domínio e sinônimos da documentação, na varredura de ontologia. Usa a IA configurada em Chat.",
    fields: [
      { key: "prompt", label: "Extrair termos de domínio", rows: 18, default: ONTOLOGIA_PROMPT,
        hint: "Os artigos são anexados ao final automaticamente." },
    ],
  },
  {
    key: "icones",
    label: "Ícones de diretório",
    description: "Como a IA escolhe um ícone para cada pasta a partir do título e dos itens dentro dela.",
    fields: [
      { key: "instrucoes", label: "Instruções de escolha", rows: 12, default: ICONES_INSTRUCOES,
        hint: "A lista de ícones válidos é sempre anexada ao final — não precisa (nem deve) constar aqui." },
    ],
  },
  {
    key: "embeddings",
    label: "Embeddings — contexto do documento",
    description: "A frase de contexto que a IA gera para situar cada documento antes de gerar os vetores de busca (chunking).",
    fields: [
      { key: "contexto", label: "Frase de contexto", rows: 5, default: EMBEDDINGS_CONTEXTO,
        hint: "O documento é anexado após “DOCUMENTO:” automaticamente." },
    ],
  },
  {
    key: "criatividade",
    label: "Criatividade (temperaturas)",
    description: "A temperatura da IA por nível de criatividade, no “Melhorar layout” e na “IA no texto”. Valores mais altos variam mais o resultado.",
    fields: [
      { key: "layout_conservador", label: "Layout — Conservador", type: "number", min: 0, max: 2, step: 0.05, default: 0.2 },
      { key: "layout_equilibrado", label: "Layout — Equilibrado", type: "number", min: 0, max: 2, step: 0.05, default: 0.45 },
      { key: "layout_criativo", label: "Layout — Criativo", type: "number", min: 0, max: 2, step: 0.05, default: 0.7 },
      { key: "texto_conservador", label: "Texto — Conservador", type: "number", min: 0, max: 2, step: 0.05, default: 0.2 },
      { key: "texto_equilibrado", label: "Texto — Equilibrado", type: "number", min: 0, max: 2, step: 0.05, default: 0.6 },
      { key: "texto_criativo", label: "Texto — Criativo", type: "number", min: 0, max: 2, step: 0.05, default: 0.9 },
    ],
  },
];

export function getCategory(key: string): PromptCategory | undefined {
  return PROMPT_CATEGORIES.find((c) => c.key === key);
}
