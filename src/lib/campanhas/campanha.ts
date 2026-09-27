import { z } from "zod";
import { exclusoesEntreRegras } from "@/lib/documentacoes/regras-combinadas";
import { regraParaFormulario, type FormularioDeRegra } from "@/lib/documentacoes/dimensoes-ui";
import type { Regra } from "@/lib/elegibilidade";

/**
 * O QUE UMA CAMPANHA É PARA A TELA, e as quatro decisões que não podem morar
 * no componente.
 *
 * Este módulo é puro (nada de `server-only`): a tela é `"use client"` e a
 * Server Action precisa das MESMAS decisões. Duas implementações divergiriam, e
 * o sintoma seria a tela liberar o botão para uma gravação que o servidor
 * recusa, ou pior, mostrar um estado que não é o que o banco aplica.
 *
 * ── 1. O ESTADO É DERIVADO, NUNCA GRAVADO ────────────────────────────────
 * Não existe coluna `status` em `ai_campanhas`, e isso é de propósito: o
 * agendamento é um PREDICADO de consulta (ver o cabeçalho de
 * `20260926160000_campanhas.sql`), então "ativa" é uma conta sobre o relógio e
 * não um fato guardado. Uma coluna de status precisaria de um worker para
 * mantê-la, e aí voltaria a existir o estado "devia ter mudado e não mudou".
 * `estadoDaCampanha` é essa conta, escrita uma vez.
 *
 * ── 2. O INTERRUPTOR DE REPETIÇÃO NASCE DESLIGADO ────────────────────────
 * Decisão do dono: o padrão é "uma vez por pessoa". Um formulário que mandasse
 * `true` por omissão inverteria essa decisão, e nenhum CHECK do banco pega isso
 * (`repetir` é boolean, os dois valores são válidos). Por isso o esquemazod
 * abaixo EXIGE o campo, e `campanhaParaFormulario(null)` devolve `false`.
 *
 * ── 3. OS DOIS CHECKS DO BANCO TÊM DE SER VALIDADOS AQUI ─────────────────
 * `ai_campanhas_titulo_nao_branco` e `ai_campanhas_janela_coerente` existem para
 * barrar dado que não deveria existir. Sem validar antes, o cliente recebe um
 * 500 no lugar de uma frase que diz o que corrigir.
 *
 * ── 4. A REGRA QUE EXCLUI A PRÓPRIA EMPRESA ──────────────────────────────
 * A campanha pertence a UMA base (`ai_campanhas.base_id`), e `alertas_para`
 * exige as duas coisas ao mesmo tempo: a base da campanha E a `regra`. Uma
 * regra que restringe a dimensão de cliente a OUTRA empresa produz um aviso que
 * não alcança ninguém, sem erro em lugar nenhum. É o mesmo defeito que
 * `exclusoesEntreRegras` recusa na documentação, e é a mesma função que o
 * detecta: a "segunda regra" aqui é a base a que o aviso está preso.
 */

/** Uma campanha como a tela precisa dela. Espelho da linha, em camelCase. */
export type Campanha = {
  id: string;
  titulo: string;
  corpo: string;
  regra: Regra;
  /** ISO-8601. A partir deste instante o aviso está na janela. */
  publicarEm: string;
  /** ISO-8601, ou nulo para "não encerra". */
  encerrarEm: string | null;
  enabled: boolean;
  repetir: boolean;
  criadaPor: string | null;
  criadaEm: string;
};

export type EstadoDaCampanha = "agendada" | "ativa" | "encerrada" | "desligada";

/**
 * O estado de uma campanha no instante `agora`.
 *
 * A ORDEM DOS RAMOS É A REGRA, e ela não é arbitrária: a janela vencida vem
 * ANTES do interruptor. Uma campanha cujo `encerrar_em` já passou não volta a
 * aparecer nem se alguém religar o interruptor, porque `alertas_para` corta pela
 * janela também. Chamá-la de "Desligada" sugeriria que religar resolve, e a
 * pessoa clicaria num botão que não faz nada visível.
 *
 * Os quatro ramos espelham, na mesma ordem, os quatro pedaços do predicado de
 * `alertas_para`: `encerrar_em > now()`, `enabled`, `publicar_em <= now()`.
 */
export function estadoDaCampanha(
  c: Pick<Campanha, "publicarEm" | "encerrarEm" | "enabled">,
  agora: Date = new Date(),
): EstadoDaCampanha {
  const fim = c.encerrarEm ? new Date(c.encerrarEm).getTime() : null;
  if (fim !== null && !Number.isNaN(fim) && fim <= agora.getTime()) return "encerrada";
  if (!c.enabled) return "desligada";
  const inicio = new Date(c.publicarEm).getTime();
  if (!Number.isNaN(inicio) && inicio > agora.getTime()) return "agendada";
  return "ativa";
}

