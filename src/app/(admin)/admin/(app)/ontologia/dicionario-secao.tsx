"use client";

import { useState } from "react";
import { ResumoDicionario } from "./resumo-dic";
import { ApexIngest } from "./apex-ingest";
import { CsvIngest } from "./csv-ingest";
import { DbIngest } from "./db-ingest";

/**
 * ESTADO PRIMEIRO, AÇÃO DEPOIS.
 *
 * As três ingestões estavam soltas na página e o que elas produzem não aparecia
 * em lugar nenhum — só num toast de cinco segundos. Quem subia um arquivo não
 * tinha como saber, um minuto depois, se tinha funcionado, se substituíra o lote
 * anterior ou se somara a ele.
 *
 * Juntá-las sob o resumo resolve as duas coisas: o resumo responde "o que tem
 * lá" de forma permanente, e a proximidade deixa claro que as três escrevem no
 * MESMO dicionário, cada uma na sua origem.
 *
 * O contador existe porque o resumo é um componente cliente e as importações são
 * irmãs dele: `revalidatePath` re-renderiza o servidor, mas não faz um estado de
 * cliente já montado buscar de novo.
 */
export function DicionarioSecao({ spaceId }: { spaceId: string }) {
  const [recarga, setRecarga] = useState(0);
  const mudou = () => setRecarga((n) => n + 1);

  return (
    <div className="space-y-6">
      <ResumoDicionario spaceId={spaceId} recarga={recarga} />
      <ApexIngest key={`ingest-${spaceId}`} spaceId={spaceId} onMudou={mudou} />
      <CsvIngest key={`csv-${spaceId}`} spaceId={spaceId} onImportado={mudou} />
      <DbIngest key={`db-${spaceId}`} spaceId={spaceId} />
    </div>
  );
}
