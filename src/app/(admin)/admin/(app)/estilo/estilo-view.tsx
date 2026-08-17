"use client";

import { useState } from "react";
import { Plus, Trash2, Search, Settings2, Play } from "lucide-react";
import { PageShell, Section, Toolbar } from "@/components/ui/page-shell";
import { Tabs, TabPanel, useAbaAtual, type Aba } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Input, controlClass } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonText, SkeletonTable, SkeletonCards, SkeletonList } from "@/components/ui/skeleton";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { ErroDaRota } from "@/components/ui/erro-da-rota";
import { useToast } from "@/components/ui/toast";

const ABAS: Aba[] = [
  { key: "controles", label: "Controles" },
  { key: "estados", label: "Estados" },
  { key: "moldura", label: "Moldura" },
  { key: "tokens", label: "Tokens" },
];

export function EstiloView() {
  const aba = useAbaAtual(ABAS);
  const toast = useToast();
  const [carregando, setCarregando] = useState(false);

  return (
    <PageShell
      titulo="Estilo"
      descricao="Todo primitivo em todos os estados. É a superfície de revisão do sistema de design e o alvo dos snapshots — troque o tema no topo para conferir os dois."
      largura="wide"
      abas={<Tabs tabs={ABAS} aria-label="Áreas do sistema de design" />}
    >
      <TabPanel aba="controles" atual={aba} className="space-y-10">
        <Section titulo="Botão — variantes" descricao="Uma primária por tela. As demais são subordinadas.">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primária</Button>
            <Button variant="secondary">Secundária</Button>
            <Button variant="accent">Acento</Button>
            <Button variant="warning">Aviso</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger">Destrutiva</Button>
          </div>
        </Section>

        <Section titulo="Botão — tamanhos e ícone" descricao="O ícone herda size-4 da base; o call site não escolhe.">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Pequeno</Button>
            <Button size="md">Médio</Button>
            <Button size="lg">Grande</Button>
            <Button size="icon" aria-label="Adicionar">
              <Plus />
            </Button>
            <Button variant="danger" size="icon" aria-label="Excluir">
              <Trash2 />
            </Button>
            <Button>
              <Plus />
              Com ícone
            </Button>
          </div>
        </Section>

        <Section
          titulo="Botão — carregando e desabilitado"
          descricao="loading desabilita, anuncia aria-busy e troca o ícone-líder pelo giro — sem adicionar um segundo, que faria o botão crescer no meio da barra."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button loading>Salvar</Button>
            <Button loading loadingLabel="Publicando…">
              Publicar
            </Button>
            <Button variant="secondary" loading>
              Testar
            </Button>
            <Button disabled>Desabilitada</Button>
            <Button
              onClick={() => {
                setCarregando(true);
                setTimeout(() => setCarregando(false), 1800);
              }}
              loading={carregando}
              loadingLabel="Rodando…"
            >
              <Play />
              Experimentar
            </Button>
          </div>
        </Section>

        <Section titulo="Campo" descricao="Field exige label por tipagem e liga hint e erro por aria-describedby.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="e-nome" hint="Aparece no portal público.">
              <Input id="e-nome" placeholder="Financeiro" />
            </Field>
            <Field label="Slug" htmlFor="e-slug" required error="Já existe uma documentação com este endereço.">
              <Input id="e-slug" defaultValue="financeiro" />
            </Field>
            <Field label="Somente leitura" htmlFor="e-ro">
              <Input id="e-ro" defaultValue="natcorp" readOnly />
            </Field>
            <Field label="Desabilitado" htmlFor="e-dis">
              <Input id="e-dis" defaultValue="—" disabled />
            </Field>
          </div>
          <p className="text-xs text-text-muted">
            Todo campo usa a mesma <code className="rounded bg-surface-2 px-1">controlClass</code>. Cinco telas
            declaravam a sua, e três ficaram com um anel de foco que não existia.
          </p>
        </Section>

        <Section titulo="Selo" descricao="Cor nunca carrega o significado sozinha — o texto diz o estado.">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Neutro</Badge>
            <Badge tone="success">Publicado</Badge>
            <Badge tone="warning">Em revisão</Badge>
            <Badge tone="danger">Erro</Badge>
            <Badge tone="info">Herdado</Badge>
          </div>
        </Section>

        <Section titulo="Aviso" descricao="Feedback efêmero. Erro e aviso não somem sozinhos.">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => toast.success("Artigo publicado.")}>
              Sucesso
            </Button>
            <Button variant="secondary" onClick={() => toast.info("Reindexação enfileirada.")}>
              Informação
            </Button>
            <Button variant="secondary" onClick={() => toast.warning("O worker não está no ar.")}>
              Aviso
            </Button>
            <Button variant="secondary" onClick={() => toast.error("Não foi possível salvar.")}>
              Erro
            </Button>
          </div>
        </Section>
      </TabPanel>

      <TabPanel aba="estados" atual={aba} className="space-y-10">
        <Section
          titulo="Carregando"
          descricao="O esqueleto tem a FORMA do conteúdo que vem. Nunca use em RECARGA de dado já visível — piscar do conteúdo para o cinza e voltar é pior que esperar."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface padding="md">
              <p className="mb-3 text-2xs font-semibold uppercase tracking-wide text-text-muted">Texto</p>
              <SkeletonText lines={4} />
            </Surface>
            <Surface padding="md">
              <p className="mb-3 text-2xs font-semibold uppercase tracking-wide text-text-muted">Árvore / lista</p>
              <SkeletonList rows={6} />
            </Surface>
            <Surface padding="md" className="lg:col-span-2">
              <p className="mb-3 text-2xs font-semibold uppercase tracking-wide text-text-muted">Tabela</p>
              <SkeletonTable rows={4} cols={5} />
            </Surface>
          </div>
          <SkeletonCards count={3} />
        </Section>

        <Section titulo="Vazio" descricao="Estado vazio sem ação é um beco sem saída.">
          <EmptyState
            icon={Search}
            title="Nenhuma conversa neste período"
            description="Ajuste as datas ou remova os filtros de rastreio."
            action={<Button variant="secondary">Limpar filtros</Button>}
          />
        </Section>

        <Section
          titulo="Erro de rota"
          descricao="O digest é o único fio entre 'quebrou pra mim' e a linha do log do servidor — por isso é copiável."
        >
          <Surface padding="none" className="overflow-hidden">
            <ErroDaRota
              error={Object.assign(new Error("Exemplo"), { digest: "3a7f19c2e4b8" })}
              reset={() => toast.info("Aqui o segmento seria remontado.")}
            />
          </Surface>
        </Section>

        <Section titulo="Sem permissão" descricao="Nomeia a permissão que falta e o papel que a concede.">
          <Surface padding="none" className="overflow-hidden">
            <SemPermissao
              titulo="Auditoria"
              oQue="ver o log de auditoria"
              permissao="audit.read"
              papel="Admin técnico"
            />
          </Surface>
        </Section>
      </TabPanel>

      <TabPanel aba="moldura" atual={aba} className="space-y-10">
        <Section
          titulo="Barra de lista"
          descricao="Busca à esquerda, filtros no meio, contagem à direita — em aria-live, porque saber que sobraram 3 de 96 é a informação, não um detalhe."
        >
          <Surface padding="md">
            <Toolbar
              busca={<input className={controlClass} placeholder="Buscar…" aria-label="Buscar" />}
              filtros={
                <Button variant="secondary">
                  <Settings2 />
                  Filtros
                </Button>
              }
              total="12 de 96"
              acoes={
                <Button>
                  <Plus />
                  Novo
                </Button>
              }
            />
          </Surface>
        </Section>

        <Section titulo="Elevação" descricao="Sombra com viés roxo, não cinza puro. No escuro ela fica densa, não difusa.">
          <div className="grid gap-4 sm:grid-cols-3">
            {([0, 1, 2] as const).map((e) => (
              <Surface key={e} elevation={e} padding="md">
                <p className="text-sm font-semibold text-text">Elevação {e}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {e === 0 ? "Repouso, dentro da página" : e === 1 ? "Cartão destacado" : "Flutuante"}
                </p>
              </Surface>
            ))}
          </div>
        </Section>

        <Section titulo="Larguras" descricao="A escolha é pelo TIPO de conteúdo. Eram seis, agora são três.">
          <div className="space-y-2">
            {[
              ["prose", "72ch", "Texto para ler — limitado pela medida de linha, não pela tela."],
              ["page", "max-w-4xl", "Formulário e configuração — campo largo demais custa leitura e mira."],
              ["wide", "max-w-7xl", "Tabela e análise — cortar coluna é pior que rolar."],
            ].map(([k, v, por]) => (
              <div key={k} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-text">{k}</code>
                <span className="text-xs tabular-nums text-text-muted">{v}</span>
                <span className="text-xs text-text-muted">{por}</span>
              </div>
            ))}
          </div>
        </Section>
      </TabPanel>

      <TabPanel aba="tokens" atual={aba} className="space-y-10">
        <Section
          titulo="Escala tipográfica"
          descricao="Fiada no Tailwind com tupla — mapear só o tamanho deixaria o line-height 1.7 do body vazar para todo texto pequeno."
        >
          <div className="space-y-3">
            {[
              ["text-4xl", "Título de página (fluido)"],
              ["text-3xl", "Seção grande"],
              ["text-2xl", "Título de página do admin"],
              ["text-xl", "Subtítulo"],
              ["text-lg", "Destaque"],
              ["text-base", "Corpo"],
              ["text-sm", "Corpo denso — 79% do texto do produto"],
              ["text-xs", "Auxiliar"],
              ["text-2xs", "Micro — absorveu três grafias de 11px"],
            ].map(([c, uso]) => (
              <div key={c} className="flex flex-wrap items-baseline gap-x-4 border-b border-border pb-2">
                <code className="w-24 shrink-0 text-2xs text-text-muted">{c}</code>
                <span className={`${c} text-text`}>Documentação é texto</span>
                <span className="ml-auto text-2xs text-text-muted">{uso}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section titulo="Cor semântica" descricao="Nenhum componente referencia hex. Trocar o tema por cliente depende disso.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["--color-primary", "bg-primary"],
              ["--color-accent", "bg-accent"],
              ["--color-surface", "bg-surface"],
              ["--color-surface-2", "bg-surface-2"],
              ["--color-border", "bg-border"],
              ["--color-border-strong", "bg-border-strong"],
              ["--color-text", "bg-text"],
              ["--color-focus-ring", "bg-ring"],
            ].map(([nome, cls]) => (
              <div key={nome} className="space-y-1.5">
                <div className={`h-12 rounded-md border border-border ${cls}`} />
                <code className="block text-2xs text-text-muted">{nome}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section
          titulo="Cor de estado"
          descricao="Os quatro papéis que faltavam — e cuja ausência produziu 401 cores cruas espalhadas por 60 arquivos."
        >
          {/* Cada tom aparece nos QUATRO usos porque um aviso precisa dos
              quatro, e era a combinação — não a cor — que cada tela improvisava
              de um jeito. Ver os quatro juntos é o que revela a incoerência. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["success", "Concluído", "bg-success", "text-success-on", "bg-success-soft", "text-success", "border-success-line"],
                ["warning", "Atenção", "bg-warning", "text-warning-on", "bg-warning-soft", "text-warning", "border-warning-line"],
                ["danger", "Erro", "bg-danger", "text-danger-on", "bg-danger-soft", "text-danger", "border-danger-line"],
                ["info", "Informação", "bg-info", "text-info-on", "bg-info-soft", "text-info", "border-info-line"],
              ] as const
            ).map(([nome, rotulo, solido, tintaSolida, suave, tinta, linha]) => (
              <div key={nome} className="space-y-2">
                <div
                  className={`flex h-12 items-center justify-center rounded-md text-sm font-semibold ${solido} ${tintaSolida}`}
                >
                  {rotulo}
                </div>
                <div className={`rounded-md border px-3 py-2 text-sm ${suave} ${tinta} ${linha}`}>
                  Fundo suave com borda
                </div>
                <p className={`text-sm ${tinta}`}>Tinta sobre a página</p>
                <code className="block text-2xs text-text-muted">--color-{nome}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section titulo="Foco" descricao="Dois modelos, cada um no seu lugar: anel em controle de formulário, contorno no resto.">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary">Tecle Tab até aqui</Button>
            <input className={controlClass} placeholder="…e depois até aqui" aria-label="Exemplo de foco" />
            <a href="#" className="text-sm text-primary underline">
              E até este link
            </a>
          </div>
        </Section>
      </TabPanel>
    </PageShell>
  );
}
