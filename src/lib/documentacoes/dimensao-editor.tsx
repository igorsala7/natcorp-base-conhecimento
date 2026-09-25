"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DimensaoUI, ListaDeValores } from "./dimensoes-ui";

/**
 * UMA DIMENSÃO NO FORMULÁRIO: interruptor, valores escolhidos, e a procedência.
 *
 * ── Por que este componente é compartilhado ──────────────────────────────
 * Duas telas editam a MESMA regra de doze dimensões: a aba do admin
 * (`/admin/integracoes`, onde a Natcorp define a oferta) e a do cliente
 * (`/gestao/conteudo`, onde ele ajusta o que vale na empresa dele). O desenho
 * das duas é diferente — uma é escura e vive num diálogo, a outra é clara e vive
 * num iFrame do APEX —, mas esta linha é idêntica, e é ela que carrega as regras
 * que não podem divergir:
 *
 *   · "sem restrição" é INTERRUPTOR, nunca campo em branco. Campo em branco é
 *     estado inválido: quem apagou o último valor querendo restringir mais teria
 *     LIBERADO para todo mundo, sem nada na tela dizendo isso;
 *   · o AVISO DE PRESENÇA ("esta base nunca enviou valor para X"), que é o
 *     diagnóstico que substituiu o contador de alcance medido como inútil;
 *   · a PROCEDÊNCIA da lista, sempre dita, porque "lista vazia" e "lista
 *     indisponível" pedem ações opostas de quem configura.
 *
 * Com duas cópias, corrigir uma dessas três numa tela e esquecer a outra não
 * quebra compilação nem teste: produz duas telas que descrevem a mesma regra de
 * formas diferentes, que é o defeito mais caro desta superfície.
 *
 * Fica em `src/lib/documentacoes/` — o lugar que já guarda a parte comum das
 * duas telas (`dimensoes-ui.ts`) — e é puro de componentes de servidor: só
 * primitivos de UI, nada de `server-only`.
 */

/**
 * O que esta base já enviou nesta dimensão. `null` = ainda não se sabe.
 *
 * `vistos` é opcional — e não `[]` por padrão — porque quem monta o objeto lê
 * `porDimensao[dimensao]`, que é `undefined` na dimensão sem valor nenhum. Com
 * `?? []` do lado de fora, cada render criaria um array novo e invalidaria o
 * `useMemo` das opções, que é justamente a lista entregue ao seletor.
 */
export type PresencaDaDimensao = {
  vistos?: { valor: string; conversas: number }[];
  /** Conversas da base. Zero explica um vocabulário vazio inteiro. */
  conversas: number;
} | null;

/** Opção oferecida quando a origem da dimensão é o cadastro do próprio sistema. */
export type OpcaoDeCadastro = { valor: string; rotulo: string; dica?: string };

/* Constante de módulo, não literal no corpo: um `[]` novo a cada render
   invalidaria o `useMemo` das opções, que é a lista entregue ao seletor. */
const SEM_VALORES: { valor: string; conversas: number }[] = [];

