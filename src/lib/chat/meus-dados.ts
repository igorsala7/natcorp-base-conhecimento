/**
 * Recorte dos dados do PRÓPRIO usuário para o prompt (ferramenta `meus_dados`).
 *
 * Por que existe: perguntar "qual meu centro de custo?" gastava um passo do laço
 * agêntico — e passo é o recurso escasso (o teto é 3 a 6 por turno). A chamada em
 * si é barata (~50ms) e não depende do modelo: todos os parâmetros de `meus_dados`
 * vêm da identidade/credencial, então o servidor a resolve sozinho. Trazer o
 * resultado pronto no prompt troca um passo do agente por ~120 tokens.
 *
 * De quebra, dá ao modelo os valores de empresa/matrícula para preencher as
 * ferramentas cujo parâmetro é `origem=modelo` — sem fixá-los como filtro.
 *
 * ── Por que ALLOWLIST e não blacklist ───────────────────────────────────────
 * A lista hoje inclui os dados pessoais (CPF, contatos, nascimento, sexo) por
 * decisão do responsável pelo produto: com eles no prompt, o agente responde
 * qualquer pergunta cadastral sem gastar um passo. O custo aceito é que esses
 * campos vão ao provedor de IA em todo turno com ferramentas ativas.
 *
 * Ainda assim a lista é de PERMISSÃO, não de proibição: o que a ORDS acrescentar
 * amanhã (uma coluna de salário, um dado de dependente) fica de fora até alguém
 * decidir incluí-lo. Com lista de proibidos, entraria em silêncio.
 *
 * Puro (sem IO): testável isolado.
 */

/** Os únicos campos que vão ao prompt, com o rótulo que o modelo lê. */
const CAMPOS: [string, string][] = [
  ["nome", "Nome"],
  // Quando existe, é como a pessoa quer ser chamada — vem logo depois do nome de
  // registro para o modelo tratá-la certo.
  ["nome_social", "Nome social"],
  ["matricula", "Matrícula"],
  ["cod_empresa", "Empresa (código)"],
  ["nome_empresa", "Empresa"],
  ["filial", "Filial (código)"],
  ["nome_filial", "Filial"],
  ["centro_de_custo", "Centro de custo (código)"],
  ["nome_centro_de_custo", "Centro de custo"],
  ["cod_unidade_adm", "Unidade administrativa (código)"],
  ["nome_unidade_adm", "Unidade administrativa"],
  ["local_trabalho", "Local de trabalho"],
  ["nome_local_trabalho", "Local de trabalho"],
  ["cargo", "Cargo"],
  ["nome_cargo", "Cargo"],
  ["funcao", "Função"],
  ["nome_funcao", "Função"],
  ["vinculo", "Vínculo"],
  ["nome_vinculo", "Vínculo"],
  ["descricao_vinculo", "Vínculo"],
  ["sindicato", "Sindicato"],
  ["nome_sindicato", "Sindicato"],
  ["modalidade_trabalho", "Modalidade de trabalho"],
  ["situacao_funcional", "Situação funcional"],
  ["descricao_situacao_funcional", "Situação funcional"],
  ["dt_admissao", "Admissão"],
  // ── Dados pessoais e de contato ───────────────────────────────────────────
  // Incluídos por decisão explícita do responsável pelo produto (07/08/2026),
  // depois de a primeira versão deixá-los de fora. Consequência registrada: eles
  // vão ao provedor de IA em todo turno com ferramentas ativas. Para voltar ao
  // recorte anterior, basta remover este bloco — o resto do módulo não muda.
  ["cpf", "CPF"],
  ["dt_nascimento", "Nascimento"],
  ["sexo", "Sexo"],
  ["email_funcional", "E-mail funcional"],
  ["email_pessoal", "E-mail pessoal"],
  ["celular_funcional_empresarial", "Celular funcional"],
  ["celular_pessoal", "Celular pessoal"],
  ["cnpj", "CNPJ da empresa"],
];

/** Primeiro item de `{items:[...]}`, ou o próprio objeto. */
function primeiroItem(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const items = (payload as { items?: unknown }).items;
  if (Array.isArray(items)) {
    const primeiro = items[0];
    return primeiro && typeof primeiro === "object" ? (primeiro as Record<string, unknown>) : null;
  }
  return payload as Record<string, unknown>;
}

