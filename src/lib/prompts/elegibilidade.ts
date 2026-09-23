/**
 * "QUEM VAI VER ESTE PROMPT?" — em português, enquanto a pessoa preenche.
 *
 * Seis allowlists combinadas com E, cada uma opcional, é uma regra simples de
 * implementar e difícil de conferir de cabeça: marcar o portal do Gestor E o
 * perfil FOLHA restringe à interseção, não à união, e quem cadastrou esperando
 * "gestores OU pessoal da folha" só descobre o engano quando alguém reclama de
 * não ver o prompt — sem erro em lugar nenhum para investigar. Com seis
 * dimensões o risco só cresce.
 *
 * Então a tela diz a frase resultante, ao vivo. É a mesma regra do SQL escrita
 * por extenso, e é pura de propósito: mora fora do módulo `server-only` para o
 * formulário poder usá-la, e tem teste porque é ela que o admin vai ler em vez
 * de ler o código.
 */

export type Elegibilidade = {
  bases: string[];
  portais: string[];
  perfis: string[];
  empresas: string[];
  usuarios: string[];
  matriculas: string[];
};

/** Nome amigável dos três painéis do ERP. */
const NOME_PORTAL: Record<string, string> = {
  PO: "Operador",
  PG: "Gestor",
  PC: "Colaborador",
};

export function nomeDoPortal(id: string): string {
  return NOME_PORTAL[id.trim().toUpperCase()] ?? id;
}

function lista(itens: string[], conector = "e"): string {
  const v = itens.map((s) => s.trim()).filter(Boolean);
  if (v.length <= 1) return v[0] ?? "";
  return `${v.slice(0, -1).join(", ")} ${conector} ${v[v.length - 1]}`;
}

const cheios = (v: string[] | undefined) => (v ?? []).filter((x) => x && x.trim());

/**
 * A frase que a tela mostra. Sempre afirmativa e sempre completa — nunca
 * "nenhuma restrição", que deixa a pessoa deduzir o efeito.
 *
 * Cada dimensão traz o próprio VERBO ("estiver no portal", "for do perfil",
 * "tiver a matrícula"), porque uma frase única com preposição genérica sai
 * torta e, pior, ambígua: "só para o portal do Gestor e o perfil FOLHA" se lê
 * tanto como interseção quanto como união. Com os verbos, "estiver ... e
 * for ..." só tem uma leitura.
 *
 * `nomeDaBase` existe porque a allowlist guarda o CÓDIGO da base e o admin
 * conhece o nome. Sem ele a frase diria "for da base leadec_sa".
 */
export function resumoElegibilidade(
  e: Partial<Elegibilidade>,
  nomeDaBase?: (code: string) => string,
): string {
  const bases = cheios(e.bases);
  const portais = cheios(e.portais);
  const perfis = cheios(e.perfis);
  const empresas = cheios(e.empresas);
  const usuarios = cheios(e.usuarios);
  const matriculas = cheios(e.matriculas);

  if (
    !bases.length &&
    !portais.length &&
    !perfis.length &&
    !empresas.length &&
    !usuarios.length &&
    !matriculas.length
  ) {
    return "Todos os usuários desta base veem este prompt.";
  }

  // A ordem vai do recorte mais largo ao mais estreito — cliente, tela,
  // empresa, perfil, pessoa. É como quem cadastra pensa o filtro.
  const oracoes: string[] = [];
  if (bases.length) {
    oracoes.push(`for da base ${lista(bases.map((b) => nomeDaBase?.(b) ?? b), "ou")}`);
  }
  if (portais.length) {
    oracoes.push(
      portais.length === 1
        ? `estiver no portal do ${nomeDoPortal(portais[0]!)}`
        : `estiver no portal ${lista(portais.map(nomeDoPortal), "ou")}`,
    );
  }
  if (empresas.length) {
    oracoes.push(`for da empresa ${lista(empresas, "ou")}`);
  }
  if (perfis.length) {
    oracoes.push(`for do perfil ${lista(perfis, "ou")}`);
  }
  if (usuarios.length) {
    oracoes.push(
      usuarios.length === 1
        ? `for o usuário ${usuarios[0]!}`
        : `estiver entre os ${usuarios.length} usuários listados`,
    );
  }
  if (matriculas.length) {
    oracoes.push(
      matriculas.length === 1
        ? `tiver a matrícula ${matriculas[0]!}`
        : `estiver entre as ${matriculas.length} matrículas listadas`,
    );
  }

  /*
    "ou" DENTRO de uma dimensão, "e" ENTRE elas — e essa diferença é a regra.
    Dois portais marcados de fato liberam qualquer um dos dois; o que nunca é
    "ou" é a junção base × portal × empresa × perfil × usuário × matrícula.
    Escrever "ou" nos dois níveis seria mentir sobre a interseção; escrever "e"
    nos dois produziria "no portal Gestor e Operador", que ninguém está ao
    mesmo tempo.
  */
  return `Só quem ${lista(oracoes, "e")}.`;
}

/**
 * Aviso quando a combinação provavelmente não alcança ninguém.
 *
 * Não é validação — o perfil pode existir e simplesmente ainda não ter
 * aparecido em conversa nenhuma, e recusar o cadastro por isso impediria
 * preparar o prompt antes de o time entrar. É um aviso, e ele nomeia o que
 * está fora da lista conhecida para a pessoa conferir a grafia.
 *
 * Vale para perfil e empresa, as duas dimensões que a tela oferece a partir do
 * que o banco JÁ VIU. Usuário e matrícula não entram: não há lista conhecida
 * (de propósito — ver `vocabularioDoEscopo`), então todo valor pareceria
 * suspeito e o aviso viraria ruído garantido.
 */
export function avisoDeAlcance(
  e: Partial<Elegibilidade>,
  conhecidos: { perfis: string[]; empresas: string[] },
): string | null {
  const fora = (usados: string[], vistos: string[]) => {
    const set = new Set(vistos.map((p) => p.trim().toLowerCase()));
    return usados.filter((p) => !set.has(p.trim().toLowerCase()));
  };

  const perfis = fora(cheios(e.perfis), conhecidos.perfis);
  const empresas = fora(cheios(e.empresas), conhecidos.empresas);
  if (!perfis.length && !empresas.length) return null;

  const partes: string[] = [];
  if (perfis.length) {
    partes.push(perfis.length === 1 ? `O perfil “${perfis[0]}”` : `Os perfis ${lista(perfis)}`);
  }
  if (empresas.length) {
    partes.push(
      empresas.length === 1 ? `a empresa “${empresas[0]}”` : `as empresas ${lista(empresas)}`,
    );
  }
  return `${lista(partes)} ainda não apareceu em nenhuma conversa desta base — confira a grafia.`;
}
