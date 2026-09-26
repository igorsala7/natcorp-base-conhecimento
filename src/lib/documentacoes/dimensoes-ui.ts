import { DIMENSOES, type Dimensao, type Regra } from "@/lib/elegibilidade";

/**
 * O QUE A TELA MOSTRA EM CADA UMA DAS DOZE DIMENSÕES.
 *
 * Fica fora do componente e fora da action porque os DOIS lados precisam da
 * mesma tabela: a tela decide qual controle desenhar, a action decide qual
 * ferramenta chamar. Com a tabela duplicada, acrescentar uma dimensão
 * compilaria com um dos lados ignorando a nova — e o sintoma seria um campo que
 * a tela oferece e o servidor não sabe preencher, ou o contrário.
 *
 * Também é pura de propósito (nada de `server-only`): o componente é
 * `"use client"` e o teste não sobe runtime de servidor.
 */

/** De onde saem os valores oferecidos numa dimensão. */
export type OrigemDeValores =
  /** Constante do produto (os três painéis). */
  | { tipo: "fixo"; valores: { valor: string; rotulo: string }[] }
  /** Cadastro do próprio sistema (`ai_bases`). */
  | { tipo: "cadastro" }
  /** Ferramenta de integração do ERP do cliente (`ai_tools.key`). */
  | { tipo: "tool"; key: string; campoValor: string[]; campoRotulo: string[] }
  /** Sem lista: o valor é sempre digitado. */
  | { tipo: "digitacao"; porque: string };

export type GrupoDeDimensao = "onde" | "alocacao" | "pessoa";

export type DimensaoUI = {
  dimensao: Dimensao;
  rotulo: string;
  /** O que a pessoa precisa saber para escolher — nunca repete o rótulo. */
  ajuda: string;
  grupo: GrupoDeDimensao;
  origem: OrigemDeValores;
  /**
   * Se o diagnóstico de presença ("esta base nunca enviou valor para X") vale.
   *
   * Falso só para `base`: `vocabulario_rastreio` não devolve essa dimensão de
   * propósito (a base é o FILTRO da consulta, não um valor a descobrir), então o
   * aviso diria "nunca enviou valor" sobre toda base do sistema — um alarme que
   * dispara sempre e por isso não informa nada.
   */
  presenca: boolean;
};

/**
 * Três grupos, e não doze campos soltos.
 *
 * A ordem dentro de cada grupo segue a da frase (`resumoElegibilidade`), que vai
 * do recorte mais largo ao mais estreito. Doze caixas idênticas em coluna é a
 * forma mais rápida de ninguém achar a que quer — e aqui errar a caixa não dá
 * erro, dá documentação que não alcança ninguém.
 */
export const GRUPOS: { chave: GrupoDeDimensao; titulo: string; descricao: string }[] = [
  {
    chave: "onde",
    titulo: "Onde a pessoa está",
    descricao: "O recorte mais largo: cliente, painel e empresa de onde a pergunta chega.",
  },
  {
    chave: "alocacao",
    titulo: "Como a pessoa está alocada",
    descricao:
      "Sempre a alocação PRÓPRIA de quem pergunta. Um gestor de três centros de custo tem um só centro de custo próprio, e é esse que conta.",
  },
  {
    chave: "pessoa",
    titulo: "Quem a pessoa é",
    descricao: "Perfil de acesso e, no limite, a pessoa nominal.",
  },
];

/**
 * As seis ferramentas de estrutura que resolvem NOME → CÓDIGO no ERP.
 *
 * `campoValor` e `campoRotulo` são listas de candidatos porque o retorno do ORDS
 * não segue um padrão único (`nome_filial`, `descricao_unidade_adm`) e porque
 * `sindicatos` devolveu ZERO linhas na medição de 25/09 nesta base — os nomes de
 * campo dele são candidatos, não medidos. A ordem importa: o primeiro que
 * existir na linha ganha.
 *
 * O `campoValor` é explícito, e não um "primeiro campo que começa com cod",
 * porque a linha de centro de custo traz `cod_empresa` ANTES de `cod_ccusto`: a
 * heurística escolheria o código da empresa e a tela ofereceria empresa no campo
 * de centro de custo, sem erro nenhum.
 */
