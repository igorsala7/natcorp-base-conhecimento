/**
 * Resolução das regras de acesso a ferramentas (`ai_acesso_regras`).
 *
 * PURO e sem I/O — recebe as regras já carregadas. É o que torna isto testável
 * sem banco, e o que permite carregar as regras uma vez por turno em vez de uma
 * vez por ferramenta.
 *
 * ── Precedência ────────────────────────────────────────────────────────
 *
 *   1. regra de USUÁRIO   2. regra de PERFIL   3. regra de BASE
 *
 * O primeiro nível que tiver alguma regra aplicável DECIDE — os de baixo nem
 * são consultados. É isso que faz funcionar o pedido "negar para todos, liberar
 * só para o fulano": a regra de base nega, a de usuário permite, e a de usuário
 * vem antes.
 *
 * ── Dentro do mesmo nível ──────────────────────────────────────────────
 *
 * Vence o escopo MAIS ESPECÍFICO: `tool` > `submodulo` > `modulo`, e, em
 * empate, painel explícito ganha de painel curinga. Só depois disso, se ainda
 * houver empate, NEGAR vence PERMITIR.
 *
 * A especificidade importa porque o caso real aparece: "bloqueia o módulo
 * FINANCEIRO inteiro para a base, exceto a ferramenta de contracheque". Se
 * negar vencesse sempre, a exceção nunca valeria e a regra fina seria
 * impossível de escrever.
 *
 * Negar vence só no empate final — quando duas regras igualmente específicas se
 * contradizem, o que é erro de cadastro. Aí a escolha conservadora é fechar:
 * bloqueio indevido vira chamado, liberação indevida vira vazamento.
 */

export type EfeitoRegra = "permitir" | "negar";

export type RegraAcesso = {
  painel: string | null;
  alvo_tipo: "base" | "perfil" | "usuario";
  alvo: string | null;
  escopo_tipo: "tool" | "modulo" | "submodulo";
  tool_key: string | null;
  modulo: string | null;
  submodulo: string | null;
  efeito: EfeitoRegra;
};

export type ContextoAcesso = {
  painel: string | null;
  perfil: string | null;
  usuario: string | null;
};

/** Módulo/submódulo que a ferramenta serve (vem de `ai_tool_modules`). */
export type ModuloDaTool = { modulo: string; submodulo: string | null };

export type Decisao = {
  efeito: EfeitoRegra;
  /** Regra que decidiu — para explicar o corte no trace. */
  regra: RegraAcesso;
} | null;

function igual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A regra fala DESTA ferramenta? */
function casaEscopo(r: RegraAcesso, toolKey: string, modulos: readonly ModuloDaTool[]): boolean {
  if (r.escopo_tipo === "tool") return igual(r.tool_key, toolKey);
  if (r.escopo_tipo === "modulo") return modulos.some((m) => igual(m.modulo, r.modulo));
  // submodulo: precisa casar os dois. Um submódulo com o mesmo nome sob outro
  // módulo é outra coisa — 'RELATÓRIOS' existe sob FREQUÊNCIA e sob SEGURANÇA
  // DO TRABALHO, e confundi-los liberaria o que se quis bloquear.
  return modulos.some((m) => igual(m.modulo, r.modulo) && igual(m.submodulo, r.submodulo));
}

/** A regra vale para QUEM está perguntando? */
function casaAlvo(r: RegraAcesso, ctx: ContextoAcesso): boolean {
  if (r.painel !== null && !igual(r.painel, ctx.painel)) return false;
  switch (r.alvo_tipo) {
    case "base":
      return true;
    case "perfil":
      return igual(r.alvo, ctx.perfil);
    case "usuario":
      return igual(r.alvo, ctx.usuario);
  }
}

const PESO_ALVO = { usuario: 3, perfil: 2, base: 1 } as const;
const PESO_ESCOPO = { tool: 3, submodulo: 2, modulo: 1 } as const;

