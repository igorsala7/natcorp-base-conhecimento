"use client";

import { Send, X } from "lucide-react";

/**
 * O WIDGET MONTADO — não só a bolha e o avatar.
 *
 * A prévia existente mostrava as duas peças isoladas sobre fundo escuro. Isso
 * responde "a bolha ficou boa?" e não responde a pergunta que importa: como o
 * atendimento vai PARECER para o colaborador que abrir. Cabeçalho com título e
 * subtítulo, mensagem de boas-vindas, perguntas sugeridas, cor da conversa e o
 * lado da tela só apareciam depois de salvar, sair do formulário e clicar em
 * "Testar" — três passos e uma troca de contexto para julgar uma cor.
 *
 * ── O que ela NÃO é ─────────────────────────────────────────────────────────
 * Não é o widget de verdade. O widget real roda em Shadow DOM, num site que não
 * é este, com o CSS do host isolado. Reimplementá-lo aqui criaria uma segunda
 * verdade que diverge da primeira na primeira mudança. Isto é uma MAQUETE dos
 * campos configuráveis — e é por isso que o botão "Testar", que injeta o script
 * real, continua existindo: um responde "está bonito?", o outro responde
 * "funciona?".
 *
 * As duas perguntas são diferentes e nenhuma substitui a outra.
 */
export function PreviaMontada({
  titulo,
  subtitulo,
  boasVindas,
  sugestoes,
  primaria,
  secundaria,
  posicao,
  avatar,
}: {
  titulo: string;
  subtitulo: string;
  boasVindas: string;
  /** Uma por linha, como no formulário. */
  sugestoes: string;
  primaria: string;
  secundaria: string;
  posicao: "right" | "left";
  /** O avatar já renderizado pelo componente que a aba de aparência usa. */
  avatar?: React.ReactNode;
}) {
  const perguntas = sugestoes
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div
      // O fundo imita uma página qualquer do host, e não o admin: o widget nunca
      // aparece sobre a superfície do admin, e julgar contraste contra o fundo
      // errado leva a escolher cor que não funciona onde ele vai viver.
      className="relative flex h-[26rem] justify-end overflow-hidden rounded-xl border border-border bg-[linear-gradient(180deg,#f1f0f4_0%,#e7e5ec_100%)] p-4 dark:bg-[linear-gradient(180deg,#232029_0%,#1a1820_100%)]"
      style={posicao === "left" ? { justifyContent: "flex-start" } : undefined}
      aria-label="Prévia do widget montado"
    >
      <div className="flex w-72 flex-col overflow-hidden rounded-xl bg-white shadow-2 dark:bg-[#1c1a22]">
        <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ background: primaria }}>
          {avatar}
          <div className="min-w-0 flex-1">
            {/* `truncate` aqui é honesto: no widget real o espaço é este mesmo,
                e um título que não cabe na prévia também não vai caber lá. */}
            <p className="truncate text-sm font-semibold text-white">{titulo || "Assistente"}</p>
            {subtitulo && <p className="truncate text-2xs text-white/80">{subtitulo}</p>}
          </div>
          <X className="size-4 shrink-0 text-white/70" aria-hidden="true" />
        </div>

        <div className="flex-1 space-y-2 overflow-hidden p-3">
          {boasVindas && (
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-2 px-3 py-2 text-xs leading-relaxed text-text">
              {boasVindas}
            </div>
          )}
          {perguntas.map((p) => (
            /* `span`, não `button`: isto é maquete. Um botão desabilitado
               entraria na ordem de leitura como controle inerte, e o leitor de
               tela anunciaria três ações que não existem. */
            <span
              key={p}
              className="block max-w-[90%] truncate rounded-full border px-3 py-1.5 text-2xs"
              // Sugestão usa a cor SECUNDÁRIA: é onde ela aparece de verdade, e
              // é o único lugar da prévia que mostra as duas cores convivendo.
              style={{ borderColor: secundaria, color: secundaria }}
            >
              {p}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
          <span className="flex-1 truncate text-2xs text-text-muted">Escreva sua pergunta…</span>
          <span
            className="flex size-6 items-center justify-center rounded-full text-white"
            style={{ background: primaria }}
          >
            <Send className="size-3" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
