import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "./button";

/**
 * O QUE APARECE QUANDO A PESSOA NÃO PODE ENTRAR.
 *
 * Estava copiado em 24 páginas como `<h1>Título</h1><p>Você não tem permissão
 * para X.</p>` — e o texto nunca dizia o que resolve. Quem batia nisso tinha
 * duas saídas: adivinhar quem procurar, ou desistir.
 *
 * A recusa vira um beco sem saída quando não nomeia o que falta. Aqui ela diz a
 * PERMISSÃO (que é o que a pessoa cita ao pedir) e o PAPEL que a concede (que é
 * o que quem administra precisa ouvir para agir). Sem isso, a conversa vira
 * "não consigo entrar numa tela lá" — e um chamado de dois dias.
 *
 * Isto ganha peso na Fase 3: quando o menu passar a esconder o que o papel não
 * usa, links continuarão sendo compartilhados em conversa. Esta tela é o que
 * impede o link colado de virar mistério.
 */
export function SemPermissao({
  titulo,
  oQue,
  permissao,
  papel,
  voltarHref = "/admin",
}: {
  /** Nome da página, para a pessoa saber onde bateu. */
  titulo: string;
  /** A ação, em português: "ver o log de auditoria", "restaurar itens". */
  oQue: string;
  /** A chave técnica, ex.: `audit.read`. É o que se cita ao pedir acesso. */
  permissao?: string;
  /** O papel mais baixo que concede, ex.: "Admin técnico". */
  papel?: string;
  voltarHref?: string;
}) {
  return (
    <div
      data-testid="sem-permissao"
      className="mx-auto flex max-w-md flex-col items-center gap-5 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-muted">
        <Lock className="size-5" aria-hidden="true" />
      </span>

      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-text">{titulo}</h1>
        <p className="text-sm text-text-muted">Seu acesso atual não permite {oQue}.</p>
      </div>

      {(permissao || papel) && (
        <div className="w-full space-y-1.5 rounded-lg border border-border bg-surface-2 px-4 py-3 text-left text-xs text-text-muted">
          <p className="font-semibold text-text">Para pedir acesso</p>
          {permissao && (
            <p>
              Peça a permissão <code className="rounded bg-surface px-1 py-0.5 text-2xs">{permissao}</code> a quem
              administra o sistema.
            </p>
          )}
          {papel && (
            <p>
              O papel <strong className="text-text">{papel}</strong> já a inclui.
            </p>
          )}
        </div>
      )}

      <Button asChild variant="ghost">
        <Link href={voltarHref}>
          <ArrowLeft aria-hidden="true" />
          Voltar ao Painel
        </Link>
      </Button>
    </div>
  );
}
