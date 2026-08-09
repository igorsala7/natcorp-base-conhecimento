/**
 * Template de CORPO para APIs com payload aninhado.
 *
 * O motor monta o corpo plano: `{a, b}`, `[{a, b}]` ou `{chave: [{a, b}]}`
 * (ver `envelopeBody`). Isso cobre as APIs do ORDS, que recebem um registro
 * raso. Não cobre o Microsoft Graph, nem quase nenhuma API moderna:
 *
 *   {"message": {"subject": "…",
 *                "body": {"contentType": "Text", "content": "…"},
 *                "toRecipients": [{"emailAddress": {"address": "…"}}]}}
 *
 * Aqui a ferramenta declara o formato uma vez, em JSON, com marcadores no lugar
 * dos valores. O modelo continua vendo parâmetros PLANOS (`para`, `assunto`,
 * `corpo`) — que é o que ele preenche bem — e o aninhamento fica sendo
 * problema do cadastro, não do modelo.
 *
 * Puro (sem IO): testável isolado.
 *
 * ── Os três marcadores ──────────────────────────────────────────────────
 * `"{{nome}}"`  — valor inteiro. A chave SOME quando o parâmetro não veio, e é
 *                 isso que faz campo opcional funcionar sem um template por
 *                 combinação. Enviar `null` ao Graph não é equivalente: em
 *                 vários endpoints ele APAGA o campo.
 *
 * `"…{{nome}}…"` — interpolação dentro de um texto maior. Ausente vira "".
 *
 * `"{{*nome}}"` — dentro de um array de UM elemento: repete o elemento para
 *                 cada valor separado por vírgula. É o que transforma
 *                 "a@x.com, b@y.com" nos dois objetos que o Graph espera.
 */

export type Valores = Record<string, unknown>;

const RX_TODO = /^\{\{\s*(\*?)([a-zA-Z0-9_]+)\s*\}\}$/;
const RX_DENTRO = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const vazio = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** "a@x.com, b@y.com" → ["a@x.com", "b@y.com"]. Também aceita array pronto. */
export function separarLista(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = String(v ?? "").trim();
  if (!s) return [];
  // Vírgula E ponto-e-vírgula: quem digita lista de e-mail usa os dois, e o
  // modelo reproduz o que o usuário escreveu.
  return s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

/** Marcador de remoção — distingue "não veio" de "veio vazio de propósito". */
const REMOVER = Symbol("remover");

/**
 * @param escalares Nomes cujo `{{*nome}}` já foi expandido pelo array pai e
 *   agora vale por UM item. Sem isto, o marcador dentro do elemento repetido
 *   voltaria a virar lista e o Graph receberia `address: ["a@x.com"]` — um
 *   array onde ele espera texto, e o 400 não diz qual campo.
 */
function render(no: unknown, vals: Valores, escalares: Set<string> = new Set(), raiz = false): unknown {
  if (typeof no === "string") {
    const todo = RX_TODO.exec(no);
    if (todo) {
      const [, estrela, nome] = todo;
      const v = vals[nome!];
      if (estrela && !escalares.has(nome!)) return separarLista(v);
      if (vazio(v)) return REMOVER;
      return v;
    }
    return no.replace(RX_DENTRO, (_, nome: string) => {
      const v = vals[nome];
      return vazio(v) ? "" : String(v);
    });
  }

  if (Array.isArray(no)) {
    // Array de UM elemento contendo `{{*nome}}`: repete por valor da lista.
    if (no.length === 1) {
      const alvo = expansivel(no[0]);
      if (alvo) {
        const itens = separarLista(vals[alvo]);
        // Sem valores, o array fica vazio — e o pai decide se remove. Um array
        // com um objeto de campos vazios seria pior: o Graph recusa
        // `toRecipients: [{emailAddress: {address: ""}}]` com um 400 obscuro.
        const escalar = new Set(escalares).add(alvo);
        return itens.map((item) => render(no[0], { ...vals, [alvo]: item }, escalar));
      }
    }
    return no.map((x) => render(x, vals, escalares)).filter((x) => x !== REMOVER);
  }

  if (no && typeof no === "object") {
    const out: Record<string, unknown> = {};
    let comMarcador = 0;
    let sobreviveram = 0;
    for (const [k, v] of Object.entries(no as Record<string, unknown>)) {
      const tinha = temMarcador(v);
      if (tinha) comMarcador++;
      const r = render(v, vals, escalares);
      if (r === REMOVER) continue;
      if (tinha) sobreviveram++;
      out[k] = r;
    }
    // Objeto cujos MARCADORES sumiram todos vai junto — mesmo que sobrem
    // literais. `{"body": {"contentType": "HTML"}}` sem `content` é um corpo de
    // e-mail sem texto: o Graph aceita e manda mensagem vazia, que é pior que
    // não mandar o campo. Objeto sem marcador nenhum é constante e fica.
    // NÃO se aplica à raiz: podar o corpo inteiro porque um campo opcional
    // faltou transformaria "e-mail sem cópia" em "requisição sem corpo".
    if (!raiz && comMarcador > 0 && sobreviveram === 0) return REMOVER;
    return out;
  }

  return no;
}

/** O nó contém algum marcador, em qualquer profundidade? */
function temMarcador(no: unknown): boolean {
  if (typeof no === "string") return RX_TODO.test(no) || RX_DENTRO.test(no.replace(RX_DENTRO, "$&"));
  if (Array.isArray(no)) return no.some(temMarcador);
  if (no && typeof no === "object") return Object.values(no as Record<string, unknown>).some(temMarcador);
  return false;
}

/** Nome do parâmetro de um `{{*nome}}` em qualquer profundidade, ou null. */
function expansivel(no: unknown): string | null {
  if (typeof no === "string") {
    const m = RX_TODO.exec(no);
    return m && m[1] === "*" ? m[2]! : null;
  }
  if (Array.isArray(no)) {
    for (const x of no) {
      const r = expansivel(x);
      if (r) return r;
    }
    return null;
  }
  if (no && typeof no === "object") {
    for (const v of Object.values(no as Record<string, unknown>)) {
      const r = expansivel(v);
      if (r) return r;
    }
  }
  return null;
}

/**
 * Aplica o template. `null` quando não há template — o chamador mantém o
 * comportamento plano de sempre.
 */
export function montarCorpo(template: unknown, valores: Valores): unknown | null {
  if (template === null || template === undefined) return null;
  const r = render(template, valores, new Set(), true);
  return r === REMOVER ? null : r;
}

/**
 * Parâmetros citados no template — para a tela avisar quando o cadastro
 * declara um parâmetro que o template ignora, ou usa um que não existe. Erro de
 * digitação em marcador é invisível em produção: o campo simplesmente não vai.
 */
export function parametrosDoTemplate(template: unknown): string[] {
  const achados = new Set<string>();
  const anda = (no: unknown): void => {
    if (typeof no === "string") {
      const todo = RX_TODO.exec(no);
      if (todo) {
        achados.add(todo[2]!);
        return;
      }
      for (const m of no.matchAll(RX_DENTRO)) achados.add(m[1]!);
      return;
    }
    if (Array.isArray(no)) return void no.forEach(anda);
    if (no && typeof no === "object") return void Object.values(no as Record<string, unknown>).forEach(anda);
  };
  anda(template);
  return [...achados];
}