const DIMENSOES_UI: DimensaoUI[] = [
  {
    dimensao: "base",
    rotulo: "Cliente (base)",
    ajuda: "O `p_base` do token. Restringe a documentação a clientes específicos.",
    grupo: "onde",
    presenca: false,
    origem: { tipo: "cadastro" },
  },
  {
    dimensao: "portal",
    rotulo: "Portal",
    ajuda: "O painel de onde a pessoa abre o assistente: Operador, Gestor ou Colaborador.",
    grupo: "onde",
    presenca: true,
    origem: {
      tipo: "fixo",
      valores: [
        { valor: "PO", rotulo: "Operador" },
        { valor: "PG", rotulo: "Gestor" },
        { valor: "PC", rotulo: "Colaborador" },
      ],
    },
  },
  {
    dimensao: "empresa",
    rotulo: "Empresa",
    ajuda: "Código da empresa no ERP (700, 1, 99…), não o nome.",
    grupo: "onde",
    presenca: true,
    origem: {
      tipo: "tool",
      key: "estrutura_empresas",
      campoValor: ["cod_empresa"],
      campoRotulo: ["nome_empresa"],
    },
  },
  {
    dimensao: "filial",
    rotulo: "Filial",
    ajuda: "Código da filial. O mesmo código existe em várias empresas — a regra olha só o código.",
    grupo: "onde",
    presenca: true,
    origem: {
      tipo: "tool",
      key: "estrutura_filiais",
      campoValor: ["cod_filial"],
      campoRotulo: ["nome_filial"],
    },
  },
  {
    dimensao: "centro_custo",
    rotulo: "Centro de custo",
    ajuda: "Código do centro de custo da própria pessoa, não dos que ela gerencia.",
    grupo: "alocacao",
    presenca: true,
    origem: {
      tipo: "tool",
      key: "estrutura_centros_custo",
      campoValor: ["cod_ccusto", "cod_centro_custo"],
      campoRotulo: ["nome_centro_custo", "descricao_centro_custo"],
    },
  },
  {
    dimensao: "unidade_adm",
    rotulo: "Unidade administrativa",
    ajuda: "Código da unidade administrativa no cadastro do ERP.",
    grupo: "alocacao",
    presenca: true,
    origem: {
      tipo: "tool",
      key: "estrutura_unidades_adm",
      campoValor: ["cod_unidade_adm"],
      campoRotulo: ["descricao_unidade_adm", "nome_unidade_adm"],
    },
  },
  {
    dimensao: "unidade_negocio",
    rotulo: "Unidade de negócio",
    ajuda: "Código da unidade de negócio da própria pessoa, do jeito que está cadastrado no ERP.",
    grupo: "alocacao",
    presenca: true,
    origem: {
      tipo: "digitacao",
      porque: "Não existe endpoint de unidade de negócio no ERP — é a única das doze sem lista.",
    },
  },
  {
    dimensao: "vinculo",
    rotulo: "Vínculo empregatício",
    ajuda: "CLT, PJ, autônomo, estagiário — pelo código de vínculo do ERP.",
    grupo: "alocacao",
    presenca: true,
    origem: {
      tipo: "tool",
      key: "estrutura_vinculos_empregaticios",
      campoValor: ["cod_vinculo"],
      campoRotulo: ["nome_vinculo", "descricao_vinculo"],
    },
  },
  {
    dimensao: "sindicato",
    rotulo: "Sindicato",
    ajuda: "Código do sindicato da pessoa.",
    grupo: "alocacao",
    presenca: true,
    origem: {
      tipo: "tool",
      key: "estrutura_sindicatos",
      campoValor: ["cod_sindicato", "codigo_sindicato"],
      campoRotulo: ["nome_sindicato", "nome", "descricao_sindicato", "sigla_sindicato"],
    },
  },
  {
    dimensao: "perfil",
    rotulo: "Perfil de acesso",
    ajuda:
      "O perfil de acesso da pessoa no cadastro do sistema — por exemplo, MASTER é o perfil de quem " +
      "administra. Não é o painel de onde ela abre o assistente (isso é a dimensão \"Portal\", acima).",
    grupo: "pessoa",
    presenca: true,
    origem: {
      tipo: "digitacao",
      porque:
        "O perfil não é enum no ERP: chega como texto. A lista oferecida é o que esta base já enviou em conversa.",
    },
  },
  {
    dimensao: "usuario",
    rotulo: "Usuário (login)",
    ajuda: "Restringe a pessoas nominais. Use com parcimônia: a lista envelhece com a rotatividade.",
    grupo: "pessoa",
    presenca: true,
    origem: {
      tipo: "digitacao",
      porque:
        "Não existe lista COMPLETA de logins por desenho (montá-la exporia os usuários de todos os clientes); só aparecem os que já conversaram aqui.",
    },
  },
  {
    dimensao: "matricula",
    rotulo: "Matrícula",
    ajuda: "Restringe a matrículas nominais. Some quando a pessoa é desligada.",
    grupo: "pessoa",
    presenca: true,
    origem: {
      tipo: "digitacao",
      porque:
        "Não existe lista COMPLETA de matrículas por desenho (montá-la exporia as pessoas de todos os clientes); só aparecem as que já conversaram aqui.",
    },
  },
];

