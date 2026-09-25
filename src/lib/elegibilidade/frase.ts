import type { Regra } from "./dimensoes";

/**
 * A FRASE, e por que ela é o produto e não um enfeite.
 *
 * Doze allowlists combinadas com E é uma regra simples de
 * implementar e difícil de conferir de cabeça: marcar o portal do Gestor E o
 * perfil FOLHA restringe à INTERSEÇÃO, não à união, e quem cadastrou esperando
 * "gestores OU pessoal da folha" só descobre quando alguém reclama de não ver o
 * conteúdo, sem erro em lugar nenhum para investigar.
 *
 * Por isso a tela diz a frase resultante, ao vivo. É a mesma regra do
 * predicado escrita por extenso, e é pura de propósito: mora fora de
 * `server-only` para o formulário poder usá-la.
 *
 * O tipo vem de `dimensoes.ts` e não é declarado aqui: com a lista duplicada,
 * acrescentar uma dimensão compilaria com a frase ignorando a nova, e o
 * sintoma seria a tela descrevendo um alcance mais amplo do que o real.
 */
// A frase descreve a MESMA coisa que o predicado avalia, então usa o MESMO
// tipo. `Elegibilidade` fica só como nome antigo, para os importadores não
// mudarem de assinatura no mesmo commit em que mudam de módulo.
export type Elegibilidade = Regra;

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
  const bases = cheios(e.base);
  const portais = cheios(e.portal);
  const perfis = cheios(e.perfil);
  const empresas = cheios(e.empresa);
  const usuarios = cheios(e.usuario);
  const matriculas = cheios(e.matricula);
  const filiais = cheios(e.filial);
  const centros = cheios(e.centro_custo);
  const unidadesAdm = cheios(e.unidade_adm);
  const unidadesNeg = cheios(e.unidade_negocio);
  const vinculos = cheios(e.vinculo);
  const sindicatos = cheios(e.sindicato);

  if (
    !bases.length &&
    !portais.length &&
    !perfis.length &&
    !empresas.length &&
    !usuarios.length &&
    !matriculas.length &&
    !filiais.length &&
    !centros.length &&
    !unidadesAdm.length &&
    !unidadesNeg.length &&
    !vinculos.length &&
    !sindicatos.length
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
  if (filiais.length) {
    oracoes.push(`for da filial ${lista(filiais, "ou")}`);
  }
  if (centros.length) {
    oracoes.push(`for do centro de custo ${lista(centros, "ou")}`);
  }
  if (unidadesAdm.length) {
    oracoes.push(`for da unidade administrativa ${lista(unidadesAdm, "ou")}`);
  }
  if (unidadesNeg.length) {
    oracoes.push(`for da unidade de negócio ${lista(unidadesNeg, "ou")}`);
  }
  if (vinculos.length) {
    // "tiver O vínculo", com artigo, como as irmãs: "tiver A matrícula",
    // "for DA filial", "for DO centro de custo". Sem ele a oração saía fora do
    // padrão de todas as outras, e é numa frase lida de corrido que isso
    // atrapalha — a pessoa tropeça e relê em vez de conferir o alcance.
    oracoes.push(`tiver o vínculo ${lista(vinculos, "ou")}`);
  }
  if (sindicatos.length) {
    oracoes.push(`for do sindicato ${lista(sindicatos, "ou")}`);
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
    "ou" é a junção entre as doze dimensões. Escrever "ou" nos dois níveis
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

  const perfis = fora(cheios(e.perfil), conhecidos.perfis);
  const empresas = fora(cheios(e.empresa), conhecidos.empresas);
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
