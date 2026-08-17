"use client";

/**
 * A FRONTEIRA ACIMA DO LAYOUT — a que faltava.
 *
 * O admin já tinha `error.tsx` em nove lugares, incluindo um em `(app)/`, cujo
 * comentário explica a escolha: ele fica no grupo para que a barra lateral e a
 * topbar sobrevivam à quebra, e quem perdeu a tela ainda consiga navegar. O
 * raciocínio está certo — e tem um ponto cego.
 *
 * Uma fronteira de erro NÃO captura o `layout.tsx` IRMÃO dela. E
 * `(app)/layout.tsx` é justamente onde moram SEIS chamadas de rede: sessão,
 * nível de MFA, permissões, lista de documentações e a resolução do espaço.
 * Quando qualquer uma soluça, quem lança é o layout, nada abaixo dele captura,
 * e o Next devolve o último recurso: a página branca com "Internal Server
 * Error" em fonte monoespaçada, sem marca, sem português e sem saída.
 *
 * Foi assim que apareceu — três telas do admin quebraram no MESMO instante
 * durante uma captura de QA. Telas diferentes falhando juntas não é
 * coincidência: é o sinal de que o defeito está no que elas COMPARTILHAM. Duas
 * mostraram a tela de erro estilizada (o `page` delas lançou, e a fronteira de
 * `(app)` fez o trabalho); a terceira mostrou texto cru — nela quem lançou foi
 * o layout.
 *
 * Aqui em `admin/` a barra lateral realmente se perde, porque quem a renderiza
 * é exatamente o que falhou. Não há como preservá-la; há como não deixar a
 * pessoa numa página branca em inglês. O `digest` continua copiável, que é o
 * único fio entre "quebrou pra mim" e a linha do log.
 */
import { ErroDaRota } from "@/components/ui/erro-da-rota";

export default function ErroDoAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErroDaRota
      error={error}
      reset={reset}
      // Nomeia o escopo: aqui a falha é do admin inteiro, não "desta tela" —
      // dizer o contrário mandaria a pessoa tentar outra tela que também não
      // vai abrir.
      titulo="O admin não conseguiu carregar"
      voltarHref="/admin/login"
      voltarLabel="Ir para o login"
    />
  );
}
