import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { DndContext, useDraggable } from "@dnd-kit/core";

/**
 * Regressão: hidratação quebrada pelos ids do dnd-kit.
 *
 * `useUniqueId` do @dnd-kit/utilities guarda um contador em ESCOPO DE MÓDULO:
 *
 *     const id = ids[prefix] == null ? 0 : ids[prefix] + 1;
 *
 * No servidor o módulo sobrevive entre requisições, então o contador vai
 * subindo; no cliente ele começa do zero. Resultado: o `aria-describedby` de
 * cada alça de arrastar vinha `DndDescribedBy-2` do servidor e
 * `DndDescribedBy-0` no cliente, e o React acusava mismatch.
 *
 * A correção é passar `id` explícito a cada <DndContext>. Estes testes existem
 * para ninguém remover esses ids achando que são decorativos.
 */

function Alca() {
  const { attributes, setNodeRef } = useDraggable({ id: "item" });
  return <button ref={setNodeRef} {...attributes} />;
}

const arvore = (id?: string) => (
  <DndContext id={id}>
    <Alca />
  </DndContext>
);

describe("ids do dnd-kit sob SSR", () => {
  it("SEM id explícito, dois renders divergem — é a causa do mismatch", () => {
    expect(renderToString(arvore())).not.toEqual(renderToString(arvore()));
  });

  it("COM id explícito, renders sucessivos são idênticos", () => {
    const a = renderToString(arvore("dnd-arvore-conteudo"));
    const b = renderToString(arvore("dnd-arvore-conteudo"));
    expect(a).toEqual(b);
  });

  it("o id vira um id de DOM LITERAL, sem prefixo — por isso precisa ser único", () => {
    // Se algum dia o dnd-kit voltar a prefixar, este teste avisa: os nossos
    // ids foram escolhidos assumindo que eles caem crus no atributo.
    expect(renderToString(arvore("dnd-editor-blocos"))).toContain(
      'aria-describedby="dnd-editor-blocos"',
    );
  });
});
