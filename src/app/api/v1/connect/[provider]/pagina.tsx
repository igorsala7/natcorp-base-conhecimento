/**
 * As telas que o consentimento pode terminar mostrando.
 *
 * HTML servido direto, sem React nem layout do app: este popup abre num
 * contexto isolado, some em segundos, e carregar o bundle do admin aqui só
 * atrasaria o fechamento.
 *
 * O `postMessage` avisa quem abriu o fluxo (o widget) para ele atualizar o
 * estado sem ficar consultando o servidor. Vai para `opener` E `parent`: no
 * fluxo normal isto roda num popup, e na tentativa SILENCIOSA roda dentro de um
 * iframe escondido, onde `opener` é nulo. `targetOrigin` fica em `"*"` de
 * propósito e é seguro AQUI: a mensagem não carrega token nem dado pessoal — só
 * "deu certo", "deu errado" ou "não deu para fazer em silêncio". Restringir
 * exigiria conhecer a origem do host, que varia por cliente, e um alvo errado
 * silenciaria o aviso sem qualquer ganho de segurança.
 */

const CSS = `
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #faf9fb; color: #1c1a20;
  }
  @media (prefers-color-scheme: dark) { body { background: #16141a; color: #efedf2; } }
  .caixa { max-width: 26rem; padding: 2rem; text-align: center; }
  .icone { font-size: 2.5rem; line-height: 1; }
  h1 { margin: .75rem 0 .25rem; font-size: 1.125rem; font-weight: 600; }
  p { margin: 0; color: #6b6675; }
  @media (prefers-color-scheme: dark) { p { color: #a9a3b5; } }
`;

function pagina(icone: string, titulo: string, texto: string, evento: string, fecharEm: number | null): Response {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title><style>${CSS}</style></head>
<body><div class="caixa">
  <div class="icone">${icone}</div>
  <h1>${esc(titulo)}</h1>
  <p>${esc(texto)}</p>
</div>
<script>
  try { window.opener && window.opener.postMessage(${JSON.stringify(evento)}, "*"); } catch (e) {}
  try { window.parent && window.parent !== window && window.parent.postMessage(${JSON.stringify(evento)}, "*"); } catch (e) {}
  ${fecharEm === null ? "" : `setTimeout(function () { try { window.close(); } catch (e) {} }, ${fecharEm});`}
</script>
</body></html>`;
  return new Response(html, {
    // 200 mesmo no erro: é uma página para uma pessoa ler, não uma resposta de
    // API. Um 4xx aqui só faria o navegador poder trocá-la por uma tela de erro
    // genérica, escondendo justamente a mensagem que explica o que fazer.
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Nunca cachear: a página reflete o resultado de UM consentimento.
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export function paginaDeSucesso(conta: string | null): Response {
  return pagina(
    "✓",
    "Conta conectada",
    conta ? `Conectado como ${conta}. Pode fechar esta janela.` : "Pode fechar esta janela.",
    "kb:conexao:ok",
    1500,
  );
}

/**
 * A tentativa silenciosa não deu (sem sessão no provedor, ou escopos ainda não
 * consentidos). NÃO é erro: é o caminho normal para quem nunca conectou. Sai
 * como página mínima, sem texto de falha — ela vive dentro de um iframe de 0px,
 * e o widget só precisa saber que pode parar de esperar e mostrar o botão.
 */
export function paginaSilencioFalhou(): Response {
  return pagina("", "", "", "kb:conexao:silencio", 200);
}

export function paginaDeErro(motivo: string): Response {
  // Sem fechamento automático: o usuário precisa de tempo para LER o motivo, e
  // é essa frase que ele vai repetir ao suporte.
  return pagina("!", "Não foi possível conectar", motivo, "kb:conexao:erro", null);
}