export function LinhaDimensao({
  ui,
  restrita,
  valores,
  onAlternar,
  onValores,
  presenca,
  baseDoEscopo,
  baseRef,
  opcoesDeCadastro,
  lista,
}: {
  ui: DimensaoUI;
  restrita: boolean;
  valores: string[];
  onAlternar: (restrita: boolean) => void;
  onValores: (v: string[]) => void;
  presenca: PresencaDaDimensao;
  /** `base_code` a que a configuração está presa, quando há uma. */
  baseDoEscopo: string | null;
  /** `base_code` de onde as listas de cadastro vêm. Vazio = não há de onde. */
  baseRef: string;
  opcoesDeCadastro: OpcaoDeCadastro[];
  lista: ListaDeValores | undefined;
}) {
  const [digitado, setDigitado] = useState("");
  const idBase = `dim_${ui.dimensao}`;
  const vistos = presenca?.vistos ?? SEM_VALORES;
  /* Esqueleto sai da AUSÊNCIA da lista, não de um estado "carregando": a
     ausência é exatamente o que o efeito do formulário usa para decidir buscar, e
     duas representações do mesmo fato divergem. Sem base de referência não há o
     que esperar, e aí a linha de procedência explica em vez de girar. */
  const carregando = restrita && ui.origem.tipo === "tool" && !!baseRef && lista === undefined;

  /**
   * O que o seletor oferece, e a ORDEM importa.
   *
   * Primeiro o que esta base JÁ ENVIOU nas conversas: são literalmente os textos
   * que `public.elegivel` vai comparar, então casam por construção. Depois o
   * cadastro do ERP, que pode chegar com formatação diferente da do token (o
   * código vem como número 9902 e o painel pode mandar "09902"). Inverter a ordem
   * poria na frente o valor que tem mais chance de não casar.
   */
  const opcoes: SelectOption[] = useMemo(() => {
    const out: SelectOption[] = [];
    const visto = new Set<string>();
    for (const v of vistos) {
      out.push({ value: v.valor, label: v.valor, hint: `${v.conversas} conversa(s)` });
      visto.add(v.valor.toLowerCase());
    }
    if (ui.origem.tipo === "fixo") {
      for (const v of ui.origem.valores) {
        if (visto.has(v.valor.toLowerCase())) continue;
        out.push({ value: v.valor, label: `${v.rotulo} (${v.valor})` });
        visto.add(v.valor.toLowerCase());
      }
    }
    if (ui.origem.tipo === "cadastro") {
      for (const o of opcoesDeCadastro) {
        if (visto.has(o.valor.toLowerCase())) continue;
        out.push({ value: o.valor, label: o.rotulo, hint: o.dica });
        visto.add(o.valor.toLowerCase());
      }
    }
    if (lista?.ok) {
      for (const v of lista.valores) {
        if (visto.has(v.valor.toLowerCase())) continue;
        out.push({ value: v.valor, label: v.rotulo ? `${v.valor} — ${v.rotulo}` : v.valor, hint: "cadastro" });
        visto.add(v.valor.toLowerCase());
      }
    }
    return out.filter((o) => !valores.some((v) => v.toLowerCase() === o.value.toLowerCase()));
  }, [vistos, ui.origem, opcoesDeCadastro, lista, valores]);

  function adicionar(v: string) {
    const limpo = v.trim();
    if (!limpo) return;
    if (valores.some((x) => x.toLowerCase() === limpo.toLowerCase())) return;
    onValores([...valores, limpo]);
    setDigitado("");
  }

  const semPresenca = restrita && ui.presenca && presenca !== null && vistos.length === 0;

  /**
   * A dimensão `base` DENTRO de uma configuração presa a um cliente.
   *
   * As doze são oferecidas sempre (decisão do dono), e esta é a única que pode
   * se contradizer com o escopo: a linha já está presa à base do anexo, e
   * `escopo_documentacao` exige as DUAS condições ao mesmo tempo. Restringir a
   * outra base produz uma regra que não alcança ninguém — e é o tipo de erro que
   * não dá erro. Restringir à própria base é só redundante, e dizer isso evita
   * que alguém ache que mexer aqui mudou algo.
   */
  const conflitoDeBase =
    restrita && ui.dimensao === "base" && baseDoEscopo && valores.length
      ? valores.some((v) => v.trim().toLowerCase() !== baseDoEscopo.trim().toLowerCase())
        ? `Esta documentação está anexada à base ${baseDoEscopo}, e as duas condições valem ao mesmo tempo: com outra base na lista, ela não alcança ninguém. Deixe em "Todos" ou use só ${baseDoEscopo}.`
        : `Redundante: a documentação já é só da base ${baseDoEscopo}. Pode deixar em "Todos" sem mudar o alcance.`
      : null;

  return (
    <div className={cn("rounded-md border bg-surface p-2.5", restrita ? "border-border-strong" : "border-border")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text">{ui.rotulo}</p>
          <p className="text-xs leading-relaxed text-text-muted">{ui.ajuda}</p>
        </div>
        {/*
          INTERRUPTOR explícito, e não "campo vazio = liberado". Campo em branco
          é estado inválido: quem apagou o último valor querendo restringir mais
          teria LIBERADO para todo mundo, sem nada na tela dizendo isso.
        */}
        <Segmented
          value={restrita ? "sim" : "nao"}
          onChange={(v) => onAlternar(v === "sim")}
          options={[
            { value: "nao", label: "Todos" },
            { value: "sim", label: "Restringir" },
          ]}
        />
      </div>

      {restrita && (
        <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
          {valores.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {valores.map((v) => (
                <li key={v}>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs text-text">
                    {v}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 rounded-full [&_svg]:size-3"
                      aria-label={`Remover ${v} de ${ui.rotulo}`}
                      onClick={() => onValores(valores.filter((x) => x !== v))}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {carregando ? (
              <div className="space-y-1.5">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-3 w-40" />
              </div>
            ) : (
              <Select
                id={`${idBase}_sel`}
                value=""
                onChange={adicionar}
                options={opcoes}
                aria-label={`Escolher valor de ${ui.rotulo}`}
                placeholder={opcoes.length ? "Escolher da lista…" : "Nada na lista — digite ao lado"}
                disabled={opcoes.length === 0}
              />
            )}
            <div className="flex items-end gap-1.5">
              <Input
                id={`${idBase}_txt`}
                value={digitado}
                aria-label={`Digitar valor de ${ui.rotulo}`}
                placeholder="ou digite o código…"
                onChange={(e) => setDigitado(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  adicionar(digitado);
                }}
              />
              <Button variant="secondary" onClick={() => adicionar(digitado)} disabled={!digitado.trim()}>
                Adicionar
              </Button>
            </div>
          </div>

          {/*
            De onde vem a lista, sempre dito. "Lista vazia" e "lista
            indisponível" são coisas diferentes para quem configura: a primeira
            manda conferir o cadastro do cliente, a segunda manda liberar uma
            ferramenta ou digitar o código.
          */}
          <ProcedenciaDaLista
            ui={ui}
            lista={lista}
            carregando={carregando}
            baseRef={baseRef}
            vistos={vistos.length}
          />

          {conflitoDeBase && (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{conflitoDeBase}</span>
            </p>
          )}

          {semPresenca && (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {baseDoEscopo
                  ? `Esta base nunca enviou valor para ${ui.rotulo.toLowerCase()}.`
                  : `Nenhuma base enviou valor para ${ui.rotulo.toLowerCase()}.`}{" "}
                {presenca && presenca.conversas === 0
                  ? "Também não há conversa nenhuma registrada aqui, então nada seria esperado ainda."
                  : `Em ${presenca?.conversas ?? 0} conversa(s) registrada(s), nenhuma trouxe esse valor. ` +
                    "Restringir por aqui faz a documentação não alcançar ninguém até o painel passar a enviá-lo."}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** A linha que diz de onde os valores oferecidos vieram — ou por que não vieram. */
function ProcedenciaDaLista({
  ui,
  lista,
  carregando,
  baseRef,
  vistos,
}: {
  ui: DimensaoUI;
  lista: ListaDeValores | undefined;
  carregando: boolean;
  baseRef: string;
  vistos: number;
}) {
  const origem = ui.origem;
  const daConversa = vistos > 0 ? `${vistos} valor(es) já visto(s) nas conversas. ` : "";

  if (origem.tipo === "fixo") {
    return <p className="text-xs text-text-muted">{daConversa}Os três painéis do produto são fixos.</p>;
  }
  if (origem.tipo === "cadastro") {
    return <p className="text-xs text-text-muted">{daConversa}As bases vêm do cadastro de clientes.</p>;
  }
  if (origem.tipo === "digitacao") {
    return (
      <p className="text-xs text-text-muted">
        {daConversa}
        {origem.porque}
      </p>
    );
  }
  if (carregando || lista === undefined) {
    return (
      <p className="text-xs text-text-muted">
        {daConversa}
        {baseRef ? `Consultando ${origem.key} na base ${baseRef}…` : "Escolha um cadastro de referência para a lista."}
      </p>
    );
  }
  if (!lista.ok) {
    // O MOTIVO na tela, não um "falhou". É ele que diz se a saída é liberar uma
    // ferramenta, corrigir o token do painel, ou simplesmente digitar o código.
    return (
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {daConversa}
          {lista.motivo}
        </span>
      </p>
    );
  }
  if (lista.formatoDesconhecido) {
    return (
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {daConversa}
          {`O cadastro de ${ui.rotulo.toLowerCase()} respondeu, mas sem o campo ${origem.campoValor[0]} que esperávamos — o retorno do ERP mudou. Digite o código à mão.`}
        </span>
      </p>
    );
  }
  return (
    <p className="text-xs leading-relaxed text-text-muted">
      {daConversa}
      {lista.total === 0
        ? `O cadastro de ${ui.rotulo.toLowerCase()} da base ${baseRef} está vazio (consultado com o login ${lista.usuario}).`
        : `${lista.valores.length} de ${lista.total} do cadastro da base ${baseRef}, consultado com o login ${lista.usuario}${
            lista.valores.length < lista.total ? " — se o que você quer não está na lista, digite o código" : ""
          }.`}
    </p>
  );
}
