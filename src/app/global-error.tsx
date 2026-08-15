"use client";

/**
 * ÚLTIMA REDE — o erro que derrubou o layout raiz.
 *
 * Só dispara quando a quebra é no próprio `layout.tsx` da raiz, e por isso
 * precisa renderizar `<html>` e `<body>` por conta própria: neste ponto nenhum
 * layout da aplicação está montado.
 *
 * Consequência prática: NADA daqui pode depender do resto do app. Sem tema, sem
 * providers, sem tokens (o `globals.css` pode não ter carregado), sem `Button`,
 * sem ícone. Estilo inline e `prefers-color-scheme` puro — o único jeito de
 * garantir que a tela de erro não seja a segunda coisa a quebrar.
 */
export default function ErroGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          background: "#faf9fb",
          color: "#231f2b",
        }}
      >
        <style>{`@media (prefers-color-scheme: dark){body{background:#16131c!important;color:#efedf2!important}}`}</style>
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
            A aplicação não conseguiu carregar
          </h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, margin: "0 0 1.25rem", lineHeight: 1.6 }}>
            A falha foi registrada. Recarregar resolve boa parte dos casos — se insistir, mande o código abaixo para
            quem cuida do sistema.
          </p>
          {error.digest && (
            <code
              style={{
                display: "inline-block",
                fontSize: "0.6875rem",
                padding: "0.375rem 0.625rem",
                borderRadius: 6,
                background: "rgba(81,28,118,0.08)",
                marginBottom: "1.25rem",
                userSelect: "all",
              }}
            >
              {error.digest}
            </code>
          )}
          <div>
            <button
              type="button"
              onClick={reset}
              style={{
                cursor: "pointer",
                border: 0,
                borderRadius: 8,
                padding: "0.625rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: "#511c76",
                color: "#fff",
              }}
            >
              Tentar de novo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