/** Especificidade dentro de um nível: escopo primeiro, painel como desempate. */
function especificidade(r: RegraAcesso): number {
  return PESO_ESCOPO[r.escopo_tipo] * 2 + (r.painel !== null ? 1 : 0);
}

/**
 * Decide o acesso a UMA ferramenta.
 *
 * `null` significa "nenhuma regra fala desta ferramenta para esta pessoa" — e
 * NÃO "pode". Quem chama trata o nulo como "seguir para as camadas seguintes"
 * (o cruzamento automático com o ERP e a cerca preexistente). Confundir
 * ausência de regra com permissão explícita é o que faria uma tela vazia
 * liberar tudo.
 */
export function decidirAcesso(
  regras: readonly RegraAcesso[],
  ctx: ContextoAcesso,
  toolKey: string,
  modulos: readonly ModuloDaTool[],
): Decisao {
  const aplicaveis = regras.filter((r) => casaAlvo(r, ctx) && casaEscopo(r, toolKey, modulos));
  if (aplicaveis.length === 0) return null;

  const nivel = Math.max(...aplicaveis.map((r) => PESO_ALVO[r.alvo_tipo]));
  const doNivel = aplicaveis.filter((r) => PESO_ALVO[r.alvo_tipo] === nivel);

  const maisEspecifico = Math.max(...doNivel.map(especificidade));
  const finalistas = doNivel.filter((r) => especificidade(r) === maisEspecifico);

  // Empate real entre regras contraditórias: fecha.
  const negar = finalistas.find((r) => r.efeito === "negar");
  const escolhida = negar ?? finalistas[0]!;
  return { efeito: escolhida.efeito, regra: escolhida };
}

/**
 * Cruzamento automático com as permissões do ERP.
 *
 * Devolve `true` quando a ferramenta pode passar. Três situações, e a terceira
 * é a que não pode ser confundida com as outras:
 *
 *   a) tool tem módulo que EXISTE na taxonomia do ERP e o usuário tem  → passa
 *   b) tool tem módulo que EXISTE na taxonomia do ERP e o usuário não tem → corta
 *   c) tool NÃO tem nenhum módulo que exista na taxonomia do ERP → passa
 *
 * O caso (c) é medido, não hipotético: em 08/09/2026, 37 das 124 ferramentas
 * com módulo cadastrado usavam nomes que não existem em `apex_programas`
 * (`FINANCEIRO`, `FÉRIAS`, `PONTO E FREQUÊNCIA`, `PAGAMENTO`, `DOCUMENTOS`…).
 * A API de permissões nunca vai devolvê-los para ninguém. Tratar isso como
 * "sem permissão" derrubaria férias e financeiro para TODOS os usuários, sem
 * nada na tela apontando o motivo.
 *
 * Enquanto essas 37 não forem remapeadas, elas passam e aparecem no relatório
 * de cobertura da tela de acessos. Quando forem, a regra vira estrita sozinha —
 * sem tocar em código.
 */
export function permitidoPelaTaxonomia(
  modulosDaTool: readonly ModuloDaTool[],
  modulosDoUsuario: readonly ModuloDaTool[],
  taxonomiaDoErp: ReadonlySet<string>,
): boolean {
  if (modulosDaTool.length === 0) return true; // sem tag, sem eixo para cruzar

  const mapeados = modulosDaTool.filter((m) => taxonomiaDoErp.has(chaveModulo(m.modulo)));
  if (mapeados.length === 0) return true; // caso (c)

  return mapeados.some((m) =>
    modulosDoUsuario.some(
      (u) =>
        igual(u.modulo, m.modulo) &&
        // Tool marcada no módulo inteiro (submódulo nulo) passa com qualquer
        // submódulo daquele módulo que o usuário tenha.
        (m.submodulo == null || igual(u.submodulo, m.submodulo)),
    ),
  );
}

/** Normaliza o nome do módulo para comparação em conjunto. */
export function chaveModulo(modulo: string): string {
  return modulo.trim().toLowerCase();
}
