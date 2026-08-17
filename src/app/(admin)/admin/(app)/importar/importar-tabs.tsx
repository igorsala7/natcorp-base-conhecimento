"use client";

import { Tabs, TabPanel, useAbaAtual, type Aba } from "@/components/ui/tabs";
import { abasDaRota } from "@/lib/admin/mapa-rotas";
import { ImportManager, type ImportJobRow } from "./import-manager";
import { EmbeddingsManager, type EmbJobRow } from "./embeddings-manager";
import type { EmbeddingReportRow } from "./embeddings-actions";

/**
 * AS DUAS ABAS DA IMPORTAR — agora com endereço.
 *
 * Eram `useState` com deep-link por `?tab=embeddings`, e isso quebrava em dois
 * pontos ao mesmo tempo. O F5 sempre voltava para "Importar documentos", mesmo
 * para quem estava acompanhando uma indexação; e o `mapa-rotas` declara esta
 * aba como destino do Cmd+K sob a chave `?aba=embeddings` — um parâmetro que a
 * tela não lia. Quem buscava "embeddings" na paleta chegava na tela certa, na
 * aba errada, sem nenhum aviso. É a pior classe de falha de navegação: a pessoa
 * conclui que digitou errado.
 *
 * Um só nome de parâmetro (`aba`) em todo o produto é o que torna o mapa de
 * rotas verificável — ver `mapa-rotas.test.ts`.
 *
 * ── Por que dois componentes e não um ───────────────────────────────────────
 * A barra vive no `<header>` do `PageShell`, junto do título e do seletor de
 * documentação; os painéis vivem no corpo. Ambos leem a aba da URL pelo mesmo
 * `useAbaAtual` com a mesma lista, então nunca discordam.
 */

/**
 * A lista vem do MAPA, não daqui.
 *
 * Manter uma segunda lista neste arquivo é exatamente o que fez o Cmd+K
 * oferecer abas que a barra não tinha. As permissões chegam prontas da rota;
 * `abasDaRota` filtra e monta os endereços com a mesma regra que a paleta usa.
 */
function abasDe(canImport: boolean, canEmbed: boolean): Aba[] {
  const permissoes = new Set<string>();
  if (canImport) permissoes.add("content.import");
  if (canEmbed) permissoes.add("embeddings.reindex");
  return abasDaRota("/admin/importar", permissoes).map((a) => ({ key: a.key, label: a.rotulo }));
}

export function ImportarAbas({ canImport, canEmbed }: { canImport: boolean; canEmbed: boolean }) {
  const abas = abasDe(canImport, canEmbed);
  // Uma aba só não é uma escolha — é ruído. Quem só pode importar não precisa
  // ver uma barra de navegação com um item.
  if (abas.length < 2) return null;
  return <Tabs tabs={abas} aria-label="Áreas da importação" />;
}

export function ImportarPaineis({
  canImport,
  canEmbed,
  spaceId,
  spaceName,
  spaces,
  initialJobs,
  report,
  embJobs,
  initialNodeId,
}: {
  canImport: boolean;
  canEmbed: boolean;
  /** A documentação RESOLVIDA pelo seletor — é para cá que o arquivo vai. */
  spaceId: string;
  /** O nome dela, para a confirmação de envio dizer o destino por extenso. */
  spaceName: string;
  spaces: { id: string; name: string }[];
  initialJobs: ImportJobRow[];
  report: EmbeddingReportRow[];
  embJobs: EmbJobRow[];
  initialNodeId?: string;
}) {
  const abas = abasDe(canImport, canEmbed);
  const atual = useAbaAtual(abas);

  return (
    <>
      {canImport && (
        <TabPanel aba="documentos" atual={atual}>
          <ImportManager spaceId={spaceId} spaceName={spaceName} initialJobs={initialJobs} />
        </TabPanel>
      )}
      {canEmbed && (
        <TabPanel aba="embeddings" atual={atual}>
          <EmbeddingsManager
            initial={report}
            spaces={spaces}
            initialJobs={embJobs}
            // A documentação em jogo é a MESMA do resto da tela: o filtro dos
            // embeddings não pode discordar do destino da importação.
            initialSpaceId={spaceId}
            initialNodeId={initialNodeId}
          />
        </TabPanel>
      )}
    </>
  );
}