/**
 * Duas caixas postais são a mesma? Caixa alta/baixa e espaços não distinguem
 * endereço. Vazio NUNCA casa com vazio: quem chama isto decide se BLOQUEIA uma
 * conexão, e "não sei" precisa cair no ramo de não-sei, não no de tudo-certo.
 *
 * Puro e aqui (e não no módulo que fala com a ORDS) para o callback do
 * consentimento comparar sem arrastar o cliente do banco.
 */
export function mesmoEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = (a ?? "").trim().toLowerCase();
  const nb = (b ?? "").trim().toLowerCase();
  return !!na && na === nb;
}

export type MeusDados = { rotulo: string; valor: string }[];

/**
 * O e-mail FUNCIONAL do cadastro, cru do payload da ferramenta.
 *
 * Lê o campo, não o recorte: o rótulo do recorte é texto de prompt e pode mudar
 * sem aviso, enquanto `email_funcional` é o contrato da ORDS. Quem usa isto —
 * `login_hint` do consentimento e a checagem da conta conectada — precisa do
 * valor exato, não do que o modelo lê.
 */
export function emailFuncionalDe(payload: unknown): string | null {
  const item = primeiroItem(payload);
  const v = item?.email_funcional;
  if (v === undefined || v === null) return null;
  const texto = String(v).trim();
  if (!texto || texto.toLowerCase() === "null" || !texto.includes("@")) return null;
  return texto;
}

/**
 * Aplica a allowlist. Campos vazios/nulos somem — "Centro de custo: null" no
 * prompt só ensina o modelo a repetir "null" ao usuário.
 */
export function recortarMeusDados(payload: unknown): MeusDados {
  const item = primeiroItem(payload);
  if (!item) return [];
  const vistos = new Set<string>();
  const out: MeusDados = [];
  for (const [chave, rotulo] of CAMPOS) {
    const v = item[chave];
    if (v === undefined || v === null) continue;
    const texto = String(v).trim();
    if (!texto || texto.toLowerCase() === "null") continue;
    // Vários campos compartilham rótulo (código × descrição). O primeiro
    // preenchido vence: a lista põe o código antes do nome só quando os dois
    // importam (empresa/filial/centro de custo, usados como parâmetro).
    const dedup = `${rotulo}::${texto}`;
    if (vistos.has(dedup)) continue;
    vistos.add(dedup);
    out.push({ rotulo, valor: texto });
  }
  return out;
}

/**
 * Bloco para o prompt. Vazio quando não há dado — um cabeçalho sozinho custa
 * token e não informa nada.
 */
export function blocoMeusDados(dados: MeusDados): string {
  if (!dados.length) return "";
  const linhas = dados.map((d) => `- ${d.rotulo}: ${d.valor}`).join("\n");
  return (
    "DADOS DO USUÁRIO QUE ESTÁ FALANDO COM VOCÊ (já consultados; não chame ferramenta para obtê-los):\n" +
    linhas +
    "\nUse para responder direto sobre o cadastro DELE e para preencher empresa/matrícula quando o pedido for sobre " +
    "ele mesmo. NÃO use como filtro em pedido amplo (\"todos\", \"da empresa\", contagens) — ali o filtro fica em " +
    "branco. Para qualquer dado que NÃO esteja nesta lista, use a ferramenta."
  );
}

/**
 * Como o agente assina o que escreve EM NOME da pessoa (e-mail, convite).
 *
 * Só entra quando há conta pessoal conectada — é o único caso em que o agente
 * de fato escreve para terceiros. Diz também o que ele NÃO decide: o remetente
 * é a caixa conectada, e prometer "responda para tal endereço" quando o e-mail
 * sai de outro é a forma silenciosa de o destinatário responder para o vazio.
 */
export function blocoAssinatura(dados: MeusDados): string {
  const de = (rotulo: string) => dados.find((d) => d.rotulo === rotulo)?.valor ?? "";
  const nome = de("Nome social") || de("Nome");
  const email = de("E-mail funcional");
  if (!nome && !email) return "";
  const quem = [nome && `nome: ${nome}`, email && `e-mail funcional: ${email}`].filter(Boolean).join(", ");
  return (
    `ESCREVENDO EM NOME DO USUÁRIO (${quem}): assine a mensagem com o nome dele e informe o e-mail funcional ` +
    "como contato. O envio sai da conta que ELE conectou — não invente outro remetente, não escreva 'enviado por " +
    "assistente' e não prometa resposta em endereço diferente do que aparece no cabeçalho."
  );
}