/**
 * A tabela na ordem de tela, conferida contra `DIMENSOES` na carga do módulo.
 *
 * A conferência existe porque o defeito seria silencioso nas duas direções:
 * dimensão nova sem linha aqui simplesmente não apareceria na tela (e ninguém
 * conseguiria restringir por ela), e linha aqui para uma chave que não é
 * dimensão produziria uma regra que `chavesProblematicasDaRegra` recusa na
 * gravação — erro na cara do admin, culpa do código.
 */
if (DIMENSOES_UI.length !== DIMENSOES.length) {
  throw new Error(
    `dimensoes-ui: ${DIMENSOES_UI.length} linhas para ${DIMENSOES.length} dimensões. Acrescente a que falta.`,
  );
}
for (const d of DIMENSOES) {
  if (!DIMENSOES_UI.some((x) => x.dimensao === d)) {
    throw new Error(`dimensoes-ui: falta a dimensão "${d}".`);
  }
}

export const DIMENSOES_DA_TELA: readonly DimensaoUI[] = DIMENSOES_UI;

export function dimensaoUI(d: Dimensao): DimensaoUI {
  // O `!` é seguro pela conferência acima, que roda na carga do módulo.
  return DIMENSOES_UI.find((x) => x.dimensao === d)!;
}

export function dimensoesDoGrupo(g: GrupoDeDimensao): DimensaoUI[] {
  return DIMENSOES_UI.filter((x) => x.grupo === g);
}

/**
 * O ESTADO DO FORMULÁRIO, e por que ele não é a regra.
 *
 * "Sem restrição" é um interruptor por dimensão, nunca campo em branco — campo
 * em branco é estado inválido, e a convenção do motor é que lista vazia LIBERA.
 * Quem apagasse o último valor querendo restringir mais teria aberto para todo
 * mundo, sem nada na tela dizendo isso. Por isso o interruptor (`restritas`) e os
 * valores moram separados, e a conversão nos dois sentidos é destas funções.
 */
export type FormularioDeRegra = {
  restritas: Dimensao[];
  valores: Partial<Record<Dimensao, string[]>>;
};

/** Regra gravada → formulário. Lista vazia ou só de brancos NÃO liga o interruptor. */
export function regraParaFormulario(regra: Regra | null | undefined): FormularioDeRegra {
  const restritas: Dimensao[] = [];
  const valores: Partial<Record<Dimensao, string[]>> = {};
  if (!regra || typeof regra !== "object" || Array.isArray(regra)) return { restritas, valores };
  for (const { dimensao } of DIMENSOES_UI) {
    const bruto = regra[dimensao];
    if (!Array.isArray(bruto)) continue;
    const lista = bruto.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    if (lista.length) {
      restritas.push(dimensao);
      valores[dimensao] = lista;
    }
  }
  return { restritas, valores };
}

/**
 * Formulário → regra a gravar. Dimensão ligada e SEM valor sai de fora.
 *
 * Sair de fora e não virar `[]` é o ponto: `[]` LIBERA, que é o oposto da
 * intenção de quem ligou o interruptor. Quem acusa esse estado é a tela, antes de
 * chamar a action — aqui a regra sai apenas consistente.
 */
export function formularioParaRegra(f: FormularioDeRegra): Regra {
  const regra: Regra = {};
  for (const d of f.restritas) {
    const lista = (f.valores[d] ?? []).filter((v) => v.trim() !== "");
    if (lista.length) regra[d] = lista;
  }
  return regra;
}

/**
 * A regra SEM a dimensão de cliente, para a tela do cliente MOSTRAR.
 *
 * A área do cliente (`/gestao/conteudo`) não pode imprimir o código de outro
 * cliente na tela deste — e uma documentação universal restrita a dois clientes
 * faria exatamente isso na frase de alcance. Ali a condição de cliente é
 * verdadeira por construção (a página só lista o que vale para a base da
 * sessão), então retirá-la não muda o sentido do que é dito.
 *
 * Só para MOSTRAR: o que vai ao banco é a regra inteira. Descartar a dimensão no
 * caminho de gravação transformaria uma regra que fecha numa regra que abre, que
 * é o defeito que o validador de chaves existe para impedir.
 */
