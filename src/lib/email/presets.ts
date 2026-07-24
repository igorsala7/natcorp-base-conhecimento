import { newId, type Block, type BlockDoc } from "@/lib/blocks/schema";

/**
 * Modelos prontos de template de e-mail — pontos de partida no designer,
 * inspirados nos e-mails de grandes empresas de tecnologia (Stripe, Linear,
 * Vercel, Notion, Intercom) com a leveza de produto de startup.
 *
 * Cada `criar()` devolve um BlockDoc NOVO (ids frescos). O template é o CHROME
 * (cabeçalho + rodapé de marca); o corpo de cada e-mail entra no token
 * {{conteudo}}. Outros tokens no texto: {{remetente}} (from_name), {{ano}}.
 *
 * Não há logo de produto — o cabeçalho usa o nome do remetente; o admin pode
 * trocar por uma imagem (bloco de imagem) no editor.
 */

const PRIMARIA = "#511C76";
const TITULO = "#111827";
const RODAPE_COR = "#9aa0ab";

type Align = "left" | "center";

// ── construtores ─────────────────────────────────────────────────────────────
/** Marca em texto (wordmark). O admin troca por uma imagem se tiver logo. */
const marca = (align: Align, size: "lg" | "xl" = "xl"): Block => ({
  id: newId(),
  type: "paragraph",
  text: [{ text: "{{remetente}}", marks: [{ type: "bold" }, { type: "color", color: TITULO }] }],
  styles: { align, fontSize: size },
});
/** Rótulo pequeno em maiúsculas, na cor da marca. */
const eyebrow = (texto: string, align: Align = "center"): Block => ({
  id: newId(),
  type: "paragraph",
  text: [{ text: texto.toUpperCase(), marks: [{ type: "bold" }, { type: "color", color: PRIMARIA }] }],
  styles: { align, fontSize: "xs" },
});
/** O parágrafo-âncora do corpo — o wrapper troca este bloco pelo conteúdo. */
const conteudo = (): Block => ({ id: newId(), type: "paragraph", text: [{ text: "{{conteudo}}" }] });
const hr = (): Block => ({ id: newId(), type: "divider" });
const espaco = (size: "sm" | "md" | "lg"): Block => ({ id: newId(), type: "spacer", data: { size } });
const faixa = (bg: "purple" | "blue" | "gray" | "dark", title: string, subtitle: string): Block => ({
  id: newId(),
  type: "hero",
  data: { eyebrow: "", title, subtitle, bg },
});
/** Rodapé: linhas discretas (use \n para várias). */
const rodape = (texto: string, align: Align = "center"): Block => ({
  id: newId(),
  type: "paragraph",
  text: [{ text: texto, marks: [{ type: "color", color: RODAPE_COR }] }],
  styles: { align, fontSize: "xs" },
});

const doc = (blocks: Block[]): BlockDoc => ({ version: 2, blocks });

export type EmailPreset = {
  key: string;
  nome: string;
  descricao: string;
  criar: () => BlockDoc;
};

export const EMAIL_PRESETS: EmailPreset[] = [
  {
    key: "profissional",
    nome: "Profissional",
    descricao: "Cabeçalho discreto, muito respiro e fios finos — estilo Stripe.",
    criar: () =>
      doc([
        marca("left"),
        hr(),
        conteudo(),
        hr(),
        rodape("Você recebeu este e-mail de {{remetente}}.\n© {{ano}} {{remetente}}. Todos os direitos reservados.", "left"),
      ]),
  },
  {
    key: "elegante",
    nome: "Elegante",
    descricao: "Cabeçalho escuro em gradiente e corpo limpo — estilo Linear.",
    criar: () =>
      doc([faixa("dark", "{{remetente}}", ""), espaco("sm"), conteudo(), hr(), rodape("© {{ano}} {{remetente}}")]),
  },
  {
    key: "minimalista",
    nome: "Minimalista",
    descricao: "Preto no branco, centralizado e essencial — estilo Vercel.",
    criar: () =>
      doc([marca("center"), espaco("md"), conteudo(), espaco("md"), rodape("{{remetente}} · © {{ano}}")]),
  },
  {
    key: "amigavel",
    nome: "Amigável",
    descricao: "Cabeçalho colorido e caloroso, com emoji — estilo Notion.",
    criar: () =>
      doc([
        faixa("purple", "Olá! 👋", "Uma mensagem de {{remetente}}"),
        conteudo(),
        hr(),
        rodape("Enviado com carinho pela equipe {{remetente}}.\n© {{ano}}"),
      ]),
  },
  {
    key: "newsletter",
    nome: "Newsletter",
    descricao: "Marca em destaque e rodapé completo — estilo Intercom/Mailchimp.",
    criar: () =>
      doc([
        eyebrow("Novidades"),
        marca("center"),
        espaco("sm"),
        hr(),
        conteudo(),
        hr(),
        rodape(
          "{{remetente}}\nVocê recebeu este e-mail porque tem interesse nesta documentação.\n© {{ano}} {{remetente}} · Todos os direitos reservados.",
        ),
      ]),
  },
];

/** O modelo padrão para quem abre o editor sem nada salvo. */
export function templatePadrao(): BlockDoc {
  return EMAIL_PRESETS[0]!.criar();
}
