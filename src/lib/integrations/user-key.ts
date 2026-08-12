/**
 * A CHAVE DA PESSOA numa conexão de conta pessoal (Microsoft/Google).
 *
 * Era `p_usuario`, e isso estava errado por um motivo que só aparece em campo:
 * no Painel do Colaborador o anfitrião manda `p_usuario = 'PORTAL'` para TODO
 * MUNDO — é o usuário da aplicação APEX, não a pessoa. Quem identifica a pessoa
 * é a matrícula. Chaveando por `p_usuario`, a primeira pessoa a conectar a
 * conta entregava a própria caixa de e-mail a todos os colegas da base: o
 * `ms_email_enviar` do colega encontraria a conexão de 'PORTAL' e mandaria
 * mensagem pela caixa dela.
 *
 * A empresa entra junto porque matrícula se repete entre empresas da mesma
 * base — `700:365785` e `1:365785` são pessoas diferentes.
 *
 * Arquivo separado, e PURO, de propósito: as duas pontas precisam gerar a mesma
 * chave — o consentimento (`/api/v1/connect/*`), que só tem os campos `p_*` do
 * token, e o chat (executor/tool-builder), que já converteu para `Identity`. Foi
 * exatamente essa divergência que criou a conexão órfã `365785`: o consentimento
 * caía em `p_usuario ?? p_matricula` e o chat consultava só `p_usuario`.
 */

/** Nome de exibição do provedor — o que o usuário lê no chat e no botão. Mora
 *  aqui, e não no `tool-builder`, para o widget e as rotas leves alcançarem sem
 *  arrastar o motor de ferramentas inteiro. */
export const NOME_PROVEDOR: Record<string, string> = { microsoft: "Microsoft", google: "Google" };

/**
 * `base:empresa:matricula`, ou `null` quando não dá para saber QUEM é a pessoa.
 *
 * A BASE entrou na chave quando a credencial da conta pessoal passou a poder
 * ser compartilhada entre clientes (há um app só no Azure, porque a URL de
 * callback do sistema é uma só). Sem ela, `1:57292` da Stefanini e `1:57292` de
 * outro cliente são a MESMA linha na tabela de conexões — e a segunda pessoa a
 * conectar assumiria a caixa de e-mail da primeira.
 */
export function chavePessoal(input: {
  base?: string | null;
  empresa?: string | null;
  matricula?: string | null;
}): string | null {
  // `p_base` chega do APEX em qualquer caixa ("NATCORP" e "natcorp" são a mesma
  // empresa); normalizar aqui evita duas conexões para a mesma pessoa.
  const base = String(input.base ?? "").trim().toLowerCase();
  const empresa = String(input.empresa ?? "").trim();
  const matricula = String(input.matricula ?? "").trim();
  // Sem matrícula não há pessoa a quem amarrar a conta. Devolver algo genérico
  // aqui — o `p_usuario`, um vazio — é justamente o defeito que este módulo
  // existe para impedir: a conta iria para uma chave compartilhada.
  if (!matricula) return null;
  return `${base}:${empresa}:${matricula}`;
}