export function regraSemCliente(regra: Regra): Regra {
  const out = { ...regra };
  delete out.base;
  return out;
}

export type ValorOferecido = {
  valor: string;
  /** Nome legível, quando o cadastro tem um. */
  rotulo?: string;
  /** De onde veio, para a tela dizer e para o filtro do seletor casar. */
  fonte: "conversas" | "cadastro";
};

/**
 * O resultado de buscar no ERP a lista de valores de uma dimensão.
 *
 * Mora aqui, e não na action que busca, porque as DUAS telas o consomem (a do
 * admin e a do cliente em `/gestao/conteudo`) e porque este módulo é puro — um
 * componente `"use client"` não pode importar de um arquivo `server-only`.
 *
 * "Vazia" e "indisponível" são coisas diferentes para quem está configurando: a
 * primeira manda conferir o cadastro do cliente, a segunda manda liberar uma
 * ferramenta ou digitar o código. Por isso a recusa carrega o MOTIVO, nunca um
 * booleano.
 */
export type ListaDeValores =
  | {
      ok: true;
      valores: ValorOferecido[];
      total: number;
      /** Login do ERP usado na consulta. A tela DIZ qual foi: o ORDS escopa por
       *  usuário, e uma lista curta pode ser recorte de permissão. */
      usuario: string;
      formatoDesconhecido: boolean;
    }
  | { ok: false; motivo: string };

/**
 * Teto de valores devolvidos ao navegador, por dimensão.
 *
 * Medido em 25/09: `estrutura_centros_custo` devolve 2.847 linhas na base
 * natcorp. O seletor do produto renderiza TODAS as opções filtradas (não
 * virtualiza), então a lista inteira seriam 2.847 nós no DOM a cada abertura.
 * O corte é o mesmo de `listarPerfis` (300) e a tela DIZ o total, para "não
 * achei" e "não está na lista que couberam" não virarem a mesma coisa.
 */
export const TETO_DE_VALORES = 300;

const texto = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v.trim();
  return "";
};

/** Acha o array de linhas dentro da resposta da ferramenta. */
function linhasDaResposta(data: unknown): Record<string, unknown>[] {
  const bruto = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown[] }).items)
      ? (data as { items: unknown[] }).items
      : [];
  return bruto.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
}

/**
 * Extrai os valores DISTINTOS de uma dimensão do retorno da ferramenta.
 *
 * Devolve `total` além da lista cortada, porque a tela precisa dizer "300 de
 * 2.847": sem o total, quem não acha o código na lista não sabe se ele não
 * existe ou se ficou de fora do corte, e as duas conclusões levam a ações
 * opostas (corrigir o cadastro × digitar o código).
 *
 * Dedupe por VALOR e não por linha: `cod_filial = 1` existe em toda empresa, e a
 * regra compara só o código — oferecer "1" catorze vezes seria descrever a
 * planilha, não a regra. Quando o mesmo código traz nomes diferentes, o rótulo
 * fica com o primeiro e a tela recebe `varios: true` para avisar.
 */
export function extrairValoresDaTool(
  origem: OrigemDeValores,
  data: unknown,
): { valores: ValorOferecido[]; total: number; formatoDesconhecido: boolean } {
  if (origem.tipo !== "tool") return { valores: [], total: 0, formatoDesconhecido: false };
  const linhas = linhasDaResposta(data);
  const porValor = new Map<string, ValorOferecido>();
  let algumCampoAchado = false;

  for (const linha of linhas) {
    const campoV = origem.campoValor.find((c) => c in linha);
    if (!campoV) continue;
    algumCampoAchado = true;
    const valor = texto(linha[campoV]);
    if (!valor) continue;
    const campoR = origem.campoRotulo.find((c) => c in linha && texto(linha[c]));
    const rotulo = campoR ? texto(linha[campoR]) : undefined;
    const ja = porValor.get(valor);
    if (!ja) porValor.set(valor, { valor, rotulo, fonte: "cadastro" });
  }

  const todos = [...porValor.values()].sort((a, b) =>
    a.valor.localeCompare(b.valor, "pt-BR", { numeric: true }),
  );
  return {
    valores: todos.slice(0, TETO_DE_VALORES),
    total: todos.length,
    // Linhas vieram mas nenhuma tinha o campo esperado: o ORDS mudou o retorno.
    // Silenciar isso ofereceria uma lista vazia, que quem configura leria como
    // "este cliente não tem nenhum" — a conclusão oposta.
    formatoDesconhecido: linhas.length > 0 && !algumCampoAchado,
  };
}