/**
 * Rótulo e tom de cada estado, num lugar só.
 *
 * Fica aqui, e não no componente, porque o teste do estado e a etiqueta da tela
 * têm de falar a mesma língua: uma campanha calculada como "encerrada" e
 * pintada como "ativa" é pior do que qualquer um dos dois erros isolados.
 */
export const ROTULO_DO_ESTADO: Record<
  EstadoDaCampanha,
  { rotulo: string; tom: "neutro" | "bom" | "atencao" }
> = {
  ativa: { rotulo: "Aparecendo agora", tom: "bom" },
  agendada: { rotulo: "Agendado", tom: "neutro" },
  encerrada: { rotulo: "Encerrado", tom: "neutro" },
  desligada: { rotulo: "Parado", tom: "atencao" },
};

/** Um problema de preenchimento, já no campo em que a tela o mostra. */
export type ProblemaDaCampanha = {
  campo: "titulo" | "publicarEm" | "encerrarEm";
  mensagem: string;
};

/** Limites de texto. `titulo` e `corpo` são `text` no banco; o teto é de leitura. */
export const MAX_TITULO = 200;
export const MAX_CORPO = 4000;

/**
 * Os problemas de preenchimento, ANTES de gravar.
 *
 * As duas primeiras regras são os dois CHECKs do banco ditos em português. A
 * terceira (título comprido) é só de leitura: o aviso é a primeira mensagem do
 * chat, e um título de mil caracteres não é título.
 *
 * O aparo aqui é o `.trim()` do JavaScript, que é MAIS largo que o `btrim` de um
 * argumento do Postgres (só espaço). A direção é a segura: um título feito
 * apenas de tabulação passaria pelo CHECK e seria recusado aqui, e o resultado é
 * uma frase na tela em vez de uma primeira mensagem em branco no chat de todo
 * mundo que a regra alcança.
 */
export function problemasDaCampanha(f: {
  titulo: string;
  corpo?: string;
  publicarEm: string | null;
  encerrarEm: string | null;
}): ProblemaDaCampanha[] {
  const out: ProblemaDaCampanha[] = [];

  if (!f.titulo.trim()) {
    out.push({
      campo: "titulo",
      mensagem: "Escreva o título do aviso: é a primeira coisa que a pessoa lê no chat.",
    });
  } else if (f.titulo.trim().length > MAX_TITULO) {
    out.push({
      campo: "titulo",
      mensagem: `Use no máximo ${MAX_TITULO} caracteres no título. O texto longo cabe na mensagem, abaixo.`,
    });
  }

  const inicio = f.publicarEm ? new Date(f.publicarEm).getTime() : NaN;
  if (Number.isNaN(inicio)) {
    out.push({
      campo: "publicarEm",
      mensagem: "Escolha quando o aviso começa a aparecer.",
    });
  }

  if (f.encerrarEm) {
    const fim = new Date(f.encerrarEm).getTime();
    if (Number.isNaN(fim)) {
      out.push({
        campo: "encerrarEm",
        mensagem: "A data de parada não foi entendida. Escolha de novo, ou deixe em branco.",
      });
    } else if (!Number.isNaN(inicio) && fim <= inicio) {
      // O CHECK do banco é `encerrar_em > publicar_em`. Igual também não serve:
      // uma janela de zero segundo nunca está aberta.
      out.push({
        campo: "encerrarEm",
        mensagem:
          "A data de parada tem de ser depois da data em que o aviso começa, senão ele nunca aparece. " +
          "Deixe em branco para o aviso ficar até você parar.",
      });
    }
  }

  return out;
}

/**
 * A regra restringe a dimensão de cliente a empresas que NÃO incluem esta?
 *
 * Detecta com `exclusoesEntreRegras`, a mesma função que a aba Conteúdo usa, e a
 * "primeira regra" é a base a que o aviso está preso. Com a própria base na
 * lista (sozinha ou acompanhada) não há exclusão: o aviso continua alcançando
 * gente daqui, e o resto da lista é peso morto.
 *
 * A tela do cliente não oferece a dimensão de cliente (pelo mesmo motivo da aba
 * Conteúdo: seria redundante, e listar os valores imprimiria o código de outra
 * empresa numa tela desta). Então este caso chega por dois caminhos: regra
 * gravada antes, e Server Action chamada por fora da nossa página. O segundo é
 * suficiente para a checagem existir: action é endpoint.
 */
export function regraExcluiAPropriaBase(regra: Regra, baseCode: string): boolean {
  if (!baseCode.trim()) return false;
  return exclusoesEntreRegras({ base: [baseCode] }, regra).some((e) => e.dimensao === "base");
}

