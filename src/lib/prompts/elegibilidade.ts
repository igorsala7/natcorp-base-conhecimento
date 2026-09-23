/**
 * "QUEM VAI VER ESTE PROMPT?" — em português, enquanto a pessoa preenche.
 *
 * Três allowlists combinadas com E, cada uma opcional, é uma regra simples de
 * implementar e difícil de conferir de cabeça: marcar o portal do Gestor E o
 * perfil FOLHA restringe à interseção, não à união, e quem cadastrou esperando
 * "gestores OU pessoal da folha" só descobre o engano quando alguém reclama de
 * não ver o prompt — sem erro em lugar nenhum para investigar.
 *
 * Então a tela diz a frase resultante, ao vivo. É a mesma regra do SQL escrita
 * por extenso, e é pura de propósito: mora fora do módulo `server-only` para o
 * formulário poder usá-la, e tem teste porque é ela que o admin vai ler em vez
 * de ler o código.
 */

export type Elegibilidade = {
  portais: string[];
  perfis: string[];
  usuarios: string[];
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

/**
 * A frase que a tela mostra. Sempre afirmativa e sempre completa — nunca
 * "nenhuma restrição", que deixa a pessoa deduzir o efeito.
 *
 * Cada dimensão traz o próprio VERBO ("estiver no portal", "for do perfil"),
 * porque uma frase única com preposição genérica sai torta e, pior, ambígua:
 * "só para o portal do Gestor e o perfil FOLHA" se lê tanto como interseção
 * quanto como união. Com os verbos, "estiver ... e for ..." só tem uma leitura.
 */
export function resumoElegibilidade(e: Elegibilidade): string {
  const portais = e.portais.filter((v) => v && v.trim());
  const perfis = e.perfis.filter((v) => v && v.trim());
  const usuarios = e.usuarios.filter((v) => v && v.trim());

  if (!portais.length && !perfis.length && !usuarios.length) {
    return "Todos os usuários desta base veem este prompt.";
  }

  const oracoes: string[] = [];
  if (portais.length) {
    oracoes.push(
      portais.length === 1
        ? `estiver no portal do ${nomeDoPortal(portais[0]!)}`
        : `estiver no portal ${lista(portais.map(nomeDoPortal), "ou")}`,
    );
  }
  if (perfis.length) {
    oracoes.push(
      perfis.length === 1
        ? `for do perfil ${perfis[0]!}`
        : `for do perfil ${lista(perfis, "ou")}`,
    );
  }
  if (usuarios.length) {
    oracoes.push(
      usuarios.length === 1
        ? `for o usuário ${usuarios[0]!}`
        : `estiver entre os ${usuarios.length} usuários listados`,
    );
  }

  /*
    "ou" DENTRO de uma dimensão, "e" ENTRE elas — e essa diferença é a regra.
    Dois portais marcados de fato liberam qualquer um dos dois; o que nunca é
    "ou" é a junção portal × perfil × usuário. Escrever "ou" nos dois níveis
    seria mentir sobre a interseção; escrever "e" nos dois produziria "no
    portal Gestor e Operador", que ninguém está ao mesmo tempo.
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
 */
export function avisoDeAlcance(e: Elegibilidade, perfisConhecidos: string[]): string | null {
  const conhecidos = new Set(perfisConhecidos.map((p) => p.trim().toLowerCase()));
  const estranhos = e.perfis.filter((p) => p.trim() && !conhecidos.has(p.trim().toLowerCase()));
  if (!estranhos.length) return null;
  return estranhos.length === 1
    ? `O perfil “${estranhos[0]}” ainda não apareceu em nenhuma conversa desta base — confira a grafia.`
    : `Estes perfis ainda não apareceram em nenhuma conversa desta base: ${lista(estranhos)}. Confira a grafia.`;
}