/** A recusa, sem nomear o código da outra empresa. */
export function mensagemDeAutoExclusao(baseNome: string): string {
  return (
    `A configuração de alcance deste aviso está restrita a outra empresa, então ninguém da ` +
    `${baseNome} receberia. Deixe o cliente em “Todos” ou fale com o suporte Natcorp.`
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   O FORMULÁRIO
   ═══════════════════════════════════════════════════════════════════════════ */

export type FormularioDeCampanha = {
  /** Nulo em aviso novo. */
  id: string | null;
  titulo: string;
  corpo: string;
  /** Valor de `<input type="datetime-local">`, no fuso do navegador. */
  publicarEm: string;
  /** Idem, e vazio significa "não encerra". */
  encerrarEm: string;
  repetir: boolean;
  alcance: FormularioDeRegra;
};

/** ISO (UTC) → valor de `<input type="datetime-local">` no fuso do navegador. */
export function isoParaLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor local do input → ISO UTC. A conversão de fuso é do NAVEGADOR. */
export function localParaIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Campanha gravada → formulário. `null` é o formulário de um aviso NOVO.
 *
 * `repetir: false` no aviso novo é a decisão do dono, e é o valor que esta
 * função existe para garantir: nenhuma tela escreve o padrão à mão, então não há
 * um segundo lugar onde ele possa ser trocado por engano.
 *
 * `publicarEm` já vem preenchido com `agora` no aviso novo, e isso é escolha de
 * UX, não descuido: o caso comum é "avisar agora", e um campo de data vazio
 * obrigaria a digitar o instante presente para fazer a coisa mais frequente. A
 * COLUNA continua sem default no banco, que é onde o default seria perigoso (um
 * formulário que perdesse o campo publicaria para todo mundo em silêncio); aqui
 * o valor é visível na tela e editável antes de salvar.
 */
export function campanhaParaFormulario(
  c: Campanha | null,
  agora: Date = new Date(),
): FormularioDeCampanha {
  if (!c) {
    return {
      id: null,
      titulo: "",
      corpo: "",
      publicarEm: isoParaLocal(agora.toISOString()),
      encerrarEm: "",
      repetir: false,
      alcance: regraParaFormulario({}),
    };
  }
  return {
    id: c.id,
    titulo: c.titulo,
    corpo: c.corpo,
    publicarEm: isoParaLocal(c.publicarEm),
    encerrarEm: isoParaLocal(c.encerrarEm),
    repetir: c.repetir,
    /* A regra inteira, incluindo a dimensão de cliente que a tela não desenha:
       descartá-la aqui transformaria uma regra que FECHA numa que ABRE, que é o
       defeito contra o qual `chavesProblematicasDaRegra` existe. */
    alcance: regraParaFormulario(c.regra),
  };
}

/**
 * O que a Server Action aceita, sem os campos de sessão.
 *
 * Mora neste módulo puro porque um arquivo `"use server"` não consegue exportar
 * um esquema (ali todo export precisa ser função assíncrona) — é o mesmo motivo
 * de `sessaoSchema` viver em `src/lib/gestao/acao.ts`.
 *
 * `repetir` é `z.boolean()` SEM `.optional()` e SEM `.default()`, e essa é a
 * linha mais importante do arquivo: com `.default(true)` o padrão do dono
 * viraria o oposto em silêncio, e com `.optional()` o código de cima precisaria
 * escolher um valor para `undefined` — ou seja, o padrão passaria a existir em
 * DOIS lugares. Exigir o campo faz um formulário que o esqueça falhar alto, e
 * não mudar de comportamento.
 *
 * `regra` fica como `unknown` de propósito, pela mesma razão das ações de
 * documentação: um `z.object({...doze})` recusaria a chave desconhecida com
 * mensagem de Zod ou, pior, a descartaria em silêncio, transformando uma regra
 * que fecha numa que abre. Quem julga isso é `chavesProblematicasDaRegra`.
 */
export const dadosDaCampanhaSchema = z.object({
  id: z.string().uuid("Aviso inválido.").nullable().optional(),
  /*
    MENSAGEM EM PORTUGUÊS EM TODO CAMPO, e não é capricho: a action devolve
    `issues[0].message` direto para a tela, então um campo sem mensagem própria
    entrega ao operador de RH o texto padrão do Zod, em inglês. Quem julga o
    CONTEÚDO destes campos é `problemasDaCampanha`; aqui só se nomeia o tipo
    errado, que é o que chega por payload forjado.
  */
  titulo: z.string("Escreva o título do aviso."),
  corpo: z
    .string("A mensagem chegou num formato inesperado. Atualize a página e tente de novo.")
    .max(MAX_CORPO, `A mensagem passa de ${MAX_CORPO} caracteres. Encurte um pouco.`)
    .optional(),
  publicarEm: z.string("Escolha quando o aviso começa a aparecer."),
  encerrarEm: z.string("Data de parada inválida.").nullable().optional(),
  repetir: z.boolean({
    error: "Não recebemos a escolha de repetição do aviso. Atualize a página e tente de novo.",
  }),
  regra: z.unknown(),
});

export type DadosDaCampanha = z.infer<typeof dadosDaCampanhaSchema>;
